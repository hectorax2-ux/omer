import { createElement } from "react";
import Constants from "expo-constants";
import { getAdRequestOptions, prepareAdPrivacy } from "./ad-consent.native";
import { getAdMobUnitId, isAdMobDelivery } from "./admob-ad.shared";
import { canUseAdMobUnit, isAdMobRuntimeConfigured } from "@/constants/admob-config";

export { getAdMobUnitId, isAdMobDelivery };

type GoogleMobileAdsModule = {
  default: () => { initialize: () => Promise<void> };
  BannerAd: unknown;
  BannerAdSize: {
    ANCHORED_ADAPTIVE_BANNER: string;
    MEDIUM_RECTANGLE: string;
  };
  AdEventType: {
    LOADED: string;
    CLOSED: string;
    ERROR: string;
  };
  InterstitialAd: {
    createForAdRequest: (unitId: string, options: ReturnType<typeof getAdRequestOptions>) => LoadableAd;
  };
  RewardedAd: {
    createForAdRequest: (unitId: string, options: ReturnType<typeof getAdRequestOptions>) => LoadableAd;
  };
  RewardedAdEventType: {
    LOADED: string;
    EARNED_REWARD: string;
  };
};

type LoadableAd = {
  addAdEventListener: (eventType: string, listener: () => void) => () => void;
  load: () => void;
  show: () => Promise<void>;
};

let adMobInitPromise: Promise<void> | null = null;

function getGoogleMobileAds() {
  if (Constants.executionEnvironment === "storeClient" || Constants.appOwnership === "expo") {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Expo Go must not load this native module at startup.
    return require("react-native-google-mobile-ads") as GoogleMobileAdsModule;
  } catch {
    return null;
  }
}

export async function initializeAdMob(): Promise<void> {
  if (!isAdMobRuntimeConfigured()) return;
  if (!adMobInitPromise) {
    adMobInitPromise = (async () => {
      const googleMobileAds = getGoogleMobileAds();
      if (!googleMobileAds) return;

      await prepareAdPrivacy();
      await googleMobileAds.default().initialize();
    })().catch((error) => {
      adMobInitPromise = null;
      throw error;
    });
  }

  await adMobInitPromise;
}

export function isAdMobAvailable() {
  return isAdMobRuntimeConfigured() && Boolean(getGoogleMobileAds());
}

export function AdMobBannerView({ unitId, compact = false, onUnavailable }: { unitId: string; compact?: boolean; onUnavailable?: () => void }) {
  const googleMobileAds = getGoogleMobileAds();
  if (!googleMobileAds || !canUseAdMobUnit(unitId)) {
    return null;
  }

  return createElement(googleMobileAds.BannerAd as never, {
    unitId: unitId.trim(),
    size: compact ? googleMobileAds.BannerAdSize.ANCHORED_ADAPTIVE_BANNER : googleMobileAds.BannerAdSize.MEDIUM_RECTANGLE,
    requestOptions: getAdRequestOptions(),
    onAdFailedToLoad: onUnavailable
  });
}

export async function showAdMobInterstitial(unitId: string): Promise<boolean> {
  const googleMobileAds = getGoogleMobileAds();
  if (!googleMobileAds || !canUseAdMobUnit(unitId)) {
    return false;
  }

  return new Promise((resolve) => {
    let settled = false;
    let unsubscribeLoaded: () => void = () => undefined;
    let unsubscribeClosed: () => void = () => undefined;
    let unsubscribeError: () => void = () => undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      unsubscribeLoaded();
      unsubscribeClosed();
      unsubscribeError();
      resolve(value);
    };

    const interstitial = googleMobileAds.InterstitialAd.createForAdRequest(unitId.trim(), getAdRequestOptions());
    unsubscribeLoaded = interstitial.addAdEventListener(googleMobileAds.AdEventType.LOADED, () => {
      interstitial.show().catch(() => finish(false));
    });
    unsubscribeClosed = interstitial.addAdEventListener(googleMobileAds.AdEventType.CLOSED, () => finish(true));
    unsubscribeError = interstitial.addAdEventListener(googleMobileAds.AdEventType.ERROR, () => finish(false));

    interstitial.load();
    timeout = setTimeout(() => finish(false), 12000);
  });
}

export async function showAdMobRewarded(unitId: string): Promise<boolean> {
  const googleMobileAds = getGoogleMobileAds();
  if (!googleMobileAds || !canUseAdMobUnit(unitId)) {
    return false;
  }

  return new Promise((resolve) => {
    let settled = false;
    let rewarded = false;
    let unsubscribeLoaded: () => void = () => undefined;
    let unsubscribeEarned: () => void = () => undefined;
    let unsubscribeClosed: () => void = () => undefined;
    let unsubscribeError: () => void = () => undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const finish = (value: boolean) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      unsubscribeLoaded();
      unsubscribeEarned();
      unsubscribeClosed();
      unsubscribeError();
      resolve(value);
    };

    const ad = googleMobileAds.RewardedAd.createForAdRequest(unitId.trim(), getAdRequestOptions());
    unsubscribeLoaded = ad.addAdEventListener(googleMobileAds.RewardedAdEventType.LOADED, () => {
      ad.show().catch(() => finish(false));
    });
    unsubscribeEarned = ad.addAdEventListener(googleMobileAds.RewardedAdEventType.EARNED_REWARD, () => {
      rewarded = true;
    });
    unsubscribeClosed = ad.addAdEventListener(googleMobileAds.AdEventType.CLOSED, () => finish(rewarded));
    unsubscribeError = ad.addAdEventListener(googleMobileAds.AdEventType.ERROR, () => finish(false));

    ad.load();
    timeout = setTimeout(() => finish(false), 15000);
  });
}
