import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import {
  GOOGLE_PREMIUM_PRODUCT_ID,
  planForProduct,
  PremiumPlan,
  PremiumState,
  SubscriptionStatus,
  writePremiumState
} from "./premium/premium-firestore";
import { appleStoreSecrets, fetchSubscriptionSnapshot, isAppleApiConfigured } from "./premium/apple-store-server";
import {
  acknowledgeGoogleSubscription,
  expectedGoogleAccountId,
  fetchGoogleSubscriptionSnapshot,
  googlePlaySecrets,
  isGooglePlayConfigured,
  readGoogleSubscriptionToken,
  writeGoogleSubscription
} from "./premium/google-play-server";

const db = admin.firestore();

// Called on every authenticated app launch. Reconciles the caller's premium document
// with the platform store when configured and, at minimum, flips a lapsed subscription
// to expired locally. This guarantees entitlements never outlive the paid period.
export const syncPremiumStatus = onCall({ secrets: [...appleStoreSecrets, ...googlePlaySecrets] }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Premium senkronu için oturum gerekli.");
  }

  const userRef = db.collection("users").doc(uid);
  const snap = await userRef.get();
  if (!snap.exists) {
    return { ok: true, premium: false };
  }

  const current = readPremiumFields(snap.data() ?? {});
  if (!current.premium && current.status !== "active") {
    return { ok: true, premium: false, subscriptionStatus: current.status ?? undefined };
  }

  // Android entitlements created by the old client-trusting path were never
  // verified by Google. Revoke them before doing any other reconciliation.
  if (current.platform === "android" && !current.verified) {
    await writePremiumState(db, uid, {
      premium: false,
      plan: current.plan,
      productId: current.productId,
      platform: "android",
      purchaseDate: current.purchaseDate ?? new Date(),
      expireDate: current.expireDate ?? new Date(),
      autoRenew: false,
      status: "cancelled",
      originalTransactionId: null,
      verified: false
    });
    return { ok: true, premium: false, subscriptionStatus: "cancelled", changed: true };
  }

  if (current.platform === "android" && current.verified && isGooglePlayConfigured()) {
    const purchaseToken = await readGoogleSubscriptionToken(db, uid);
    if (purchaseToken) {
      const snapshot = await fetchGoogleSubscriptionSnapshot(
        current.productId ?? GOOGLE_PREMIUM_PRODUCT_ID,
        purchaseToken
      ).catch((error) => {
        logger.error("Google Play subscription reconcile failed.", error);
        return null;
      });
      if (snapshot && snapshot.obfuscatedAccountId === expectedGoogleAccountId(uid)) {
        const active = snapshot.active;
        const state: PremiumState = {
          premium: active,
          plan: planForProduct(snapshot.productId, snapshot.basePlanId),
          productId: snapshot.productId,
          platform: "android",
          purchaseDate: snapshot.purchaseDate,
          expireDate: snapshot.expireDate,
          autoRenew: snapshot.autoRenew,
          status: active
            ? "active"
            : snapshot.expireDate.getTime() <= Date.now() || snapshot.subscriptionState === "SUBSCRIPTION_STATE_EXPIRED"
              ? "expired"
              : "cancelled",
          originalTransactionId: null,
          verified: true,
          environment: snapshot.environment
        };
        await writePremiumState(db, uid, state);
        let acknowledged = !snapshot.acknowledgementPending;
        if (active && !acknowledged) {
          acknowledged = await acknowledgeGoogleSubscription(snapshot.productId, purchaseToken)
            .then(() => true)
            .catch((error) => {
              logger.error("Google Play acknowledgement retry failed.", error);
              return false;
            });
        }
        await writeGoogleSubscription(db, uid, purchaseToken, snapshot, acknowledged);
        return { ok: true, premium: active, subscriptionStatus: state.status, changed: true };
      }
    }
  }

  // Preferred: authoritative reconcile against the App Store Server API.
  if (isAppleApiConfigured() && current.originalTransactionId) {
    const snapshot = await fetchSubscriptionSnapshot(current.originalTransactionId).catch((error) => {
      logger.error("App Store Server API reconcile failed.", error);
      return null;
    });
    if (snapshot) {
      const active = snapshot.active && snapshot.expireDate.getTime() > Date.now();
      const state: PremiumState = {
        premium: active,
        plan: planForProduct(snapshot.productId),
        productId: snapshot.productId,
        platform: "ios",
        purchaseDate: snapshot.purchaseDate,
        expireDate: snapshot.expireDate,
        autoRenew: snapshot.autoRenew,
        status: active ? "active" : "expired",
        originalTransactionId: snapshot.originalTransactionId,
        verified: true
      };
      await writePremiumState(db, uid, state);
      return { ok: true, premium: active, subscriptionStatus: state.status, changed: true };
    }
  }

  // Fallback: local expiry check.
  const expired = current.expireDate ? current.expireDate.getTime() <= Date.now() : false;
  if (expired && (current.premium || current.status === "active")) {
    await writePremiumState(db, uid, {
      premium: false,
      plan: current.plan,
      productId: current.productId,
      platform: current.platform,
      purchaseDate: current.purchaseDate ?? new Date(),
      expireDate: current.expireDate ?? new Date(),
      autoRenew: false,
      status: "expired",
      originalTransactionId: current.originalTransactionId,
      verified: current.verified
    });
    return { ok: true, premium: false, subscriptionStatus: "expired", changed: true };
  }

  return { ok: true, premium: current.premium, subscriptionStatus: current.status ?? undefined };
});

