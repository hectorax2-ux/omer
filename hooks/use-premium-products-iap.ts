import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Crypto from "expo-crypto";
import {
  fetchProducts as fetchStoreProducts,
  getActiveSubscriptions,
  getAvailablePurchases,
  type ProductSubscription,
  type ProductSubscriptionAndroidOfferDetails,
  type Purchase,
  useIAP
} from "expo-iap";
import { premiumCopy } from "@/app/i18n/premium";
import { premiumPlatformCopy } from "@/constants/premium-platform";
import {
  GOOGLE_PREMIUM_BASE_PLANS,
  GOOGLE_PREMIUM_PRODUCT_ID,
  PREMIUM_PRODUCT_CATALOG,
  PREMIUM_PRODUCT_IDS,
  PremiumProductDefinition,
  PremiumPlan,
  isPremiumPlan,
  isPremiumStoreProductId,
  premiumBadgeLabel,
  premiumPlanForProduct
} from "@/constants/premiumProducts";
import { PremiumProductView } from "@/hooks/premium-product-types";
import { useAccount } from "@/hooks/use-account";
import { syncPremiumStatusRemote } from "@/src/services/firebase/premium-purchase-service";
import { Language } from "@/types/content";
import {
  finalizePremiumPurchase,
  findSubscriptionProduct,
  isNativeStoreAvailable,
  purchaseErrorMessage,
  subscriptionStorePrice
} from "@/src/services/purchase/purchaseService";
import { t } from "@/utils/localized-text";

type ProductLoadState = "idle" | "loading" | "ready" | "error";

const STORE_PRODUCT_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000];
const STORE_CONNECTION_RETRY_DELAYS_MS = [500, 1000, 2000, 4000];
const STORE_QUERY_TIMEOUT_MS = 8000;

