import { Platform } from "react-native";

export const GOOGLE_TEST_APP_IDS = {
  android: "ca-app-pub-3940256099942544~3347511713",
  ios: "ca-app-pub-3940256099942544~1458002511"
} as const;

export const GOOGLE_TEST_AD_UNITS = {
  banner: "ca-app-pub-3940256099942544/6300978111",
  interstitial: "ca-app-pub-3940256099942544/1033173712",
  rewarded: "ca-app-pub-3940256099942544/5224354917"
} as const;

export function isProductionChannel() {
  return process.env.EXPO_PUBLIC_APP_CHANNEL === "production";
}

export function isGoogleTestAdUnit(unitId: string) {
  return unitId.includes("3940256099942544");
}

export function areAdsGloballyEnabled() {
  return process.env.EXPO_PUBLIC_ADS_ENABLED?.trim().toLowerCase() !== "false";
}

export function canUseAdMobUnit(unitId?: string) {
  if (!areAdsGloballyEnabled() || !unitId) return false;
  const trimmed = unitId.trim();
  if (!/^ca-app-pub-\d{16}\/\d{10}$/.test(trimmed)) return false;
  if (/(placeholder|your[_-]?ad|sample|example)/i.test(trimmed)) return false;
  return !(isProductionChannel() && isGoogleTestAdUnit(trimmed));
}

export function isAdMobRuntimeConfigured() {
  if (!areAdsGloballyEnabled() || (Platform.OS !== "ios" && Platform.OS !== "android")) return false;
  return /^ca-app-pub-\d{16}~\d{10}$/.test(resolveAdMobAppId(Platform.OS));
}

export function resolveAdMobAppId(platform: "android" | "ios") {
  const fromEnv = platform === "android"
    ? process.env.EXPO_PUBLIC_ADMOB_ANDROID_APP_ID?.trim()
    : process.env.EXPO_PUBLIC_ADMOB_IOS_APP_ID?.trim();

  if (fromEnv) {
    return fromEnv;
  }

  if (isProductionChannel()) {
    return "";
  }

  return GOOGLE_TEST_APP_IDS[platform];
}

export function resolveDefaultAdUnit(kind: keyof typeof GOOGLE_TEST_AD_UNITS) {
  const platformPrefix = Platform.OS === "ios" ? "IOS" : "ANDROID";
  const platformValue = kind === "banner"
    ? platformPrefix === "IOS" ? process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID : process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_UNIT_ID
    : kind === "interstitial"
      ? platformPrefix === "IOS" ? process.env.EXPO_PUBLIC_ADMOB_IOS_INTERSTITIAL_UNIT_ID : process.env.EXPO_PUBLIC_ADMOB_ANDROID_INTERSTITIAL_UNIT_ID
      : platformPrefix === "IOS" ? process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_UNIT_ID : process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_UNIT_ID;
  const envKey = platformValue ?? (kind === "banner"
    ? process.env.EXPO_PUBLIC_ADMOB_BANNER_UNIT_ID
    : kind === "interstitial"
      ? process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_UNIT_ID
      : process.env.EXPO_PUBLIC_ADMOB_REWARDED_UNIT_ID);

  const fromEnv = envKey?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  if (isProductionChannel() || process.env.EXPO_PUBLIC_ADS_USE_TEST_IDS !== "true") {
    return "";
  }

  return GOOGLE_TEST_AD_UNITS[kind];
}
