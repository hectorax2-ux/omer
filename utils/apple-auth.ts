// Added Apple Sign In
import { AppleAuthenticationScope, isAvailableAsync, signInAsync, type AppleAuthenticationCredential } from "expo-apple-authentication";
import { CryptoDigestAlgorithm, digestStringAsync, getRandomBytes } from "expo-crypto";

export type AppleSignInCredentialResult = {
  credential: AppleAuthenticationCredential;
  rawNonce: string;
};

export async function isAppleSignInAvailable() {
  return isAvailableAsync();
}

export async function requestAppleSignInCredential(): Promise<AppleSignInCredentialResult> {
  const rawNonce = createAppleRawNonce();
  return {
    rawNonce,
    credential: await signInAsync({
      nonce: await digestStringAsync(CryptoDigestAlgorithm.SHA256, rawNonce),
      requestedScopes: [
        AppleAuthenticationScope.FULL_NAME,
        AppleAuthenticationScope.EMAIL
      ]
    })
  };
}

export function appleFullName(credential: AppleAuthenticationCredential) {
  return [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(" ").trim();
}

export function isAppleCancelError(error: unknown) {
  const maybeError = error as { code?: string; message?: string };
  const message = maybeError.message ?? "";
  return maybeError.code === "ERR_REQUEST_CANCELED" || message.includes("canceled") || message.includes("cancelled");
}

function createAppleRawNonce() {
  const charset = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz-._";
  return Array.from(getRandomBytes(32))
    .map((byte) => charset[byte % charset.length])
    .join("");
}