export function usePremiumProductsIap(language: Language) {
  const { account, isAuthenticated, updateAccount } = useAccount();
  const storeAvailable = isNativeStoreAvailable();
  const connectedRef = useRef(false);
  const storeSubscriptionsRef = useRef<ProductSubscription[]>([]);
  const requestedAndroidPlanRef = useRef<PremiumPlan | null>(null);
  const [priceLoadState, setPriceLoadState] = useState<ProductLoadState>(storeAvailable ? "loading" : "idle");
  const [storeLoadState, setStoreLoadState] = useState<ProductLoadState>(storeAvailable ? "loading" : "idle");
  const [storeSubscriptions, setStoreSubscriptions] = useState<ProductSubscription[]>([]);
  const [currentAndroidPlan, setCurrentAndroidPlan] = useState<PremiumPlan | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [purchasingId, setPurchasingId] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const {
    connected,
    requestPurchase,
    finishTransaction,
    restorePurchases,
    reconnect
  } = useIAP({
    onPurchaseSuccess: async (purchase) => {
      if (Platform.OS === "android" && purchase.purchaseState === "pending") {
        console.info("[Premium Google Play] Purchase is pending payment.", { productId: purchase.productId });
        setPurchasingId(null);
        setStatusMessage(t(premiumCopy.purchasePending, language));
        return;
      }
      if (Platform.OS === "android" && !isPurchasedAndroidPurchase(purchase)) {
        console.warn("[Premium Google Play] Ignoring a non-purchased subscription result.", {
          productId: purchase.productId,
          purchaseState: purchase.purchaseState
        });
        setPurchasingId(null);
        setStatusMessage(t(premiumCopy.purchaseFailed, language));
        return;
      }

      const basePlanId = Platform.OS === "android"
        ? purchase.currentPlanId ?? requestedAndroidPlanRef.current ?? undefined
        : undefined;
      console.info(Platform.OS === "android" ? "[Premium Google Play] Purchase received." : "[Premium StoreKit] Purchase received.", {
        productId: purchase.productId,
        basePlanId,
        transactionId: purchase.transactionId ?? purchase.id,
        environment: purchaseEnvironment(purchase)
      });

      try {
        const pricing = purchasePricing(storeSubscriptionsRef.current, purchase.productId, basePlanId);
        const activation = await finalizePremiumPurchase(purchase, {
          basePlanId,
          price: pricing ?? undefined
        });

        if (Platform.OS === "ios") {
          await finishTransaction({ purchase, isConsumable: false });
        } else if (!("isAcknowledgedAndroid" in purchase) || purchase.isAcknowledgedAndroid !== true) {
          await finishTransaction({ purchase, isConsumable: false }).catch((error) => {
            // The trusted backend also acknowledges verified Google purchases. A
            // duplicate/already-acknowledged client result must not hide entitlement.
            console.warn("[Premium Google Play] Client acknowledgement was not required or failed.", error);
          });
        }

        updateAccount({ isPremium: true });
        const resolvedPlan = premiumPlanForProduct(purchase.productId, basePlanId);
        if (Platform.OS === "android" && resolvedPlan) setCurrentAndroidPlan(resolvedPlan);
        console.info("[Premium Store] Firebase premium activation completed.", {
          productId: purchase.productId,
          basePlanId,
          verified: activation.verified,
          expiresAt: activation.expiresAt
        });
        syncPremiumStatusRemote()
          .then((result) => {
            updateAccount({ isPremium: result.premium });
            console.info("[Premium Store] Premium status synchronized after purchase.", result);
          })
          .catch((error) => {
            console.warn("[Premium Store] Premium status sync after purchase failed.", error);
          });
        setStatusMessage(t(premiumCopy.purchaseSuccess, language));
      } catch (error) {
        console.error("[Premium Store] Purchase verification or Firebase activation failed.", error);
        setStatusMessage(t(premiumCopy.purchaseVerifyFailed, language));
      } finally {
        requestedAndroidPlanRef.current = null;
        setPurchasingId(null);
      }
    },
    onPurchaseError: (error) => {
      console.warn("[Premium Store] Purchase failed.", error);
      requestedAndroidPlanRef.current = null;
      setPurchasingId(null);
      setStatusMessage(purchaseErrorMessage(error, language));
    },
    onError: (error?: unknown) => {
      console.warn("[Premium Store] IAP runtime error.", error);
    }
  });

  useEffect(() => {
    connectedRef.current = connected;
  }, [connected]);

  const storeProducts = useMemo(
    () => buildReadyProducts(storeSubscriptions, language) ?? [],
    [language, storeSubscriptions]
  );
  const purchaseReady = storeProducts.length === PREMIUM_PRODUCT_CATALOG.length;
  const products = storeProducts;
  const pricesReady = purchaseReady;

  useEffect(() => {
    if (!storeAvailable || !connected) return;
    let cancelled = false;

    async function loadProducts() {
      setStoreLoadState("loading");
      setPriceLoadState("loading");
      console.info("[Premium Store] Loading purchasable subscriptions.", { productIds: storeProductIds() });

      for (const attempt of Array.from({ length: STORE_PRODUCT_RETRY_DELAYS_MS.length + 1 }, (_, index) => index)) {
        try {
          const fetched = await queryStoreSubscriptions();
          const readyProducts = buildReadyProducts(fetched, language);
          console.info("[Premium Store] Product query completed.", {
            attempt: attempt + 1,
            returnedIds: fetched.map((product) => product.id),
            missingIds: storeProductIds().filter((id) => !fetched.some((product) => product.id === id))
          });
          if (!readyProducts) throw new Error("The store did not return every configured subscription plan.");
          if (cancelled) return;
          storeSubscriptionsRef.current = fetched;
          setStoreSubscriptions(fetched);
          setStoreLoadState("ready");
          setPriceLoadState("ready");
          setStatusMessage("");
          if (Platform.OS === "android") {
            const active = await readActiveGoogleSubscription().catch(() => null);
            if (!cancelled) setCurrentAndroidPlan(active?.plan ?? null);
          }
          return;
        } catch (error) {
          console.warn("[Premium Store] Product query failed.", { attempt: attempt + 1, error });
          if (attempt === STORE_PRODUCT_RETRY_DELAYS_MS.length) {
            if (cancelled) return;
            setStoreLoadState("error");
            setPriceLoadState("error");
            return;
          }
          await delay(STORE_PRODUCT_RETRY_DELAYS_MS[attempt]);
        }
      }
    }

    void loadProducts();
    return () => {
      cancelled = true;
    };
  }, [connected, language, reloadKey, storeAvailable]);

  useEffect(() => {
    if (!storeAvailable || connected) return;
    let cancelled = false;

    async function watchConnection() {
      setStoreLoadState("loading");
      setPriceLoadState("loading");
      for (const delayMs of STORE_CONNECTION_RETRY_DELAYS_MS) {
        await delay(delayMs);
        if (cancelled || connectedRef.current) return;
        const connectedAfterReconnect = await withTimeout(reconnect(), STORE_QUERY_TIMEOUT_MS).catch(() => false);
        console.info("[Premium Store] Store reconnect result.", { connected: connectedAfterReconnect });
        if (connectedAfterReconnect) return;
      }
      if (cancelled || connectedRef.current) return;
      setStoreLoadState("error");
      setPriceLoadState("error");
    }

    void watchConnection();
    return () => {
      cancelled = true;
    };
  }, [connected, reconnect, reloadKey, storeAvailable]);

  const retryLoadProducts = useCallback(() => {
    console.info("[Premium Store] Manual subscription reload requested.");
    setStatusMessage("");
    setPriceLoadState("loading");
    setStoreLoadState("loading");
    setStoreSubscriptions([]);
    storeSubscriptionsRef.current = [];
    setReloadKey((value) => value + 1);
  }, []);

  async function purchase(productId: PremiumProductDefinition["id"]) {
    if (!storeAvailable) {
      setStatusMessage(t(premiumPlatformCopy.storeUnavailable, language));
      return;
    }
    if (!isAuthenticated) {
      setStatusMessage(t(premiumCopy.signInRequired, language));
      return;
    }
    if (Platform.OS === "ios" && account.isPremium) {
      setStatusMessage(t(premiumCopy.activeMember, language));
      return;
    }

    const connectedNow = connectedRef.current
      ? true
      : await withTimeout(reconnect(), STORE_QUERY_TIMEOUT_MS).catch(() => false);
    if (!connectedNow) {
      setStatusMessage(t(premiumPlatformCopy.storeProductUnavailable, language));
      return;
    }

    let selected = storeProducts.find((product) => product.id === productId);
    if (!selected) {
      const fetched = await queryStoreSubscriptions().catch((error) => {
        console.warn("[Premium Store] Last product refresh before purchase failed.", error);
        return [];
      });
      const readyProducts = buildReadyProducts(fetched, language);
      if (readyProducts) {
        storeSubscriptionsRef.current = fetched;
        setStoreSubscriptions(fetched);
        setStoreLoadState("ready");
        selected = readyProducts.find((product) => product.id === productId);
      }
    }

    if (!selected || (Platform.OS === "android" && (!selected.offerToken || !selected.basePlanId))) {
      console.error("[Premium Store] Purchase blocked because the store did not return the requested plan.", { productId });
      setStatusMessage(t(premiumPlatformCopy.storeProductUnavailable, language));
      return;
    }

    setStatusMessage("");
    setPurchasingId(productId);
    requestedAndroidPlanRef.current = Platform.OS === "android" ? selected.plan : null;
    try {
      const appAccountId = await premiumAppAccountToken(account.uid);
      if (Platform.OS === "ios") {
        await requestPurchase({
          type: "subs",
          request: {
            apple: { sku: productId, appAccountToken: appAccountId },
            google: { skus: [productId], obfuscatedAccountId: appAccountId }
          }
        });
        return;
      }

      const active = await readActiveGoogleSubscription().catch((error) => {
        console.warn("[Premium Google Play] Active plan lookup failed before purchase.", error);
        return null;
      });
      if (active?.plan === selected.plan) {
        setCurrentAndroidPlan(active.plan);
        setPurchasingId(null);
        requestedAndroidPlanRef.current = null;
        setStatusMessage(t(premiumCopy.currentPlan, language));
        return;
      }

      await requestPurchase({
        type: "subs",
        request: {
          apple: { sku: productId },
          google: {
            skus: [GOOGLE_PREMIUM_PRODUCT_ID],
            subscriptionOffers: [{ sku: GOOGLE_PREMIUM_PRODUCT_ID, offerToken: selected.offerToken! }],
            obfuscatedAccountId: appAccountId,
            ...(active?.purchaseToken
              ? {
                  purchaseToken: active.purchaseToken,
                  subscriptionProductReplacementParams: {
                    oldProductId: GOOGLE_PREMIUM_PRODUCT_ID,
                    replacementMode: "without-proration" as const
                  }
                }
              : {})
          }
        }
      });
    } catch (error) {
      console.warn("[Premium Store] Purchase request failed.", error);
      requestedAndroidPlanRef.current = null;
      setPurchasingId(null);
      setStatusMessage(purchaseErrorMessage(error, language));
    }
  }

  async function restore() {
    if (!storeAvailable) {
      setStatusMessage(t(premiumPlatformCopy.storeUnavailable, language));
      return;
    }
    const connectedNow = connectedRef.current
      ? true
      : await withTimeout(reconnect(), STORE_QUERY_TIMEOUT_MS).catch(() => false);
    if (!connectedNow) {
      setStatusMessage(t(premiumPlatformCopy.storeProductUnavailable, language));
      return;
    }
    setRestoring(true);
    setStatusMessage("");
    try {
      console.info("[Premium Store] Restore purchases requested.");
      await restorePurchases({ alsoPublishToEventListenerIOS: false, onlyIncludeActiveItemsIOS: true });
      const restoredPurchases = await getAvailablePurchases({
        onlyIncludeActiveItemsIOS: true,
        alsoPublishToEventListenerIOS: false
      });
      const premiumPurchases = restoredPurchases.filter((purchase) => isPremiumStoreProductId(purchase.productId));
      let pendingFound = false;
      for (const restoredPurchase of premiumPurchases) {
        if (Platform.OS === "android" && restoredPurchase.purchaseState === "pending") {
          pendingFound = true;
          continue;
        }
        if (Platform.OS === "android" && !isPurchasedAndroidPurchase(restoredPurchase)) continue;
        const basePlanId = Platform.OS === "android" ? restoredPurchase.currentPlanId ?? undefined : undefined;
        const pricing = purchasePricing(storeSubscriptionsRef.current, restoredPurchase.productId, basePlanId);
        await finalizePremiumPurchase(restoredPurchase, { basePlanId, price: pricing ?? undefined });
        if (Platform.OS === "android" && (!("isAcknowledgedAndroid" in restoredPurchase) || restoredPurchase.isAcknowledgedAndroid !== true)) {
          await finishTransaction({ purchase: restoredPurchase, isConsumable: false }).catch((error) => {
            console.warn("[Premium Google Play] Restore acknowledgement failed after backend verification.", error);
          });
        }
      }
      const synced = await syncPremiumStatusRemote();
      updateAccount({ isPremium: synced.premium });
      if (Platform.OS === "android") {
        const active = await readActiveGoogleSubscription().catch(() => null);
        setCurrentAndroidPlan(active?.plan ?? null);
      }
      console.info("[Premium Store] Restore purchases synchronized with Firebase.", synced);
      setStatusMessage(t(pendingFound ? premiumCopy.purchasePending : premiumCopy.restoreSuccess, language));
    } catch (error) {
      console.warn("[Premium Store] Restore purchases failed.", error);
      setStatusMessage(t(premiumCopy.restoreFailed, language));
    } finally {
      setRestoring(false);
    }
  }

  return {
    products,
    storeAvailable,
    connected,
    loadingPrices: priceLoadState === "loading",
    pricesReady,
    priceLoadFailed: priceLoadState === "error",
    purchaseReady,
    storeLoadFailed: storeLoadState === "error",
    retryLoadProducts,
    purchasingId,
    restoring,
    purchase,
    restore,
    statusMessage,
    isPremium: account.isPremium,
    currentPlan: Platform.OS === "android" ? currentAndroidPlan : null,
    canChangePlans: Platform.OS === "android"
  };
}

