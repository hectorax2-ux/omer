import { createHash, createSign } from "node:crypto";
import * as admin from "firebase-admin";
import { defineSecret } from "firebase-functions/params";
import { GOOGLE_PREMIUM_PRODUCT_ID, PremiumPlan, planForProduct } from "./premium-firestore";

const GOOGLE_PLAY_PACKAGE_NAME = "com.artatlas.app";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_PLAY_SCOPE = "https://www.googleapis.com/auth/androidpublisher";

export const googlePlayServiceAccountEmail = defineSecret("GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL");
export const googlePlayPrivateKey = defineSecret("GOOGLE_PLAY_PRIVATE_KEY");
export const googlePlaySecrets = [googlePlayServiceAccountEmail, googlePlayPrivateKey];

export type GoogleSubscriptionSnapshot = {
  productId: string;
  basePlanId: PremiumPlan;
  purchaseDate: Date;
  expireDate: Date;
  autoRenew: boolean;
  active: boolean;
  subscriptionState: string;
  acknowledgementPending: boolean;
  obfuscatedAccountId: string | null;
  linkedPurchaseToken: string | null;
  environment: "production" | "license-test";
};

type GoogleAccessTokenResponse = {
  access_token?: unknown;
};

type GoogleSubscriptionResponse = {
  startTime?: unknown;
  subscriptionState?: unknown;
  acknowledgementState?: unknown;
  linkedPurchaseToken?: unknown;
  testPurchase?: unknown;
  externalAccountIdentifiers?: {
    obfuscatedExternalAccountId?: unknown;
  };
  lineItems?: Array<{
    productId?: unknown;
    expiryTime?: unknown;
    autoRenewingPlan?: {
      autoRenewEnabled?: unknown;
    };
    offerDetails?: {
      basePlanId?: unknown;
      offerId?: unknown;
    };
  }>;
};

export function isGooglePlayConfigured() {
  return Boolean(googlePlayServiceAccountEmail.value().trim() && googlePlayPrivateKey.value().trim());
}

export function googlePurchaseKey(purchaseToken: string) {
  return `google_${createHash("sha256").update(purchaseToken).digest("hex")}`;
}

export async function fetchGoogleSubscriptionSnapshot(
  productId: string,
  purchaseToken: string,
  expectedBasePlanId?: string | null
): Promise<GoogleSubscriptionSnapshot> {
  if (productId !== GOOGLE_PREMIUM_PRODUCT_ID) throw new Error("Unexpected Google Play subscription product.");
  const accessToken = await fetchGoogleAccessToken();
  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(GOOGLE_PLAY_PACKAGE_NAME)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!response.ok) {
    throw new Error(`Google Play subscription lookup failed with status ${response.status}.`);
  }

  const data = await response.json() as GoogleSubscriptionResponse;
  const candidates = (data.lineItems ?? [])
    .filter((item) => item.productId === productId)
    .map((item) => ({ item, expiry: parseDate(item.expiryTime) }))
    .filter((entry): entry is { item: NonNullable<GoogleSubscriptionResponse["lineItems"]>[number]; expiry: Date } => Boolean(entry.expiry))
    .sort((left, right) => right.expiry.getTime() - left.expiry.getTime());
  const selected = expectedBasePlanId
    ? candidates.find((entry) => entry.item.offerDetails?.basePlanId === expectedBasePlanId)
    : candidates[0];
  if (!selected) throw new Error("Google Play subscription product or base plan was not found.");

  const basePlanId = typeof selected.item.offerDetails?.basePlanId === "string"
    ? selected.item.offerDetails.basePlanId
    : null;
  const plan = planForProduct(productId, basePlanId);
  if (!plan) throw new Error("Google Play returned an unknown base plan.");

  const subscriptionState = typeof data.subscriptionState === "string" ? data.subscriptionState : "SUBSCRIPTION_STATE_UNSPECIFIED";
  const entitledState = subscriptionState === "SUBSCRIPTION_STATE_ACTIVE"
    || subscriptionState === "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"
    || subscriptionState === "SUBSCRIPTION_STATE_CANCELED";
  const purchaseDate = parseDate(data.startTime) ?? new Date();
  const obfuscatedAccountId = data.externalAccountIdentifiers?.obfuscatedExternalAccountId;
  const linkedPurchaseToken = data.linkedPurchaseToken;

  return {
    productId,
    basePlanId: plan,
    purchaseDate,
    expireDate: selected.expiry,
    autoRenew: selected.item.autoRenewingPlan?.autoRenewEnabled === true,
    active: entitledState && selected.expiry.getTime() > Date.now(),
    subscriptionState,
    acknowledgementPending: data.acknowledgementState === "ACKNOWLEDGEMENT_STATE_PENDING",
    obfuscatedAccountId: typeof obfuscatedAccountId === "string" ? obfuscatedAccountId : null,
    linkedPurchaseToken: typeof linkedPurchaseToken === "string" && linkedPurchaseToken ? linkedPurchaseToken : null,
    environment: data.testPurchase ? "license-test" : "production"
  };
}

