import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Animated, FlatList, NativeScrollEvent, NativeSyntheticEvent, Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View, ViewToken } from "react-native";
import { useFocusEffect } from "expo-router";
import { useRouteFirstRouter } from "@/hooks/use-route-first-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppChrome } from "@/components/app-chrome";
import { NewsCard } from "@/components/news-card";
import { ScreenDataState } from "@/components/screen-data-state";
import { navigationLayout } from "@/constants/design";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useArtNews } from "@/hooks/use-art-news";
import { useLanguage } from "@/hooks/use-language";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { saveResourceCache } from "@/src/services/cache/resource-cache";
import { localizeNews } from "@/src/services/firebase/news-service";
import { ArtNewsDocument } from "@/src/types/firestore";
import { resolveImageUri } from "@/utils/image-source";

const copy = {
  title: { tr: "Sanat Haberleri", en: "Art News", ru: "Новости искусства", uz: "San’at yangiliklari" },
  ticker: { tr: "SANAT GÜNDEMİ", en: "ART AGENDA", ru: "АРТ-ПОВЕСТКА", uz: "SAN’AT KUN TARTIBI" },
  headlines: { tr: "Manşetler", en: "Headlines", ru: "Главное", uz: "Sarlavhalar" },
  featured: { tr: "Öne Çıkanlar", en: "Featured", ru: "В центре внимания", uz: "Tanlanganlar" },
  latest: { tr: "Son Haberler", en: "Latest", ru: "Последние новости", uz: "So‘nggi yangiliklar" },
  all: { tr: "Tümü", en: "All", ru: "Все", uz: "Barchasi" },
  empty: { tr: "Henüz yayınlanmış sanat haberi bulunmuyor.", en: "There are no published art news stories yet.", ru: "Опубликованных новостей искусства пока нет.", uz: "Hali e’lon qilingan san’at yangiliklari yo‘q." },
  categoryEmpty: { tr: "Bu kategoride henüz yayınlanmış haber yok.", en: "No published stories in this category yet.", ru: "В этой категории пока нет опубликованных новостей.", uz: "Bu turkumda hali e’lon qilingan yangilik yo‘q." },
  loadMore: { tr: "12 HABER DAHA GÖSTER", en: "SHOW 12 MORE STORIES", ru: "ПОКАЗАТЬ ЕЩЁ 12 НОВОСТЕЙ", uz: "YANA 12 TA XABAR KO‘RSATISH" },
  loadingMore: { tr: "Haberler yükleniyor…", en: "Loading stories…", ru: "Новости загружаются…", uz: "Yangiliklar yuklanmoqda…" },
  loadMoreError: { tr: "Haberler yüklenemedi", en: "Stories could not be loaded", ru: "Не удалось загрузить новости", uz: "Yangiliklarni yuklab bo‘lmadi" },
  retry: { tr: "Tekrar dene", en: "Try again", ru: "Повторить", uz: "Qayta urinish" },
  archiveEnd: { tr: "— Arşivin sonuna ulaştınız —", en: "— You have reached the end of the archive —", ru: "— Вы дошли до конца архива —", uz: "— Arxiv oxiriga yetdingiz —" },
  previous: { tr: "Önceki manşet", en: "Previous headline", ru: "Предыдущая новость", uz: "Oldingi sarlavha" },
  next: { tr: "Sonraki manşet", en: "Next headline", ru: "Следующая новость", uz: "Keyingi sarlavha" }
} as const;