function buildReadyProducts(subscriptions: ProductSubscription[], language: Language): PremiumProductView[] | null {
  if (Platform.OS === "android") {
    const subscription = findSubscriptionProduct(subscriptions, GOOGLE_PREMIUM_PRODUCT_ID);
    if (!subscription || subscription.platform !== "android") return null;
    const products = PREMIUM_PRODUCT_CATALOG.map((product) => {
      const offer = selectGoogleBasePlanOffer(subscription.subscriptionOfferDetailsAndroid, product.plan);
      const price = googleOfferPrice(offer);
      if (!offer || !price) return null;
      return {
        ...product,
        storeProductId: GOOGLE_PREMIUM_PRODUCT_ID,
        basePlanId: offer.basePlanId,
        offerToken: offer.offerToken,
        storePrice: price.text,
        currency: price.currency,
        priceLabel: `${price.text} / ${billingPeriodLabel(product.plan, language)}`,
        badgeLabel: premiumBadgeLabel(product.badge, language)
      };
    });
    if (products.some((product) => product === null)) return null;
    return products as PremiumProductView[];
  }

  const products = PREMIUM_PRODUCT_CATALOG.map((product) => {
    const subscription = findSubscriptionProduct(subscriptions, product.id);
    const storePrice = subscriptionStorePrice(subscription);
    if (!storePrice) return null;
    return {
      ...product,
      storeProductId: product.id,
      storePrice,
      currency: subscription?.currency ?? "",
      priceLabel: `${storePrice} / ${billingPeriodLabel(product.plan, language)}`,
      badgeLabel: premiumBadgeLabel(product.badge, language)
    };
  });

  if (products.some((product) => product === null)) return null;
  return products as PremiumProductView[];
}

