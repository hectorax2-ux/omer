import {
  AppStoreServerAPIClient,
  Environment,
  SignedDataVerifier,
  Status,
  type JWSRenewalInfoDecodedPayload,
  type JWSTransactionDecodedPayload,
  type ResponseBodyV2DecodedPayload
} from "@apple/app-store-server-library";
import { createHash } from "crypto";
import { defineSecret } from "firebase-functions/params";

const APPLE_BUNDLE_ID = "com.artatlas.app";
const APPLE_APP_ID = 6792671640;
const APPLE_ROOT_CA_G2_BASE64 = "MIIFkjCCA3qgAwIBAgIIAeDltYNno+AwDQYJKoZIhvcNAQEMBQAwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEcyMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxMDA5WhcNMzkwNDMwMTgxMDA5WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzIxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBANgREkhI2imKScUcx+xuM23+TfvgHN6sXuI2pyT5f1BrTM65MFQn5bPW7SXmMLYFN14UIhHF6Kob0vuy0gmVOKTvKkmMXT5xZgM4+xb1hYjkWpIMBDLyyED7Ul+f9sDx47pFoFDVEovy3d6RhiPw9bZyLgHaC/YuOQhfGaFjQQscp5TBhsRTL3b2CtcM0YM/GlMZ81fVJ3/8E7j4ko380yhDPLVoACVdJ2LT3VXdRCCQgzWTxb+4Gftr49wIQuavbfqeQMpOhYV4SbHXw8EwOTKrfl+q04tvny0aIWhwZ7Oj8ZhBbZF8+NfbqOdfIRqMM78xdLe40fTgIvS/cjTf94FNcX1RoeKz8NMoFnNvzcytN31O661A4T+B/fc9Cj6i8b0xlilZ3MIZgIxbdMYs0xBTJh0UT8TUgWY8h2czJxQI6bR3hDRSj4n4aJgXv8O7qhOTH11UL6jHfPsNFL4VPSQ08prcdUFmIrQB1guvkJ4M6mL4m1k8COKWNORj3rw31OsMiANDC1CvoDTdUE0V+1ok2Az6DGOeHwOx4e7hqkP0ZmUoNwIx7wHHHtHMn23KVDpA287PT0aLSmWaasZobNfMmRtHsHLDd4/E92GcdB/O/WuhwpyUgquUoue9G7q5cDmVF8Up8zlYNPXEpMZ7YLlmQ1A/bmH8DvmGqmAMQ0uVAgMBAAGjQjBAMB0GA1UdDgQWBBTEmRNsGAPCe8CjoA1/coB6HHcmjTAPBgNVHRMBAf8EBTADAQH/MA4GA1UdDwEB/wQEAwIBBjANBgkqhkiG9w0BAQwFAAOCAgEAUabz4vS4PZO/Lc4Pu1vhVRROTtHlznldgX/+tvCHM/jvlOV+3Gp5pxy+8JS3ptEwnMgNCnWefZKVfhidfsJxaXwU6s+DDuQUQp50DhDNqxq6EWGBeNjxtUVAeKuowM77fWM3aPbn+6/Gw0vsHzYmE1SGlHKy6gLti23kDKaQwFd1z4xCfVzmMX3zybKSaUYOiPjjLUKyOKimGY3xn83uamW8GrAlvacp/fQ+onVJv57byfenHmOZ4VxG/5IFjPoeIPmGlFYl5bRXOJ3riGQUIUkhOb9iZqmxospvPyFgxYnURTbImHy99v6ZSYA7LNKmp4gDBDEZt7Y6YUX6yfIjyGNzv1aJMbDZfGKnexWoiIqrOEDCzBL/FePwN983csvMmOa/orz6JopxVtfnJBtIRD6e/J/JzBrsQzwBvDR4yGn1xuZW7AYJNpDrFEobXsmII9oDMJELuDY++ee1KG++P+w8j2Ud5cAeh6Squpj9kuNsJnfdBrRkBof0Tta6SqoWqPQFZ2aWuuJVecMsXUmPgEkrihLHdoBR37q9ZV0+N0djMenl9MU/S60EinpxLK8JQzcPqOMyT/RFtm2XNuyE9QoB6he7hY1Ck3DDUOUUi78/w0EP3SIEIwiKum1xRKtzCTrJ+VKACd+66eYWyi4uTLLT3OUEVLLUNIAytbwPF+E=";
const APPLE_ROOT_CA_G3_BASE64 = "MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwSQXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcNMTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBSb290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtfTjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySrMA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gAMGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM6BgD56KyKA==";

