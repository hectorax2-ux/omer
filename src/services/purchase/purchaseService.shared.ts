import { Platform } from "react-native";
import { premiumCopy } from "@/app/i18n/premium";
import { premiumPlatformCopy } from "@/constants/premium-platform";
import { Language } from "@/types/content";
import { t } from "@/utils/localized-text";
import { isStorePurchaseSupported } from "@/utils/iap-support";

export function isNativeStoreAvailable() {
  return isStorePurchaseSupported();
}

export function purchasePlatform(): "ios" | "android" {
  return Platform.OS === "ios" ? "ios" : "android";
}

export function purchaseErrorMessage(error: unknown, language: Language) {
  const code = purchaseErrorCode(error);
  if (code === "user-cancelled") {
    return t(premiumCopy.purchaseCancelled, language);
  }
  if (code === "pending" || code === "deferred-payment") {
    return t(premiumCopy.purchasePending, language);
  }
  if (code === "already-owned" || code === "duplicate-purchase") {
    return t(premiumCopy.purchaseAlreadyOwned, language);
  }
  if (["network-error", "connection-closed", "service-disconnected", "service-error", "service-timeout", "remote-error"].includes(code ?? "")) {
    return t(premiumCopy.storeNetworkError, language);
  }
  if (["billing-unavailable", "iap-not-available", "feature-not-supported", "activity-unavailable"].includes(code ?? "")) {
    return t(premiumPlatformCopy.storeUnavailable, language);
  }
  if (isStoreProductUnavailable(error)) {
    return t(premiumPlatformCopy.storeProductUnavailable, language);
  }
  return t(premiumCopy.purchaseFailed, language);
}

function purchaseErrorCode(error: unknown) {
  if (typeof error !== "object" || !error || !("code" in error)) return null;
  return typeof error.code === "string" ? error.code : null;
}

function isStoreProductUnavailable(error: unknown) {
  if (!(error instanceof Error)) return false;
  const message = error.message.toLowerCase();
  const code = purchaseErrorCode(error);
  return code === "sku-not-found"
    || code === "sku-offer-mismatch"
    || code === "item-unavailable"
    || message.includes("sku not found")
    || message.includes("product not found")
    || message.includes("not fetched");
}
