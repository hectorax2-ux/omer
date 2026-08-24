import { type ProductSubscription, type Purchase } from "expo-iap";
import { isPremiumStoreProductId } from "@/constants/premiumProducts";
import { activatePremiumPurchaseRemote } from "@/src/services/firebase/premium-purchase-service";
import { purchasePlatform } from "@/src/services/purchase/purchaseService.shared";

export * from "@/src/services/purchase/purchaseService.shared";

export function subscriptionStorePrice(subscription: ProductSubscription | undefined) {
  if (!subscription) return null;
  const price = subscription.displayPrice?.trim();
  return price ? price : null;
}

export function findSubscriptionProduct(subscriptions: ProductSubscription[], productId: string) {
  return subscriptions.find((item) => item.id === productId);
}

export async function finalizePremiumPurchase(
  purchase: Purchase,
  details?: { basePlanId?: string; price?: { text?: string; currency?: string } }
) {
  const productId = purchase.productId;
  if (!isPremiumStoreProductId(productId)) {
    throw new Error("Unknown premium product.");
  }
  const transactionId = purchase.transactionId ?? purchase.id;
  if (!transactionId) {
    throw new Error("Missing transaction id.");
  }
  return activatePremiumPurchaseRemote({
    productId,
    basePlanId: details?.basePlanId ?? purchase.currentPlanId ?? undefined,
    transactionId,
    signedTransaction: extractSignedTransaction(purchase),
    purchaseToken: purchase.purchaseToken ?? undefined,
    platform: purchasePlatform(),
    priceText: details?.price?.text,
    currency: details?.price?.currency,
    environment: purchaseEnvironment(purchase)
  });
}

// StoreKit 2 exposes a signed JWS transaction; expo-iap surfaces it as the unified
// purchaseToken on iOS (with jwsRepresentation* as older aliases). The server needs
// this to cryptographically verify the purchase against Apple.
function extractSignedTransaction(purchase: Purchase): string | undefined {
  const candidate = purchase as Purchase & { jwsRepresentationIos?: string; jwsRepresentation?: string };
  const jws = candidate.jwsRepresentationIos ?? candidate.jwsRepresentation ?? purchase.purchaseToken ?? undefined;
  return typeof jws === "string" && jws.trim() ? jws : undefined;
}

function purchaseEnvironment(purchase: Purchase): string {
  const candidate = purchase as Purchase & { environmentIOS?: string | null };
  return candidate.environmentIOS?.trim() || "unknown";
}
