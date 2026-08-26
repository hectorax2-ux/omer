import * as admin from "firebase-admin";

export function isActivePremium(data: admin.firestore.DocumentData | Record<string, unknown>) {
  if (data.premium !== true || data.subscriptionStatus !== "active") return false;
  const expiresAt = data.expireDate ?? data.premiumExpiresAt;
  const expiresAtMs = expiresAt instanceof admin.firestore.Timestamp
    ? expiresAt.toMillis()
    : expiresAt instanceof Date
      ? expiresAt.getTime()
      : typeof expiresAt === "number"
        ? expiresAt
        : 0;
  return expiresAtMs > Date.now();
}