function selectGoogleBasePlanOffer(offers: ProductSubscriptionAndroidOfferDetails[], plan: PremiumPlan) {
  const matching = offers.filter((offer) => offer.basePlanId === GOOGLE_PREMIUM_BASE_PLANS[plan]);
  return matching.find((offer) => !offer.offerId) ?? matching[0];
}

function googleOfferPrice(offer: ProductSubscriptionAndroidOfferDetails | undefined) {
  const phases = offer?.pricingPhases.pricingPhaseList ?? [];
  const recurring = [...phases].reverse().find((phase) => Number(phase.priceAmountMicros) > 0) ?? phases.at(-1);
  if (!recurring?.formattedPrice?.trim()) return null;
  return { text: recurring.formattedPrice.trim(), currency: recurring.priceCurrencyCode };
}

function purchasePricing(subscriptions: ProductSubscription[], productId: string, basePlanId?: string) {
  const subscription = findSubscriptionProduct(subscriptions, productId);
  if (!subscription) return null;
  if (subscription.platform === "android") {
    const plan = basePlanId && isPremiumPlan(basePlanId) ? basePlanId : null;
    return plan ? googleOfferPrice(selectGoogleBasePlanOffer(subscription.subscriptionOfferDetailsAndroid, plan)) : null;
  }
  const text = subscriptionStorePrice(subscription);
  return text ? { text, currency: subscription.currency } : null;
}