export default function ArtNewsScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [category, setCategory] = useState("");
  const news = useArtNews(category);
  const refreshNews = news.revalidate;
  const [refreshing, setRefreshing] = useState(false);
  const pagePadding = width < 360 ? 14 : 18;
  const cardWidth = Math.max(260, width - pagePadding * 2);
  const bottomPadding = navigationLayout.floatingBarHeight + Math.max(insets.bottom, navigationLayout.minimumBottomInset) + 36;
  const supporting = useMemo(() => news.pinned.slice(0, 4), [news.pinned]);

  useFocusEffect(useCallback(() => {
    void refreshNews().catch(() => undefined);
  }, [refreshNews]));

  return (
    <AppChrome title={copy.title[language]} eyebrow="ART ATLAS • NEWS" scroll={false} showBackButton>
      {news.status === "loading" && !news.allItems.length ? <ScreenDataState status="loading" /> : news.status === "error" && !news.allItems.length ? (
        <ScreenDataState status="error" onRetry={() => void news.refresh()} />
      ) : (
        <FlatList
          data={news.items}
          keyExtractor={(item) => item.id}
          renderItem={({ item, index }) => <NewsCard item={item} variant={index % 12 === 4 ? "editorial" : "compact"} />}
          contentContainerStyle={{ paddingHorizontal: pagePadding, paddingTop: 8, paddingBottom: bottomPadding }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          initialNumToRender={6}
          maxToRenderPerBatch={5}
          updateCellsBatchingPeriod={40}
          windowSize={5}
          refreshControl={<RefreshControl tintColor={colors.gold} refreshing={refreshing} onRefresh={() => {
            setRefreshing(true);
            void news.refresh().finally(() => setRefreshing(false));
          }} />}
          ListHeaderComponent={(
            <View style={styles.header}>
              {news.ticker ? <NewsTicker item={news.ticker} label={copy.ticker[language]} colors={colors} /> : null}
              {news.headlines.length ? <SectionTitle text={copy.headlines[language]} color={colors.ivory} /> : null}
              {news.headlines.length ? <HeadlineSlider items={news.headlines.slice(0, 5)} width={cardWidth} colors={colors} language={language} /> : null}
              {supporting.length ? <SectionTitle text={copy.featured[language]} color={colors.ivory} /> : null}
              {supporting.length ? <EditorialHighlights items={supporting} colors={colors} /> : null}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
                <CategoryChip active={!category} label={copy.all[language]} onPress={() => setCategory("")} colors={colors} />
                {news.categories.map((item) => <CategoryChip key={item.id} active={category === item.id} label={localizeNews(item.label, language)} onPress={() => setCategory(item.id)} colors={colors} />)}
              </ScrollView>
              <SectionRuleTitle text={copy.latest[language]} colors={colors} />
            </View>
          )}
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>{category ? copy.categoryEmpty[language] : copy.empty[language]}</Text>}
          ListFooterComponent={<LoadMoreFooter news={news} language={language} colors={colors} />}
        />
      )}
    </AppChrome>
  );
}

function EditorialHighlights({ items, colors }: { items: ArtNewsDocument[]; colors: ReturnType<typeof getThemeColors> }) {
  return (
    <View style={[styles.editorialPanel, { backgroundColor: colors.panelSoft, borderColor: colors.line }]}>
      {items.map((item, index) => (
        <View key={`editorial:${item.id}`} style={[index > 0 && styles.editorialItem, index > 0 && { borderTopColor: colors.line }]}>
          <NewsCard item={item} variant={index === 0 ? "editorial" : "compact"} />
        </View>
      ))}
    </View>
  );
}

function SectionRuleTitle({ text, colors }: { text: string; colors: ReturnType<typeof getThemeColors> }) {
  return <View style={styles.ruleTitle}><Text style={[styles.sectionTitle, { color: colors.ivory }]}>{text}</Text><View style={[styles.ruleLine, { backgroundColor: colors.gold }]} /></View>;
}

function LoadMoreFooter({ news, language, colors }: { news: ReturnType<typeof useArtNews>; language: "tr" | "en" | "ru" | "uz"; colors: ReturnType<typeof getThemeColors> }) {
  if (news.loadingMore) {
    return <View style={styles.loadingMore}><Text style={[styles.loadingMoreText, { color: colors.muted }]}>{copy.loadingMore[language]}</Text>{[0, 1].map((item) => <View key={item} style={[styles.loadSkeleton, { backgroundColor: colors.panelSoft, borderColor: colors.line }]} />)}</View>;
  }
  if (news.loadMoreError) {
    return <View style={styles.loadMoreError}><Text style={[styles.loadingMoreText, { color: colors.muted }]}>{copy.loadMoreError[language]}</Text><Pressable accessibilityRole="button" onPress={() => void news.loadMore()} style={({ pressed }) => [styles.retryButton, { borderColor: colors.gold }, pressed && styles.pressed]}><Text style={[styles.retryText, { color: colors.gold }]}>{copy.retry[language]}</Text></Pressable></View>;
  }
  if (!news.hasMore && news.items.length) return <Text style={[styles.archiveEnd, { color: colors.muted }]}>{copy.archiveEnd[language]}</Text>;
  if (!news.hasMore) return null;
  return <Pressable accessibilityRole="button" onPress={() => void news.loadMore()} style={({ pressed }) => [styles.loadMoreButton, { backgroundColor: colors.panelSoft, borderColor: colors.gold }, pressed && styles.pressed]}><Text style={[styles.loadMoreText, { color: colors.ivory }]}>{copy.loadMore[language]}</Text><Ionicons name="chevron-down" size={15} color={colors.gold} /></Pressable>;
}