export const appleIssuerId = defineSecret("APPLE_ISSUER_ID");
export const appleKeyId = defineSecret("APPLE_KEY_ID");
export const applePrivateKey = defineSecret("APPLE_PRIVATE_KEY");
export const appleStoreSecrets = [appleIssuerId, appleKeyId, applePrivateKey];

// Apple App Store Server integration (App Store Server API + Notifications V2).
//
// Private App Store Connect credentials stay in Firebase Secret Manager. Apple's
// public root certificates and this app's public identifiers are safe to bundle here.

export type AppleTransactionInfo = {
  productId: string;
  originalTransactionId: string;
  transactionId: string;
  purchaseDate: Date;
  expireDate: Date;
  environment: Environment;
  appAccountToken: string | null;
};

export type AppleSubscriptionSnapshot = AppleTransactionInfo & {
  autoRenew: boolean;
  active: boolean;
};

export type DecodedAppleNotification = {
  notificationType: string;
  subtype?: string;
  environment: Environment;
  transaction?: JWSTransactionDecodedPayload;
  renewalInfo?: JWSRenewalInfoDecodedPayload;
};

function env(name: string): string {
  return (process.env[name] ?? "").trim();
}

export function isAppleConfigured(): boolean {
  return loadRootCertificates().length > 0;
}

export function isAppleApiConfigured(): boolean {
  return (
    isAppleConfigured() &&
    Boolean(env("APPLE_ISSUER_ID")) &&
    Boolean(env("APPLE_KEY_ID")) &&
    Boolean(env("APPLE_PRIVATE_KEY"))
  );
}

function bundleId(): string {
  return APPLE_BUNDLE_ID;
}

function appAppleId(): number | undefined {
  return APPLE_APP_ID;
}

function configuredEnvironment(): Environment {
  return env("APPLE_ENVIRONMENT").toLowerCase() === "sandbox" ? Environment.SANDBOX : Environment.PRODUCTION;
}

let rootCertsCache: Buffer[] | null = null;
function loadRootCertificates(): Buffer[] {
  if (rootCertsCache) return rootCertsCache;
  rootCertsCache = [APPLE_ROOT_CA_G2_BASE64, APPLE_ROOT_CA_G3_BASE64].map((entry) => Buffer.from(entry, "base64"));
  return rootCertsCache;
}

const verifierCache = new Map<Environment, SignedDataVerifier>();
function getVerifier(environment: Environment): SignedDataVerifier {
  const cached = verifierCache.get(environment);
  if (cached) return cached;
  const verifier = new SignedDataVerifier(
    loadRootCertificates(),
    true,
    environment,
    bundleId(),
    environment === Environment.PRODUCTION ? appAppleId() : undefined
  );
  verifierCache.set(environment, verifier);
  return verifier;
}

