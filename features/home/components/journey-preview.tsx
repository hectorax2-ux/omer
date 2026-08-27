import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { ClippedGradient } from "@/components/ui/clipped-gradient";
import { JourneyOrb, journeyEraPalette } from "@/components/ui/journey-orb";
import { PressableScale } from "@/components/ui/pressable-scale";
import { SectionHeading } from "@/components/ui/section-heading";
import { homeCopy } from "@/app/i18n/common";
import { homeLayout, radii, v2Colors } from "@/constants/design";
import { safeTextLayout } from "@/constants/text-layout";
import { AppTheme } from "@/constants/theme";
import { useLanguage } from "@/hooks/use-language";
import { t } from "@/utils/localized-text";
import { journeyProgressPercent } from "../journey-engine";
import type { ArtJourney, JourneyProgress, JourneyStageView } from "../types";

export function JourneyPreview({ theme, journey, stages, progress, previewCount, isAuthenticated, onOpenJourney, onOpenStage }: {
  theme: AppTheme;
  journey: ArtJourney;
  stages: JourneyStageView[];
  progress: JourneyProgress;
  previewCount: number;
  isAuthenticated: boolean;
  onOpenJourney: () => void;
  onOpenStage: (stage: JourneyStageView) => void;
}) {
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const currentIndex = Math.max(0, stages.findIndex((stage) => stage.state === "current"));
  const current = stages[currentIndex];
  const currentChapterIndex = Math.max(0, journey.chapters.findIndex((chapter) => chapter.id === current?.chapterId));
  const chapterStart = Math.max(0, Math.min(currentChapterIndex - 1, Math.max(0, journey.chapters.length - Math.min(4, previewCount))));
  const preview = journey.chapters.slice(chapterStart, chapterStart + Math.min(4, previewCount)).flatMap((chapter) => {
    const chapterStages = stages.filter((stage) => stage.chapterId === chapter.id);
    const stage = chapter.id === current?.chapterId ? current : chapter.order < currentChapterIndex ? chapterStages.at(-1) : chapterStages[0];
    const imageUri = chapterStages.find((candidate) => candidate.activity.image)?.activity.image;
    return stage ? [{ chapter, stage, imageUri }] : [];
  });
  const percent = journeyProgressPercent(journey, progress);
  const styles = createStyles(compact);

  return (
    <View style={styles.section}>
      <SectionHeading
        theme={theme}
        title={t(homeCopy.artJourney, language)}
        accent={v2Colors.violet}
        action={<PressableScale onPress={onOpenJourney} style={styles.headingAction} accessibilityLabel={t(homeCopy.seeJourney, language)}><Text style={styles.headingActionText} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.86}>{t(homeCopy.seeJourney, language)}</Text><Ionicons name="arrow-forward" size={15} color={v2Colors.brightViolet} /></PressableScale>}
      />

      {!stages.length ? (
        <View style={styles.empty}><Ionicons name="trail-sign-outline" size={28} color={v2Colors.brightViolet} /><Text style={styles.emptyText}>{t(homeCopy.journeyEmpty, language)}</Text></View>
      ) : (
        <View style={styles.map}>
          <View style={styles.mapAtmosphere} pointerEvents="none" />
          <View style={styles.path} pointerEvents="none">
            <LinearGradient colors={[v2Colors.success, v2Colors.premium, v2Colors.violet, v2Colors.magenta]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={[styles.completedPath, { width: `${Math.max(5, percent)}%` }]} />
          </View>
          <View style={styles.nodes}>
            {preview.map(({ chapter, stage, imageUri }) => {
              const palette = journeyEraPalette(chapter.eraId);
              return (
                <View key={chapter.id} style={styles.nodeSlot}>
                  <JourneyOrb stage={stage} eraId={chapter.eraId} size={compact ? 47 : 52} fallbackImageUri={imageUri} onPress={() => onOpenStage(stage)} />
                  <Text style={[styles.nodeTitle, { color: stage.state === "locked" ? v2Colors.textFaint : v2Colors.text }]} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.86}>{chapter.title}</Text>
                  <Text style={[styles.nodeDate, { color: palette.end }]} numberOfLines={2}>{chapter.dateLabel || stage.activity.dateLabel || ""}</Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {current ? (
        <PressableScale onPress={() => onOpenStage(current)} style={styles.continueCapsule} accessibilityLabel={`${t(homeCopy.continueAction, language)}: ${current.activity.title}`}>
          <ClippedGradient colors={["rgba(67,56,202,0.34)", "rgba(126,34,206,0.3)", "rgba(157,23,77,0.26)"]} androidColors={["rgba(67,56,202,0.3)", "rgba(126,34,206,0.18)"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} radius={radii.xl} />
          <View style={styles.playOrb}><Ionicons name="play" size={16} color={v2Colors.text} /></View>
          <View style={styles.continueCopy}><Text style={styles.continueEyebrow}>{t(homeCopy.continueJourney, language)}</Text><Text style={styles.continueTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.88}>{current.activity.title}</Text></View>
          <View style={styles.arrowOrb}><Ionicons name="arrow-forward" size={16} color={v2Colors.text} /></View>
        </PressableScale>
      ) : null}
      {!isAuthenticated ? <Text style={styles.syncHint}>{t(homeCopy.journeySyncHint, language)}</Text> : null}
    </View>
  );
}

function createStyles(compact: boolean) {
  return StyleSheet.create({
    section: { marginTop: 4, marginBottom: 6 },
    headingAction: { minHeight: homeLayout.minimumTouchTarget, flexDirection: "row", alignItems: "center", gap: 5, paddingLeft: 10 },
    headingActionText: { ...safeTextLayout, color: v2Colors.brightViolet, fontSize: compact ? 11 : 12, lineHeight: compact ? 14 : 16, fontWeight: "800" },
    empty: { minHeight: 120, alignItems: "center", justifyContent: "center", gap: 9 },
    emptyText: { ...safeTextLayout, color: v2Colors.textMuted, fontSize: 13, lineHeight: 19, fontWeight: "700", textAlign: "center" },
    map: { minHeight: compact ? 152 : 166, justifyContent: "center", position: "relative", overflow: "visible" },
    mapAtmosphere: { position: "absolute", left: "9%", right: "7%", top: 28, height: 82, borderRadius: 999, backgroundColor: "rgba(90,68,220,0.08)", shadowColor: v2Colors.violet, shadowOpacity: 0.45, shadowRadius: 27, shadowOffset: { width: 0, height: 0 } },
    path: { position: "absolute", left: "9%", right: "9%", top: compact ? 45 : 50, height: 3, borderRadius: 2, backgroundColor: "rgba(255,255,255,0.11)", overflow: "hidden" },
    completedPath: { height: "100%", borderRadius: 2 },
    nodes: { flexDirection: "row", alignItems: "flex-start", width: "100%", zIndex: 2 },
    nodeSlot: { flex: 1, minWidth: 0, alignItems: "center" },
    nodeTitle: { ...safeTextLayout, width: "100%", paddingHorizontal: 2, marginTop: 2, fontSize: compact ? 9.5 : 10.5, lineHeight: compact ? 12 : 14, fontWeight: "700", textAlign: "center", minHeight: compact ? 24 : 28 },
    nodeDate: { ...safeTextLayout, width: "100%", minHeight: 23, paddingHorizontal: 2, marginTop: 2, fontSize: compact ? 8.5 : 9.5, lineHeight: 11.5, fontWeight: "800", textAlign: "center" },
    continueCapsule: { minHeight: compact ? 62 : 66, borderRadius: radii.xl, overflow: "hidden", borderWidth: 1, borderColor: "rgba(217,70,239,0.3)", paddingHorizontal: 10, paddingVertical: 7, flexDirection: "row", alignItems: "center", gap: 10 },
    playOrb: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(124,58,237,0.52)", borderWidth: 1, borderColor: "rgba(196,167,255,0.38)", alignItems: "center", justifyContent: "center" },
    continueCopy: { flex: 1, minWidth: 0 },
    continueEyebrow: { ...safeTextLayout, color: "#C4A7FF", fontSize: 9, lineHeight: 12, fontWeight: "800", letterSpacing: 0.75, textTransform: "uppercase" },
    continueTitle: { ...safeTextLayout, color: v2Colors.text, fontSize: compact ? 13 : 14.5, lineHeight: 19, fontWeight: "800", marginTop: 2 },
    arrowOrb: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(217,70,239,0.25)", alignItems: "center", justifyContent: "center" },
    syncHint: { ...safeTextLayout, color: v2Colors.textFaint, fontSize: 10, lineHeight: 14, textAlign: "center", fontWeight: "600", marginTop: 8 }
  });
}