function NewsTicker({ item, label, colors }: { item: ArtNewsDocument; label: string; colors: ReturnType<typeof getThemeColors> }) {
  const router = useRouteFirstRouter();
  const { language } = useLanguage();
  const reducedMotion = useReducedMotion();
  const translateX = useRef(new Animated.Value(0)).current;
  const [trackWidth, setTrackWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const title = localizeNews(item.title, language);

  useEffect(() => {
    const distance = Math.max(0, textWidth - trackWidth + 20);
    translateX.stopAnimation();
    translateX.setValue(0);
    if (!distance || reducedMotion) return;
    const animation = Animated.loop(Animated.sequence([
      Animated.delay(900),
      Animated.timing(translateX, { toValue: -distance, duration: Math.max(2800, distance * 28), useNativeDriver: true }),
      Animated.delay(900),
      Animated.timing(translateX, { toValue: 0, duration: 380, useNativeDriver: true })
    ]));
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, textWidth, trackWidth, translateX]);

  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={() => {
      router.push(`/news/${item.id}` as never);
      void saveResourceCache(`art-news:item:${item.id}`, item);
    }} style={({ pressed }) => [styles.ticker, { backgroundColor: colors.panelSoft, borderColor: colors.line }, pressed && styles.pressed]}>
      <Text style={[styles.tickerLabel, { color: colors.gold }]} numberOfLines={1}>{label}</Text>
      <View style={[styles.tickerDot, { backgroundColor: colors.gold }]} />
      <View style={styles.tickerTrack} onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}>
        <Animated.View onLayout={(event) => setTextWidth(event.nativeEvent.layout.width)} style={[styles.tickerMoving, { transform: [{ translateX }] }]}>
          <Text style={[styles.tickerText, { color: colors.ivory }]} numberOfLines={1}>{title}</Text>
        </Animated.View>
      </View>
    </Pressable>
  );
}

function HeadlineSlider({ items, width, colors, language }: { items: ArtNewsDocument[]; width: number; colors: ReturnType<typeof getThemeColors>; language: "tr" | "en" | "ru" | "uz" }) {
  const listRef = useRef<FlatList<ArtNewsDocument>>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 60 }).current;
  const handleViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken<ArtNewsDocument>[] }) => {
    const nextIndex = viewableItems.find((item) => item.isViewable)?.index;
    if (typeof nextIndex === "number") setActiveIndex((current) => current === nextIndex ? current : nextIndex);
  }).current;

  useEffect(() => {
    const indexes = [activeIndex, activeIndex - 1, activeIndex + 1].filter((index) => index >= 0 && index < items.length);
    const urls = [...new Set(indexes.map((index) => items[index].coverMedium || items[index].coverImage).filter(Boolean).map((url) => resolveImageUri(url, "large")))];
    if (urls.length) void Image.prefetch(urls, { cachePolicy: "memory-disk" }).catch(() => false);
  }, [activeIndex, items]);

  const goTo = (index: number) => {
    const nextIndex = (index + items.length) % items.length;
    setActiveIndex(nextIndex);
    listRef.current?.scrollToIndex({ index: nextIndex, animated: true });
  };
  const syncActiveIndex = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const nextIndex = Math.max(0, Math.min(items.length - 1, Math.round(event.nativeEvent.contentOffset.x / width)));
    setActiveIndex((current) => current === nextIndex ? current : nextIndex);
  };

  return (
    <View style={{ width }}>
      <FlatList
        ref={listRef}
        horizontal
        pagingEnabled
        bounces={false}
        data={items}
        keyExtractor={(item) => `headline:${item.id}`}
        renderItem={({ item }) => <View style={{ width }}><NewsCard item={item} variant="headline" /></View>}
        getItemLayout={(_, index) => ({ length: width, offset: width * index, index })}
        initialNumToRender={1}
        maxToRenderPerBatch={2}
        windowSize={3}
        showsHorizontalScrollIndicator={false}
        disableIntervalMomentum
        scrollEventThrottle={16}
        onScroll={syncActiveIndex}
        onMomentumScrollEnd={syncActiveIndex}
        viewabilityConfig={viewabilityConfig}
        onViewableItemsChanged={handleViewableItemsChanged}
      />
      {items.length > 1 ? <View pointerEvents="box-none" style={[styles.sliderArrows, { top: Math.max(70, width / 3.3 - 20) }]}>
        <SliderArrow icon="chevron-back" label={copy.previous[language]} onPress={() => goTo(activeIndex - 1)} colors={colors} />
        <SliderArrow icon="chevron-forward" label={copy.next[language]} onPress={() => goTo(activeIndex + 1)} colors={colors} />
      </View> : null}
      <View style={styles.indicators}>{items.map((item, index) => <View key={`indicator:${item.id}`} style={[styles.indicator, { backgroundColor: index === activeIndex ? colors.gold : colors.line }, index === activeIndex && styles.activeIndicator]} />)}</View>
    </View>
  );
}

