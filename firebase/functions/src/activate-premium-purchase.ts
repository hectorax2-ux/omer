import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import {
  isPremiumProductId,
  planForProduct,
  PremiumState,
  writePremiumState
} from "./premium/premium-firestore";
import {
  appleStoreSecrets,
  expectedAppleAppAccountToken,
  isAppleConfigured,
  verifyClientTransaction
} from "./premium/apple-store-server";
import {
  acknowledgeGoogleSubscription,
  expectedGoogleAccountId,
  fetchGoogleSubscriptionSnapshot,
  GoogleSubscriptionSnapshot,
  googlePlaySecrets,
  googlePurchaseKey,
  isGooglePlayConfigured,
  writeGoogleSubscription
} from "./premium/google-play-server";

const db = admin.firestore();

// Called by the app right after a successful store purchase. iOS entitlements are
// granted only after cryptographic verification of Apple's StoreKit 2 transaction.
export const activatePremiumPurchase = onCall({ secrets: [...appleStoreSecrets, ...googlePlaySecrets] }, async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Premium satın alma için oturum gerekli.");
  }

  const productId = String(request.data?.productId ?? "");
  const basePlanId = request.data?.basePlanId ? String(request.data.basePlanId) : "";
  const transactionId = String(request.data?.transactionId ?? "");
  const signedTransaction = request.data?.signedTransaction ? String(request.data.signedTransaction) : "";
  const purchaseToken = request.data?.purchaseToken ? String(request.data.purchaseToken) : "";
  const platform = request.data?.platform === "android" ? "android" : "ios";
  const priceText = request.data?.priceText ? String(request.data.priceText) : "";
  const currency = request.data?.currency ? String(request.data.currency) : "";
  const environment = normalizeEnvironment(request.data?.environment);

  if (!isPremiumProductId(productId)) {
    throw new HttpsError("invalid-argument", "Geçersiz premium ürünü.");
  }
  if (!transactionId) {
    throw new HttpsError("invalid-argument", "İşlem kimliği eksik.");
  }
  if (platform === "android" && !purchaseToken) {
    throw new HttpsError("invalid-argument", "Google Play satın alma belirteci eksik.");
  }
  if (platform === "android" && !planForProduct(productId, basePlanId)) {
    throw new HttpsError("invalid-argument", "Geçersiz Google Play base planı.");
  }

  const userRef = db.collection("users").doc(uid);
  if (!(await userRef.get()).exists) {
    throw new HttpsError("not-found", "Kullanıcı profili bulunamadı.");
  }

  const purchaseRef = db.collection("premiumPurchases").doc(platform === "android" ? googlePurchaseKey(purchaseToken) : transactionId);
  const existingPurchase = await purchaseRef.get();
  if (existingPurchase.exists && existingPurchase.get("uid") !== uid) {
    throw new HttpsError("already-exists", "Bu mağaza işlemi daha önce kullanılmış.");
  }
  if (existingPurchase.exists && platform === "ios") {
    return {
      ok: true,
      alreadyProcessed: true,
      verified: existingPurchase.get("verified") === true,
      expiresAt: existingPurchase.get("expiresAt")?.toDate?.()?.toISOString?.()
    };
  }

  const resolved = await resolvePremiumState({ uid, productId, basePlanId, transactionId, purchaseToken, platform, signedTransaction, environment });
  const state = resolved.state;

  await purchaseRef.set({
    uid,
    productId: state.productId,
    basePlanId: state.plan,
    plan: state.plan,
    transactionId,
    originalTransactionId: state.originalTransactionId,
    platform,
    environment,
    source: "store",
    verified: state.verified,
    purchaseTokenHash: platform === "android" ? googlePurchaseKey(purchaseToken) : null,
    priceText,
    currency,
    activatedAt: existingPurchase.exists
      ? existingPurchase.get("activatedAt") ?? admin.firestore.FieldValue.serverTimestamp()
      : admin.firestore.FieldValue.serverTimestamp(),
    lastVerifiedAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt: admin.firestore.Timestamp.fromDate(state.expireDate)
  });

  await writePremiumState(db, uid, state);

  let acknowledged = platform !== "android";
  if (platform === "android" && resolved.googleSnapshot) {
    acknowledged = !resolved.googleSnapshot.acknowledgementPending;
    if (!acknowledged) {
      acknowledged = await acknowledgeGoogleSubscription(productId, purchaseToken)
        .then(() => true)
        .catch((error) => {
          logger.error("Google Play server acknowledgement failed; the client and next sync will retry.", error);
          return false;
        });
    }
    acknowledged = acknowledged || existingPurchase.get("acknowledged") === true;
    await writeGoogleSubscription(db, uid, purchaseToken, resolved.googleSnapshot, acknowledged);
    await purchaseRef.set({ acknowledged }, { merge: true });
  }

  return {
    ok: true,
    alreadyProcessed: existingPurchase.exists,
    verified: state.verified,
    acknowledged,
    expiresAt: state.expireDate.toISOString()
  };
});

