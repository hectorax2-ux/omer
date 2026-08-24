import { useMemo } from "react";
import { FlatList, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { AuthRequired } from "@/components/auth-required";
import { JourneyOrb, journeyEraPalette } from "@/components/ui/journey-orb";
import { PressableScale } from "@/components/ui/pressable-scale";
import { homeCopy } from "@/app/i18n/common";
import { homeLayout, radii, v2Colors } from "@/constants/design";
import { useLanguage } from "@/hooks/use-language";
import { useAccount } from "@/hooks/use-account";
import { t } from "@/utils/localized-text";
import { journeyProgressPercent } from "@/features/home/journey-engine";
import type { JourneyStageView } from "@/features/home/types";
import { difficultyText, journeyStateText } from "@/features/home/ui-copy";
import { useHomeExperience } from "@/features/home/use-home-experience";

export default function JourneyScreen() {
  const { isAuthenticated } = useAccount();
  const { language } = useLanguage();
  if (!isAuthenticated) return <AuthRequired title={t(homeCopy.artJourney, language)} />;
  return <AuthenticatedJourneyScreen />;
}

function AuthenticatedJourneyScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const styles = useMemo(() => createStyles(width), [width]);
  const home = useHomeExperience();
  const percent = journeyProgressPercent(home.journey, home.journeyExperience.progress);
  const chapterImages = useMemo(() => new Map(home.journey.chapters.map((chapter) => [
    chapter.id,
    home.journeyExperience.stages.find((stage) => stage.chapterId === chapter.id && stage.activity.image)?.activity.image
  ])), [home.journey.chapters, home.journeyExperience.stages]);

  function openStage(stage: JourneyStageView) {
    if (stage.state === "locked") return;
    home.journeyExperience.openStage(stage.id);
    router.push({ pathname: stage.activity.route, params: stage.activity.params ?? {} } as never);
  }

  return (
    <AppChrome title={t(compact ? homeCopy.journeyShort : homeCopy.artJourney, language)} eyebrow="ART ATLAS" showBackButton backToHome scroll={false} showTopAd={false}>
      <FlatList
        data={home.journeyExperience.stages}
        keyExtractor={(item) => item.id}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.list}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={7}
        ListHeaderComponent={(
          <View style={styles.header}>
            <View style={styles.headerGlow} pointerEvents="none" />
            <View style={styles.headerCopy}>
              <Text style={styles.kicker}>{oldestToNewest(language)}</Text>
              <Text style={styles.headerTitle}>{home.journey.title}</Text>
              <Text style={styles.headerText}>{journeyDescription(language)}</Text>
            </View>
            <View style={styles.progressOuter}>
              <LinearGradient colors={[v2Colors.cyan, v2Colors.violet, v2Colors.magenta]} style={styles.progressGradient}>
                <View style={styles.progressInner}><Text style={styles.progressNumber}>{formatPercent(percent, language)}</Text><Text style={styles.progressLabel}>{t(homeCopy.journeyProgress, language)}</Text></View>
              </LinearGradient>
            </View>
          </View>
        )}
        ListEmptyComponent={<View style={styles.empty}><Ionicons name="images-outline" size={32} color={v2Colors.brightViolet} /><Text style={styles.emptyText}>{t(homeCopy.journeyEmpty, language)}</Text></View>}
        renderItem={({ item, index }) => {
          const chapter = home.journey.chapters.find((candidate) => candidate.id === item.chapterId);
          const startsChapter = index === 0 || home.journeyExperience.stages[index - 1]?.chapterId !== item.chapterId;
          const opened = home.journeyExperience.progress.openedStageIds.includes(item.id);
          const canComplete = opened && item.state !== "completed" && item.state !== "locked";
          const palette = journeyEraPalette(chapter?.eraId);
          return (
            <View>
              {startsChapter ? (
                <View style={styles.chapterHeader}>
                  <View style={[styles.chapterGlow, { backgroundColor: palette.glow }]} pointerEvents="none" />
                  <View style={[styles.chapterGem, { backgroundColor: palette.end }]} />
                  <View style={styles.chapterCopy}><Text style={styles.chapterTitle}>{chapter?.title}</Text><Text style={[styles.chapterDate, { color: palette.end }]}>{chapter?.dateLabel}</Text></View>
                  <Text style={styles.chapterCount}>{chapter?.stageIds.length ?? 0}</Text>
                </View>
              ) : null}
              <View style={styles.stageRow}>
                <View style={[styles.timeline, index === home.journeyExperience.stages.length - 1 && styles.timelineLast]} pointerEvents="none"><LinearGradient colors={[palette.end, "rgba(255,255,255,0.08)"]} style={StyleSheet.absoluteFill} /></View>
                <View style={styles.orbColumn}><JourneyOrb stage={item} eraId={chapter?.eraId} size={compact ? 54 : 60} fallbackImageUri={chapterImages.get(item.chapterId)} onPress={() => openStage(item)} /></View>
                <View style={[styles.stageContent, item.state === "current" && styles.stageCurrent]}>
                  {item.state === "current" ? <LinearGradient colors={["rgba(67,56,202,0.2)", "rgba(126,34,206,0.09)", "transparent"]} style={StyleSheet.absoluteFill} /> : null}
                  <View style={styles.stageLabels}><Text style={[styles.stateText, { color: palette.end }]}>{journeyStateText(item.state, language)}</Text><Text style={styles.difficulty}>{difficultyText(item.difficulty, language)}</Text></View>
                  <Text style={styles.stageTitle} numberOfLines={2}>{item.activity.title}</Text>
                  <Text style={styles.stageSubtitle} numberOfLines={2}>{item.activity.subtitle}</Text>
                  <View style={styles.metaRow}>
                    {item.activity.periodLabel ? <Text style={styles.metaPill} numberOfLines={1}>{item.activity.periodLabel}</Text> : null}
                    {item.activity.dateLabel ? <Text style={[styles.datePill, { color: palette.end }]}>{item.activity.dateLabel}</Text> : null}
                  </View>
                  {item.state !== "locked" && item.state !== "completed" ? (
                    <View style={styles.actions}>
                      <PressableScale onPress={() => openStage(item)} style={styles.openAction}><Ionicons name="arrow-forward" size={15} color={v2Colors.text} /><Text style={styles.openText}>{t(compact ? homeCopy.openActivityShort : homeCopy.openActivity, language)}</Text></PressableScale>
                      <PressableScale onPress={() => home.journeyExperience.completeStage(item.id)} disabled={!canComplete} style={[styles.completeAction, !canComplete && styles.disabled]}><Ionicons name="checkmark" size={15} color={v2Colors.background} /><Text style={styles.completeText}>{t(compact ? homeCopy.confirmActivityShort : homeCopy.confirmActivity, language)}</Text></PressableScale>
                    </View>
                  ) : null}
                </View>
              </View>
            </View>
          );
        }}
      />
    </AppChrome>
  );
}

