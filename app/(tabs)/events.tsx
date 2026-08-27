import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { ClippedGradient } from "@/components/ui/clipped-gradient";
import { AppChrome } from "@/components/app-chrome";
import { AuthRequired } from "@/components/auth-required";
import { ReadingSizeControl } from "@/components/ui/reading-size-control";
import { useReadingScale } from "@/providers/reading-preferences-provider";
import { getThemeColors, type AppTheme } from "@/constants/theme";
import { radii, v2Colors } from "@/constants/design";
import { bookFilmPlaceholderSource, isBookFilmPlaceholderImage, resolveBookFilmImageSource } from "@/constants/book-film-media";
import { copy } from "@/data/content";
import { commonCopy } from "@/app/i18n/common";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { useRegisterRefresh } from "@/providers/refresh-provider";
import { listUserFavorites, removeFavorite, setFavorite } from "@/src/services/firebase/favorite-service";
import { subscribePublishedBookFilms, subscribeUserBookFilmEngagement } from "@/src/services/firebase/book-film-service";
import { removeReaction, setReaction } from "@/src/services/firebase/like-service";
import { markRead, removeRead } from "@/src/services/firebase/read-service";
import { setUserRating, subscribeRatingSummaries, type RatingSummary } from "@/src/services/firebase/rating-service";
import { t } from "@/utils/localized-text";
import { throttleAction, withinBurstLimit } from "@/utils/safety";
import type { LanguageCode } from "@/src/types/firestore";

type LibraryItem = {
  id: string;
  kind: "book" | "film";
  title: string;
  image: string;
  description: string;
  score: number;
  votes: number;
  language?: LanguageCode | "all";
};

type LibraryFilter = "all" | "favorites";
type SeenFilter = "all" | "seen" | "unseen" | "topLiked" | "lowLiked" | "topScore" | "lowScore";
type LibraryKind = "book" | "film";
const PAGE_SIZE = 20;
const SORT_ONLY_FILTERS = new Set<SeenFilter>(["topLiked", "lowLiked", "topScore", "lowScore"]);
const FILTER_OPTIONS: SeenFilter[] = ["all", "seen", "unseen", "topLiked", "lowLiked", "topScore", "lowScore"];

const libraryItems: LibraryItem[] = [
  {
    id: "book-ways-of-seeing",
    kind: "book",
    title: "Görme Biçimleri",
    image: "",
    description: "Sanata, imgeye ve görsel kültüre sade ama çarpıcı bir giriş.",
    score: 9.1,
    votes: 0
  },
  {
    id: "book-story-of-art",
    kind: "book",
    title: "Sanatın Öyküsü",
    image: "",
    description: "Sanat tarihini kronolojik ve anlaşılır bir dille takip etmek isteyenler için temel kaynak.",
    score: 9.4,
    votes: 0
  },
  {
    id: "book-art-spirit",
    kind: "book",
    title: "The Art Spirit",
    image: "https://images.unsplash.com/photo-1516979187457-637abb4f9353?auto=format&fit=crop&w=700&q=80",
    description: "Sanat üretimi, disiplin ve bakış geliştirme üzerine güçlü notlar.",
    score: 8.6,
    votes: 0
  },
  {
    id: "film-loving-vincent",
    kind: "film",
    title: "Loving Vincent",
    image: "",
    description: "Van Gogh'un dünyasını resimsel bir anlatımla izleyen etkileyici bir film.",
    score: 8.8,
    votes: 0
  },
  {
    id: "film-museum-hours",
    kind: "film",
    title: "Museum Hours",
    image: "",
    description: "Müze, şehir ve insan ilişkisini sakin bir tempoda ele alan kültür filmi.",
    score: 8.1,
    votes: 0
  },
  {
    id: "film-big-eyes",
    kind: "film",
    title: "Big Eyes",
    image: "",
    description: "Sanat dünyasında imza, görünürlük ve sahiplik üzerine akıcı bir hikaye.",
    score: 7.7,
    votes: 0
  }
];