async function resolvePremiumState(input: {
  uid: string;
  productId: string;
  basePlanId: string;
  transactionId: string;
  purchaseToken: string;
  platform: "ios" | "android";
  signedTransaction: string;
  environment: string;
}): Promise<{ state: PremiumState; googleSnapshot?: GoogleSubscriptionSnapshot }> {
  if (input.platform === "ios") {
    if (!input.signedTransaction || !isAppleConfigured()) {
      throw new HttpsError("failed-precondition", "Apple satın alma doğrulaması kullanılamıyor.");
    }
    try {
      const verified = await verifyClientTransaction(input.signedTransaction);
      if (verified.productId !== input.productId || verified.transactionId !== input.transactionId) {
        throw new Error("Apple transaction does not match the requested product or transaction.");
      }
      if (verified.appAccountToken !== expectedAppleAppAccountToken(input.uid)) {
        throw new Error("Apple transaction is not linked to the authenticated user.");
      }
      if (verified.expireDate.getTime() <= Date.now()) {
        throw new Error("Apple subscription is already expired.");
      }
      const plan = planForProduct(verified.productId);
      if (!plan) throw new Error("Unknown verified product.");
      return { state: {
        premium: true,
        plan,
        productId: verified.productId,
        platform: "ios",
        purchaseDate: verified.purchaseDate,
        expireDate: verified.expireDate,
        autoRenew: true,
        status: "active",
        originalTransactionId: verified.originalTransactionId,
        verified: true,
        environment: String(verified.environment).toLowerCase()
      } };
    } catch (error) {
      logger.error("Apple transaction verification failed.", error);
      throw new HttpsError("permission-denied", "Apple satın alma işlemi doğrulanamadı.");
    }
  }

  if (!input.purchaseToken || !isGooglePlayConfigured()) {
    throw new HttpsError("failed-precondition", "Google Play satın alma doğrulaması kullanılamıyor.");
  }

  try {
    const verified = await fetchGoogleSubscriptionSnapshot(input.productId, input.purchaseToken, input.basePlanId);
    if (verified.obfuscatedAccountId !== expectedGoogleAccountId(input.uid)) {
      throw new Error("Google Play purchase is not linked to the authenticated user.");
    }
    if (!verified.active) {
      throw new Error(`Google Play subscription is not entitled: ${verified.subscriptionState}.`);
    }
    const plan = planForProduct(verified.productId, verified.basePlanId);
    if (!plan) throw new Error("Unknown verified product.");
    return { state: {
      premium: true,
      plan,
      productId: verified.productId,
      platform: "android",
      purchaseDate: verified.purchaseDate,
      expireDate: verified.expireDate,
      autoRenew: verified.autoRenew,
      status: "active",
      originalTransactionId: null,
      verified: true,
      environment: verified.environment
    }, googleSnapshot: verified };
  } catch (error) {
    logger.error("Google Play purchase verification failed.", error);
    throw new HttpsError("permission-denied", "Google Play satın alma işlemi doğrulanamadı.");
  }

}

function normalizeEnvironment(value: unknown): string {
  if (typeof value !== "string") return "unknown";
  const environment = value.trim().toLowerCase();
  if (environment === "production" || environment === "sandbox" || environment === "xcode") return environment;
  return environment || "unknown";
}
