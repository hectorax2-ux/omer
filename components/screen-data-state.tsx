import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ArtAtlasLoader } from "@/components/art-atlas-loader";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";

type Props = {
  status: "loading" | "error";
  onRetry?: () => void;
};

const copy = {
  loading: { tr: "İçerik hazırlanıyor", en: "Preparing content", ru: "Подготовка контента", uz: "Kontent tayyorlanmoqda" },
  error: { tr: "İçerik şu anda alınamadı. Bağlantını kontrol edip yeniden dene.", en: "Content is unavailable right now. Check your connection and try again.", ru: "Контент сейчас недоступен. Проверьте подключение и повторите попытку.", uz: "Kontent hozircha olinmadi. Ulanishni tekshirib, qayta urinib ko'ring." },
  retry: { tr: "Yeniden dene", en: "Try again", ru: "Повторить", uz: "Qayta urinish" }
};

export function ScreenDataState({ status, onRetry }: Props) {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);

  if (status === "loading") {
    return <ArtAtlasLoader visible variant="detail" label={copy.loading[language]} />;
  }

  return (
    <View style={styles.state}>
      <Ionicons name="cloud-offline-outline" size={30} color={colors.gold} />
      <Text style={[styles.message, { color: colors.muted }]}>{copy.error[language]}</Text>
      {onRetry ? (
        <Pressable accessibilityRole="button" onPress={onRetry} style={[styles.retry, { borderColor: colors.gold }]}>
          <Text style={[styles.retryText, { color: colors.gold }]}>{copy.retry[language]}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    minHeight: 260,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24
  },
  message: {
    maxWidth: 360,
    textAlign: "center",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700"
  },
  retry: {
    minWidth: 124,
    minHeight: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18
  },
  retryText: {
    fontSize: 13,
    fontWeight: "800"
  }
});