function oldestToNewest(language: "tr" | "en" | "ru" | "uz") {
  return { tr: "EN ESKİDEN EN YENİYE", en: "OLDEST TO NEWEST", ru: "ОТ ДРЕВНЕГО К НОВОМУ", uz: "ENG QADIMDAN ENG YANGIGA" }[language];
}

function journeyDescription(language: "tr" | "en" | "ru" | "uz") {
  return {
    tr: "Gerçek eserler, sanatçılar ve okumalarla sanat tarihinin ışıklı haritasında ilerle.",
    en: "Move through an illuminated map of art history with real artworks, artists, and readings.",
    ru: "Исследуйте светящуюся карту истории искусства через реальные произведения, имена и тексты.",
    uz: "Haqiqiy asarlar, rassomlar va o'qishlar bilan san'at tarixining yorqin xaritasidan o'ting."
  }[language];
}

function formatPercent(percent: number, language: string) {
  return new Intl.NumberFormat(language, { style: "percent", maximumFractionDigits: 0 }).format(percent / 100);
}

function createStyles(width: number) {
  const horizontal = width < 360 ? 14 : width >= homeLayout.tabletMinWidth ? 28 : 18;
  const compact = width < 360;
  return StyleSheet.create({
    list: { paddingHorizontal: horizontal, paddingTop: 8, paddingBottom: 116, alignSelf: "center", width: "100%", maxWidth: homeLayout.tabletContentMaxWidth },
    header: { minHeight: compact ? 182 : 196, flexDirection: "row", alignItems: "center", position: "relative", marginBottom: 12 },
    headerGlow: { position: "absolute", right: 12, width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(99,102,241,0.12)", shadowColor: v2Colors.violet, shadowOpacity: 0.65, shadowRadius: 32, shadowOffset: { width: 0, height: 0 } },
    headerCopy: { flex: 1, minWidth: 0, paddingRight: 12 },
    kicker: { color: v2Colors.cyan, fontSize: 9, lineHeight: 13, fontWeight: "800", letterSpacing: 1.6 },
    headerTitle: { color: v2Colors.text, fontSize: compact ? 24 : 28, lineHeight: compact ? 29 : 33, fontWeight: "800", letterSpacing: -0.6, marginTop: 6 },
    headerText: { color: v2Colors.textMuted, fontSize: compact ? 11.5 : 12.5, lineHeight: compact ? 17 : 19, fontWeight: "600", marginTop: 7 },
    progressOuter: { width: compact ? 88 : 102, height: compact ? 88 : 102, borderRadius: 60, padding: 2, shadowColor: v2Colors.magenta, shadowOpacity: 0.55, shadowRadius: 20, shadowOffset: { width: 0, height: 0 } },
    progressGradient: { flex: 1, borderRadius: 60, padding: 3 },
    progressInner: { flex: 1, borderRadius: 60, backgroundColor: v2Colors.backgroundSecondary, alignItems: "center", justifyContent: "center" },
    progressNumber: { color: v2Colors.text, fontSize: compact ? 19 : 22, fontWeight: "900" },
    progressLabel: { color: v2Colors.textMuted, fontSize: 8.5, lineHeight: 11, fontWeight: "700", textAlign: "center", marginTop: 2, paddingHorizontal: 5 },
    empty: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: 10 },
    emptyText: { color: v2Colors.textMuted, fontSize: 13, lineHeight: 19, textAlign: "center", fontWeight: "700" },
    chapterHeader: { minHeight: 72, flexDirection: "row", alignItems: "center", gap: 10, position: "relative", marginTop: 7, paddingLeft: compact ? 7 : 12 },
    chapterGlow: { position: "absolute", left: 0, width: 135, height: 58, borderRadius: 29, opacity: 0.28, shadowColor: v2Colors.violet, shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
    chapterGem: { width: 13, height: 13, borderRadius: 4, transform: [{ rotate: "45deg" }] },
    chapterCopy: { flex: 1, minWidth: 0 },
    chapterTitle: { color: v2Colors.text, fontSize: compact ? 17 : 19, lineHeight: 24, fontWeight: "800" },
    chapterDate: { fontSize: 10.5, lineHeight: 14, fontWeight: "800", marginTop: 1 },
    chapterCount: { color: v2Colors.textFaint, fontSize: 11, fontWeight: "800" },
    stageRow: { minHeight: compact ? 128 : 136, flexDirection: "row", position: "relative" },
    timeline: { position: "absolute", left: compact ? 34 : 38, top: 0, bottom: -1, width: 2, opacity: 0.56 },
    timelineLast: { bottom: "50%" },
    orbColumn: { width: compact ? 70 : 78, alignItems: "center", paddingTop: 12, zIndex: 2 },
    stageContent: { flex: 1, minWidth: 0, alignSelf: "flex-start", minHeight: 112, borderRadius: radii.lg, paddingHorizontal: compact ? 11 : 14, paddingVertical: 11, overflow: "hidden", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: v2Colors.border },
    stageCurrent: { borderWidth: 1, borderColor: "rgba(139,92,246,0.28)" },
    stageLabels: { flexDirection: "row", alignItems: "center", gap: 7 },
    stateText: { fontSize: 9, lineHeight: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.6 },
    difficulty: { flexShrink: 1, color: v2Colors.textFaint, fontSize: 9, lineHeight: 12, fontWeight: "700" },
    stageTitle: { color: v2Colors.text, fontSize: compact ? 14.5 : 16, lineHeight: compact ? 18 : 20, fontWeight: "800", marginTop: 3 },
    stageSubtitle: { color: v2Colors.textMuted, fontSize: compact ? 10.5 : 11.5, lineHeight: compact ? 14 : 16, fontWeight: "600", marginTop: 2 },
    metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7, marginTop: 6 },
    metaPill: { maxWidth: "68%", color: v2Colors.textSecondary, fontSize: 9.5, lineHeight: 13, fontWeight: "700" },
    datePill: { fontSize: 9.5, lineHeight: 13, fontWeight: "800" },
    actions: { flexDirection: "row", alignItems: "center", gap: 7, marginTop: 9 },
    openAction: { minHeight: homeLayout.minimumTouchTarget, paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: "rgba(99,102,241,0.2)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
    openText: { color: v2Colors.text, fontSize: 10, fontWeight: "800" },
    completeAction: { minHeight: homeLayout.minimumTouchTarget, paddingHorizontal: 10, borderRadius: radii.pill, backgroundColor: v2Colors.premium, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
    completeText: { color: v2Colors.background, fontSize: 10, fontWeight: "900" },
    disabled: { opacity: 0.35 }
  });
}
