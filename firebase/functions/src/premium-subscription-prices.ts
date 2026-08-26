import * as crypto from "crypto";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";
import { appleStoreSecrets } from "./premium/apple-store-server";

const APPLE_PRICE_CACHE_MS = 10 * 60 * 1000;
const APPLE_APP_ID = "6792671640";
const PRODUCT_IDS = [
  "com.artatlas.app.premium.monthly",
  "com.artatlas.app.premium.quarterly",
  "com.artatlas.app.premium.yearly"
] as const;

type ProductId = typeof PRODUCT_IDS[number];

type AppleApiResource = {
  id: string;
  type: string;
  attributes?: Record<string, unknown>;
  relationships?: Record<string, { data?: { id: string; type: string } | Array<{ id: string; type: string }> }>;
};

type AppleApiResponse = {
  data?: AppleApiResource[];
  included?: AppleApiResource[];
};

type CachedPrices = {
  expiresAt: number;
  prices: PremiumSubscriptionPrice[];
};

type PremiumSubscriptionPrice = {
  productId: ProductId;
  price: string;
  currency: string;
  territory: string;
  source: "app-store-connect";
};

const cache = new Map<string, CachedPrices>();

export const premiumSubscriptionPrices = onCall(
  { secrets: appleStoreSecrets },
  async (request) => {
  const locale = normalizeLocale(request.data?.locale);
  const territory = normalizeTerritory(request.data?.territory);
  const cacheKey = `${territory}:${locale}`;
  const cached = cache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return { ok: true, prices: cached.prices };
  }

  try {
    const prices = await fetchApplePrices(territory, locale);
    cache.set(cacheKey, { expiresAt: Date.now() + APPLE_PRICE_CACHE_MS, prices });
    logger.info("Premium subscription prices loaded from App Store Connect.", {
      territory,
      locale,
      count: prices.length
    });
    return { ok: true, prices };
  } catch (error) {
    logger.error("Premium subscription prices could not be loaded from App Store Connect.", error);
    throw new HttpsError("unavailable", "Unable to load subscription prices.");
  }
  }
);

async function fetchApplePrices(territory: string, locale: string): Promise<PremiumSubscriptionPrice[]> {
  const subscriptions = await loadSubscriptionIds();
  const prices = await Promise.all(PRODUCT_IDS.map((productId) => loadProductPrice(subscriptions[productId], productId, territory, locale)));
  return prices;
}

async function loadSubscriptionIds(): Promise<Record<ProductId, string>> {
  const response = await appleApi(`/v1/apps/${APPLE_APP_ID}/subscriptionGroups?include=subscriptions&limit=200`);
  const subscriptions = (response.included ?? []).filter((item) => item.type === "subscriptions");
  const ids = Object.fromEntries(PRODUCT_IDS.map((productId) => {
    const subscription = subscriptions.find((item) => item.attributes?.productId === productId);
    if (!subscription) {
      throw new Error(`Subscription ${productId} not found in App Store Connect.`);
    }
    return [productId, subscription.id];
  })) as Record<ProductId, string>;
  return ids;
}

async function loadProductPrice(subscriptionId: string, productId: ProductId, territory: string, locale: string): Promise<PremiumSubscriptionPrice> {
  const response = await appleApi(`/v1/subscriptions/${subscriptionId}/prices?filter[territory]=${encodeURIComponent(territory)}&include=subscriptionPricePoint,territory&limit=10`);
  const price = (response.data ?? []).find((item) => item.attributes?.planType === "UPFRONT") ?? response.data?.[0];
  const pricePointId = relationshipId(price, "subscriptionPricePoint");
  const territoryId = relationshipId(price, "territory") ?? territory;
  const pricePoint = (response.included ?? []).find((item) => item.type === "subscriptionPricePoints" && item.id === pricePointId);
  const territoryResource = (response.included ?? []).find((item) => item.type === "territories" && item.id === territoryId);
  const customerPrice = typeof pricePoint?.attributes?.customerPrice === "string" ? pricePoint.attributes.customerPrice : "";
  const currency = typeof territoryResource?.attributes?.currency === "string" ? territoryResource.attributes.currency : "";

  if (!customerPrice || !currency) {
    throw new Error(`Price data missing for ${productId} in ${territory}.`);
  }

  return {
    productId,
    price: new Intl.NumberFormat(locale, { style: "currency", currency }).format(Number(customerPrice)),
    currency,
    territory,
    source: "app-store-connect"
  };
}

async function appleApi(path: string): Promise<AppleApiResponse> {
  const response = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    headers: { Authorization: `Bearer ${appleJwt()}` }
  });
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${body}`);
  }
  return body ? JSON.parse(body) as AppleApiResponse : {};
}

function appleJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "ES256", kid: env("APPLE_KEY_ID"), typ: "JWT" }));
  const payload = base64Url(JSON.stringify({ iss: env("APPLE_ISSUER_ID"), iat: now, exp: now + 20 * 60, aud: "appstoreconnect-v1" }));
  const body = `${header}.${payload}`;
  const signature = crypto.sign("sha256", Buffer.from(body), {
    key: env("APPLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    dsaEncoding: "ieee-p1363"
  });
  return `${body}.${base64Url(signature)}`;
}

function base64Url(input: string | Buffer): string {
  return Buffer.from(input).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function relationshipId(resource: AppleApiResource | undefined, name: string): string | null {
  const data = resource?.relationships?.[name]?.data;
  if (!data || Array.isArray(data)) return null;
  return data.id;
}

function normalizeLocale(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "en-US";
}

function normalizeTerritory(value: unknown): string {
  const territory = typeof value === "string" ? value.trim().toUpperCase() : "";
  if (/^[A-Z]{3}$/.test(territory)) return territory;
  return ISO2_TO_APP_STORE_TERRITORY[territory] ?? "USA";
}

function env(name: string): string {
  const value = (process.env[name] ?? "").trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

const ISO2_TO_APP_STORE_TERRITORY: Record<string, string> = {
  AE: "ARE",
  AT: "AUT",
  AU: "AUS",
  AZ: "AZE",
  BE: "BEL",
  BG: "BGR",
  BR: "BRA",
  CA: "CAN",
  CH: "CHE",
  CY: "CYP",
  CZ: "CZE",
  DE: "DEU",
  DK: "DNK",
  EE: "EST",
  ES: "ESP",
  FI: "FIN",
  FR: "FRA",
  GB: "GBR",
  GR: "GRC",
  HR: "HRV",
  HU: "HUN",
  IE: "IRL",
  IT: "ITA",
  JP: "JPN",
  KZ: "KAZ",
  LT: "LTU",
  LU: "LUX",
  LV: "LVA",
  NL: "NLD",
  NO: "NOR",
  PL: "POL",
  PT: "PRT",
  RO: "ROU",
  RU: "RUS",
  SE: "SWE",
  SK: "SVK",
  TR: "TUR",
  UA: "UKR",
  US: "USA",
  UZ: "UZB"
};