const apiClientCache = new Map<Environment, AppStoreServerAPIClient>();
function getApiClient(environment: Environment): AppStoreServerAPIClient {
  const cached = apiClientCache.get(environment);
  if (cached) return cached;
  const client = new AppStoreServerAPIClient(
    env("APPLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    env("APPLE_KEY_ID"),
    env("APPLE_ISSUER_ID"),
    bundleId(),
    environment
  );
  apiClientCache.set(environment, client);
  return client;
}

// Reads the environment from an unverified JWS payload so we can choose the correct
// verifier. Signature is still fully verified afterwards; this peek only selects keys.
function peekEnvironment(jws: string, path: "transaction" | "notification"): Environment {
  try {
    const payload = JSON.parse(Buffer.from(jws.split(".")[1] ?? "", "base64").toString("utf8"));
    const value = path === "notification" ? payload?.data?.environment : payload?.environment;
    return String(value).toLowerCase() === "sandbox" ? Environment.SANDBOX : Environment.PRODUCTION;
  } catch {
    return configuredEnvironment();
  }
}

function toDate(ms: number | undefined): Date {
  return new Date(typeof ms === "number" ? ms : Date.now());
}

// Verifies a StoreKit 2 signed transaction (JWS) sent from the client during purchase.
export async function verifyClientTransaction(jws: string): Promise<AppleTransactionInfo> {
  const environment = peekEnvironment(jws, "transaction");
  const decoded = await getVerifier(environment).verifyAndDecodeTransaction(jws);
  return transactionInfoFromDecoded(decoded, environment);
}

function transactionInfoFromDecoded(
  decoded: JWSTransactionDecodedPayload,
  environment: Environment
): AppleTransactionInfo {
  if (!decoded.productId || !decoded.originalTransactionId) {
    throw new Error("Incomplete Apple transaction payload.");
  }
  return {
    productId: decoded.productId,
    originalTransactionId: decoded.originalTransactionId,
    transactionId: decoded.transactionId ?? decoded.originalTransactionId,
    purchaseDate: toDate(decoded.purchaseDate),
    expireDate: toDate(decoded.expiresDate),
    environment,
    appAccountToken: decoded.appAccountToken ?? null
  };
}

export function expectedAppleAppAccountToken(uid: string): string {
  const chars = createHash("sha256").update(`art-atlas:${uid}`).digest("hex").slice(0, 32).split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16], 16) & 3) | 8).toString(16);
  const value = chars.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

// Verifies an App Store Server Notification V2 payload and its inner signed objects.
export async function decodeNotification(signedPayload: string): Promise<DecodedAppleNotification> {
  const environment = peekEnvironment(signedPayload, "notification");
  const verifier = getVerifier(environment);
  const payload: ResponseBodyV2DecodedPayload = await verifier.verifyAndDecodeNotification(signedPayload);

  const signedTransaction = payload.data?.signedTransactionInfo;
  const signedRenewal = payload.data?.signedRenewalInfo;

  return {
    notificationType: String(payload.notificationType ?? ""),
    subtype: payload.subtype ? String(payload.subtype) : undefined,
    environment,
    transaction: signedTransaction ? await verifier.verifyAndDecodeTransaction(signedTransaction) : undefined,
    renewalInfo: signedRenewal ? await verifier.verifyAndDecodeRenewalInfo(signedRenewal) : undefined
  };
}

// Queries the App Store Server API for the current subscription state. Used by the
// launch reconcile so a device that missed a notification still self-heals.
export async function fetchSubscriptionSnapshot(
  originalTransactionId: string
): Promise<AppleSubscriptionSnapshot | null> {
  const environments = [configuredEnvironment(), otherEnvironment(configuredEnvironment())];
  for (const environment of environments) {
    const snapshot = await fetchFromEnvironment(originalTransactionId, environment).catch(() => null);
    if (snapshot) return snapshot;
  }
  return null;
}

function otherEnvironment(environment: Environment): Environment {
  return environment === Environment.PRODUCTION ? Environment.SANDBOX : Environment.PRODUCTION;
}

async function fetchFromEnvironment(
  originalTransactionId: string,
  environment: Environment
): Promise<AppleSubscriptionSnapshot | null> {
  const response = await getApiClient(environment).getAllSubscriptionStatuses(originalTransactionId);
  const verifier = getVerifier(environment);

  for (const group of response.data ?? []) {
    for (const last of group.lastTransactions ?? []) {
      if (!last.signedTransactionInfo) continue;
      const transaction = await verifier.verifyAndDecodeTransaction(last.signedTransactionInfo);
      const renewalInfo = last.signedRenewalInfo
        ? await verifier.verifyAndDecodeRenewalInfo(last.signedRenewalInfo)
        : undefined;
      const info = transactionInfoFromDecoded(transaction, environment);
      return {
        ...info,
        autoRenew: renewalInfo?.autoRenewStatus === 1,
        active: last.status === Status.ACTIVE || last.status === Status.BILLING_GRACE_PERIOD
      };
    }
  }
  return null;
}
