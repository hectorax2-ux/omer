import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { CoverImage } from "@/components/cover-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { getThemeColors } from "@/constants/theme";
import { useArtworks } from "@/hooks/use-artworks";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEngagement } from "@/hooks/use-engagement";
import { useLanguage } from "@/hooks/use-language";

export default function FavoritesScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { favoriteArtworkIds, toggleFavorite } = useEngagement();
  const { artworks } = useArtworks();
  const favorites = artworks.filter((artwork) => favoriteArtworkIds.includes(artwork.id));

  return (
    <AppChrome title={language === "tr" ? "Favoriler" : "Favorites"} eyebrow="Art Atlas" showBackButton backToHome>
      {favorites.length ? (
        <View style={styles.list}>
          {favorites.map((artwork) => (
            <Pressable key={artwork.id} onPress={() => router.push({ pathname: "/artwork/[id]", params: { id: artwork.id } })} style={styles.card}>
              <CoverImage source={{ uri: artwork.image }} style={styles.image} imageFocus={artwork.imageFocus} />
              <View style={styles.info}>
                <Text style={styles.title}>{artwork.title[language]}</Text>
                <Text style={styles.meta}>{artwork.artist[language]} · {artwork.period[language]}</Text>
              </View>
              <Pressable onPress={() => toggleFavorite(artwork.id)} style={styles.iconButton}>
                <Ionicons name="bookmark" size={18} color={colors.gold} />
              </Pressable>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.empty}>
          <Ionicons name="bookmark-outline" size={28} color={colors.gold} />
          <Text style={styles.emptyText}>{language === "tr" ? "Henüz favori eser eklenmedi." : "No favorite artworks yet."}</Text>
        </View>
      )}
    </AppChrome>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
return StyleSheet.create({
  list: { gap: 12 },
  card: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
  image: { width: 62, height: 62, borderRadius: 8 },
  info: { flex: 1, minWidth: 0 },
  title: { color: colors.ivory, fontSize: 15, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 4 },
  iconButton: { width: 38, height: 38, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.panelSoft },
  empty: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: "center", gap: 8, padding: 24 },
  emptyText: { color: colors.ivory, fontWeight: "900", textAlign: "center" }
});
}
