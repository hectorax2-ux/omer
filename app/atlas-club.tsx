import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { homeCopy } from "@/app/i18n/common";
import { radii, v2Colors } from "@/constants/design";
import { safeTextLayout } from "@/constants/text-layout";
import { getThemeColors } from "@/constants/theme";
import { artworks, copy, uiCopy } from "@/data/content";
import { QuickDiscovery, type HomeActionItem } from "@/features/home/components/discovery-sections";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { t } from "@/utils/localized-text";

export default function AtlasClubScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const actions: HomeActionItem[] = [
    { id: "competition", icon: "color-palette", title: copy.communityArt[language], subtitle: copy.newArtworks[language], accent: "pink", image: artworks[5].image, imageFocus: { x: 72, y: 48 }, onPress: () => router.push("/(tabs)/ranking") },
    { id: "games", icon: "game-controller", title: uiCopy.games[language], subtitle: t(homeCopy.gamesSubtitle, language), accent: "violet", image: artworks[3].image, imageFocus: { x: 72, y: 50 }, onPress: () => router.push("/games") },
    { id: "chance", icon: "sparkles", title: t(homeCopy.chanceCard, language), subtitle: t(homeCopy.chanceSubtitle, language), accent: "gold", image: artworks[6].image, imageFocus: { x: 72, y: 48 }, onPress: () => router.push("/chance-card") },
    { id: "duels", icon: "flash", title: t(homeCopy.seerDuel, language), subtitle: t(homeCopy.duelSubtitle, language), accent: "pink", image: artworks[8].image, imageFocus: { x: 70, y: 45 }, onPress: () => router.push("/duels") },
    { id: "profiles", icon: "compass", title: uiCopy.discover[language], subtitle: uiCopy.discoverSubtitle[language], accent: "blue", image: artworks[2].image, imageFocus: { x: 72, y: 38 }, onPress: () => router.push("/discover") },
    { id: "leaderboards", icon: "bar-chart", title: copy.ranking[language], subtitle: t(homeCopy.rankingSubtitle, language), accent: "violet", image: artworks[1].image, imageFocus: { x: 70, y: 38 }, onPress: () => router.push("/leaderboards") }
  ];

  return (
    <AppChrome title={t(homeCopy.atlasClub, language)} eyebrow="Art Atlas" showBackButton backToHome showTopAd={false}>
      <LinearGradient colors={["rgba(76,43,135,0.52)", "rgba(17,26,53,0.72)"]} style={[styles.intro, { borderColor: colors.line }]}>
        <View style={styles.accentLine} />
        <Text style={[styles.eyebrow, { color: colors.gold }]}>ART ATLAS · ATLAS CLUB</Text>
        <Text style={[styles.title, { color: colors.ivory }]}>{t(homeCopy.atlasClubTagline, language)}</Text>
        <Text style={[styles.description, { color: colors.muted }]}>{t(homeCopy.atlasClubDescription, language)}</Text>
      </LinearGradient>
      <QuickDiscovery theme={theme} title={t(homeCopy.challengesGames, language)} items={actions} accent={v2Colors.premium} variant="games" />
    </AppChrome>
  );
}

const styles = StyleSheet.create({
  intro: {
    marginTop: 16,
    minHeight: 132,
    borderRadius: radii.xl,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    paddingHorizontal: 18,
    paddingVertical: 17
  },
  accentLine: { position: "absolute", left: 0, top: 18, bottom: 18, width: 3, borderRadius: 3, backgroundColor: v2Colors.premium },
  eyebrow: { ...safeTextLayout, fontSize: 9.5, lineHeight: 13, fontWeight: "900", letterSpacing: 1.3 },
  title: { ...safeTextLayout, marginTop: 7, fontSize: 24, lineHeight: 29, fontWeight: "900", letterSpacing: -0.35 },
  description: { ...safeTextLayout, marginTop: 6, maxWidth: 620, fontSize: 12, lineHeight: 17, fontWeight: "600" }
});
