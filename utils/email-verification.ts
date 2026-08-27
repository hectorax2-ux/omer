import type { User } from "firebase/auth";

const verifiedSocialProviders = new Set(["google.com", "apple.com"]);

export function isEmailVerifiedForApp(user: User | null | undefined) {
  if (!user) return false;
  if (user.emailVerified) return true;
  return user.providerData.some((provider) => verifiedSocialProviders.has(provider.providerId));
}

export function hasVerifiedSocialProvider(user: User | null | undefined) {
  if (!user) return false;
  return user.providerData.some((provider) => verifiedSocialProviders.has(provider.providerId));
}