const labels = {
  title: { tr: "Kitaplar ve Filmler", en: "Books and Films", ru: "Книги и фильмы", uz: "Kitoblar va filmlar" },
  eyebrow: { tr: "ÖNERİLER", en: "PICKS", ru: "РЕКОМЕНДАЦИИ", uz: "TAVSIYALAR" },
  hero: {
    tr: "Sanat tarihi, müze kültürü ve görsel dünyayı besleyen kitap ve film önerileri.",
    en: "Book and film picks for art history, museum culture, and visual thinking.",
    ru: "Книги и фильмы об истории искусства, музейной культуре и визуальном мышлении.",
    uz: "San'at tarixi, muzey madaniyati va vizual tafakkur uchun kitob va film tavsiyalari."
  },
  all: { tr: "Tümü", en: "All", ru: "Все", uz: "Barchasi" },
  favorites: { tr: "Favorilerim", en: "Favorites", ru: "Избранное", uz: "Sevimlilarim" },
  seen: { tr: "Okundu", en: "Read", ru: "Прочитано", uz: "O'qildi" },
  unseen: { tr: "Okunmadı", en: "Unread", ru: "Не прочитано", uz: "O'qilmadi" },
  watched: { tr: "İzlendi", en: "Watched", ru: "Просмотрено", uz: "Ko'rildi" },
  unwatched: { tr: "İzlenmedi", en: "Unwatched", ru: "Не просмотрено", uz: "Ko'rilmadi" },
  filterRead: { tr: "Okunanlar", en: "Read", ru: "Прочитанные", uz: "O'qilganlar" },
  filterUnread: { tr: "Okunmayanlar", en: "Unread", ru: "Непрочитанные", uz: "O'qilmaganlar" },
  filterWatched: { tr: "İzlenenler", en: "Watched", ru: "Просмотренные", uz: "Ko'rilganlar" },
  filterUnwatched: { tr: "İzlenmeyenler", en: "Unwatched", ru: "Непросмотренные", uz: "Ko'rilmaganlar" },
  topScore: { tr: "Yüksek Puan", en: "Highest rated", ru: "Высокая оценка", uz: "Yuqori ball" },
  lowScore: { tr: "Düşük Puan", en: "Lowest rated", ru: "Низкая оценка", uz: "Past ball" },
  topLiked: { tr: "En çok beğenilenler", en: "Most liked", ru: "Самые популярные", uz: "Eng yoqtirilgan" },
  lowLiked: { tr: "En az beğenilenler", en: "Least liked", ru: "Наименее популярные", uz: "Eng kam yoqtirilgan" },
  books: { tr: "Kitaplar", en: "Books", ru: "Книги", uz: "Kitoblar" },
  films: { tr: "Filmler", en: "Films", ru: "Фильмы", uz: "Filmlar" },
  searchBook: { tr: "Kitap ara", en: "Search books", ru: "Поиск книг", uz: "Kitob qidirish" },
  searchFilm: { tr: "Film ara", en: "Search films", ru: "Поиск фильмов", uz: "Film qidirish" },
  vote: { tr: "Oy ver", en: "Vote", ru: "Оценить", uz: "Ovoz berish" },
  rate: { tr: "Puan ver", en: "Rate", ru: "Оценить", uz: "Baholash" },
  yourRating: { tr: "Senin puanın", en: "Your rating", ru: "Ваша оценка", uz: "Sizning bahoyingiz" },
  ratingHint: { tr: "1 en düşük, 10 en yüksek. Yıldıza dokunup puan ver.", en: "1 lowest, 10 highest. Tap a star to rate.", ru: "1 — минимум, 10 — максимум. Нажмите звезду.", uz: "1 eng past, 10 eng yuqori. Yulduzga bosing." },
  noRating: { tr: "Henüz puan yok", en: "No ratings yet", ru: "Пока нет оценок", uz: "Hali baho yo'q" },
  ratingCount: { tr: "oy", en: "votes", ru: "оц.", uz: "ovoz" },
  save: { tr: "Kaydet", en: "Save", ru: "Сохранить", uz: "Saqlash" },
  close: { tr: "Kapat", en: "Close", ru: "Закрыть", uz: "Yopish" },
  empty: { tr: "Bu filtreye uygun öneri yok.", en: "No picks for this filter.", ru: "Нет рекомендаций для этого фильтра.", uz: "Bu filtrga mos tavsiya yo'q." }
};

