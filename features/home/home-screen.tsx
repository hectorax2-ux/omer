import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image } from "expo-image";
import { FlatList, InteractionManager, NativeScrollEvent, NativeSyntheticEvent, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
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
import { resolveImageUri } from "@/utils/image-source";
import { useStartupPhase } from "@/hooks/use-startup-phase";
import { useRouteFirstRouter } from "@/hooks/use-route-first-router";
import { useArtNewsHeadlines } from "@/hooks/use-art-news";
import { NewsCard } from "@/components/news-card";

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

  const quickActions = useMemo<HomeActionItem[]>(() => [
    { id: "premium", icon: "diamond", title: "Premium", subtitle: t(homeCopy.premiumSubtitle, language), accent: "gold", image: artworks[4].image, imageFocus: { x: 72, y: 44 }, onPress: () => router.push("/premium") },
    { id: "feed", icon: "newspaper", title: uiCopy.feedDiscover[language], subtitle: t(homeCopy.feedSubtitle, language), accent: "violet", image: artworks[3].image, imageFocus: { x: 68, y: 48 }, onPress: () => router.push("/(tabs)/feed") },
    { id: "gallery", icon: "easel", title: copy.gallery[language], subtitle: t(homeCopy.gallerySubtitle, language), accent: "blue", image: artworks[0].image, imageFocus: { x: 70, y: 42 }, onPress: () => router.push("/(tabs)/gallery") },
    { id: "books", icon: "bookmarks", title: copy.events[language], subtitle: t(homeCopy.eventsSubtitle, language), accent: "pink", image: artworks[2].image, imageFocus: { x: 70, y: 38 }, onPress: () => router.push("/(tabs)/events") },
    { id: "stories", icon: "document-text", title: uiCopy.artArticles[language], subtitle: t(homeCopy.articlesSubtitle, language), accent: "violet", image: artworks[9].image, imageFocus: { x: 68, y: 46 }, onPress: () => router.push("/stories") },
    { id: "museum", icon: "albums", title: t(homeCopy.myMuseum, language), subtitle: t(homeCopy.museumSubtitle, language), accent: "blue", image: artworks[7].image, imageFocus: { x: 68, y: 48 }, onPress: () => router.push("/my-museum") }
  ], [language, router]);
  const gameActions = useMemo<HomeActionItem[]>(() => [
    { id: "competition", icon: "color-palette", title: copy.communityArt[language], subtitle: copy.newArtworks[language], accent: "pink", image: artworks[5].image, imageFocus: { x: 72, y: 48 }, onPress: () => router.push("/(tabs)/ranking") },
    { id: "games", icon: "game-controller", title: uiCopy.games[language], subtitle: t(homeCopy.gamesSubtitle, language), accent: "violet", image: artworks[3].image, imageFocus: { x: 72, y: 50 }, onPress: () => router.push("/games") },
    { id: "chance", icon: "sparkles", title: t(homeCopy.chanceCard, language), subtitle: t(homeCopy.chanceSubtitle, language), accent: "gold", image: artworks[6].image, imageFocus: { x: 72, y: 48 }, onPress: () => router.push("/chance-card") },
    { id: "duels", icon: "flash", title: t(homeCopy.seerDuel, language), subtitle: t(homeCopy.duelSubtitle, language), accent: "pink", image: artworks[8].image, imageFocus: { x: 70, y: 45 }, onPress: () => router.push("/duels") },
    { id: "profiles", icon: "compass", title: uiCopy.discover[language], subtitle: uiCopy.discoverSubtitle[language], accent: "blue", image: artworks[2].image, imageFocus: { x: 72, y: 38 }, onPress: () => router.push("/discover") },
    { id: "leaderboards", icon: "bar-chart", title: copy.ranking[language], subtitle: t(homeCopy.rankingSubtitle, language), accent: "violet", image: artworks[1].image, imageFocus: { x: 70, y: 38 }, onPress: () => router.push("/leaderboards") }
  ], [language, router]);

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
    { key: "art-news", content: <HomeNewsSection /> },
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
      <AppChrome title="Art Atlas" showTopAd={false} virtualizedItems={homeItems} virtualizedInitialNumToRender={3} onVirtualizedViewableItemsChanged={handleViewableHomeItems} />
      <ThemePickerModal visible={themePickerOpen} onClose={() => setThemePickerOpen(false)} />
    </>
  );
}

