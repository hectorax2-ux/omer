import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { AppChrome } from "@/components/app-chrome";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";

type Localized = Record<"tr" | "en" | "ru" | "uz", string>;

export function LegalPage({ title, eyebrow = "Art Atlas", body }: { title: Localized; eyebrow?: string; body: Localized }) {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <AppChrome title={title[language]} eyebrow={eyebrow} showBackButton backToHome>
      <View style={styles.panel}>
        <Text style={styles.body}>{body[language]}</Text>
      </View>
    </AppChrome>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    panel: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 16 },
    body: { color: colors.ivory, fontSize: 14, lineHeight: 23, fontWeight: "700" }
  });
}