export default function EventsScreen() {
  const { language } = useLanguage();
  const { account, canUseMemberFeatures, isAuthenticated } = useAccount();
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors, width), [colors, width]);
  const [mainFilter, setMainFilter] = useState<LibraryFilter>("all");
  const [activeKind, setActiveKind] = useState<LibraryKind>("book");
  const [seenFilter, setSeenFilter] = useState<SeenFilter>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [bookQuery, setBookQuery] = useState("");
  const [filmQuery, setFilmQuery] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [seenIds, setSeenIds] = useState<string[]>([]);
  const [votedIds, setVotedIds] = useState<string[]>([]);
  const [remoteItems, setRemoteItems] = useState<LibraryItem[]>([]);
  const [ratingSummaries, setRatingSummaries] = useState<Record<string, RatingSummary>>({});
  const [userRatings, setUserRatings] = useState<Record<string, number>>({});
  const [ratingTarget, setRatingTarget] = useState<LibraryItem | null>(null);
  const [ratingDraft, setRatingDraft] = useState(0);
  const [savingRating, setSavingRating] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  useRegisterRefresh(() => setRefreshCounter((value) => value + 1));

  useEffect(() => {
    const unsubscribe = subscribePublishedBookFilms(language, (items) => {
      setRemoteItems(items);
    }, () => {
      setRemoteItems([]);
    });
    return unsubscribe;
  }, [language, refreshCounter]);

  useEffect(() => {
    if (!account.uid) {
      setFavorites([]);
      setSeenIds([]);
      setVotedIds([]);
      setUserRatings({});
      return;
    }

    const unsubscribe = subscribeUserBookFilmEngagement(account.uid, (engagement) => {
      setFavorites(engagement.favorites);
      setSeenIds(engagement.seenIds);
      setVotedIds(engagement.likedIds);
      setUserRatings(engagement.userRatings);
    });
    return unsubscribe;
  }, [account.uid, refreshCounter]);

  useEffect(() => {
    const unsubscribe = subscribeRatingSummaries("bookFilm", setRatingSummaries);
    return () => unsubscribe();
  }, []);

  const items = useMemo(() => {
    const sourceItems = remoteItems.length ? remoteItems : libraryItems;

    const filtered = sourceItems.filter((item) => {
      const query = activeKind === "book" ? bookQuery : filmQuery;
      const matchesKind = item.kind === activeKind;
      const matchesLanguage = !item.language || item.language === "all" || item.language === language;
      const matchesQuery = item.title.toLocaleLowerCase("tr").includes(query.trim().toLocaleLowerCase("tr"));
      const matchesMain = mainFilter === "all" || favorites.includes(item.id);
      const matchesSeen =
        seenFilter === "all" ||
        SORT_ONLY_FILTERS.has(seenFilter) ||
        (seenFilter === "seen" ? seenIds.includes(item.id) : !seenIds.includes(item.id));
      return matchesKind && matchesLanguage && matchesQuery && matchesMain && matchesSeen;
    });

    if (seenFilter === "topLiked") {
      return filtered.sort((a, b) => b.votes - a.votes || a.title.localeCompare(b.title, "tr"));
    }

    if (seenFilter === "lowLiked") {
      return filtered.sort((a, b) => a.votes - b.votes || a.title.localeCompare(b.title, "tr"));
    }

    if (seenFilter === "topScore") {
      return filtered.sort((a, b) => compareByViewerRating(a.id, b.id, ratingSummaries, "desc") || a.title.localeCompare(b.title, "tr"));
    }

    if (seenFilter === "lowScore") {
      return filtered.sort((a, b) => compareByViewerRating(a.id, b.id, ratingSummaries, "asc") || a.title.localeCompare(b.title, "tr"));
    }

    return filtered.sort((a, b) => b.votes - a.votes || a.title.localeCompare(b.title, "tr"));
  }, [activeKind, bookQuery, favorites, filmQuery, language, mainFilter, ratingSummaries, remoteItems, seenFilter, seenIds]);

  if (!isAuthenticated) {
    return <AuthRequired title={labels.title[language]} />;
  }

  const activeItems = items;
  const featuredItem = activeItems[0];

  function openRating(item: LibraryItem) {
    setRatingTarget(item);
    setRatingDraft(userRatings[item.id] ?? 0);
  }

  function saveRating() {
    if (!ratingTarget || ratingDraft < 1 || !canUseMemberFeatures || !account.uid) return;
    if (!throttleAction(`rate_${ratingTarget.id}`, 1200)) return;
    const targetId = ratingTarget.id;
    const value = ratingDraft;
    setSavingRating(true);
    setUserRatings((current) => ({ ...current, [targetId]: value }));
    setUserRating(account.uid, "bookFilm", targetId, value)
      .catch(() => undefined)
      .finally(() => {
        setSavingRating(false);
        setRatingTarget(null);
      });
  }

  function toggleFavorite(id: string) {
    if (!canUseMemberFeatures || !account.uid) return;
    if (!throttleAction(`fav_bookfilm_${id}`, 700)) return;
    setFavorites((current) => {
      const exists = current.includes(id);
      (exists ? removeFavorite(account.uid, "bookFilm", id) : setFavorite(account.uid, "bookFilm", id)).catch(() => undefined);
      return exists ? current.filter((item) => item !== id) : [id, ...current];
    });
  }

  function toggleSeen(id: string) {
    if (!canUseMemberFeatures || !account.uid) return;
    if (!throttleAction(`read_bookfilm_${id}`, 700)) return;
    setSeenIds((current) => {
      const exists = current.includes(id);
      (exists ? removeRead(account.uid, "bookFilm", id) : markRead(account.uid, "bookFilm", id)).catch(() => undefined);
      return exists ? current.filter((item) => item !== id) : [id, ...current];
    });
  }

  function vote(id: string) {
    if (!canUseMemberFeatures || !account.uid) return;
    if (!throttleAction(`vote_bookfilm_${id}`, 900)) return;
    if (!withinBurstLimit(`vote_bookfilm_${account.uid}`, 40, 60 * 1000)) return;
    const exists = votedIds.includes(id);
    const previousVotedIds = votedIds;
    const previousItems = remoteItems;
    setVotedIds(exists ? votedIds.filter((item) => item !== id) : [id, ...votedIds]);
    setRemoteItems((current) => current.map((item) => item.id === id
      ? { ...item, votes: Math.max(0, item.votes + (exists ? -1 : 1)) }
      : item));
    (exists ? removeReaction(account.uid, "bookFilm", id) : setReaction(account.uid, "bookFilm", id, "like")).catch(() => {
      setVotedIds(previousVotedIds);
      setRemoteItems(previousItems);
    });
  }

  return (
    <AppChrome title={labels.title[language]} eyebrow={labels.eyebrow[language]}>
      <View style={[styles.hero, activeKind === "film" && styles.filmHero]}>
        {featuredItem ? (
          <Image
            source={isBookFilmPlaceholderImage(featuredItem.kind, featuredItem.image)
              ? bookFilmPlaceholderSource(featuredItem.kind)
              : resolveBookFilmImageSource(featuredItem.kind, featuredItem.image)}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <ClippedGradient colors={activeKind === "film" ? ["#0C4A6E", "#312E81", "#070A12"] : ["#4C1D95", "#7E22CE", "#070A12"]} androidColors={activeKind === "film" ? ["#0C314A", "#101329"] : ["#321B5A", "#171024"]} radius={radii.xl} />
        )}
        <ClippedGradient colors={["rgba(7,10,18,0.06)", "rgba(7,10,18,0.56)", "rgba(7,10,18,0.98)"]} androidColors={["rgba(7,10,18,0.12)", "rgba(7,10,18,0.98)"]} radius={radii.xl} />
        <View style={styles.heroGlow} pointerEvents="none" />
        <View style={styles.heroKindPill}>
          <Ionicons name={activeKind === "film" ? "film" : "book"} size={13} color={v2Colors.cyan} />
          <Text style={styles.heroKindText}>{activeKind === "film" ? labels.films[language] : labels.books[language]}</Text>
        </View>
        <View style={styles.heroCopy}>
          <Text style={styles.heroTitle} numberOfLines={3}>{featuredItem?.title ?? labels.title[language]}</Text>
          <Text style={styles.heroText} numberOfLines={2}>{featuredItem?.description ?? labels.hero[language]}</Text>
        </View>
        <View style={styles.heroAction}>
          <Ionicons name={activeKind === "film" ? "play" : "bookmark"} size={20} color={v2Colors.text} />
        </View>
      </View>

      <View style={styles.kindTabs}>
        <Pressable onPress={() => setActiveKind("book")} style={[styles.kindTab, activeKind === "book" && styles.kindTabActive]}>
          <Ionicons name="book" size={17} color={activeKind === "book" ? v2Colors.text : v2Colors.textMuted} />
          <Text style={[styles.kindTabText, activeKind === "book" && styles.kindTabTextActive]}>{labels.books[language]}</Text>
        </Pressable>
        <Pressable onPress={() => setActiveKind("film")} style={[styles.kindTab, activeKind === "film" && styles.kindTabActive]}>
          <Ionicons name="film" size={17} color={activeKind === "film" ? v2Colors.text : v2Colors.textMuted} />
          <Text style={[styles.kindTabText, activeKind === "film" && styles.kindTabTextActive]}>{labels.films[language]}</Text>
        </Pressable>
      </View>

      <View style={styles.filterTop}>
        <Pressable onPress={() => setMainFilter("all")} style={[styles.filterChip, mainFilter === "all" && styles.filterChipActive]}>
          <Text style={[styles.filterChipText, mainFilter === "all" && styles.filterChipTextActive]}>{labels.all[language]}</Text>
        </Pressable>
        <Pressable onPress={() => setMainFilter("favorites")} style={[styles.filterChip, mainFilter === "favorites" && styles.filterChipActive]}>
          <Text style={[styles.filterChipText, mainFilter === "favorites" && styles.filterChipTextActive]}>{labels.favorites[language]}</Text>
        </Pressable>
        <View style={styles.dropdownWrap}>
          <Pressable onPress={() => setFilterOpen((value) => !value)} style={styles.dropdownButton}>
            <Text style={styles.dropdownText}>{getSeenLabel(seenFilter, language, activeKind)}</Text>
            <Ionicons name="chevron-down" size={17} color={v2Colors.cyan} />
          </Pressable>
          {filterOpen ? (
            <View style={styles.dropdownMenu}>
              {FILTER_OPTIONS.map((item) => (
                <Pressable key={item} onPress={() => { setSeenFilter(item); setFilterOpen(false); }} style={styles.dropdownItem}>
                  <Text style={styles.dropdownItemText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>{getSeenLabel(item, language, activeKind)}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </View>

      <LibrarySection
        title={activeKind === "book" ? labels.books[language] : labels.films[language]}
        searchPlaceholder={activeKind === "book" ? labels.searchBook[language] : labels.searchFilm[language]}
        query={activeKind === "book" ? bookQuery : filmQuery}
        setQuery={activeKind === "book" ? setBookQuery : setFilmQuery}
        items={activeItems}
        favorites={favorites}
        seenIds={seenIds}
        votedIds={votedIds}
        ratingSummaries={ratingSummaries}
        userRatings={userRatings}
        onFavorite={toggleFavorite}
        onSeen={toggleSeen}
        onVote={vote}
        onRate={openRating}
        kind={activeKind}
        language={language}
        theme={theme}
        styles={styles}
        colors={colors}
      />

      <Modal visible={!!ratingTarget} transparent animationType="fade" onRequestClose={() => setRatingTarget(null)}>
        <Pressable style={styles.ratingBackdrop} onPress={() => setRatingTarget(null)}>
          <Pressable style={styles.ratingCard} onPress={() => undefined}>
            <Text style={styles.ratingTitle} numberOfLines={2}>{ratingTarget?.title}</Text>
            <Text style={styles.ratingHint}>{labels.ratingHint[language]}</Text>
            <View style={styles.starsRow}>
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => (
                <Pressable key={value} onPress={() => setRatingDraft(value)} style={styles.starButton} hitSlop={4}>
                  <Ionicons name={value <= ratingDraft ? "star" : "star-outline"} size={24} color={colors.gold} />
                  <Text style={styles.starNumber}>{value}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.ratingMeta}>
              <Text style={styles.ratingMetaText}>
                {ratingTarget && (ratingSummaries[ratingTarget.id]?.count ?? 0) > 0
                  ? `${ratingSummaries[ratingTarget.id].average.toFixed(1)} / 10 · ${ratingSummaries[ratingTarget.id].count} ${labels.ratingCount[language]}`
                  : labels.noRating[language]}
              </Text>
              {ratingDraft > 0 ? <Text style={styles.ratingMetaSelected}>{labels.yourRating[language]}: {ratingDraft}</Text> : null}
            </View>
            <Pressable disabled={ratingDraft < 1 || savingRating} onPress={saveRating} style={[styles.ratingSave, (ratingDraft < 1 || savingRating) && styles.ratingSaveDisabled]}>
              <Text style={styles.ratingSaveText}>{labels.save[language]}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

    </AppChrome>
  );
}

function getSeenLabel(filter: SeenFilter, language: "tr" | "en" | "ru" | "uz", kind: LibraryKind) {
  return {
    all: labels.all[language],
    seen: kind === "film" ? labels.filterWatched[language] : labels.filterRead[language],
    unseen: kind === "film" ? labels.filterUnwatched[language] : labels.filterUnread[language],
    topLiked: labels.topLiked[language],
    lowLiked: labels.lowLiked[language],
    topScore: labels.topScore[language],
    lowScore: labels.lowScore[language]
  }[filter];
}

function compareByViewerRating(
  leftId: string,
  rightId: string,
  ratingSummaries: Record<string, RatingSummary>,
  direction: "asc" | "desc"
) {
  const leftSummary = ratingSummaries[leftId];
  const rightSummary = ratingSummaries[rightId];
  const leftRating = leftSummary && leftSummary.count > 0 ? leftSummary.average : null;
  const rightRating = rightSummary && rightSummary.count > 0 ? rightSummary.average : null;
  if (leftRating === null && rightRating === null) return 0;
  if (leftRating === null) return 1;
  if (rightRating === null) return -1;
  return direction === "desc" ? rightRating - leftRating : leftRating - rightRating;
}

function LibrarySection({
  title,
  searchPlaceholder,
  query,
  setQuery,
  items,
  favorites,
  seenIds,
  votedIds,
  ratingSummaries,
  userRatings,
  onFavorite,
  onSeen,
  onVote,
  onRate,
  kind,
  language,
  theme,
  styles,
  colors
}: {
  title: string;
  searchPlaceholder: string;
  query: string;
  setQuery: (value: string) => void;
  items: LibraryItem[];
  favorites: string[];
  seenIds: string[];
  votedIds: string[];
  ratingSummaries: Record<string, RatingSummary>;
  userRatings: Record<string, number>;
  onFavorite: (id: string) => void;
  onSeen: (id: string) => void;
  onVote: (id: string) => void;
  onRate: (item: LibraryItem) => void;
  kind: LibraryKind;
  language: "tr" | "en" | "ru" | "uz";
  theme: AppTheme;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof getThemeColors>;
}) {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [detailItem, setDetailItem] = useState<LibraryItem | null>(null);
  const { scale } = useReadingScale();
  const readingTextStyle = { fontSize: 14 * scale, lineHeight: 21 * scale };
  const visibleItems = items.slice(0, visibleCount);
  const seenLabel = kind === "film" ? labels.watched : labels.seen;
  const unseenLabel = kind === "film" ? labels.unwatched : labels.unseen;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [items, query]);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={17} color={colors.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder={searchPlaceholder} placeholderTextColor={colors.muted} style={styles.searchInput} />
      </View>
      <View style={styles.list}>
        {visibleItems.map((item) => (
          <View key={item.id} style={styles.card}>
            <BookFilmCover kind={item.kind} image={item.image} styles={styles} />
            <View style={styles.info}>
              <View style={styles.cardTop}>
                <Text style={styles.itemTitle} numberOfLines={2}>{item.title}</Text>
                <Pressable onPress={() => onRate(item)} style={styles.scorePill} hitSlop={6}>
                  <Ionicons name={userRatings[item.id] ? "star" : "star-outline"} size={12} color={colors.ink} />
                  <Text style={styles.scoreText}>
                    {(ratingSummaries[item.id]?.count ?? 0) > 0 ? ratingSummaries[item.id].average.toFixed(1) : "–"}
                  </Text>
                </Pressable>
              </View>
              <BookFilmDescription
                text={item.description}
                language={language}
                onReadMore={() => setDetailItem(item)}
                styles={styles}
              />
              <View style={styles.actions}>
                <Pressable onPress={() => onFavorite(item.id)} style={[styles.actionButton, favorites.includes(item.id) && styles.actionActive]}>
                  <Ionicons name={favorites.includes(item.id) ? "bookmark" : "bookmark-outline"} size={15} color={favorites.includes(item.id) ? colors.ink : colors.gold} />
                  <Text style={[styles.actionText, favorites.includes(item.id) && styles.actionTextActive]}>{labels.favorites[language]}</Text>
                </Pressable>
                <Pressable onPress={() => onSeen(item.id)} style={[styles.actionButton, seenIds.includes(item.id) && styles.actionActive]}>
                  <Ionicons name={seenIds.includes(item.id) ? "eye" : "eye-outline"} size={15} color={seenIds.includes(item.id) ? colors.ink : colors.gold} />
                  <Text style={[styles.actionText, seenIds.includes(item.id) && styles.actionTextActive]}>{seenIds.includes(item.id) ? seenLabel[language] : unseenLabel[language]}</Text>
                </Pressable>
                <Pressable onPress={() => onVote(item.id)} style={[styles.voteButton, votedIds.includes(item.id) && styles.actionActive]}>
                  <Ionicons name={votedIds.includes(item.id) ? "thumbs-up" : "thumbs-up-outline"} size={15} color={votedIds.includes(item.id) ? colors.ink : colors.gold} />
                  <Text style={[styles.voteText, votedIds.includes(item.id) && styles.actionTextActive]}>{item.votes}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ))}
        {visibleCount < items.length ? (
          <Pressable onPress={() => setVisibleCount((value) => value + PAGE_SIZE)} style={styles.moreButton}>
            <Text style={styles.moreText}>{language === "tr" ? "Daha fazla gör" : language === "ru" ? "Показать еще" : language === "uz" ? "Ko'proq ko'rish" : "Show more"}</Text>
          </Pressable>
        ) : null}
        {!items.length ? (
          <View style={styles.emptyState}>
            <Ionicons name="search" size={22} color={colors.gold} />
            <Text style={styles.emptyText}>{labels.empty[language]}</Text>
          </View>
        ) : null}
      </View>

      <Modal visible={!!detailItem} transparent animationType="fade" onRequestClose={() => setDetailItem(null)}>
        <Pressable style={styles.detailBackdrop} onPress={() => setDetailItem(null)}>
          <Pressable style={styles.detailCard} onPress={() => undefined}>
            <View style={styles.detailHeader}>
              <Text style={styles.detailTitle}>{detailItem?.title}</Text>
              <Pressable onPress={() => setDetailItem(null)} hitSlop={10} accessibilityLabel={labels.close[language]}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <ReadingSizeControl theme={theme} />
            <ScrollView style={styles.detailScroll} contentContainerStyle={styles.detailScrollContent} showsVerticalScrollIndicator>
              <Text style={[styles.detailBody, readingTextStyle]}>{detailItem?.description}</Text>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function BookFilmCover({
  kind,
  image,
  styles
}: {
  kind: LibraryKind;
  image: string;
  styles: ReturnType<typeof createStyles>;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [image, kind]);

  const isPlaceholder = failed || isBookFilmPlaceholderImage(kind, image);
  const source = isPlaceholder ? bookFilmPlaceholderSource(kind) : resolveBookFilmImageSource(kind, image);

  return (
    <Image
      source={source}
      style={[styles.cover, kind === "film" && isPlaceholder ? styles.filmCoverPlaceholder : null]}
      contentFit="cover"
      contentPosition="center"
      onError={() => setFailed(true)}
    />
  );
}

function BookFilmDescription({
  text,
  language,
  onReadMore,
  styles
}: {
  text: string;
  language: "tr" | "en" | "ru" | "uz";
  onReadMore: () => void;
  styles: ReturnType<typeof createStyles>;
}) {
  const readMoreLabel = t(commonCopy.readMore, language);
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [preview, setPreview] = useState<BookDescriptionPreview>({ truncated: false });

  useEffect(() => {
    setPreview(buildBookDescriptionPreview(text, layoutWidth || 220, readMoreLabel));
  }, [text, layoutWidth, readMoreLabel]);

  if (!text.trim()) return null;

  return (
    <View
      style={styles.descWrap}
      onLayout={(event) => {
        const nextWidth = Math.round(event.nativeEvent.layout.width);
        if (nextWidth > 0 && nextWidth !== layoutWidth) setLayoutWidth(nextWidth);
      }}
    >
      {layoutWidth > 0 ? (
        <Text
          style={[styles.desc, styles.descMeasure, { width: layoutWidth }]}
          onTextLayout={(event) => {
            const lines = event.nativeEvent.lines;
            setPreview(lines.length > 2
              ? layoutBookDescriptionPreview(text, lines, readMoreLabel)
              : estimateBookDescriptionPreview(text, layoutWidth, readMoreLabel));
          }}
        >
          {text}
        </Text>
      ) : null}
      <Pressable onPress={preview.truncated ? onReadMore : undefined} disabled={!preview.truncated} style={styles.descTap}>
        <Text style={styles.desc}>
          {preview.truncated ? (
            <>
              {preview.lineOne}
              {"\n"}
              {preview.lineTwo}{" "}
              <Text style={styles.readMoreInline} onPress={onReadMore} suppressHighlighting>
                {readMoreLabel}
              </Text>
            </>
          ) : (
            text
          )}
        </Text>
      </Pressable>
    </View>
  );
}

type BookDescriptionPreview =
  | { truncated: false }
  | { truncated: true; lineOne: string; lineTwo: string };

function buildBookDescriptionPreview(text: string, width: number, readMoreLabel: string): BookDescriptionPreview {
  return estimateBookDescriptionPreview(text, width || 220, readMoreLabel);
}

function estimateBookDescriptionPreview(text: string, width: number, readMoreLabel: string): BookDescriptionPreview {
  const plain = text.replace(/\s+/g, " ").trim();
  if (!plain) return { truncated: false };

  const charsPerLine = Math.max(24, Math.floor(width / 6.4));
  const maxVisible = charsPerLine * 2 - readMoreLabel.length - 4;
  if (plain.length <= maxVisible) return { truncated: false };

  let lineBreak = plain.lastIndexOf(" ", charsPerLine);
  if (lineBreak < Math.floor(charsPerLine * 0.45)) lineBreak = charsPerLine;
  const lineOne = plain.slice(0, lineBreak).trimEnd();
  const rest = plain.slice(lineBreak).trimStart();
  const secondBudget = Math.max(12, charsPerLine - readMoreLabel.length - 2);
  const lineTwo = rest.length > secondBudget
    ? `${rest.slice(0, secondBudget).trimEnd()}…`
    : rest;

  return { truncated: true, lineOne, lineTwo };
}

function layoutBookDescriptionPreview(
  text: string,
  lines: Array<{ text: string }>,
  readMoreLabel: string
): BookDescriptionPreview {
  if (lines.length <= 2) return { truncated: false };

  const reserve = readMoreLabel.length + 2;
  const second = lines[1]?.text ?? "";
  const trimmedSecond = second.length > reserve + 4
    ? `${second.slice(0, second.length - reserve).trimEnd()}…`
    : second;

  return {
    truncated: true,
    lineOne: lines[0]?.text ?? "",
    lineTwo: trimmedSecond
  };
}

function createStyles(colors: ReturnType<typeof getThemeColors>, width: number) {
const compact = width < 360;
return StyleSheet.create({
  hero: { minHeight: compact ? 205 : 232, borderRadius: radii.xl, overflow: "hidden", justifyContent: "flex-end", padding: compact ? 16 : 20, marginBottom: 18, borderWidth: 1, borderColor: "rgba(139,92,246,0.24)", backgroundColor: v2Colors.elevated },
  filmHero: { borderColor: "rgba(34,211,238,0.22)" },
  heroGlow: { position: "absolute", right: -36, bottom: -52, width: 184, height: 184, borderRadius: 92, backgroundColor: "rgba(99,102,241,0.18)", shadowColor: v2Colors.brightViolet, shadowOpacity: 0.8, shadowRadius: 36, shadowOffset: { width: 0, height: 0 } },
  heroKindPill: { position: "absolute", left: compact ? 14 : 18, top: compact ? 14 : 18, minHeight: 30, borderRadius: radii.pill, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(7,10,18,0.72)", borderWidth: 1, borderColor: "rgba(255,255,255,0.12)" },
  heroKindText: { color: v2Colors.text, fontSize: 10.5, fontWeight: "800" },
  heroCopy: { maxWidth: "78%", minWidth: 0 },
  heroTitle: { color: v2Colors.text, fontSize: compact ? 23 : 27, lineHeight: compact ? 28 : 32, fontWeight: "900", letterSpacing: -0.5 },
  heroText: { color: v2Colors.textSecondary, fontSize: compact ? 11 : 12, lineHeight: compact ? 16 : 18, fontWeight: "600", marginTop: 6 },
  heroAction: { position: "absolute", right: 16, bottom: 16, width: 48, height: 48, borderRadius: 24, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(99,102,241,0.8)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)" },
  kindTabs: { flexDirection: "row", gap: 8, marginBottom: 12, padding: 4, borderRadius: radii.pill, backgroundColor: "rgba(255,255,255,0.04)" },
  kindTab: { flex: 1, minHeight: 42, borderRadius: radii.pill, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 10 },
  kindTabActive: { backgroundColor: "rgba(99,102,241,0.8)", shadowColor: v2Colors.primary, shadowOpacity: 0.42, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  kindTabText: { color: v2Colors.textMuted, fontWeight: "900" },
  kindTabTextActive: { color: v2Colors.text },
  filterTop: { flexDirection: "row", gap: 8, marginBottom: 14, zIndex: 10 },
  filterChip: { flex: 1, minHeight: 38, borderRadius: radii.pill, borderWidth: 1, borderColor: v2Colors.border, backgroundColor: v2Colors.surface1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  filterChipActive: { backgroundColor: "rgba(139,92,246,0.2)", borderColor: "rgba(139,92,246,0.4)" },
  filterChipText: { color: v2Colors.textMuted, fontSize: 11.5, fontWeight: "900" },
  filterChipTextActive: { color: v2Colors.text },
  dropdownWrap: { flex: 1.2, position: "relative" },
  dropdownButton: { minHeight: 38, borderRadius: radii.pill, borderWidth: 1, borderColor: v2Colors.border, backgroundColor: v2Colors.surface1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingHorizontal: 10 },
  dropdownText: { color: v2Colors.textSecondary, fontSize: 11, fontWeight: "900", flex: 1 },
  dropdownMenu: { position: "absolute", top: 42, left: 0, right: 0, minWidth: 142, borderRadius: radii.md, borderWidth: 1, borderColor: v2Colors.border, backgroundColor: v2Colors.elevated, padding: 6, zIndex: 20, shadowColor: "#000", shadowOpacity: 0.6, shadowRadius: 20, shadowOffset: { width: 0, height: 10 } },
  dropdownItem: { minHeight: 36, justifyContent: "center", paddingHorizontal: 8, borderRadius: radii.xs },
  dropdownItemText: { color: v2Colors.text, fontSize: 11, fontWeight: "800" },
  section: { gap: 12, marginBottom: 22 },
  sectionTitle: { color: v2Colors.text, fontSize: 21, lineHeight: 27, fontWeight: "900", letterSpacing: -0.3 },
  searchBox: { minHeight: 44, borderRadius: radii.pill, backgroundColor: v2Colors.surface1, borderWidth: 1, borderColor: v2Colors.border, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 14 },
  searchInput: { flex: 1, color: v2Colors.text, fontWeight: "800" },
  list: { gap: 12 },
  card: { borderRadius: radii.lg, borderWidth: 1, borderColor: v2Colors.border, backgroundColor: v2Colors.surface1, flexDirection: "row", gap: compact ? 10 : 13, padding: compact ? 9 : 11, overflow: "hidden" },
  cover: { width: compact ? 72 : 82, height: compact ? 104 : 118, borderRadius: radii.md, overflow: "hidden" },
  filmCoverPlaceholder: { backgroundColor: "#2b1808" },
  info: { flex: 1, minWidth: 0 },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  itemTitle: { color: v2Colors.text, fontSize: compact ? 14.5 : 16, lineHeight: compact ? 18 : 20, fontWeight: "900", flex: 1 },
  scorePill: { minHeight: 28, borderRadius: radii.pill, backgroundColor: v2Colors.premium, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 7 },
  scoreText: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  desc: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" },
  descWrap: { marginTop: 6, alignSelf: "stretch", width: "100%" },
  descMeasure: { position: "absolute", opacity: 0, left: 0, top: 0, pointerEvents: "none" },
  descTap: {},
  readMoreInline: { color: v2Colors.cyan, fontWeight: "900", fontSize: 12 },
  detailBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.62)", alignItems: "center", justifyContent: "center", padding: 22 },
  detailCard: { width: "100%", maxWidth: 420, maxHeight: "78%", borderRadius: radii.xl, borderWidth: 1, borderColor: v2Colors.border, backgroundColor: v2Colors.elevated, padding: 18, gap: 12 },
  detailHeader: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  detailTitle: { color: colors.ivory, fontSize: 17, fontWeight: "900", flex: 1, lineHeight: 23 },
  detailScroll: { flexGrow: 0 },
  detailScrollContent: { paddingBottom: 4 },
  detailBody: { color: colors.muted, fontSize: 14, lineHeight: 21, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 6, marginTop: 9 },
  actionButton: { flex: 1, minHeight: 34, borderRadius: radii.pill, borderWidth: 1, borderColor: "rgba(139,92,246,0.26)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 5 },
  actionActive: { backgroundColor: v2Colors.premium, borderColor: v2Colors.premium },
  actionText: { color: colors.gold, fontSize: 10, fontWeight: "900" },
  actionTextActive: { color: colors.ink },
  voteButton: { minHeight: 34, minWidth: 50, borderRadius: radii.pill, borderWidth: 1, borderColor: "rgba(139,92,246,0.26)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 7 },
  voteText: { color: colors.gold, fontSize: 11, fontWeight: "900" },
  emptyState: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: "center", gap: 8, padding: 16 },
  emptyText: { color: colors.muted, fontWeight: "800", textAlign: "center" },
  moreButton: { minHeight: 44, borderRadius: radii.pill, backgroundColor: "rgba(99,102,241,0.75)", alignItems: "center", justifyContent: "center" },
  moreText: { color: v2Colors.text, fontSize: 14, fontWeight: "900" },
  ratingBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.62)", alignItems: "center", justifyContent: "center", padding: 22 },
  ratingCard: { width: "100%", maxWidth: 380, borderRadius: radii.xl, borderWidth: 1, borderColor: v2Colors.border, backgroundColor: v2Colors.elevated, padding: 18, gap: 12 },
  ratingTitle: { color: colors.ivory, fontSize: 17, fontWeight: "900", textAlign: "center" },
  ratingHint: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: "700", textAlign: "center" },
  starsRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 4, marginTop: 2 },
  starButton: { width: 30, alignItems: "center", gap: 1 },
  starNumber: { color: colors.muted, fontSize: 9, fontWeight: "800" },
  ratingMeta: { alignItems: "center", gap: 2 },
  ratingMetaText: { color: colors.gold, fontSize: 13, fontWeight: "900" },
  ratingMetaSelected: { color: colors.ivory, fontSize: 12, fontWeight: "800" },
  ratingSave: { minHeight: 46, borderRadius: 10, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", marginTop: 4 },
  ratingSaveDisabled: { opacity: 0.5 },
  ratingSaveText: { color: colors.ink, fontSize: 15, fontWeight: "900" }
});
}
