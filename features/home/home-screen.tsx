import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppChrome } from "@/components/app-chrome";
import { PressableScale } from "@/components/ui/pressable-scale";
import { Reveal } from "@/components/ui/reveal";
import { ThemePickerModal, getThemePickerLabel } from "@/components/theme-picker-modal";
import { homeCopy } from "@/app/i18n/common";
import { homeLayout, radii, v2Colors } from "@/constants/design";
import { safeTextLayout } from "@/constants/text-layout";
import { AppTheme, getThemeColors } from "@/constants/theme";
import { artworks, copy, uiCopy } from "@/data/content";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { t } from "@/utils/localized-text";
import { ArtworkRail } from "./components/artwork-rail";
import { DynamicHero } from "./components/dynamic-hero";
import {
  AchievementStrip,
  DailyChallengeCard,
  DailyEditorial,
  HomeActionItem,
  QuickDiscovery
} from "./components/discovery-sections";
import { JourneyPreview } from "./components/journey-preview";
import { FollowingActivity, SuggestedProfiles } from "./components/social-sections";
import { useHomeExperience } from "./use-home-experience";
import type { JourneyStageView } from "./types";
import { prepareTimelineGameQueue } from "@/src/services/firebase/timeline-game-service";
import { prefetchImageUrls } from "@/utils/image-prefetch";
import { markPerformanceEvent } from "@/utils/performance";
import { useStartupPhase } from "@/hooks/use-startup-phase";
import { useRouteFirstRouter } from "@/hooks/use-route-first-router";

