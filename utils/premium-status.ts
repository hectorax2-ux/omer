import type { FirebaseUserProfile } from "@/src/services/firebase";

// Firebase is the single source of truth for premium. This derives the *effective*
// premium state on the client so entitlements switch off the instant a subscription
// lapses, even if a server reconcile job has not yet flipped the stored flags.
//
// Rules:
// - An explicit expired/cancelled status always means "not premium".
// - A past expireDate always means "not premium".
// - Otherwise premium is true only when the canonical flag, active status and
//   future expiry are all present. A badge is presentation metadata, not proof
//   of a paid entitlement.
type PremiumEvaluable = Pick<
  FirebaseUserProfile,
  "premium" | "subscriptionStatus" | "expireDate"
>;

export function isPremiumProfileActive(profile: PremiumEvaluable, now: number = Date.now()): boolean {
  return isPremiumDataActive(profile, now);
}

export function isPremiumDataActive(
  profile: { premium?: unknown; subscriptionStatus?: unknown; expireDate?: unknown; premiumExpiresAt?: unknown },
  now: number = Date.now()
): boolean {
  if (profile.subscriptionStatus !== "active") return false;
  const expireMs = timestampMillis(profile.expireDate ?? profile.premiumExpiresAt);
  return profile.premium === true && expireMs !== null && expireMs > now;
}

function timestampMillis(value: unknown) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (!value || typeof value !== "object") return null;
  const candidate = value as { toMillis?: unknown };
  return typeof candidate.toMillis === "function" ? candidate.toMillis() as number : null;
}
