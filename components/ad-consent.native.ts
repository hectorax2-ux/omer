import Constants from "expo-constants";
import { Platform } from "react-native";
import {
  AdPersonalizationPreference,
  getAdPersonalizationPreference,
  isNonPersonalizedAdsOnly,
  setAdPersonalizationPreference
} from "@/utils/ad-privacy-preference";

let requestNonPersonalizedAdsOnly = true;
let consentReady = false;
let manualPreference: AdPersonalizationPreference | null = null;

type AdsConsentModule = {
  gatherConsent: () => Promise<void>;
  getUserChoices: () => Promise<{
    storeAndAccessInformationOnDevice?: boolean;
    selectPersonalisedAds?: boolean;
    createAPersonalisedAdsProfile?: boolean;
  }>;
  showPrivacyOptionsForm: () => Promise<void>;
};

function getAdsConsent() {
  if (Constants.executionEnvironment === "storeClient" || Constants.appOwnership === "expo") {
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- Expo Go must not load this native module at startup.
    const googleMobileAds = require("react-native-google-mobile-ads") as { AdsConsent?: AdsConsentModule };
    return googleMobileAds.AdsConsent ?? null;
  } catch {
    return null;
  }
}

export function getAdRequestOptions() {
  if (manualPreference) {
    return { requestNonPersonalizedAdsOnly: isNonPersonalizedAdsOnly(manualPreference) };
  }
  return { requestNonPersonalizedAdsOnly };
}

export function isAdConsentReady() {
  return consentReady;
}

export async function prepareAdPrivacy(): Promise<void> {
  manualPreference = await getAdPersonalizationPreference();
  const AdsConsent = getAdsConsent();

  if (Platform.OS === "ios") {
    try {
      const { requestTrackingPermissionsAsync, getTrackingPermissionsAsync } = await import("expo-tracking-transparency");
      const current = await getTrackingPermissionsAsync();
      if (current.status === "undetermined") {
        await requestTrackingPermissionsAsync();
      }
    } catch {
      // Tracking permission is optional; ads can still run with UMP/NPA settings.
    }
  }

  if (!AdsConsent) {
    requestNonPersonalizedAdsOnly = true;
    consentReady = true;
    return;
  }

  try {
    await AdsConsent.gatherConsent();
    if (!manualPreference) {
      const choices = await AdsConsent.getUserChoices();
      const personalizedAllowed = Boolean(
        choices.storeAndAccessInformationOnDevice &&
        choices.selectPersonalisedAds &&
        choices.createAPersonalisedAdsProfile
      );
      requestNonPersonalizedAdsOnly = !personalizedAllowed;
    }
  } catch {
    if (!manualPreference) {
      requestNonPersonalizedAdsOnly = true;
    }
  } finally {
    consentReady = true;
  }
}

export async function showAdPrivacyOptions(): Promise<void> {
  const AdsConsent = getAdsConsent();
  if (!AdsConsent) {
    return;
  }

  await AdsConsent.showPrivacyOptionsForm();
  try {
    const choices = await AdsConsent.getUserChoices();
    requestNonPersonalizedAdsOnly = !choices.selectPersonalisedAds;
    manualPreference = null;
    await setAdPersonalizationPreference(requestNonPersonalizedAdsOnly ? "non_personalized" : "personalized");
    manualPreference = requestNonPersonalizedAdsOnly ? "non_personalized" : "personalized";
  } catch {
    requestNonPersonalizedAdsOnly = true;
  }
}

export function canServePersonalizedAds() {
  if (manualPreference) {
    return manualPreference === "personalized";
  }
  return !requestNonPersonalizedAdsOnly;
}

export async function applyAdPrivacyPreference(preference: AdPersonalizationPreference): Promise<void> {
  await setAdPersonalizationPreference(preference);
  manualPreference = preference;
  requestNonPersonalizedAdsOnly = isNonPersonalizedAdsOnly(preference);
}

export function getCachedAdPrivacyPreference() {
  return manualPreference;
}
