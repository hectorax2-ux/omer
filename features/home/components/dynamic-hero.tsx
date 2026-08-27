import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ClippedGradient } from "@/components/ui/clipped-gradient";
import { ArtworkOrbit } from "@/components/ui/artwork-orbit";
import { PressableScale } from "@/components/ui/pressable-scale";
import { homeCopy } from "@/app/i18n/common";
import { elevation, homeLayout, radii, v2Colors } from "@/constants/design";
import { safeTextLayout } from "@/constants/text-layout";
import { AppTheme } from "@/constants/theme";
import { useLanguage } from "@/hooks/use-language";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { t } from "@/utils/localized-text";
import { useRuntimePerformanceMode } from "@/hooks/use-runtime-performance-mode";
import type { HomeArtworkItem, HomeGreetingKey } from "../types";
import { greetingText, reasonText } from "../ui-copy";
import { useIsFocused } from "@react-navigation/native";

export function DynamicHero({ theme, items, greetingKey, displayName, premium, onOpen, motionActive = true }: {
  theme: AppTheme;
  items: HomeArtworkItem[];
  greetingKey: HomeGreetingKey;
  displayName: string;
  premium: boolean;
  onOpen: (id: string) => void;
  motionActive?: boolean;
}) {
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const performanceMode = useRuntimePerformanceMode();
  const isFocused = useIsFocused();
  const lightweight = reducedMotion || performanceMode !== "full" || !motionActive || !isFocused;
  const [index, setIndex] = useState(0);
  const active = items[index] ?? items[0];
  const compact = width < 360;
  const orbitSize = compact ? 174 : width < 400 ? 202 : 218;
  const styles = useMemo(() => createStyles(compact, width), [compact, width]);
  const headline = greetingText(greetingKey, language);
  const headlineFontSize = fitHeadlineFontSize(
    headline,
    (width - (compact ? 32 : 36)) * (compact ? 0.48 : 0.51),
    language,
    compact
  );

  useEffect(() => {
    if (lightweight || items.length < 2) return undefined;
    const timer = setInterval(() => setIndex((current) => (current + 1) % items.length), 8200);
    return () => clearInterval(timer);
  }, [items.length, lightweight]);

  if (!active) {
    return (
      <View style={[styles.hero, styles.emptyHero]} accessibilityLabel={t(homeCopy.contentUnavailable, language)}>
        <View style={styles.emptyLine} />
        <View style={[styles.emptyLine, { width: "68%", height: 28 }]} />
        <View style={[styles.emptyLine, { width: "46%" }]} />
      </View>
    );
  }

  return (
    <View style={styles.hero}>
      <View style={[styles.blueAtmosphere, lightweight && styles.atmosphereLightweight]} pointerEvents="none" />
      <View style={[styles.magentaAtmosphere, lightweight && styles.atmosphereLightweight]} pointerEvents="none" />

      <View style={styles.copyColumn}>
        <View style={styles.welcomeRow}>
          <Text style={styles.welcome} numberOfLines={2}>{welcomeText(displayName, language)}</Text>
          {premium ? <Ionicons name="diamond" size={12} color={v2Colors.premium} /> : null}
        </View>
        <Text
          style={[styles.headline, { fontSize: headlineFontSize, lineHeight: headlineFontSize * 1.17 }]}
        >
          {headline}
        </Text>
        <LinearGradient colors={["#4338CA", "#7C3AED", "#DB2777"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.ctaGradient}>
          <PressableScale onPress={() => onOpen(active.id)} style={styles.cta} accessibilityLabel={t(homeCopy.openArtwork, language)}>
            <Text style={styles.ctaText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.88}>{t(homeCopy.openArtwork, language)}</Text>
            <Ionicons name="arrow-forward" size={16} color={v2Colors.text} />
          </PressableScale>
        </LinearGradient>
      </View>

      <View style={[styles.orbitPosition, { width: orbitSize, height: orbitSize }]}>
        <ArtworkOrbit items={items} activeIndex={index} size={orbitSize} onOpen={onOpen} />
      </View>

      <PressableScale onPress={() => onOpen(active.id)} wrapStyle={styles.todayPanelPosition} style={[styles.todayPanel, lightweight && styles.todayPanelLightweight]} accessibilityLabel={`${active.title}, ${active.artist}`}>
        <ClippedGradient colors={["rgba(12,18,39,0.94)", "rgba(8,24,45,0.78)"]} androidColors={["rgba(12,18,39,0.96)", "rgba(11,22,39,0.9)"]} radius={radii.lg} />
        <View style={styles.todayCopy}>
          <Text style={styles.todayEyebrow}>{t(homeCopy.dailyArtwork, language)}</Text>
          <Text style={styles.todayTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.9}>{active.title}</Text>
          <Text style={styles.todayMeta} numberOfLines={1}>{[active.artist, active.year].filter(Boolean).join(" · ")}</Text>
        </View>
        <View style={styles.favoriteOrb}>
          <Ionicons name="heart-outline" size={21} color={v2Colors.text} />
        </View>
      </PressableScale>

      <View style={styles.dots} pointerEvents="none">
        {items.map((item, dotIndex) => <View key={item.id} style={[styles.dot, dotIndex === index && styles.dotActive]} />)}
      </View>
      <Text style={styles.reason} numberOfLines={1}>{reasonText(active.reason, language)}</Text>
    </View>
  );
}

function welcomeText(name: string, language: "tr" | "en" | "ru" | "uz") {
  return {
    tr: `Hoş geldin, ${name} 👋`,
    en: `Welcome, ${name} 👋`,
    ru: `Добро пожаловать, ${name} 👋`,
    uz: `Xush kelibsiz, ${name} 👋`
  }[language];
}

function fitHeadlineFontSize(headline: string, availableWidth: number, language: "tr" | "en" | "ru" | "uz", compact: boolean) {
  const characterWidth = language === "ru" ? 0.58 : 0.55;
  const minimum = compact ? 16 : 18;
  const words = headline.trim().split(/\s+/u);
  const candidates = Array.from(
    { length: Math.floor(((compact ? 24 : 29) - minimum) * 2) + 1 },
    (_, index) => (compact ? 24 : 29) - index * 0.5
  );
  return candidates.find((fontSize) => words.reduce(
    (layout, word) => {
      const wordWidth = word.length * fontSize * characterWidth;
      const nextWidth = layout.lineWidth ? layout.lineWidth + fontSize * characterWidth + wordWidth : wordWidth;
      if (nextWidth <= availableWidth) return { lines: layout.lines, lineWidth: nextWidth };
      return { lines: layout.lines + 1, lineWidth: wordWidth };
    },
    { lines: 1, lineWidth: 0 }
  ).lines <= 3 && Math.max(...words.map((word) => word.length)) * fontSize * characterWidth <= availableWidth) ?? minimum;
}

function createStyles(compact: boolean, width: number) {
  const panelWidth = Math.min(compact ? 218 : 250, width - (compact ? 48 : 58));
  return StyleSheet.create({
    hero: { minHeight: compact ? 304 : 332, marginTop: 2, marginBottom: 16, position: "relative", overflow: "visible" },
    emptyHero: { justifyContent: "center", gap: 12, opacity: 0.75 },
    emptyLine: { width: "35%", height: 12, borderRadius: radii.pill, backgroundColor: v2Colors.surface2 },
    blueAtmosphere: { position: "absolute", right: compact ? -28 : -38, top: 2, width: compact ? 218 : 260, height: compact ? 218 : 260, borderRadius: 999, backgroundColor: "rgba(37,99,235,0.11)", shadowColor: v2Colors.blue, shadowOpacity: 0.65, shadowRadius: 34, shadowOffset: { width: 0, height: 0 } },
    magentaAtmosphere: { position: "absolute", left: "24%", bottom: 18, width: 130, height: 90, borderRadius: 999, backgroundColor: "rgba(217,70,239,0.08)", shadowColor: v2Colors.magenta, shadowOpacity: 0.6, shadowRadius: 28, shadowOffset: { width: 0, height: 0 } },
    atmosphereLightweight: { shadowOpacity: 0, shadowRadius: 0 },
    copyColumn: { width: compact ? "48%" : "51%", minWidth: 0, paddingTop: compact ? 12 : 18, zIndex: 4 },
    welcomeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    welcome: { ...safeTextLayout, color: v2Colors.textSecondary, fontSize: compact ? 11.5 : 13, lineHeight: compact ? 16 : 18, fontWeight: "600" },
    headline: { ...safeTextLayout, color: v2Colors.text, fontWeight: "800", letterSpacing: compact ? -0.45 : -0.75, marginTop: 7 },
    ctaGradient: { alignSelf: "flex-start", borderRadius: radii.pill, marginTop: compact ? 12 : 15, ...elevation("dark", "low") },
    cta: { minHeight: homeLayout.minimumTouchTarget, paddingHorizontal: compact ? 13 : 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    ctaText: { ...safeTextLayout, color: v2Colors.text, fontSize: compact ? 11 : 12.5, lineHeight: compact ? 14 : 16, fontWeight: "800" },
    orbitPosition: { position: "absolute", right: compact ? -2 : -5, top: compact ? 2 : 0, zIndex: 2 },
    todayPanelPosition: { position: "absolute", left: 0, bottom: 27, width: panelWidth, zIndex: 8 },
    todayPanel: { width: "100%", minHeight: compact ? 78 : 88, borderRadius: radii.lg, overflow: "hidden", borderWidth: 1, borderColor: "rgba(91,145,255,0.28)", paddingLeft: compact ? 13 : 16, paddingRight: 10, paddingVertical: 11, flexDirection: "row", alignItems: "center", gap: 10, ...elevation("dark", "high") },
    todayPanelLightweight: { shadowOpacity: 0.12, shadowRadius: 4, elevation: 3 },
    todayCopy: { flex: 1, minWidth: 0 },
    todayEyebrow: { ...safeTextLayout, color: "#C4A7FF", fontSize: 9, lineHeight: 12, fontWeight: "800", letterSpacing: 0.7, textTransform: "uppercase" },
    todayTitle: { ...safeTextLayout, color: v2Colors.text, fontSize: compact ? 15 : 17, lineHeight: compact ? 19 : 21, fontWeight: "800", marginTop: 3 },
    todayMeta: { ...safeTextLayout, color: v2Colors.textMuted, fontSize: 10.5, lineHeight: 14, fontWeight: "600", marginTop: 2 },
    favoriteOrb: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(33,77,127,0.55)", borderWidth: 1, borderColor: "rgba(97,176,255,0.25)", alignItems: "center", justifyContent: "center" },
    dots: { position: "absolute", left: panelWidth + 9, bottom: 46, flexDirection: "row", flexWrap: "wrap", width: Math.max(28, width - panelWidth - 44), gap: 4, zIndex: 6 },
    dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.26)" },
    dotActive: { width: 15, backgroundColor: v2Colors.brightViolet },
    reason: { ...safeTextLayout, position: "absolute", left: 2, bottom: 7, maxWidth: panelWidth, color: v2Colors.textFaint, fontSize: 9.5, lineHeight: 13, fontWeight: "600" }
  });
}
