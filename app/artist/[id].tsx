import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { DetailScreenState } from "@/components/detail-screen-state";
import { ZoomableHeroImage } from "@/components/zoomable-hero-image";
import { getThemeColors } from "@/constants/theme";
import { useArtist } from "@/hooks/use-artists";
import { useArtworks } from "@/hooks/use-artworks";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { commonCopy } from "@/app/i18n/common";
import { t } from "@/utils/localized-text";

export default function ArtistDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { artist, loading } = useArtist(id);
  const { artworks } = useArtworks();

  if (loading || !artist) {
    return (
      <AppChrome title="Art Atlas" eyebrow="Artists" showBackButton backToHome>
        <DetailScreenState
          emptyLabel={t(commonCopy.artistUnavailable, language)}
          hasContent={false}
          loading={loading}
          loadingLabel={t(commonCopy.detailPreparing, language)}
        />
      </AppChrome>
    );
  }

  const artistNames = [artist.name.tr, artist.name.en, artist.name.ru, artist.name.uz].map(normalizeName).filter(Boolean);
  const featured = artworks.filter((artwork) => {
    if (artist.featuredArtworkIds.includes(artwork.id)) return true;
    const artworkArtistNames = [artwork.artist.tr, artwork.artist.en, artwork.artist.ru, artwork.artist.uz].map(normalizeName);
    return artworkArtistNames.some((name) => artistNames.includes(name));
  });

  return (
    <AppChrome title={artist.name[language]} eyebrow={artist.movement[language]} showBackButton>
      <DetailScreenState
        emptyLabel={t(commonCopy.artistUnavailable, language)}
        hasContent
        loading={loading}
        loadingLabel={t(commonCopy.detailPreparing, language)}
      >
      <ZoomableHeroImage uri={artist.image} imageFocus={artist.imageFocus} containerStyle={styles.hero} />
      <View style={styles.panel}>
        <Text style={styles.name}>{artist.name[language]}</Text>
        <Text style={styles.meta}>{artist.life} · {artist.country[language]}</Text>
        <Text style={styles.bio}>{artist.biography[language]}</Text>
      </View>
      <Text style={styles.sectionTitle}>{language === "tr" ? "Öne çıkan eserleri" : "Featured artworks"}</Text>
      <View style={styles.artworks}>
        {featured.map((artwork) => (
          <Pressable key={artwork.id} onPress={() => router.push({ pathname: "/artwork/[id]", params: { id: artwork.id } })} style={styles.artworkCard}>
            <Image source={{ uri: artwork.image }} style={styles.artworkImage} contentFit="cover" />
            <View style={styles.artworkInfo}>
              <Text style={styles.artworkTitle}>{artwork.title[language]}</Text>
              <Text style={styles.artworkMeta}>{artwork.year}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </View>
      </DetailScreenState>
    </AppChrome>
  );
}

function normalizeName(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .replaceAll("İ", "i")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ş", "s")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
    .replace(/\s+/g, " ");
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
return StyleSheet.create({
  hero: { width: "100%", height: 260, borderRadius: 8, borderWidth: 1, borderColor: colors.line },
  panel: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 16, marginTop: 14, gap: 8 },
  name: { color: colors.ivory, fontSize: 24, fontWeight: "900" },
  meta: { color: colors.gold, fontWeight: "900" },
  bio: { color: colors.ivory, fontSize: 15, lineHeight: 23 },
  sectionTitle: { color: colors.ivory, fontSize: 18, fontWeight: "900", marginTop: 18, marginBottom: 10 },
  artworks: { gap: 10 },
  artworkCard: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
  artworkImage: { width: 58, height: 58, borderRadius: 8 },
  artworkInfo: { flex: 1 },
  artworkTitle: { color: colors.ivory, fontWeight: "900" },
  artworkMeta: { color: colors.muted, fontSize: 12, fontWeight: "800", marginTop: 4 },
  missing: { color: colors.ivory, fontWeight: "900" }
});
}