function billingPeriodLabel(plan: PremiumPlan, language: Language) {
  const labels: Record<PremiumPlan, Record<Language, string>> = {
    monthly: { tr: "ay", en: "month", ru: "месяц", uz: "oy" },
    quarterly: { tr: "3 ay", en: "3 months", ru: "3 месяца", uz: "3 oy" },
    yearly: { tr: "yıl", en: "year", ru: "год", uz: "yil" }
  };
  return labels[plan][language];
}

async function queryStoreSubscriptions(): Promise<ProductSubscription[]> {
  const result = await withTimeout(
    fetchStoreProducts({ skus: storeProductIds(), type: "subs" }),
    STORE_QUERY_TIMEOUT_MS
  );
  return (result ?? []).filter((product) => storeProductIds().includes(product.id)) as ProductSubscription[];
}

function storeProductIds(): string[] {
  return Platform.OS === "android" ? [GOOGLE_PREMIUM_PRODUCT_ID] : [...PREMIUM_PRODUCT_IDS];
}

async function readActiveGoogleSubscription() {
  if (Platform.OS !== "android") return null;
  const subscriptions = await withTimeout(getActiveSubscriptions([GOOGLE_PREMIUM_PRODUCT_ID]), STORE_QUERY_TIMEOUT_MS);
  const active = subscriptions.find((subscription) => subscription.isActive && subscription.productId === GOOGLE_PREMIUM_PRODUCT_ID);
  if (!active) return null;
  const basePlanId = active.basePlanIdAndroid ?? active.currentPlanId;
  return {
    plan: basePlanId && isPremiumPlan(basePlanId) ? basePlanId : null,
    purchaseToken: active.purchaseTokenAndroid ?? active.purchaseToken ?? null
  };
}

function isPurchasedAndroidPurchase(purchase: Purchase) {
  if (purchase.purchaseState !== "purchased") return false;
  if ("isSuspendedAndroid" in purchase && purchase.isSuspendedAndroid === true) return false;
  return true;
}

async function premiumAppAccountToken(uid: string) {
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, `art-atlas:${uid}`);
  const chars = hash.slice(0, 32).split("");
  chars[12] = "5";
  chars[16] = ((Number.parseInt(chars[16], 16) & 3) | 8).toString(16);
  const value = chars.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`Store request timed out after ${timeoutMs}ms.`)), timeoutMs);
    })
  ]);
}

function delay(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function purchaseEnvironment(purchase: Purchase) {
  if (!("environmentIOS" in purchase)) return Platform.OS === "android" ? "production" : "unknown";
  return purchase.environmentIOS?.trim() || "unknown";
}
