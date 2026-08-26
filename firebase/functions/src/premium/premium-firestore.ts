import * as admin from "firebase-admin";

// Central premium plan vocabulary. Kept in lockstep with the client constants file
// (constants/premiumProducts.ts). Firebase is the single source of truth, so every
// write to a user's premium state must flow through writePremiumState below.

export type PremiumPlan = "monthly" | "quarterly" | "yearly";
export type SubscriptionStatus = "active" | "expired" | "cancelled";

export const PREMIUM_PRODUCT_IDS = [
  "com.artatlas.app.premium.monthly",
  "com.artatlas.app.premium.quarterly",
  "com.artatlas.app.premium.yearly"
] as const;

export const GOOGLE_PREMIUM_PRODUCT_ID = "art_atlas_premium";

const PRODUCT_PLAN: Record<string, PremiumPlan> = {
  "com.artatlas.app.premium.monthly": "monthly",
  "com.artatlas.app.premium.quarterly": "quarterly",
  "com.artatlas.app.premium.yearly": "yearly"
};

const PLAN_MONTHS: Record<PremiumPlan, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12
};

export function isPremiumProductId(value: string): boolean {
  return value in PRODUCT_PLAN || value === GOOGLE_PREMIUM_PRODUCT_ID;
}

export function planForProduct(productId: string, basePlanId?: string | null): PremiumPlan | null {
  if (productId === GOOGLE_PREMIUM_PRODUCT_ID) {
    return basePlanId === "monthly" || basePlanId === "quarterly" || basePlanId === "yearly"
      ? basePlanId
      : null;
  }
  return PRODUCT_PLAN[productId] ?? null;
}

export function monthsForPlan(plan: PremiumPlan): number {
  return PLAN_MONTHS[plan];
}

export function addMonths(base: Date, months: number): Date {
  const next = new Date(base);
  next.setMonth(next.getMonth() + months);
  return next;
}

export type PremiumState = {
  premium: boolean;
  plan: PremiumPlan | null;
  productId: string | null;
  platform: "ios" | "android" | "admin";
  purchaseDate: Date;
  expireDate: Date;
  autoRenew: boolean;
  status: SubscriptionStatus;
  originalTransactionId: string | null;
  verified: boolean;
  source?: "store" | "admin";
  environment?: string | null;
};

// Writes the canonical premium fields required by the product spec, keeps the legacy
// fields the current app still reads in sync, and mirrors the "premium" badge. Using
// merge:true means unrelated profile fields are never disturbed.
export async function writePremiumState(
  db: admin.firestore.Firestore,
  uid: string,
  state: PremiumState
): Promise<void> {
  const badgeOp = state.premium
    ? admin.firestore.FieldValue.arrayUnion("premium")
    : admin.firestore.FieldValue.arrayRemove("premium");

  const update: admin.firestore.DocumentData = {
    // Canonical source-of-truth fields (product spec).
    premium: state.premium,
    premiumPlan: state.plan,
    purchasePlatform: state.platform,
    purchaseDate: admin.firestore.Timestamp.fromDate(state.purchaseDate),
    expireDate: admin.firestore.Timestamp.fromDate(state.expireDate),
    autoRenew: state.autoRenew,
    subscriptionStatus: state.status,
    premiumOriginalTransactionId: state.originalTransactionId,
    premiumEnvironment: state.environment ?? null,
    // Legacy fields kept for backward compatibility with existing readers/admin.
    isPremium: state.premium,
    premiumPlatform: state.platform,
    premiumProductId: state.productId,
    premiumActivatedAt: admin.firestore.Timestamp.fromDate(state.purchaseDate),
    premiumExpiresAt: admin.firestore.Timestamp.fromDate(state.expireDate),
    premiumVerified: state.verified,
    premiumSource: state.source ?? (state.platform === "admin" ? "admin" : "store"),
    badges: badgeOp,
    adminBadges: badgeOp,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  const batch = db.batch();
  batch.set(db.collection("users").doc(uid), update, { merge: true });

  // Link the Apple originalTransactionId -> uid so App Store Server Notifications can
  // resolve the owner without scanning the users collection.
  if (state.originalTransactionId) {
    batch.set(
      db.collection("appleSubscriptions").doc(state.originalTransactionId),
      {
        uid,
        productId: state.productId,
        plan: state.plan,
        status: state.status,
        environment: state.environment ?? null,
        autoRenew: state.autoRenew,
        expireDate: admin.firestore.Timestamp.fromDate(state.expireDate),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }

  await batch.commit();
}

export async function findUidByOriginalTransactionId(
  db: admin.firestore.Firestore,
  originalTransactionId: string
): Promise<string | null> {
  const mapping = await db.collection("appleSubscriptions").doc(originalTransactionId).get();
  const mappedUid = mapping.get("uid");
  if (typeof mappedUid === "string" && mappedUid) return mappedUid;

  // Fallback: locate by the field stored on the user document.
  const bySnapshot = await db
    .collection("users")
    .where("premiumOriginalTransactionId", "==", originalTransactionId)
    .limit(1)
    .get();
  return bySnapshot.empty ? null : bySnapshot.docs[0].id;
}
