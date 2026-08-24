import {
  AdPersonalizationPreference,
  getAdPersonalizationPreference,
  isNonPersonalizedAdsOnly,
  setAdPersonalizationPreference
} from "@/utils/ad-privacy-preference";

let cachedPreference: AdPersonalizationPreference | null = null;

export function getAdRequestOptions() {
  return { requestNonPersonalizedAdsOnly: isNonPersonalizedAdsOnly(cachedPreference) };
}

export function isAdConsentReady() {
  return true;
}

export async function prepareAdPrivacy(): Promise<void> {
  cachedPreference = await getAdPersonalizationPreference();
}

export async function showAdPrivacyOptions(): Promise<void> {
  return;
}

export function canServePersonalizedAds() {
  return cachedPreference === "personalized";
}

export async function applyAdPrivacyPreference(preference: AdPersonalizationPreference): Promise<void> {
  await setAdPersonalizationPreference(preference);
  cachedPreference = preference;
}

export function getCachedAdPrivacyPreference() {
  return cachedPreference;
}