function HomeNewsSection() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const router = useRouteFirstRouter();
  const colors = getThemeColors(theme);
  const headlines = useArtNewsHeadlines();
  const { width } = useWindowDimensions();
  const cardWidth = Math.max(260, width - (width < 360 ? 32 : width > 720 ? 48 : 36));
  if (!headlines.length) return null;
  const title = language === "tr" ? "Sanat Haberleri" : language === "ru" ? "Новости искусства" : language === "uz" ? "San’at yangiliklari" : "Art News";
  const seeAll = language === "tr" ? "Tümünü gör" : language === "ru" ? "Смотреть все" : language === "uz" ? "Barchasini ko‘rish" : "See all";
  return <View style={homeNewsStyles.section}><View style={homeNewsStyles.header}><Text style={[homeNewsStyles.title, { color: colors.ivory }]}>{title}</Text><Pressable onPress={() => router.push("/art-news")}><Text style={[homeNewsStyles.action, { color: colors.gold }]}>{seeAll}</Text></Pressable></View><HomeHeadlineSlider items={headlines} width={cardWidth} colors={colors} language={language} /></View>;
}

function HomeHeadlineSlider({ items, width, colors, language }: { items: ReturnType<typeof useArtNewsHeadlines>; width: number; colors: ReturnType<typeof getThemeColors>; language: "tr" | "en" | "ru" | "uz" }) {
  const listRef = useRef<FlatList<(typeof items)[number]>>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const urls = [activeIndex - 1, activeIndex, activeIndex + 1]
      .filter((index) => index >= 0 && index < items.length)
      .map((index) => items[index].coverMedium || items[index].coverImage)
      .filter(Boolean)
      .map((url) => resolveImageUri(url, "large"));
    if (urls.length) void Image.prefetch([...new Set(urls)], { cachePolicy: "memory-disk" }).catch(() => false);
  }, [activeIndex, items]);

  const syncIndex = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.max(0, Math.min(items.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)));
    setActiveIndex((current) => current === nextIndex ? current : nextIndex);
  };
  const goTo = (index: number) => {
    const nextIndex = (index + items.length) % items.length;
    setActiveIndex(nextIndex);
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
  };

  return <View style={{ width }}><FlatList ref={listRef} horizontal pagingEnabled bounces={false} data={items} keyExtractor={(item) => `home-headline:${item.id}`} renderItem={({ item }) => <View style={{ width }}><NewsCard item={item} variant="homeHeadline" /></View>} getItemLayout={(_, index) => ({ length: width, offset: width * index, index })} initialNumToRender={1} maxToRenderPerBatch={2} windowSize={3} showsHorizontalScrollIndicator={false} disableIntervalMomentum onMomentumScrollEnd={syncIndex} />{items.length > 1 ? <View pointerEvents="box-none" style={homeNewsStyles.arrows}><Pressable accessibilityLabel={language === "tr" ? "Önceki manşet" : "Previous headline"} hitSlop={8} onPress={() => goTo(activeIndex - 1)} style={[homeNewsStyles.arrow, { backgroundColor: colors.ink, borderColor: colors.line }]}><Ionicons name="chevron-back" size={17} color={colors.ivory} /></Pressable><Pressable accessibilityLabel={language === "tr" ? "Sonraki manşet" : "Next headline"} hitSlop={8} onPress={() => goTo(activeIndex + 1)} style={[homeNewsStyles.arrow, { backgroundColor: colors.ink, borderColor: colors.line }]}><Ionicons name="chevron-forward" size={17} color={colors.ivory} /></Pressable></View> : null}<View style={homeNewsStyles.indicators}>{items.map((item, index) => <View key={`home-indicator:${item.id}`} style={[homeNewsStyles.indicator, { backgroundColor: index === activeIndex ? colors.gold : colors.line }, index === activeIndex && homeNewsStyles.activeIndicator]} />)}</View></View>;
}

const homeNewsStyles = StyleSheet.create({
  section: { marginTop: 28, gap: 12 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  title: { flexShrink: 1, fontSize: 21, lineHeight: 27, fontWeight: "800" },
  action: { fontSize: 11, lineHeight: 15, fontWeight: "700" },
  arrows: { position: "absolute", top: 72, left: 9, right: 9, flexDirection: "row", justifyContent: "space-between" },
  arrow: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: "center", justifyContent: "center", opacity: 0.92 },
  indicators: { minHeight: 17, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingTop: 9 },
  indicator: { width: 5, height: 5, borderRadius: 3 },
  activeIndicator: { width: 22 }
});

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
