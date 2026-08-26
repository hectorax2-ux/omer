import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { isActivePremium } from "./premium/premium-access";
import { syncPremiumContentForUser } from "./premium/premium-content-sync";
import { writePremiumState } from "./premium/premium-firestore";

const db = admin.firestore();
const MANUAL_PREMIUM_PRODUCT_ID = "admin_grant";
const MANUAL_PREMIUM_DURATION_MS = 365 * 24 * 60 * 60 * 1000;

export const setManualPremium = onCall(async (request) => {
  const adminUid = request.auth?.uid;
  if (!adminUid) throw new HttpsError("unauthenticated", "Admin oturumu gerekli.");
  if (request.auth?.token.email_verified !== true) {
    throw new HttpsError("failed-precondition", "Doğrulanmış admin hesabı gerekli.");
  }

  const adminProfile = await db.collection("users").doc(adminUid).get();
  if (!adminProfile.exists || adminProfile.get("role") !== "admin") {
    throw new HttpsError("permission-denied", "Bu işlem yalnızca admin tarafından yapılabilir.");
  }

  const uid = typeof request.data?.uid === "string" ? request.data.uid.trim() : "";
  const active = request.data?.active;
  if (!uid || typeof active !== "boolean") {
    throw new HttpsError("invalid-argument", "uid ve active alanları zorunludur.");
  }

  const target = await db.collection("users").doc(uid).get();
  if (!target.exists) throw new HttpsError("not-found", "Kullanıcı bulunamadı.");
  const current = target.data() ?? {};
  const currentActive = isActivePremium(current);
  const manual = current.purchasePlatform === "admin"
    || current.premiumPlatform === "admin"
    || current.premiumSource === "admin"
    || current.premiumProductId === MANUAL_PREMIUM_PRODUCT_ID;

  // Removing an admin badge must never cancel a valid App Store/Google Play
  // entitlement. Store verification remains authoritative for paid users.
  if (!active && currentActive && !manual) {
    return { ok: true, premium: true, changed: false, source: "store", preservedStoreEntitlement: true };
  }
  if (active && currentActive && !manual) {
    return { ok: true, premium: true, changed: false, source: "store" };
  }

  const now = new Date();
  await writePremiumState(db, uid, {
    premium: active,
    plan: null,
    productId: MANUAL_PREMIUM_PRODUCT_ID,
    platform: "admin",
    purchaseDate: now,
    expireDate: active ? new Date(now.getTime() + MANUAL_PREMIUM_DURATION_MS) : now,
    autoRenew: false,
    status: active ? "active" : "cancelled",
    originalTransactionId: null,
    verified: true,
    source: "admin",
    environment: "admin"
  });
  const updatedContentCount = await syncPremiumContentForUser(uid, active);
  return { ok: true, premium: active, changed: currentActive !== active, source: "admin", updatedContentCount };
});
