import { useState } from "react";
import { premiumCopy } from "@/app/i18n/premium";
import { premiumPlatformCopy } from "@/constants/premium-platform";
import { PremiumProductView } from "@/hooks/premium-product-types";
import { useAccount } from "@/hooks/use-account";
import { Language } from "@/types/content";
import { isNativeStoreAvailable, purchaseErrorMessage } from "@/src/services/purchase/purchaseService.shared";
import { t } from "@/utils/localized-text";

export function usePremiumProductsFallback(language: Language) {
  const { account, isAuthenticated } = useAccount();
  const storeAvailable = isNativeStoreAvailable();
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");

  async function purchase(_productId: PremiumProductView["id"]) {
    if (!storeAvailable) {
      setStatusMessage(t(premiumPlatformCopy.storeUnavailable, language));
      return;
    }
    if (!isAuthenticated) {
      setStatusMessage(t(premiumCopy.signInRequired, language));
      return;
    }
    if (account.isPremium) {
      setStatusMessage(t(premiumCopy.activeMember, language));
      return;
    }
    setPurchasingId(null);
    setStatusMessage(purchaseErrorMessage(new Error(t(premiumPlatformCopy.storeUnavailable, language)), language));
  }

  return {
    products: [],
    storeAvailable,
    connected: false,
    loadingPrices: false,
    pricesReady: false,
    priceLoadFailed: false,
    retryLoadProducts: () => undefined,
    purchasingId,
    purchase,
    statusMessage,
    isPremium: account.isPremium
  };
}