export async function acknowledgeGoogleSubscription(productId: string, purchaseToken: string) {
  const accessToken = await fetchGoogleAccessToken();
  const response = await fetch(
    `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(GOOGLE_PLAY_PACKAGE_NAME)}/purchases/subscriptions/${encodeURIComponent(productId)}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({})
    }
  );
  if (!response.ok) throw new Error(`Google Play acknowledgement failed with status ${response.status}.`);
}

export async function writeGoogleSubscription(
  db: admin.firestore.Firestore,
  uid: string,
  purchaseToken: string,
  snapshot: GoogleSubscriptionSnapshot,
  acknowledged: boolean
) {
  await db.collection("googleSubscriptions").doc(uid).set({
    uid,
    purchaseToken,
    purchaseTokenHash: googlePurchaseKey(purchaseToken),
    productId: snapshot.productId,
    basePlanId: snapshot.basePlanId,
    subscriptionState: snapshot.subscriptionState,
    linkedPurchaseTokenHash: snapshot.linkedPurchaseToken ? googlePurchaseKey(snapshot.linkedPurchaseToken) : null,
    expireDate: admin.firestore.Timestamp.fromDate(snapshot.expireDate),
    autoRenew: snapshot.autoRenew,
    acknowledged,
    environment: snapshot.environment,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

export async function readGoogleSubscriptionToken(db: admin.firestore.Firestore, uid: string) {
  const snapshot = await db.collection("googleSubscriptions").doc(uid).get();
  const token = snapshot.get("purchaseToken");
  return typeof token === "string" && token ? token : null;
}

export function expectedGoogleAccountId(uid: string) {
  const chars = createHash("sha256").update(`art-atlas:${uid}`).digest("hex").slice(0, 32).split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16], 16) & 3) | 8).toString(16);
  const value = chars.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

async function fetchGoogleAccessToken() {
  const email = googlePlayServiceAccountEmail.value().trim();
  const privateKey = googlePlayPrivateKey.value().replace(/\\n/g, "\n").trim();
  if (!email || !privateKey) throw new Error("Google Play service account is not configured.");

  const now = Math.floor(Date.now() / 1000);
  const header = encodeBase64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = encodeBase64Url(JSON.stringify({
    iss: email,
    scope: GOOGLE_PLAY_SCOPE,
    aud: GOOGLE_OAUTH_TOKEN_URL,
    iat: now,
    exp: now + 3600
  }));
  const unsignedToken = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256");
  signer.update(unsignedToken);
  const assertion = `${unsignedToken}.${signer.sign(privateKey, "base64url")}`;
  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth2:grant-type:jwt-bearer",
      assertion
    })
  });
  if (!response.ok) throw new Error(`Google OAuth token request failed with status ${response.status}.`);

  const data = await response.json() as GoogleAccessTokenResponse;
  if (typeof data.access_token !== "string" || !data.access_token) throw new Error("Google OAuth response did not contain an access token.");
  return data.access_token;
}

function encodeBase64Url(value: string) {
  return Buffer.from(value).toString("base64url");
}

function parseDate(value: unknown) {
  if (typeof value !== "string") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
