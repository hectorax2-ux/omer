import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { getThemeColors } from "@/constants/theme";
import { useArtSystems } from "@/hooks/use-art-systems";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";

export default function MuseumFindScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { personalMuseums } = useArtSystems();
  const museums = useMemo(() => shuffleItems(personalMuseums.filter((museum) => museum.active)), [personalMuseums]);

  return (
    <AppChrome title={language === "tr" ? "Müze Keşfi" : language === "ru" ? "Поиск музеев" : language === "uz" ? "Muzey kashfiyoti" : "Museum Explore"} eyebrow="Art Atlas" showBackButton backToHome>
      <View style={styles.grid}>
        {museums.map((museum) => (
          <Pressable key={museum.id} onPress={() => router.push({ pathname: "/user-museum/[username]", params: { username: museum.ownerUsername } })} style={styles.card}>
            <Image source={{ uri: museum.coverImage }} style={styles.image} contentFit="cover" />
            <Text style={styles.title} numberOfLines={1}>{museum.name}</Text>
            <Text style={styles.meta} numberOfLines={1}>{museum.ownerName}</Text>
          </Pressable>
        ))}
      </View>
      {!museums.length ? <Text style={styles.empty}>{language === "tr" ? "Henüz aktif kullanıcı müzesi yok." : "No active user museums yet."}</Text> : null}
    </AppChrome>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    card: { width: "48.5%", borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel },
    image: { width: "100%", aspectRatio: 1.1 },
    title: { color: colors.ivory, fontWeight: "900", paddingHorizontal: 10, paddingTop: 10 },
    meta: { color: colors.muted, fontSize: 11, fontWeight: "800", paddingHorizontal: 10, paddingBottom: 10, paddingTop: 2 },
    empty: { color: colors.muted, fontWeight: "900", textAlign: "center", marginTop: 18 }
  });
}

function shuffleItems<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}
