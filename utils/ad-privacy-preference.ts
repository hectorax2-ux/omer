import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "artatlas:ad-personalization";

export type AdPersonalizationPreference = "personalized" | "non_personalized";

export async function getAdPersonalizationPreference(): Promise<AdPersonalizationPreference | null> {
  const value = await AsyncStorage.getItem(STORAGE_KEY);
  if (value === "personalized" || value === "non_personalized") {
    return value;
  }
  return null;
}

export async function setAdPersonalizationPreference(value: AdPersonalizationPreference): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, value);
}

export function isNonPersonalizedAdsOnly(preference: AdPersonalizationPreference | null): boolean {
  return preference !== "personalized";
}

export function adPrivacyStatusLabel(preference: AdPersonalizationPreference | null, language: "tr" | "en" | "ru" | "uz"): string {
  if (preference === "personalized") {
    return {
      tr: "Kişiselleştirilmiş reklamlar açık",
      en: "Personalized ads enabled",
      ru: "Персонализированная реклама включена",
      uz: "Shaxsiylashtirilgan reklamalar yoqilgan"
    }[language];
  }

  return {
    tr: "Kişiselleştirilmemiş reklamlar (varsayılan)",
    en: "Non-personalized ads (default)",
    ru: "Неперсонализированная реклама (по умолчанию)",
    uz: "Shaxsiylashtirilmagan reklamalar (standart)"
  }[language];
}
