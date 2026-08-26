import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { isActivePremium } from "./premium-access";
import { writePremiumState } from "./premium-firestore";

const db = admin.firestore();
const MANUAL_PREMIUM_PRODUCT_ID = "admin_grant";
const MANUAL_PREMIUM_DURATION_MS = 365 * 24 * 60 * 60 * 1000;

const premiumContentCollections = [
  { name: "posts", ownerField: "authorId" },
  { name: "postComments", ownerField: "authorId" },
  { name: "communityImages", ownerField: "ownerId" },
  { name: "communityImageComments", ownerField: "authorId" },
  { name: "artStories", ownerField: "authorId" }
] as const;

export async function syncPremiumContentForUser(uid: string, premium: boolean) {
  const snapshots = await Promise.all(
    premiumContentCollections.map((item) => db.collection(item.name).where(item.ownerField, "==", uid).get())
  );
  const refs = snapshots.flatMap((snapshot) => snapshot.docs)
    .filter((document) => document.get("isPremium") !== premium)
    .map((document) => document.ref);

  for (let start = 0; start < refs.length; start += 450) {
    const batch = db.batch();
    refs.slice(start, start + 450).forEach((ref) => batch.set(ref, {
      isPremium: premium,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true }));
    await batch.commit();
  }

  return refs.length;
}

export const syncPremiumContentOnUserChange = onDocumentWritten("users/{uid}", async (event) => {
  const after = event.data?.after;
  if (!after?.exists) return;

  const data = after.data() ?? {};
  const uid = event.params.uid;
  const hasAdminPremiumBadge = Array.isArray(data.adminBadges) && data.adminBadges.includes("premium");
  const active = isActivePremium(data);
  const manual = data.purchasePlatform === "admin"
    || data.premiumPlatform === "admin"
    || data.premiumSource === "admin"
    || data.premiumProductId === MANUAL_PREMIUM_PRODUCT_ID;

  // Backward compatibility: older admin-panel builds only wrote the protected
  // admin badge. Since clients cannot write adminBadges, it is safe to turn that
  // legacy admin action into a canonical, server-verified manual entitlement.
  if (hasAdminPremiumBadge && !active) {
    const now = new Date();
    await writePremiumState(db, uid, {
      premium: true,
      plan: null,
      productId: MANUAL_PREMIUM_PRODUCT_ID,
      platform: "admin",
      purchaseDate: now,
      expireDate: new Date(now.getTime() + MANUAL_PREMIUM_DURATION_MS),
      autoRenew: false,
      status: "active",
      originalTransactionId: null,
      verified: true,
      source: "admin",
      environment: "admin"
    });
    const updated = await syncPremiumContentForUser(uid, true);
    logger.info("Legacy admin premium normalized.", { uid, updated });
    return;
  }

  if (!hasAdminPremiumBadge && active && manual) {
    const now = new Date();
    await writePremiumState(db, uid, {
      premium: false,
      plan: null,
      productId: MANUAL_PREMIUM_PRODUCT_ID,
      platform: "admin",
      purchaseDate: now,
      expireDate: now,
      autoRenew: false,
      status: "cancelled",
      originalTransactionId: null,
      verified: true,
      source: "admin",
      environment: "admin"
    });
    const updated = await syncPremiumContentForUser(uid, false);
    logger.info("Manual premium removed and content normalized.", { uid, updated });
    return;
  }

  const before = event.data?.before;
  const wasActive = before?.exists ? isActivePremium(before.data() ?? {}) : false;
  if (wasActive === active) return;
  const updated = await syncPremiumContentForUser(uid, active);
  logger.info("Premium content metadata synchronized.", { uid, active, updated });
});

async function normalizeContentPremium(
  snapshot: admin.firestore.DocumentSnapshot | undefined,
  ownerField: "authorId" | "ownerId"
) {
  if (!snapshot?.exists) return;
  const uid = snapshot.get(ownerField);
  if (typeof uid !== "string" || !uid) return;
  const user = await db.collection("users").doc(uid).get();
  if (!user.exists) return;
  const premium = isActivePremium(user.data() ?? {});
  if (snapshot.get("isPremium") === premium) return;
  await snapshot.ref.set({
    isPremium: premium,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

export const normalizePostPremium = onDocumentWritten("posts/{documentId}", (event) =>
  normalizeContentPremium(event.data?.after, "authorId"));

export const normalizePostCommentPremium = onDocumentWritten("postComments/{documentId}", (event) =>
  normalizeContentPremium(event.data?.after, "authorId"));

export const normalizeCommunityImagePremium = onDocumentWritten("communityImages/{documentId}", (event) =>
  normalizeContentPremium(event.data?.after, "ownerId"));

export const normalizeCommunityImageCommentPremium = onDocumentWritten("communityImageComments/{documentId}", (event) =>
  normalizeContentPremium(event.data?.after, "authorId"));

export const normalizeArtStoryPremium = onDocumentWritten("artStories/{documentId}", (event) =>
  normalizeContentPremium(event.data?.after, "authorId"));
