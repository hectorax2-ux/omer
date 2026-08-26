import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import {
  findUidByOriginalTransactionId,
  planForProduct,
  PremiumState,
  SubscriptionStatus,
  writePremiumState
} from "./premium/premium-firestore";
import {
  appleStoreSecrets,
  DecodedAppleNotification,
  decodeNotification,
  isAppleConfigured
} from "./premium/apple-store-server";

const db = admin.firestore();

// App Store Server Notifications V2 endpoint. Apple calls this for every subscription
// lifecycle event (renew, auto-renew change, cancel, refund, expiry, billing retry,
// reactivation), keeping Firebase automatically in sync with Apple with zero manual
// intervention. Register this URL in App Store Connect > App > App Information >
// App Store Server Notifications (Production + Sandbox).
export const appStoreServerNotifications = onRequest(
  { cors: false, secrets: appleStoreSecrets },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).send("Method Not Allowed");
      return;
    }
    if (!isAppleConfigured()) {
      logger.error("App Store notification received but Apple verification is not configured.");
      res.status(500).send("Not configured");
      return;
    }

    const signedPayload = typeof req.body?.signedPayload === "string" ? req.body.signedPayload : "";
    if (!signedPayload) {
      res.status(400).send("Missing signedPayload");
      return;
    }

    let notification: DecodedAppleNotification;
    try {
      notification = await decodeNotification(signedPayload);
    } catch (error) {
      logger.error("Failed to verify App Store notification.", error);
      res.status(400).send("Invalid signature");
      return;
    }

    const originalTransactionId = notification.transaction?.originalTransactionId;
    if (!originalTransactionId) {
      logger.warn("Notification without originalTransactionId.", { type: notification.notificationType });
      res.status(200).send("Ignored");
      return;
    }

    try {
      const uid = await findUidByOriginalTransactionId(db, originalTransactionId);
      if (!uid) {
        logger.warn("No user mapped to Apple subscription.", { originalTransactionId });
        res.status(200).send("Unmapped");
        return;
      }
      await writePremiumState(db, uid, buildStateFromNotification(uid, notification, originalTransactionId));
      logger.info("Premium synced from Apple notification.", {
        uid,
        type: notification.notificationType,
        subtype: notification.subtype
      });
      res.status(200).send("OK");
    } catch (error) {
      logger.error("Failed to apply App Store notification.", error);
      res.status(500).send("Processing error");
    }
  }
);

function buildStateFromNotification(
  uid: string,
  notification: DecodedAppleNotification,
  originalTransactionId: string
): PremiumState {
  const transaction = notification.transaction;
  const productId = transaction?.productId ?? null;
  const plan = productId ? planForProduct(productId) : null;
  const purchaseDate = transaction?.purchaseDate ? new Date(transaction.purchaseDate) : new Date();
  const expireDate = transaction?.expiresDate ? new Date(transaction.expiresDate) : new Date();

  const lifecycle = resolveLifecycle(
    notification.notificationType,
    notification.subtype,
    expireDate,
    notification.renewalInfo?.autoRenewStatus === 1
  );

  return {
    premium: lifecycle.premium,
    plan,
    productId,
    platform: "ios",
    purchaseDate,
    expireDate,
    autoRenew: lifecycle.autoRenew,
    status: lifecycle.status,
    originalTransactionId,
    verified: true
  };
}

// Maps Apple notificationType/subtype to our canonical lifecycle. Entitlement stays
// on until the verified expiry for billing retries and grace periods, and turns off
// immediately on refund/revoke/expiry.
function resolveLifecycle(
  type: string,
  subtype: string | undefined,
  expireDate: Date,
  autoRenewFromApple: boolean
): { status: SubscriptionStatus; premium: boolean; autoRenew: boolean } {
  const notExpired = expireDate.getTime() > Date.now();

  switch (type) {
    case "REFUND":
    case "REVOKE":
      return { status: "cancelled", premium: false, autoRenew: false };
    case "EXPIRED":
    case "GRACE_PERIOD_EXPIRED":
      return { status: "expired", premium: false, autoRenew: false };
    case "DID_CHANGE_RENEWAL_STATUS":
      return {
        status: notExpired ? "active" : "expired",
        premium: notExpired,
        autoRenew: subtype !== "AUTO_RENEW_DISABLED"
      };
    case "DID_FAIL_TO_RENEW":
      // Billing retry / grace period: keep access until the verified expiry.
      return { status: notExpired ? "active" : "expired", premium: notExpired, autoRenew: autoRenewFromApple };
    case "SUBSCRIBED":
    case "DID_RENEW":
    case "OFFER_REDEEMED":
    case "DID_CHANGE_RENEWAL_PREF":
    case "RENEWAL_EXTENDED":
    case "PRICE_INCREASE":
    default:
      return { status: notExpired ? "active" : "expired", premium: notExpired, autoRenew: autoRenewFromApple };
  }
}
