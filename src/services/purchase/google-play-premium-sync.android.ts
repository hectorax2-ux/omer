import { finishTransaction, getAvailablePurchases, initConnection } from "expo-iap";
import { GOOGLE_PREMIUM_PRODUCT_ID } from "@/constants/premiumProducts";
import { syncPremiumStatusRemote } from "@/src/services/firebase/premium-purchase-service";
import { finalizePremiumPurchase } from "@/src/services/purchase/purchaseService";

let restoreInFlight: Promise<unknown> | null = null;

export function restoreGooglePlayPremiumAtLaunch() {
  if (restoreInFlight) return restoreInFlight;
  restoreInFlight = restoreGooglePlayPremium().finally(() => {
    restoreInFlight = null;
  });
  return restoreInFlight;
}

async function restoreGooglePlayPremium() {
  try {
    const connected = await initConnection();
    if (connected) {
      const purchases = await getAvailablePurchases({
        onlyIncludeActiveItemsIOS: true,
        alsoPublishToEventListenerIOS: false
      });
      const googlePurchases = purchases.filter((purchase) => purchase.productId === GOOGLE_PREMIUM_PRODUCT_ID);
      for (const purchase of googlePurchases) {
        if (purchase.purchaseState === "pending") {
          console.info("[Premium Google Play] Pending purchase found during launch restore.");
          continue;
        }
        if (purchase.purchaseState !== "purchased") continue;
        if ("isSuspendedAndroid" in purchase && purchase.isSuspendedAndroid === true) continue;
        try {
          await finalizePremiumPurchase(purchase, { basePlanId: purchase.currentPlanId ?? undefined });
          if (!("isAcknowledgedAndroid" in purchase) || purchase.isAcknowledgedAndroid !== true) {
            await finishTransaction({ purchase, isConsumable: false }).catch((error) => {
              console.warn("[Premium Google Play] Launch restore acknowledgement failed after server verification.", error);
            });
          }
        } catch (error) {
          console.warn("[Premium Google Play] Launch purchase restore verification failed.", error);
        }
      }
    }
  } catch (error) {
    console.warn("[Premium Google Play] Store restore was unavailable during launch.", error);
  }
  return syncPremiumStatusRemote();
}
