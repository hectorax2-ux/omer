import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDocFromServer } from "firebase/firestore";
import { firestoreDb } from "@/src/services/firebase/core";

export type AppVersionConfig = {
  iosLatestVersion: string;
  iosMinimumVersion: string;
  androidLatestVersion: string;
  androidMinimumVersion: string;
  iosForceUpdate: boolean;
  androidForceUpdate: boolean;
  iosStoreUrl: string;
  androidStoreUrl: string;
};

const CACHE_KEY = "art-atlas:last-known-version-config";
const DEFAULT_IOS_STORE_URL = "https://apps.apple.com/app/id6792671640";
const DEFAULT_ANDROID_STORE_URL = "https://play.google.com/store/apps/details?id=com.artatlas.app";
const VERSION_CONFIG_TIMEOUT_MS = 5000;

export async function loadAppVersionConfig() {
  try {
    const snapshot = await Promise.race([
      getDocFromServer(doc(firestoreDb, "appSettings", "versionControl")),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error("VERSION_CONFIG_TIMEOUT")), VERSION_CONFIG_TIMEOUT_MS))
    ]);
    if (snapshot.exists()) {
      const config = normalizeAppVersionConfig(snapshot.data());
      await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(config)).catch(() => undefined);
      return config;
    }
  } catch (error) {
    if (__DEV__) console.warn("[version-control] remote config read failed", error);
  }

  const cached = await AsyncStorage.getItem(CACHE_KEY).catch(() => null);
  if (!cached) return null;

  try {
    return normalizeAppVersionConfig(JSON.parse(cached) as Record<string, unknown>);
  } catch (error) {
    if (__DEV__) console.warn("[version-control] cached config is invalid", error);
    return null;
  }
}

function normalizeAppVersionConfig(data: Record<string, unknown>): AppVersionConfig {
  return {
    iosLatestVersion: versionValue(data.iosLatestVersion),
    iosMinimumVersion: versionValue(data.iosMinimumVersion),
    androidLatestVersion: versionValue(data.androidLatestVersion),
    androidMinimumVersion: versionValue(data.androidMinimumVersion),
    iosForceUpdate: data.iosForceUpdate === true,
    androidForceUpdate: data.androidForceUpdate === true,
    iosStoreUrl: urlValue(data.iosStoreUrl, DEFAULT_IOS_STORE_URL),
    androidStoreUrl: urlValue(data.androidStoreUrl, DEFAULT_ANDROID_STORE_URL)
  };
}

function versionValue(value: unknown) {
  return typeof value === "string" && /^v?\d+(?:\.\d+){0,3}(?:[-+][0-9A-Za-z.-]+)?$/.test(value.trim())
    ? value.trim()
    : "0.0.0";
}

function urlValue(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return /^https:\/\//i.test(trimmed) ? trimmed : fallback;
}
