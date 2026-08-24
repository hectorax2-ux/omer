import { useEffect, useMemo } from "react";
import { Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppChrome } from "@/components/app-chrome";
import { APP_STORE_URL, PLAY_STORE_URL, appStoreLinkForPlatform, storeLinkForUserAgent } from "@/constants/app-links";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";

const copy = {
  tr: { title: "Art Atlas'ı indir", text: "Cihazına uygun mağazaya yönlendiriliyorsun.", ios: "App Store", android: "Google Play" },
  en: { title: "Download Art Atlas", text: "You are being redirected to the store for your device.", ios: "App Store", android: "Google Play" },
  ru: { title: "Скачать Art Atlas", text: "Перенаправляем в магазин для вашего устройства.", ios: "App Store", android: "Google Play" },
  uz: { title: "Art Atlas'ni yuklab oling", text: "Qurilmangizga mos do'konga yo'naltirilmoqdasiz.", ios: "App Store", android: "Google Play" }
};

export default function InviteRedirectScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);

  useEffect(() => {
    const target = Platform.OS === "web"
      ? storeLinkForUserAgent(globalThis.navigator?.userAgent ?? "")
      : appStoreLinkForPlatform();
    if (target) void Linking.openURL(target);
  }, []);

  return (
    <AppChrome title="Art Atlas" eyebrow="Invite" showBottomDock={false}>
      <View style={styles.card}>
        <Ionicons name="phone-portrait-outline" size={38} color={colors.gold} />
        <Text style={styles.title}>{copy[language].title}</Text>
        <Text style={styles.text}>{copy[language].text}</Text>
        <Pressable onPress={() => void Linking.openURL(APP_STORE_URL)} style={styles.button}><Text style={styles.buttonText}>{copy[language].ios}</Text></Pressable>
        <Pressable onPress={() => void Linking.openURL(PLAY_STORE_URL)} style={styles.button}><Text style={styles.buttonText}>{copy[language].android}</Text></Pressable>
      </View>
    </AppChrome>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    card: { borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 22, alignItems: "center", gap: 12 },
    title: { color: colors.ivory, fontSize: 23, fontWeight: "900", textAlign: "center" },
    text: { color: colors.muted, lineHeight: 20, fontWeight: "700", textAlign: "center", marginBottom: 4 },
    button: { alignSelf: "stretch", minHeight: 46, borderRadius: 12, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
    buttonText: { color: colors.ink, fontWeight: "900" }
  });
}
