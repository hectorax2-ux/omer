import AsyncStorage from "@react-native-async-storage/async-storage";
import { createContext, PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react";
import { AppTheme, appThemes } from "@/constants/theme";

type ThemeContextValue = {
  theme: AppTheme;
  isThemeReady: boolean;
  setTheme: (theme: AppTheme) => void;
  toggleTheme: () => void;
};

export const ThemeContext = createContext<ThemeContextValue>({
  theme: "dali",
  isThemeReady: false,
  setTheme: () => undefined,
  toggleTheme: () => undefined
});

const THEME_STORAGE_KEY = "art_atlas_theme";

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<AppTheme>("dali");
  const [isThemeReady, setIsThemeReady] = useState(false);
  const setTheme = useCallback((nextTheme: AppTheme) => {
    setThemeState(nextTheme);
    void AsyncStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  }, []);

  useEffect(() => {
    void AsyncStorage.getItem(THEME_STORAGE_KEY)
      .then((savedTheme) => {
        if (appThemes.some((item) => item === savedTheme)) {
          setThemeState(savedTheme as AppTheme);
        }
      })
      .finally(() => setIsThemeReady(true));
  }, []);

  const value = useMemo(() => ({
    theme,
    isThemeReady,
    setTheme,
    toggleTheme: () => {
      const currentIndex = appThemes.findIndex((item) => item === theme);
      setTheme(appThemes[(currentIndex + 1) % appThemes.length]);
    }
  }), [isThemeReady, setTheme, theme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