// Safety net for users who never re-open the app: flip subscriptions whose verified
// expiry has passed or were created by the old unverified Android path. The
// corresponding composite indexes live in firebase/firestore.indexes.json.
export const expirePremiumSubscriptions = onSchedule(
  { schedule: "30 3 * * *", timeZone: "Europe/Istanbul" },
  async () => {
    const now = admin.firestore.Timestamp.now();
    const [lapsed, unverifiedAndroid] = await Promise.all([
      db
        .collection("users")
        .where("premium", "==", true)
        .where("expireDate", "<=", now)
        .limit(400)
        .get(),
      db
        .collection("users")
        .where("premium", "==", true)
        .where("purchasePlatform", "==", "android")
        .where("premiumVerified", "==", false)
        .limit(400)
        .get()
    ]);

    const revoked = new Map([...lapsed.docs, ...unverifiedAndroid.docs].map((item) => [item.id, item]));
    if (!revoked.size) return;

    const batch = db.batch();
    revoked.forEach((doc) => {
      batch.set(
        doc.ref,
        {
          premium: false,
          isPremium: false,
          subscriptionStatus: "expired",
          autoRenew: false,
          badges: admin.firestore.FieldValue.arrayRemove("premium"),
          adminBadges: admin.firestore.FieldValue.arrayRemove("premium"),
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        },
        { merge: true }
      );
    });
    await batch.commit();
    logger.info("Expired or revoked premium subscriptions.", { count: revoked.size });
  }
);

type CurrentPremium = {
  premium: boolean;
  status: SubscriptionStatus | null;
  plan: PremiumPlan | null;
  productId: string | null;
  platform: "ios" | "android";
  purchaseDate: Date | null;
  expireDate: Date | null;
  autoRenew: boolean;
  originalTransactionId: string | null;
  verified: boolean;
};

function readPremiumFields(data: admin.firestore.DocumentData): CurrentPremium {
  const status = data.subscriptionStatus;
  const plan = data.premiumPlan;
  const expire = data.expireDate ?? data.premiumExpiresAt;
  const purchase = data.purchaseDate ?? data.premiumActivatedAt;
  return {
    premium: data.premium === true || data.isPremium === true,
    status: status === "active" || status === "expired" || status === "cancelled" ? status : null,
    plan: plan === "monthly" || plan === "quarterly" || plan === "yearly" ? plan : null,
    productId: typeof data.premiumProductId === "string" ? data.premiumProductId : null,
    platform: data.purchasePlatform === "android" || data.premiumPlatform === "android" ? "android" : "ios",
    purchaseDate: purchase instanceof admin.firestore.Timestamp ? purchase.toDate() : null,
    expireDate: expire instanceof admin.firestore.Timestamp ? expire.toDate() : null,
    autoRenew: data.autoRenew === true,
    originalTransactionId: typeof data.premiumOriginalTransactionId === "string" ? data.premiumOriginalTransactionId : null,
    verified: data.premiumVerified === true
  };
}
