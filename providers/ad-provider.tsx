import { createContext, PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "@/hooks/use-account";
import { useLanguage } from "@/hooks/use-language";
import {
  AdReason,
  AdSettings,
  DEFAULT_AD_SETTINGS,
  normalizeAdPlacement,
  overlayPlacementForReason
} from "@/constants/ad-placements";
import type { AdPlacementId } from "@/constants/ad-placements";
import { areRewardedAdRequirementsEnabled } from "@/constants/ad-feature-flags";
import { isAdMobDelivery, initializeAdMob, showAdMobInterstitial } from "@/components/admob-ad";
import { AdDocument, AdSettingsDocument } from "@/src/types/firestore";
import { isInterstitialEligibleRoute, resolveAdRouteKey } from "@/utils/ad-routes";
import { collection, doc, limit, onSnapshot, query, where } from "firebase/firestore";
import { firestoreDb } from "@/src/services/firebase";
import { areAdsGloballyEnabled, canUseAdMobUnit, isAdMobRuntimeConfigured } from "@/constants/admob-config";
import { useStartupPhase } from "@/hooks/use-startup-phase";

type AdContextValue = {
  interstitialVisible: boolean;
  interstitialReason: AdReason;
  interstitialAd?: AdDocument;
  bottomSheetVisible: boolean;
  bottomSheetAd?: AdDocument;
  adsEnabled: boolean;
  ads: AdDocument[];
  adSettings: AdSettings;
  closeBottomSheetAd: () => void;
  closeInterstitialAd: () => void;
  getAdForPlacement: (placement: AdDocument["placement"] | AdPlacementId) => AdDocument | undefined;
  maybeShowInterstitialAd: (reason: AdReason) => Promise<boolean>;
  showBottomSheetAd: () => Promise<boolean>;
  trackPageViewForAds: (pathname: string) => void;
  showRewardedAd: (placement?: AdPlacementId) => Promise<boolean>;
};

export const AdContext = createContext<AdContextValue>({
  interstitialVisible: false,
  interstitialReason: "page",
  bottomSheetVisible: false,
  adsEnabled: false,
  ads: [],
  adSettings: DEFAULT_AD_SETTINGS,
  closeBottomSheetAd: () => undefined,
  closeInterstitialAd: () => undefined,
  getAdForPlacement: () => undefined,
  maybeShowInterstitialAd: async () => false,
  showBottomSheetAd: async () => false,
  trackPageViewForAds: () => undefined,
  showRewardedAd: async () => false
});

export function AdProvider({ children }: PropsWithChildren) {
  const { account, authLoading, isAuthenticated } = useAccount();
  const { language } = useLanguage();
  const startupPhase = useStartupPhase();
  const adNetworkReady = startupPhase !== "critical";
  const hasAdFreeStatus = isAuthenticated && (
    account.isPremium ||
    account.isAdmin ||
    account.staffBadges.includes("moderator") ||
    account.staffBadges.includes("editor")
  );
  const adsEnabled = !authLoading && areAdsGloballyEnabled() && !hasAdFreeStatus;
  const [interstitialVisible, setInterstitialVisible] = useState(false);
  const [interstitialReason, setInterstitialReason] = useState<AdReason>("page");
  const [interstitialAd, setInterstitialAd] = useState<AdDocument | undefined>();
  const [bottomSheetVisible, setBottomSheetVisible] = useState(false);
  const [bottomSheetAd, setBottomSheetAd] = useState<AdDocument | undefined>();
  const [remoteAds, setRemoteAds] = useState<AdDocument[]>([]);
  const [adSettings, setAdSettings] = useState<AdSettings>(DEFAULT_AD_SETTINGS);
  const sessionStartedAtRef = useRef(Date.now());
  const pageViewCountRef = useRef(0);
  const lastRouteKeyRef = useRef("");
  const lastInterstitialAtRef = useRef(0);
  const lastBottomSheetAtRef = useRef(0);
  const interstitialCountRef = useRef(0);
  const bottomSheetCountRef = useRef(0);
  const interstitialInFlightRef = useRef(false);

  useEffect(() => {
    if (!adNetworkReady || !adsEnabled || !isAdMobRuntimeConfigured()) return;
    void initializeAdMob().catch((error) => {
      if (__DEV__) console.warn("[ads] AdMob initialization failed; ads remain disabled for this request", error);
    });
  }, [adNetworkReady, adsEnabled]);

  useEffect(() => {
    if (!adsEnabled) {
      setInterstitialVisible(false);
      setBottomSheetVisible(false);
      setInterstitialAd(undefined);
      setBottomSheetAd(undefined);
      pageViewCountRef.current = 0;
      interstitialCountRef.current = 0;
      bottomSheetCountRef.current = 0;
    }
  }, [adsEnabled]);

  useEffect(() => {
    if (!adNetworkReady) return;
    const settingsRef = doc(firestoreDb, "appSettings", "ads");
    const unsubscribe = onSnapshot(settingsRef, (snapshot) => {
      const data = snapshot.data() as AdSettingsDocument | undefined;
      setAdSettings({
        interstitialPageInterval: Number(data?.interstitialPageInterval) || DEFAULT_AD_SETTINGS.interstitialPageInterval,
        interstitialCooldownSeconds: Number(data?.interstitialCooldownSeconds) || DEFAULT_AD_SETTINGS.interstitialCooldownSeconds,
        interstitialInitialDelaySeconds: Number(data?.interstitialInitialDelaySeconds) || DEFAULT_AD_SETTINGS.interstitialInitialDelaySeconds,
        interstitialMaxPerSession: Number(data?.interstitialMaxPerSession) || DEFAULT_AD_SETTINGS.interstitialMaxPerSession,
        bottomSheetCooldownSeconds: Number(data?.bottomSheetCooldownSeconds) || DEFAULT_AD_SETTINGS.bottomSheetCooldownSeconds,
        feedInlineInterval: Number(data?.feedInlineInterval) || DEFAULT_AD_SETTINGS.feedInlineInterval,
        feedInlineFirstIndex: Number(data?.feedInlineFirstIndex) || DEFAULT_AD_SETTINGS.feedInlineFirstIndex
      });
    }, () => setAdSettings(DEFAULT_AD_SETTINGS));

    return () => unsubscribe();
  }, [adNetworkReady]);

  useEffect(() => {
    if (!adNetworkReady || !adsEnabled) {
      setRemoteAds([]);
      return;
    }

    const adsQuery = query(
      collection(firestoreDb, "ads"),
      where("status", "==", "published"),
      limit(80)
    );

    const unsubscribe = onSnapshot(adsQuery, (snapshot) => {
      const now = Date.now();
      setRemoteAds(snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() } as AdDocument))
        .filter((ad) => isAdVisible(ad, now))
        .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned))));
    }, () => setRemoteAds([]));

    return () => unsubscribe();
  }, [adNetworkReady, adsEnabled]);

  const getAdForPlacement = useCallback((placement: AdDocument["placement"] | AdPlacementId) => {
    const requestedPlacement = normalizeAdPlacement(String(placement));
    const candidates = remoteAds.filter((ad) => getAdSlot(ad) === requestedPlacement);
    const visible = candidates.filter((ad) => !ad.hideForPremium || !account.isPremium);
    return visible.find((ad) => ad.language === language || ad.language === "all")
      ?? visible.find((ad) => ad.language === "all")
      ?? visible[0];
  }, [account.isPremium, language, remoteAds]);

  const canShowInterstitial = useCallback((reason: AdReason) => {
    if (!adsEnabled || interstitialVisible || interstitialInFlightRef.current) return false;
    if (reason === "page") {
      const elapsedSinceLaunch = Date.now() - sessionStartedAtRef.current;
      if (elapsedSinceLaunch < adSettings.interstitialInitialDelaySeconds * 1000) return false;
      if (interstitialCountRef.current >= adSettings.interstitialMaxPerSession) return false;
    }
    const cooldownMs = adSettings.interstitialCooldownSeconds * 1000;
    return Date.now() - lastInterstitialAtRef.current > cooldownMs;
  }, [adSettings.interstitialCooldownSeconds, adSettings.interstitialInitialDelaySeconds, adSettings.interstitialMaxPerSession, adsEnabled, interstitialVisible]);

  const presentInterstitial = useCallback(async (reason: AdReason) => {
    const placement = overlayPlacementForReason(reason);
    const ad = getAdForPlacement(placement);
    if (!ad || interstitialInFlightRef.current) return false;

    interstitialInFlightRef.current = true;
    try {
      if (isAdMobDelivery(ad)) {
        if (!canUseAdMobUnit(ad.admobUnitId)) return false;
        const shown = await showAdMobInterstitial(ad.admobUnitId!);
        if (!shown) return false;
        lastInterstitialAtRef.current = Date.now();
        pageViewCountRef.current = 0;
        interstitialCountRef.current += 1;
        return true;
      }

      lastInterstitialAtRef.current = Date.now();
      pageViewCountRef.current = 0;
      interstitialCountRef.current += 1;
      setInterstitialReason(reason);
      setInterstitialAd(ad);
      setInterstitialVisible(true);
      return true;
    } finally {
      interstitialInFlightRef.current = false;
    }
  }, [getAdForPlacement]);

  const maybeShowInterstitialAd = useCallback(async (reason: AdReason) => {
    if (reason !== "page") return false;
    if (!canShowInterstitial(reason)) {
      return false;
    }
    return presentInterstitial(reason);
  }, [canShowInterstitial, presentInterstitial]);

  const trackPageViewForAds = useCallback((pathname: string) => {
    const routeKey = resolveAdRouteKey(pathname);
    if (!adsEnabled || lastRouteKeyRef.current === routeKey || !isInterstitialEligibleRoute(pathname)) {
      lastRouteKeyRef.current = routeKey;
      return;
    }

    lastRouteKeyRef.current = routeKey;
    pageViewCountRef.current += 1;

    if (pageViewCountRef.current >= adSettings.interstitialPageInterval) {
      void maybeShowInterstitialAd("page");
    }
  }, [adSettings.interstitialPageInterval, adsEnabled, maybeShowInterstitialAd]);

  const showBottomSheetAd = useCallback(async () => {
    const cooldownMs = adSettings.bottomSheetCooldownSeconds * 1000;
    if (!adsEnabled || bottomSheetVisible || Date.now() - lastBottomSheetAtRef.current < cooldownMs) {
      return false;
    }
    if (bottomSheetCountRef.current >= adSettings.interstitialMaxPerSession) {
      return false;
    }

    const ad = getAdForPlacement("artwork_detail_sheet");
    if (!ad) {
      return false;
    }

    if (isAdMobDelivery(ad)) {
      if (!canUseAdMobUnit(ad.admobUnitId)) return false;
      const shown = await showAdMobInterstitial(ad.admobUnitId!);
      if (!shown) return false;
      lastBottomSheetAtRef.current = Date.now();
      bottomSheetCountRef.current += 1;
      return true;
    }

    lastBottomSheetAtRef.current = Date.now();
    bottomSheetCountRef.current += 1;
    setBottomSheetAd(ad);
    setBottomSheetVisible(true);
    return true;
  }, [adSettings.bottomSheetCooldownSeconds, adSettings.interstitialMaxPerSession, adsEnabled, bottomSheetVisible, getAdForPlacement]);

  const showRewardedAd = useCallback(async (placement: AdPlacementId = "admob_rewarded") => {
    if (!areRewardedAdRequirementsEnabled() || !adsEnabled) {
      return true;
    }
    const ad = getAdForPlacement(placement);
    if (isAdMobDelivery(ad)) {
      if (!canUseAdMobUnit(ad?.admobUnitId)) return true;
      const { showAdMobRewarded } = await import("@/components/admob-ad");
      return showAdMobRewarded(ad!.admobUnitId!);
    }
    return true;
  }, [adsEnabled, getAdForPlacement]);

  const value = useMemo(
    () => ({
      interstitialVisible,
      interstitialReason,
      interstitialAd,
      bottomSheetVisible,
      bottomSheetAd,
      adsEnabled,
      ads: remoteAds,
      adSettings,
      closeBottomSheetAd: () => {
        setBottomSheetVisible(false);
        setBottomSheetAd(undefined);
      },
      closeInterstitialAd: () => {
        setInterstitialVisible(false);
        setInterstitialAd(undefined);
      },
      getAdForPlacement,
      maybeShowInterstitialAd,
      showBottomSheetAd,
      trackPageViewForAds,
      showRewardedAd
    }),
    [
      adSettings,
      adsEnabled,
      bottomSheetAd,
      bottomSheetVisible,
      getAdForPlacement,
      interstitialAd,
      interstitialReason,
      interstitialVisible,
      maybeShowInterstitialAd,
      remoteAds,
      showBottomSheetAd,
      showRewardedAd,
      trackPageViewForAds
    ]
  );

  return <AdContext.Provider value={value}>{children}</AdContext.Provider>;
}

function getAdSlot(ad: AdDocument) {
  const slot = (ad as AdDocument & { slot?: string }).slot;
  return normalizeAdPlacement(String(slot || ad.placement));
}

function isAdVisible(ad: AdDocument, now: number) {
  const startsAt = timestampToMillis(ad.startsAt);
  const endsAt = timestampToMillis(ad.endsAt);
  return (!startsAt || startsAt <= now) && (!endsAt || endsAt >= now);
}

function timestampToMillis(value: unknown) {
  if (!value) return 0;
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  return 0;
}