function SliderArrow({ icon, label, onPress, colors }: { icon: "chevron-back" | "chevron-forward"; label: string; onPress: () => void; colors: ReturnType<typeof getThemeColors> }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={({ pressed }) => [styles.sliderArrow, { backgroundColor: colors.ink, borderColor: colors.line }, pressed && styles.pressed]}><Ionicons name={icon} color={colors.ivory} size={18} /></Pressable>;
}

function SectionTitle({ text, color }: { text: string; color: string }) {
  return <Text style={[styles.sectionTitle, { color }]}>{text}</Text>;
}

function CategoryChip({ active, label, onPress, colors }: { active: boolean; label: string; onPress: () => void; colors: ReturnType<typeof getThemeColors> }) {
  return <Pressable onPress={onPress} style={[styles.chip, { backgroundColor: active ? colors.gold : colors.panelSoft, borderColor: active ? colors.gold : colors.line }]}><Text style={[styles.chipText, { color: active ? colors.ink : colors.ivory }]} numberOfLines={1}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  header: { gap: 12, marginBottom: 14 },
  sectionTitle: { fontSize: 20, lineHeight: 26, fontWeight: "800", marginTop: 4 },
  ticker: { minHeight: 36, flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: 10, overflow: "hidden" },
  tickerLabel: { flexShrink: 0, maxWidth: "42%", fontSize: 9, lineHeight: 12, fontWeight: "800", letterSpacing: 0.7 },
  tickerDot: { width: 5, height: 5, borderRadius: 3, marginHorizontal: 8 },
  tickerTrack: { flex: 1, minWidth: 0, overflow: "hidden" },
  tickerMoving: { alignSelf: "flex-start", paddingRight: 20 },
  tickerText: { fontSize: 11, lineHeight: 15, fontWeight: "600" },
  sliderArrows: { position: "absolute", left: 10, right: 10, flexDirection: "row", justifyContent: "space-between" },
  sliderArrow: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center", opacity: 0.92 },
  indicators: { minHeight: 18, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingTop: 10 },
  indicator: { width: 6, height: 6, borderRadius: 3 },
  activeIndicator: { width: 25 },
  editorialPanel: { width: "100%", borderWidth: 1, borderRadius: 18, padding: 8 },
  editorialItem: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, marginTop: 8 },
  ruleTitle: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 2 },
  ruleLine: { flex: 1, height: 1, opacity: 0.58 },
  chips: { gap: 7, paddingVertical: 4 },
  chip: { minHeight: 32, justifyContent: "center", borderWidth: 1, borderRadius: 16, paddingHorizontal: 12 },
  chipText: { fontSize: 11, lineHeight: 14, fontWeight: "700" },
  separator: { height: 11 },
  empty: { paddingVertical: 40, textAlign: "center", fontSize: 13, lineHeight: 19, fontWeight: "600" },
  loadMoreButton: { minHeight: 44, alignSelf: "center", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderRadius: 22, marginTop: 22, paddingHorizontal: 18 },
  loadMoreText: { fontSize: 11, lineHeight: 15, fontWeight: "700", letterSpacing: 0.45, textAlign: "center" },
  loadingMore: { gap: 10, marginTop: 18 },
  loadingMoreText: { fontSize: 12, lineHeight: 17, fontWeight: "600", textAlign: "center" },
  loadSkeleton: { height: 104, borderWidth: 1, borderRadius: 16, opacity: 0.66 },
  loadMoreError: { alignItems: "center", gap: 10, marginTop: 20 },
  retryButton: { minHeight: 44, justifyContent: "center", borderWidth: 1, borderRadius: 22, paddingHorizontal: 18 },
  retryText: { fontSize: 12, lineHeight: 16, fontWeight: "700" },
  archiveEnd: { paddingVertical: 28, fontSize: 11, lineHeight: 16, fontWeight: "600", textAlign: "center" },
  pressed: { opacity: 0.86 }
});
