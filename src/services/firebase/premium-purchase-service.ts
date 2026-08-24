import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "./core";
import { PremiumProductId, PremiumStoreProductId } from "@/constants/premiumProducts";

export type ActivatePremiumPurchaseInput = {
  productId: PremiumStoreProductId;
  basePlanId?: string;
  transactionId: string;
  // iOS StoreKit 2 signed transaction (JWS). The server verifies this against
  // Apple's certificate chain, so premium is never granted on client claims alone.
  signedTransaction?: string;
  // Android sends the Google Play purchase token for server-side verification.
  purchaseToken?: string;
  platform: "ios" | "android";
  priceText?: string;
  currency?: string;
  environment?: string;
};

export type ActivatePremiumPurchaseResult = {
  ok: boolean;
  alreadyProcessed?: boolean;
  verified?: boolean;
  acknowledged?: boolean;
  expiresAt?: string;
};

export type SyncPremiumStatusResult = {
  ok: boolean;
  premium: boolean;
  subscriptionStatus?: "active" | "expired" | "cancelled";
  changed?: boolean;
};

export type PremiumSubscriptionPriceResult = {
  ok: boolean;
  prices: {
    productId: PremiumProductId;
    price: string;
    currency: string;
    territory: string;
    source: "app-store-connect";
  }[];
};

export async function activatePremiumPurchaseRemote(input: ActivatePremiumPurchaseInput) {
  const callable = httpsCallable<ActivatePremiumPurchaseInput, ActivatePremiumPurchaseResult>(
    getFunctions(firebaseApp),
    "activatePremiumPurchase"
  );
  const result = await callable(input);
  return result.data;
}

// Reconciles the caller's canonical premium document with the verified platform
// subscription and flips expired subscriptions off. Safe to call on every launch.
export async function syncPremiumStatusRemote() {
  const callable = httpsCallable<Record<string, never>, SyncPremiumStatusResult>(
    getFunctions(firebaseApp),
    "syncPremiumStatus"
  );
  const result = await callable({});
  return result.data;
}

export async function fetchPremiumSubscriptionPricesRemote(input: { territory?: string; locale?: string }) {
  const callable = httpsCallable<typeof input, PremiumSubscriptionPriceResult>(
    getFunctions(firebaseApp),
    "premiumSubscriptionPrices"
  );
  const result = await callable(input);
  return result.data;
}
