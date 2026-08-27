import { memo, useMemo } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { EqualHeightHeaderSlot } from "@/components/ui/equal-height-header-slot";
import { PressableScale } from "@/components/ui/pressable-scale";
import { SectionHeading } from "@/components/ui/section-heading";
import { homeCopy } from "@/app/i18n/common";
import { homeLayout, radii, v2Colors } from "@/constants/design";
import { safeTextLayout } from "@/constants/text-layout";
import { AppTheme, getThemeColors, isBrightTheme } from "@/constants/theme";
import { useLanguage } from "@/hooks/use-language";
import { t } from "@/utils/localized-text";
import type { ImageFocus } from "@/types/content";
import type { HomeArtistItem, HomeChallenge, HomeStoryItem } from "../types";
import { challengeTitle, reasonText } from "../ui-copy";
import { HomeImage } from "./home-image";

type IconName = keyof typeof Ionicons.glyphMap;

export type HomeActionItem = {
  id: string;
  icon: IconName;
  title: string;
  subtitle: string;
  accent: "violet" | "blue" | "pink" | "gold";
  image: string;
  imageFocus?: ImageFocus;
  onPress: () => void;
};

export const QuickDiscovery = memo(function QuickDiscovery({ theme, title, items, accent = v2Colors.cyan, variant = "grid" }: { theme: AppTheme; title: string; items: HomeActionItem[]; accent?: string; variant?: "grid" | "games" }) {
  const { fontScale, width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const columns = width >= homeLayout.tabletMinWidth ? 3 : 2;
  const gap = width < 360 ? 10 : 12;
  const screenPadding = width < 360 ? 32 : width >= homeLayout.tabletMinWidth ? 56 : 36;
  const availableWidth = Math.min(width, homeLayout.tabletContentMaxWidth) - screenPadding;
  const tileWidth = Math.floor((availableWidth - gap * (columns - 1)) / columns);
  const normalizedFontScale = Math.min(fontScale, 1.25);
  return (
    <View style={styles.section}>
      {title ? <SectionHeading theme={theme} title={title} accent={accent} /> : null}
      <View style={[styles.actionRail, { gap }]}>
        {items.map((item, index) => {
          const compactGameCard = variant === "games" && index % 3 !== 0;
          return (
            <ArtworkActionCard
              key={item.id}
              item={item}
              styles={styles}
              width={variant === "games" && index % 3 === 0 ? availableWidth : tileWidth}
              gameCard={variant === "games"}
              compactGameCard={compactGameCard}
              height={(variant === "games" ? 104 : 156) + Math.ceil((normalizedFontScale - 1) * (variant === "games" ? 48 : 80))}
            />
          );
        })}
      </View>
    </View>
  );
});

function ArtworkActionCard({ item, styles, width, height, gameCard, compactGameCard }: {
  item: HomeActionItem;
  styles: ReturnType<typeof createStyles>;
  width: number;
  height: number;
  gameCard: boolean;
  compactGameCard: boolean;
}) {
  const titleFontSize = fitActionTitleFontSize(
    item.title,
    width - (compactGameCard ? 66 : gameCard ? 111 : 59),
    compactGameCard
  );
  return (
    <PressableScale
      onPress={item.onPress}
      scaleTo={0.975}
      dimTo={0.99}
      wrapStyle={[styles.actionShadow, { width }, accentShadow(item.accent)]}
      style={[styles.actionCard, gameCard && styles.gameCard, compactGameCard && styles.compactGameCard, { height }, accentSurface(item.accent)]}
      accessibilityLabel={`${item.title}. ${item.subtitle}`}
    >
      <HomeImage uri={item.image} imageFocus={item.imageFocus} style={styles.actionArtwork} contentFit="cover" transition={180} showFallbackIcon={false} imageVariant="thumbnail" />
      <View style={[StyleSheet.absoluteFill, accentWash(item.accent)]} pointerEvents="none" />
      <LinearGradient
        colors={actionGradient(item.accent)}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <LinearGradient
        colors={gameCard ? ["rgba(5,8,20,0.9)", "rgba(5,8,20,0.12)"] : ["rgba(5,8,20,0.15)", "rgba(5,8,20,0.93)"]}
        start={gameCard ? { x: 0, y: 0.5 } : { x: 0.5, y: 0 }}
        end={gameCard ? { x: 1, y: 0.5 } : { x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />
      <View style={[styles.actionIllumination, accentIllumination(item.accent)]} pointerEvents="none" />
      <View style={styles.actionTopEdge} pointerEvents="none" />

      <View style={[styles.actionIcon, compactGameCard && styles.compactGameIcon, accentIcon(item.accent)]}>
        <Ionicons name={item.icon} size={compactGameCard ? 18 : 21} color={item.accent === "gold" ? "#FFE4A0" : "#F7F4FF"} />
      </View>
      <View style={[styles.actionTextBlock, gameCard && styles.gameTextBlock, compactGameCard && styles.compactGameTextBlock]}>
        <EqualHeightHeaderSlot lineHeight={compactGameCard ? 15.5 : 20} lines={gameCard && !compactGameCard ? 1 : 2}>
          <Text style={[styles.actionTitle, { fontSize: titleFontSize, lineHeight: titleFontSize * (compactGameCard ? 1.26 : 1.29) }]} maxFontSizeMultiplier={1.25}>
            {item.title}
          </Text>
        </EqualHeightHeaderSlot>
        <EqualHeightHeaderSlot lineHeight={compactGameCard ? 12.5 : 15} lines={gameCard && !compactGameCard ? 1 : 2} style={styles.actionSubtitleSlot}>
          <Text style={[styles.actionSubtitle, gameCard && styles.gameSubtitle, compactGameCard && styles.compactGameSubtitle]} numberOfLines={2} ellipsizeMode="tail" adjustsFontSizeToFit minimumFontScale={0.82} maxFontSizeMultiplier={1.25}>{item.subtitle}</Text>
        </EqualHeightHeaderSlot>
      </View>
      <View style={[styles.actionArrow, accentArrow(item.accent)]}>
        <Ionicons name="chevron-forward" size={15} color="#FFF9F0" />
      </View>
    </PressableScale>
  );
}

function fitActionTitleFontSize(title: string, availableWidth: number, compact: boolean) {
  const characterWidth = /[\u0400-\u04FF]/u.test(title) ? 0.64 : 0.56;
  const minimum = 10.25;
  const maximum = compact ? 12.25 : 15.5;
  const words = title.trim().split(/\s+/u);
  return Array.from(
    { length: Math.floor((maximum - minimum) * 4) + 1 },
    (_, index) => maximum - index * 0.25
  ).find((fontSize) => words.reduce(
    (layout, word) => {
      const wordWidth = word.length * fontSize * characterWidth;
      const nextWidth = layout.lineWidth ? layout.lineWidth + fontSize * characterWidth + wordWidth : wordWidth;
      if (nextWidth <= availableWidth) return { lines: layout.lines, lineWidth: nextWidth };
      return { lines: layout.lines + 1, lineWidth: wordWidth };
    },
    { lines: 1, lineWidth: 0 }
  ).lines <= 2 && Math.max(...words.map((word) => word.length)) * fontSize * characterWidth <= availableWidth) ?? minimum;
}

export function DailyChallengeCard({ theme, challenge, onPress }: { theme: AppTheme; challenge: HomeChallenge; onPress: () => void }) {
  const { language } = useLanguage();
  const styles = createStyles(theme);
  return (
    <View style={styles.section}>
      <SectionHeading theme={theme} title={t(homeCopy.dailyMission, language)} accent={v2Colors.magenta} />
      <PressableScale onPress={onPress} accessibilityLabel={`${challengeTitle(challenge, language)}. ${t(homeCopy.startChallenge, language)}`}>
        <LinearGradient colors={["#4B3FA8", "#783DA1", "#9A3C75"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.challenge}>
          <View style={styles.challengeIcon}>
            {challenge.artwork?.image ? <HomeImage uri={challenge.artwork.image} style={styles.challengeImage} contentFit="cover" imageVariant="thumbnail" /> : <Ionicons name={challenge.icon} size={29} color="#FFF1BE" />}
          </View>
          <View style={styles.challengeBody}>
            <Text style={styles.challengeEyebrow}>{t(homeCopy.dailyMission, language)}</Text>
            <Text style={styles.challengeTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.9}>{challengeTitle(challenge, language)}</Text>
            <Text style={styles.challengeSubtitle} numberOfLines={3} adjustsFontSizeToFit minimumFontScale={0.9}>{t(homeCopy.challengeSubtitle, language)}</Text>
          </View>
          <View style={styles.challengeCta}>
            <Ionicons name="play" size={18} color="#1A1533" />
          </View>
        </LinearGradient>
      </PressableScale>
    </View>
  );
}

export function DailyEditorial({
  theme,
  artist,
  story,
  onArtist,
  onStory
}: {
  theme: AppTheme;
  artist?: HomeArtistItem;
  story?: HomeStoryItem;
  onArtist: (id: string) => void;
  onStory: (id: string) => void;
}) {
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const styles = createStyles(theme);
  const stacked = width <= homeLayout.compactMaxWidth;
  const alignedTitleLines = !stacked && artist && story ? 2 : undefined;
  if (!artist && !story) return null;
  return (
    <View style={[styles.editorialGrid, stacked && styles.editorialGridStacked]}>
      {artist ? (
        <View style={styles.editorialColumn}>
          <SectionHeading theme={theme} title={t(homeCopy.artistDiscovery, language)} titleSlotLines={alignedTitleLines} />
          <EditorialCard
            theme={theme}
            image={artist.image}
            icon="person"
            title={artist.name}
            subtitle={[artist.movement, artist.life].filter(Boolean).join(" · ")}
            reason={reasonText(artist.reason, language)}
            actionLabel={t(homeCopy.openArtist, language)}
            onPress={() => onArtist(artist.id)}
          />
        </View>
      ) : null}
      {story ? (
        <View style={styles.editorialColumn}>
          <SectionHeading theme={theme} title={t(homeCopy.readingToday, language)} titleSlotLines={alignedTitleLines} />
          <EditorialCard
            theme={theme}
            image={story.image}
            icon="document-text"
            title={story.title}
            subtitle={[story.readTime, story.excerpt].filter(Boolean).join(" · ")}
            reason={reasonText(story.reason, language)}
            actionLabel={t(homeCopy.startReading, language)}
            onPress={() => onStory(story.id)}
          />
        </View>
      ) : null}
    </View>
  );
}

export function AchievementStrip({ theme, values }: {
  theme: AppTheme;
  values: { id: string; icon: IconName; value: number; label: string }[];
}) {
  const styles = createStyles(theme);
  const { language } = useLanguage();
  return (
    <View style={styles.section}>
      <SectionHeading theme={theme} title={t(homeCopy.achievements, language)} accent={v2Colors.premium} />
      <View style={styles.achievementRail}>
        {values.map((item, index) => (
          <View key={item.id} style={styles.achievement}>
            <View style={styles.achievementGem}>
              <View style={styles.achievementIcon}><Ionicons name={item.icon} size={20} color={achievementColor(index)} /></View>
            </View>
            <Text style={styles.achievementValue}>{new Intl.NumberFormat(language).format(item.value)}</Text>
            <Text style={styles.achievementLabel} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.88}>{item.label}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function EditorialCard({ theme, image, icon, title, subtitle, reason, actionLabel, onPress }: {
  theme: AppTheme;
  image: string;
  icon: IconName;
  title: string;
  subtitle: string;
  reason: string;
  actionLabel: string;
  onPress: () => void;
}) {
  const styles = createStyles(theme);
  return (
    <PressableScale onPress={onPress} style={styles.editorialCard} accessibilityLabel={`${title}. ${actionLabel}`}>
      {image ? <HomeImage uri={image} style={styles.editorialImage} contentFit="cover" transition={220} /> : <View style={styles.editorialFallback}><Ionicons name={icon} size={28} color="#E6C87C" /></View>}
      <LinearGradient colors={["rgba(6,8,20,0.04)", "rgba(6,8,20,0.94)"]} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <View style={styles.editorialBody}>
        <Text style={styles.editorialReason} numberOfLines={1}>{reason}</Text>
        <Text style={styles.editorialTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.88}>{title}</Text>
        <Text style={styles.editorialSubtitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.9}>{subtitle}</Text>
      </View>
    </PressableScale>
  );
}

function accentSurface(accent: HomeActionItem["accent"]) {
  if (accent === "blue") return { backgroundColor: "#101B3A", borderColor: "rgba(77,128,255,0.17)" };
  if (accent === "pink") return { backgroundColor: "#2A1024", borderColor: "rgba(239,82,159,0.17)" };
  if (accent === "gold") return { backgroundColor: "#241D18", borderColor: "rgba(243,189,78,0.18)" };
  return { backgroundColor: "#17122D", borderColor: "rgba(138,92,246,0.17)" };
}

function accentWash(accent: HomeActionItem["accent"]) {
  if (accent === "blue") return { backgroundColor: "rgba(36,81,198,0.36)" };
  if (accent === "pink") return { backgroundColor: "rgba(118,20,63,0.43)" };
  if (accent === "gold") return { backgroundColor: "rgba(94,65,20,0.42)" };
  return { backgroundColor: "rgba(64,26,121,0.4)" };
}

function actionGradient(accent: HomeActionItem["accent"]): readonly [string, string, string] {
  if (accent === "blue") return ["rgba(7,12,29,0.96)", "rgba(17,41,94,0.74)", "rgba(49,95,234,0.2)"];
  if (accent === "pink") return ["rgba(24,7,20,0.96)", "rgba(91,17,50,0.74)", "rgba(214,46,134,0.2)"];
  if (accent === "gold") return ["rgba(20,15,13,0.96)", "rgba(78,55,23,0.75)", "rgba(243,189,78,0.18)"];
  return ["rgba(10,8,26,0.96)", "rgba(49,20,91,0.74)", "rgba(109,53,213,0.2)"];
}

function accentIcon(accent: HomeActionItem["accent"]) {
  if (accent === "blue") return { backgroundColor: "rgba(49,95,234,0.72)", borderColor: "rgba(132,170,255,0.35)", shadowColor: v2Colors.blue };
  if (accent === "pink") return { backgroundColor: "rgba(214,46,134,0.68)", borderColor: "rgba(255,142,198,0.34)", shadowColor: v2Colors.pink };
  if (accent === "gold") return { backgroundColor: "rgba(184,137,45,0.72)", borderColor: "rgba(255,222,148,0.36)", shadowColor: v2Colors.premium };
  return { backgroundColor: "rgba(109,53,213,0.72)", borderColor: "rgba(181,147,255,0.34)", shadowColor: v2Colors.primary };
}

function accentShadow(accent: HomeActionItem["accent"]) {
  if (accent === "blue") return { shadowColor: "#2451C6" };
  if (accent === "pink") return { shadowColor: "#76143F" };
  if (accent === "gold") return { shadowColor: "#B8892D" };
  return { shadowColor: "#401A79" };
}

function accentIllumination(accent: HomeActionItem["accent"]) {
  if (accent === "blue") return { backgroundColor: "rgba(49,215,244,0.12)" };
  if (accent === "pink") return { backgroundColor: "rgba(214,46,134,0.14)" };
  if (accent === "gold") return { backgroundColor: "rgba(243,189,78,0.14)" };
  return { backgroundColor: "rgba(109,53,213,0.15)" };
}

function accentArrow(accent: HomeActionItem["accent"]) {
  if (accent === "gold") return { borderColor: "rgba(255,224,159,0.2)", shadowColor: v2Colors.premium };
  if (accent === "pink") return { borderColor: "rgba(255,151,202,0.18)", shadowColor: v2Colors.pink };
  if (accent === "blue") return { borderColor: "rgba(139,177,255,0.18)", shadowColor: v2Colors.blue };
  return { borderColor: "rgba(190,161,255,0.18)", shadowColor: v2Colors.primary };
}

function achievementColor(index: number) {
  if (index === 0) return v2Colors.violet;
  if (index === 1) return v2Colors.blue;
  return v2Colors.premium;
}

function createStyles(theme: AppTheme) {
  const colors = getThemeColors(theme);
  const light = isBrightTheme(theme);
  return StyleSheet.create({
    section: { marginTop: 24 },
    actionRail: { flexDirection: "row", flexWrap: "wrap" },
    actionShadow: { shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 3 }, elevation: 2 },
    actionCard: { borderRadius: radii.lg, padding: 15, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)", position: "relative" },
    gameCard: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
    compactGameCard: { paddingHorizontal: 11, gap: 8 },
    actionArtwork: { ...StyleSheet.absoluteFillObject, transform: [{ scale: 1.035 }] },
    actionIllumination: { position: "absolute", right: -18, top: -30, width: 96, height: 96, borderRadius: 48 },
    actionTopEdge: { position: "absolute", top: 0, left: 18, right: 18, height: 1, backgroundColor: "rgba(255,255,255,0.2)" },
    actionIcon: { width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center", shadowOpacity: 0.24, shadowRadius: 7, shadowOffset: { width: 0, height: 0 }, elevation: 2 },
    compactGameIcon: { width: 34, height: 34, borderRadius: 17, flexShrink: 0 },
    actionTextBlock: { flex: 1, flexShrink: 1, minWidth: 0, maxWidth: "100%", marginTop: 8, paddingRight: 27, overflow: "hidden" },
    gameTextBlock: { marginTop: 0 },
    actionTitle: { ...safeTextLayout, color: "#FFF9F0", fontSize: 15.5, lineHeight: 20, fontWeight: "800" },
    compactGameTextBlock: { paddingRight: 0 },
    actionSubtitleSlot: { marginTop: 3 },
    actionSubtitle: { ...safeTextLayout, color: "rgba(255,249,240,0.7)", fontSize: 11, lineHeight: 15, fontWeight: "700" },
    gameSubtitle: { paddingRight: 20 },
    compactGameSubtitle: { fontSize: 9.5, lineHeight: 12.5, paddingRight: 20 },
    actionArrow: { position: "absolute", right: 11, bottom: 11, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.14)", borderWidth: 1, alignItems: "center", justifyContent: "center", shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 0 } },
    challenge: { minHeight: 148, borderRadius: 24, padding: 16, flexDirection: "row", alignItems: "center", gap: 13, overflow: "hidden" },
    challengeIcon: { width: 78, height: 78, borderRadius: 39, backgroundColor: "rgba(10,10,25,0.28)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", overflow: "hidden", alignItems: "center", justifyContent: "center" },
    challengeImage: { width: "100%", height: "100%" },
    challengeBody: { flex: 1, minWidth: 0 },
    challengeEyebrow: { ...safeTextLayout, color: "#FFE4A6", fontSize: 9.5, lineHeight: 13, fontWeight: "900", letterSpacing: 1, textTransform: "uppercase" },
    challengeTitle: { ...safeTextLayout, color: "#FFF9F0", fontSize: 19, lineHeight: 23, fontWeight: "900", marginTop: 3 },
    challengeSubtitle: { ...safeTextLayout, color: "rgba(255,249,240,0.72)", fontSize: 11.5, lineHeight: 16, fontWeight: "700", marginTop: 4 },
    challengeCta: { width: homeLayout.minimumTouchTarget, height: homeLayout.minimumTouchTarget, borderRadius: 22, backgroundColor: "#F8FAFC", alignItems: "center", justifyContent: "center", flexShrink: 0, shadowColor: v2Colors.magenta, shadowOpacity: 0.32, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
    editorialGrid: { flexDirection: "row", alignItems: "stretch", gap: 12, marginTop: 24 },
    editorialGridStacked: { flexDirection: "column" },
    editorialColumn: { flex: 1, minWidth: 0 },
    editorialCard: { minHeight: 226, borderRadius: radii.lg, overflow: "hidden", backgroundColor: colors.panel },
    editorialImage: { width: "100%", height: "100%", position: "absolute", backgroundColor: colors.panelSoft },
    editorialFallback: { ...StyleSheet.absoluteFillObject, backgroundColor: light ? colors.panelSoft : "#191B36", alignItems: "center", justifyContent: "center" },
    editorialBody: { flex: 1, justifyContent: "flex-end", padding: 14 },
    editorialReason: { ...safeTextLayout, color: "#F1D285", fontSize: 9.5, lineHeight: 13, fontWeight: "900", letterSpacing: 0.5 },
    editorialTitle: { ...safeTextLayout, color: "#FFF9F0", fontSize: 16.5, lineHeight: 21, fontWeight: "900", marginTop: 4 },
    editorialSubtitle: { ...safeTextLayout, color: "rgba(255,249,240,0.7)", fontSize: 10.5, lineHeight: 15, fontWeight: "700", marginTop: 3 },
    achievementRail: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    achievement: { flexBasis: "30%", flexGrow: 1, minWidth: 0, minHeight: 110, paddingHorizontal: 6, paddingVertical: 10, alignItems: "center", justifyContent: "center" },
    achievementGem: { width: 52, height: 52, borderRadius: 18, transform: [{ rotate: "45deg" }], borderWidth: 1, borderColor: "rgba(246,196,83,0.22)", backgroundColor: light ? "rgba(99,102,241,0.10)" : "rgba(255,255,255,0.055)", alignItems: "center", justifyContent: "center", shadowColor: v2Colors.premium, shadowOpacity: 0.34, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
    achievementIcon: { transform: [{ rotate: "-45deg" }] },
    achievementValue: { color: colors.ivory, fontSize: 22, lineHeight: 26, fontWeight: "800", marginTop: 5 },
    achievementLabel: { ...safeTextLayout, minHeight: 30, color: colors.muted, fontSize: 10.5, lineHeight: 14, fontWeight: "700", textAlign: "center", marginTop: 2 }
  });
}
