import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { DetailScreenState } from "@/components/detail-screen-state";
import { ZoomableHeroImage } from "@/components/zoomable-hero-image";
import { getThemeColors } from "@/constants/theme";
import { useArtworks } from "@/hooks/use-artworks";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { useMuseum } from "@/hooks/use-museums";
import { commonCopy } from "@/app/i18n/common";
import { t } from "@/utils/localized-text";

export default function MuseumDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { museum, loading } = useMuseum(id);
  const { artworks } = useArtworks();
  const museumArtworks = museum ? artworks.filter((artwork) => museum.artworkIds.includes(artwork.id)) : [];

  if (!museum) {
    return (
      <AppChrome title="Art Atlas" eyebrow="Museums" showBackButton backToHome>
        <DetailScreenState
          emptyLabel={t(commonCopy.museumUnavailable, language)}
          hasContent={false}
          loading={loading}
          loadingLabel={t(commonCopy.detailPreparing, language)}
        />
      </AppChrome>
    );
  }

  return (
    <AppChrome title={museum.name[language]} eyebrow={`${museum.city[language]} · ${museum.country[language]}`} showBackButton>
      <DetailScreenState
        emptyLabel={t(commonCopy.museumUnavailable, language)}
        hasContent
        loading={loading}
        loadingLabel={t(commonCopy.detailPreparing, language)}
      >
      <ZoomableHeroImage uri={museum.image} containerStyle={styles.hero} />
      <View style={styles.panel}>
        <Text style={styles.desc}>{museum.description[language]}</Text>
      </View>
      <Text style={styles.sectionTitle}>{language === "tr" ? "Bu müzedeki eserler" : "Artworks in this museum"}</Text>
      <View style={styles.list}>
        {museumArtworks.map((artwork) => (
          <Pressable key={artwork.id} onPress={() => router.push({ pathname: "/artwork/[id]", params: { id: artwork.id } })} style={styles.row}>
            <Image source={{ uri: artwork.image }} style={styles.thumb} contentFit="cover" />
            <View style={styles.rowInfo}>
              <Text style={styles.title}>{artwork.title[language]}</Text>
              <Text style={styles.meta}>{artwork.artist[language]}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.muted} />
          </Pressable>
        ))}
      </View>
      </DetailScreenState>
    </AppChrome>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
return StyleSheet.create({
  hero: { width: "100%", height: 230, borderRadius: 8, borderWidth: 1, borderColor: colors.line },
  panel: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 14, marginTop: 12 },
  desc: { color: colors.ivory, lineHeight: 22, fontWeight: "700" },
  sectionTitle: { color: colors.ivory, fontSize: 18, fontWeight: "900", marginTop: 16, marginBottom: 10 },
  list: { gap: 10 },
  row: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
  thumb: { width: 58, height: 58, borderRadius: 8 },
  rowInfo: { flex: 1 },
  title: { color: colors.ivory, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 12, fontWeight: "800", marginTop: 4 },
  empty: { color: colors.ivory }
});
}
