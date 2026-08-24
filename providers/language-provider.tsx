import { createContext, PropsWithChildren, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getLocales } from "expo-localization";
import { Language } from "@/types/content";

const LANGUAGE_KEY = "art-atlas/language";
const LANGUAGE_CHOSEN_KEY = "art-atlas/language-chosen";

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  hasChosenLanguage: boolean;
  isLanguageReady: boolean;
  confirmLanguage: (language: Language) => void;
};

export const LanguageContext = createContext<LanguageContextValue>({
  language: "tr",
  setLanguage: () => undefined,
  hasChosenLanguage: false,
  isLanguageReady: false,
  confirmLanguage: () => undefined
});

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguageState] = useState<Language>(() => detectInitialLanguage());
  const [hasChosenLanguage, setHasChosenLanguage] = useState(false);
  const [isLanguageReady, setIsLanguageReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    AsyncStorage.multiGet([LANGUAGE_KEY, LANGUAGE_CHOSEN_KEY])
      .then((entries) => {
        if (!mounted) return;
        const storedLanguage = entries[0]?.[1];
        const validLanguage = isLanguage(storedLanguage) ? storedLanguage : undefined;
        if (validLanguage) setLanguageState(validLanguage);
        setHasChosenLanguage(Boolean(validLanguage) && entries[1]?.[1] === "true");
      })
      .catch((error) => {
        console.warn("[Language] Saved language could not be restored.", error);
      })
      .finally(() => {
        if (mounted) setIsLanguageReady(true);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      language,
      setLanguage: (nextLanguage: Language) => {
        setLanguageState(nextLanguage);
        AsyncStorage.setItem(LANGUAGE_KEY, nextLanguage).catch((error) => {
          console.warn("[Language] Language change could not be saved.", error);
        });
      },
      hasChosenLanguage,
      isLanguageReady,
      confirmLanguage: (nextLanguage: Language) => {
        setLanguageState(nextLanguage);
        setHasChosenLanguage(true);
        AsyncStorage.multiSet([
          [LANGUAGE_KEY, nextLanguage],
          [LANGUAGE_CHOSEN_KEY, "true"]
        ]).catch((error) => {
          console.warn("[Language] Initial language choice could not be saved.", error);
        });
      }
    }),
    [hasChosenLanguage, isLanguageReady, language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

function isLanguage(value: string | null | undefined): value is Language {
  return value === "tr" || value === "en" || value === "ru" || value === "uz";
}

function detectInitialLanguage(): Language {
  const locale = getLocales()[0];
  const languageCode = locale?.languageCode?.toLowerCase();
  const regionCode = locale?.regionCode?.toLowerCase();

  if (languageCode === "tr" || regionCode === "tr") return "tr";
  if (languageCode === "ru" || regionCode === "ru") return "ru";
  if (languageCode === "uz" || regionCode === "uz") return "uz";
  return "en";
}
