import { useCallback, useMemo } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { CoverImage } from "@/components/cover-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { getThemeColors } from "@/constants/theme";
import { useArtists } from "@/hooks/use-artists";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { getStandardListPerformanceProps } from "@/constants/list-performance";
import { useRuntimePerformanceMode } from "@/hooks/use-runtime-performance-mode";

export default function ArtistsScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { artists } = useArtists();
  const performanceMode = useRuntimePerformanceMode();
  const renderArtist = useCallback(({ item: artist }: { item: (typeof artists)[number] }) => (
    <Pressable onPress={() => router.push({ pathname: "/artist/[id]", params: { id: artist.id } })} style={styles.card}>
      <CoverImage source={{ uri: artist.image }} recyclingKey={artist.id} style={styles.image} imageFocus={artist.imageFocus} />
      <View style={styles.info}>
        <Text style={styles.name}>{artist.name[language]}</Text>
        <Text style={styles.meta}>{artist.life} · {artist.country[language]}</Text>
        <Text style={styles.movement}>{artist.movement[language]}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  ), [colors.muted, language, router, styles]);

  return (
    <AppChrome title={language === "tr" ? "Sanatçılar" : "Artists"} eyebrow="Art Atlas" showBackButton backToHome scroll={false}>
      <FlatList
        data={artists}
        renderItem={renderArtist}
        keyExtractor={(artist) => artist.id}
        contentContainerStyle={styles.list}
        {...getStandardListPerformanceProps(performanceMode)}
      />
    </AppChrome>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
return StyleSheet.create({
  list: { gap: 12, paddingBottom: 110 },
  card: {
    minHeight: 92,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 10
  },
  image: { width: 70, height: 70, borderRadius: 8 },
  info: { flex: 1, minWidth: 0 },
  name: { color: colors.ivory, fontSize: 17, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 12, fontWeight: "800", marginTop: 4 },
  movement: { color: colors.gold, fontSize: 12, fontWeight: "900", marginTop: 5 }
});
}
