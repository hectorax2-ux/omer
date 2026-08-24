import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";

const noticeCopy = {
  tr: "Bu özelliği kullanmak için hesabınla giriş yap.",
  en: "Log in to your account to use this feature.",
  ru: "Войдите в аккаунт, чтобы использовать эту функцию.",
  uz: "Bu funksiyadan foydalanish uchun hisobingizga kiring."
};

export function AuthActionNotice({ trigger }: { trigger: number }) {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!trigger) return;
    setVisible(true);
    const timer = setTimeout(() => setVisible(false), 2400);
    return () => clearTimeout(timer);
  }, [trigger]);

  if (!visible) return null;

  return (
    <View style={styles.notice} accessibilityLiveRegion="polite">
      <Ionicons name="log-in-outline" size={17} color={colors.gold} />
      <Text style={styles.text}>{noticeCopy[language]}</Text>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    notice: {
      minHeight: 42,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panelSoft,
      paddingHorizontal: 12,
      paddingVertical: 9,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8
    },
    text: { flex: 1, color: colors.ivory, fontSize: 12, lineHeight: 17, fontWeight: "800" }
  });
}
