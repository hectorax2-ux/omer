export * from "@/src/services/purchase/purchaseService.shared";

export function subscriptionStorePrice(_subscription: undefined) {
  return null;
}

export function findSubscriptionProduct(_subscriptions: never[], _productId: string) {
  return undefined;
}

export async function finalizePremiumPurchase(_purchase: never) {
  throw new Error("Store purchases are unavailable on web.");
}