export default function HomeExperienceScreen() {
  const router = useRouteFirstRouter();
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const home = useHomeExperience();
  const startupPhase = useStartupPhase();
  const [themePickerOpen, setThemePickerOpen] = useState(false);
  const [heroVisible, setHeroVisible] = useState(true);
  const firstRenderMarkedRef = useRef(false);
  const dataReadyMarkedRef = useRef(false);
  if (!firstRenderMarkedRef.current) {
    firstRenderMarkedRef.current = true;
    markPerformanceEvent("HOME_FIRST_RENDER");
  }
  const activeThemeLabel = getThemePickerLabel(theme, language);
  const currentSeerLabel = home.currentSeerLevel?.name[language] ?? t(homeCopy.journeyCount, language);
  const homeImagePrefetchKey = [
    ...home.feed.hero.map((item) => item.image),
    ...home.feed.recommendations.slice(0, 4).map((item) => item.image),
    home.feed.dailyArtist?.image,
    home.feed.dailyStory?.image
  ].filter(Boolean).join("|");

  useEffect(() => {
    if (startupPhase !== "idle" || !home.isInitialReady || !home.isAuthenticated || !home.canUseMemberFeatures) return;
    let active = true;
    void prepareTimelineGameQueue("artwork", 1)
      .then(() => active ? prepareTimelineGameQueue("artist", 1) : [])
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [home.canUseMemberFeatures, home.isAuthenticated, home.isInitialReady, startupPhase]);

  useEffect(() => {
    if (!home.isInitialReady || dataReadyMarkedRef.current) return;
    dataReadyMarkedRef.current = true;
    markPerformanceEvent("HOME_DATA_READY");
  }, [home.isInitialReady]);

  useEffect(() => {
    if (startupPhase !== "idle" || !home.isInitialReady || !homeImagePrefetchKey) return;
    const task = InteractionManager.runAfterInteractions(() => {
      void prefetchImageUrls(homeImagePrefetchKey.split("|"), 2);
    });
    return () => task.cancel();
  }, [home.isInitialReady, homeImagePrefetchKey, startupPhase]);

  const quickActions: HomeActionItem[] = [
    { id: "premium", icon: "diamond", title: "Premium", subtitle: t(homeCopy.premiumSubtitle, language), accent: "gold", image: artworks[4].image, imageFocus: { x: 72, y: 44 }, onPress: () => router.push("/premium") },
    { id: "feed", icon: "newspaper", title: uiCopy.feedDiscover[language], subtitle: t(homeCopy.feedSubtitle, language), accent: "violet", image: artworks[3].image, imageFocus: { x: 68, y: 48 }, onPress: () => router.push("/(tabs)/feed") },
    { id: "gallery", icon: "easel", title: copy.gallery[language], subtitle: t(homeCopy.gallerySubtitle, language), accent: "blue", image: artworks[0].image, imageFocus: { x: 70, y: 42 }, onPress: () => router.push("/(tabs)/gallery") },
    { id: "books", icon: "bookmarks", title: copy.events[language], subtitle: t(homeCopy.eventsSubtitle, language), accent: "pink", image: artworks[2].image, imageFocus: { x: 70, y: 38 }, onPress: () => router.push("/(tabs)/events") },
    { id: "stories", icon: "document-text", title: uiCopy.artArticles[language], subtitle: t(homeCopy.articlesSubtitle, language), accent: "violet", image: artworks[9].image, imageFocus: { x: 68, y: 46 }, onPress: () => router.push("/stories") },
    { id: "museum", icon: "albums", title: t(homeCopy.myMuseum, language), subtitle: t(homeCopy.museumSubtitle, language), accent: "blue", image: artworks[7].image, imageFocus: { x: 68, y: 48 }, onPress: () => router.push("/my-museum") }
  ];
  const gameActions: HomeActionItem[] = [
    { id: "competition", icon: "color-palette", title: copy.communityArt[language], subtitle: copy.newArtworks[language], accent: "pink", image: artworks[5].image, imageFocus: { x: 72, y: 48 }, onPress: () => router.push("/(tabs)/ranking") },
    { id: "games", icon: "game-controller", title: uiCopy.games[language], subtitle: t(homeCopy.gamesSubtitle, language), accent: "violet", image: artworks[3].image, imageFocus: { x: 72, y: 50 }, onPress: () => router.push("/games") },
    { id: "chance", icon: "sparkles", title: t(homeCopy.chanceCard, language), subtitle: t(homeCopy.chanceSubtitle, language), accent: "gold", image: artworks[6].image, imageFocus: { x: 72, y: 48 }, onPress: () => router.push("/chance-card") },
    { id: "duels", icon: "flash", title: t(homeCopy.seerDuel, language), subtitle: t(homeCopy.duelSubtitle, language), accent: "pink", image: artworks[8].image, imageFocus: { x: 70, y: 45 }, onPress: () => router.push("/duels") },
    { id: "profiles", icon: "compass", title: uiCopy.discover[language], subtitle: uiCopy.discoverSubtitle[language], accent: "blue", image: artworks[2].image, imageFocus: { x: 72, y: 38 }, onPress: () => router.push("/discover") },
    { id: "leaderboards", icon: "bar-chart", title: copy.ranking[language], subtitle: t(homeCopy.rankingSubtitle, language), accent: "violet", image: artworks[1].image, imageFocus: { x: 70, y: 38 }, onPress: () => router.push("/leaderboards") }
  ];

  function openStage(stage: JourneyStageView) {
    if (stage.state === "locked") return;
    home.journeyExperience.openStage(stage.id);
    router.push({ pathname: stage.activity.route, params: stage.activity.params ?? {} } as never);
  }

  function openArtwork(id: string) {
    home.recordDiscoveryOpen("artwork", id);
    router.push({ pathname: "/artwork/[id]", params: { id } });
  }

  function openArtist(id: string) {
    home.recordDiscoveryOpen("artist", id);
    router.push({ pathname: "/artist/[id]", params: { id } });
  }

  function openStory(id: string) {
    home.recordDiscoveryOpen("story", id);
    router.push({ pathname: "/story/[id]", params: { id } });
  }

  const handleViewableHomeItems = useCallback((keys: string[]) => {
    const next = keys.includes("hero");
    setHeroVisible((current) => current === next ? current : next);
  }, []);

  const homeItems = [
    { key: "hero", content: <Reveal><DynamicHero motionActive={heroVisible} theme={theme} items={home.feed.hero} greetingKey={home.feed.greetingKey} displayName={home.isAuthenticated ? home.account.displayName : "Art Atlas"} premium={home.isAuthenticated && home.account.isPremium} onOpen={openArtwork} /></Reveal> },
    { key: "journey", content: <Reveal delay={45}><JourneyPreview theme={theme} journey={home.journey} stages={home.journeyExperience.stages} progress={home.journeyExperience.progress} previewCount={home.runtimeConfig.config.journeyPreviewCount} isAuthenticated={home.isAuthenticated} onOpenJourney={() => router.push("/journey")} onOpenStage={openStage} /></Reveal> },
    {
      key: "quick-discovery",
      content: <Reveal delay={70}>
        <View style={styles.themeRow}>
          <View style={styles.themeCopy}><Text style={styles.themeEyebrow}>ART ATLAS</Text><Text style={styles.themeTitle}>{t(homeCopy.quickDiscovery, language)}</Text></View>
          <PressableScale onPress={() => setThemePickerOpen(true)} wrapStyle={styles.themeButtonWrap} style={styles.themeButton} accessibilityLabel={activeThemeLabel}><Ionicons name={themeIcon(theme)} size={17} color={v2Colors.cyan} /><Text style={styles.themeButtonText} numberOfLines={2}>{activeThemeLabel}</Text></PressableScale>
        </View>
        <QuickDiscovery theme={theme} title="" items={quickActions} accent={v2Colors.cyan} />
      </Reveal>
    },
    { key: "for-you", content: <Reveal delay={85}><ArtworkRail theme={theme} title={t(homeCopy.forYou, language)} curatorLabel={t(homeCopy.curatorSelection, language)} curator items={home.feed.recommendations} actionLabel={t(homeCopy.seeAll, language)} onAction={() => router.push("/(tabs)/gallery")} onOpen={openArtwork} /></Reveal> },
    {
      key: "daily-challenge",
      content: <Reveal delay={95}><DailyChallengeCard theme={theme} challenge={home.feed.dailyChallenge} onPress={() => {
        if (home.feed.dailyChallenge.route === "/timeline-game") {
          router.push({ pathname: "/timeline-game", params: home.feed.dailyChallenge.params });
          return;
        }
        router.push("/games");
      }} /></Reveal>
    },
    { key: "games", content: <Reveal delay={105}><QuickDiscovery theme={theme} title={t(homeCopy.challengesGames, language)} items={gameActions} accent={v2Colors.pink} variant="games" /></Reveal> },
    { key: "editorial", content: <Reveal delay={115}><DailyEditorial theme={theme} artist={home.feed.dailyArtist} story={home.feed.dailyStory} onArtist={openArtist} onStory={openStory} /></Reveal> },
    { key: "popular", content: <Reveal delay={125}><ArtworkRail theme={theme} title={t(homeCopy.popularNew, language)} items={home.feed.popular} actionLabel={t(homeCopy.seeAll, language)} onAction={() => router.push("/(tabs)/gallery")} onOpen={openArtwork} /></Reveal> },
    { key: "achievements", content: <Reveal delay={135}><AchievementStrip theme={theme} values={[
      { id: "museum", icon: "albums", value: home.museumArtworkIds.length, label: t(homeCopy.museumCount, language) },
      { id: "read", icon: "eye", value: home.readArtworkIds.length, label: t(homeCopy.readCount, language) },
      { id: "score", icon: "trophy", value: home.account.totalScore, label: t(homeCopy.scoreCount, language) },
      { id: "journey", icon: "trail-sign", value: home.journeyExperience.progress.completedStageIds.length, label: t(homeCopy.journeyCount, language) },
      { id: "seer", icon: "sparkles", value: home.seerPoints, label: currentSeerLabel }
    ]} /></Reveal> },
    { key: "following", content: <Reveal delay={145}><FollowingActivity theme={theme} artworks={home.followingArtworks} posts={home.followingPosts} /></Reveal> },
    { key: "profiles", content: <Reveal delay={155}><SuggestedProfiles theme={theme} users={home.suggestedUsers} /></Reveal> }
  ];

  return (
    <>
      <AppChrome title="Art Atlas" showTopAd={false} virtualizedItems={homeItems} virtualizedInitialNumToRender={6} onVirtualizedViewableItemsChanged={handleViewableHomeItems} />
      <ThemePickerModal visible={themePickerOpen} onClose={() => setThemePickerOpen(false)} />
    </>
  );
}

function themeIcon(theme: AppTheme): keyof typeof Ionicons.glyphMap {
  if (theme === "light") return "sunny-outline";
  if (theme === "vangogh") return "star-outline";
  if (theme === "monet") return "water-outline";
  if (theme === "dali") return "hourglass-outline";
  if (theme === "picasso") return "shapes-outline";
  return "moon-outline";
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    themeRow: { minHeight: 64, marginTop: 28, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    themeCopy: { flex: 1, minWidth: 0 },
    themeEyebrow: { ...safeTextLayout, color: v2Colors.cyan, fontSize: 9.5, lineHeight: 13, fontWeight: "800", letterSpacing: 1.6 },
    themeTitle: { ...safeTextLayout, color: colors.ivory, fontSize: 21, lineHeight: 27, fontWeight: "800", marginTop: 2, letterSpacing: -0.25 },
    themeButtonWrap: { width: "48%", minWidth: 128, maxWidth: 180 },
    themeButton: { width: "100%", minHeight: homeLayout.minimumTouchTarget, borderRadius: radii.pill, backgroundColor: v2Colors.surface1, borderWidth: 1, borderColor: v2Colors.border, paddingHorizontal: 12, paddingVertical: 5, flexDirection: "row", alignItems: "center", gap: 7 },
    themeButtonText: { ...safeTextLayout, flex: 1, color: v2Colors.textSecondary, fontSize: 11, lineHeight: 14, fontWeight: "700" }
  });
}
