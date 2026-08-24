import { memo, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { AppChrome } from "@/components/app-chrome";
import { CoverImage } from "@/components/cover-image";
import { elevation, hexAlpha, radii, v2Colors } from "@/constants/design";
import { getThemeColors, type AppTheme } from "@/constants/theme";
import { copy } from "@/data/content";
import { useAccount } from "@/hooks/use-account";
import { useArtworks } from "@/hooks/use-artworks";
import { useArtworkSearchCatalog } from "@/hooks/use-artwork-search-catalog";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEngagement } from "@/hooks/use-engagement";
import { useLanguage } from "@/hooks/use-language";
import type { Artwork, Language } from "@/types/content";
import {
  filterArtworksForGallery,
  type GalleryMode,
  type GallerySort,
  type GalleryStatusFilter
} from "@/utils/artwork-gallery-filters";

const PAGE_SIZE = 18;

const labels = {
  search: { tr: "Eser, dönem veya sanatçı keşfet", en: "Discover works, periods, or artists", ru: "Искать работу, эпоху или художника", uz: "Asar, davr yoki san'atkorni izlash" },
  new: { tr: "Yeni Eserler", en: "New Artworks", ru: "Новые работы", uz: "Yangi asarlar" },
  personalized: { tr: "Sana Özel", en: "For You", ru: "Для вас", uz: "Siz uchun" },
  undiscovered: { tr: "Keşfedilmemiş", en: "Undiscovered", ru: "Неизведанное", uz: "Kashf etilmagan" },
  favorites: { tr: "Favoriler", en: "Favorites", ru: "Избранное", uz: "Sevimlilar" },
  read: { tr: "Okudum", en: "Read", ru: "Прочитано", uz: "O'qilgan" },
  unread: { tr: "Okumadım", en: "Unread", ru: "Не прочитано", uz: "O'qilmagan" },
  sort: { tr: "Sırala", en: "Sort", ru: "Сорт.", uz: "Sarala" },
  sortTitle: { tr: "Eserleri sırala", en: "Sort artworks", ru: "Сортировка работ", uz: "Asarlarni saralash" },
  allRead: { tr: "Tüm eserleri okudun", en: "All artworks read", ru: "Все работы прочитаны", uz: "Barcha asarlar o'qildi" },
  resetRead: {
    tr: "Okuma durumunu sıfırlayıp yeniden başlayabilirsin.",
    en: "Reset your reading status and start again.",
    ru: "Можно сбросить статус чтения и начать заново.",
    uz: "O'qish holatini tiklab, qaytadan boshlashingiz mumkin."
  },
  loadingBrowse: { tr: "Eserler yükleniyor...", en: "Loading artworks...", ru: "Загрузка работ...", uz: "Asarlar yuklanmoqda..." },
  loadingSearch: { tr: "Tüm eserler arasında aranıyor...", en: "Searching all artworks...", ru: "Поиск по всем работам...", uz: "Barcha asarlar ichidan qidirilmoqda..." },
  searchUnavailable: { tr: "Arama şu an yapılamadı. Lütfen tekrar deneyin.", en: "Search is unavailable right now. Please try again.", ru: "Поиск временно недоступен. Попробуйте снова.", uz: "Qidiruv hozir bajarilmadi. Qayta urinib ko'ring." },
  noResults: { tr: "Filtrelere uygun eser bulunamadı.", en: "No artworks match these filters.", ru: "Нет работ по выбранным фильтрам.", uz: "Filtrlarga mos asar topilmadi." },
  more: { tr: "Daha fazla gör", en: "Show more", ru: "Показать еще", uz: "Ko'proq ko'rish" }
} satisfies Record<string, Record<Language, string>>;

const sortLabels: Record<GallerySort, Record<Language, string>> = {
  default: { tr: "Varsayılan", en: "Default", ru: "По умолчанию", uz: "Standart" },
  "historical-asc": { tr: "Tarihsel: Eskiden yeniye", en: "Historical: Oldest first", ru: "История: От старых", uz: "Tarixiy: Eskidan yangiga" },
  "historical-desc": { tr: "Tarihsel: Yeniden eskiye", en: "Historical: Newest first", ru: "История: От новых", uz: "Tarixiy: Yangidan eskiga" },
  "published-desc": { tr: "Yayınlanma: En yeni", en: "Published: Newest", ru: "Публикация: Новые", uz: "Nashr: Eng yangi" },
  "published-asc": { tr: "Yayınlanma: En eski", en: "Published: Oldest", ru: "Публикация: Старые", uz: "Nashr: Eng eski" },
  "title-asc": { tr: "Eser Adı: A → Z", en: "Artwork: A → Z", ru: "Название: А → Я", uz: "Asar nomi: A → Z" },
  "title-desc": { tr: "Eser Adı: Z → A", en: "Artwork: Z → A", ru: "Название: Я → А", uz: "Asar nomi: Z → A" },
  "artist-asc": { tr: "Sanatçı: A → Z", en: "Artist: A → Z", ru: "Художник: А → Я", uz: "San'atkor: A → Z" },
  "artist-desc": { tr: "Sanatçı: Z → A", en: "Artist: Z → A", ru: "Художник: Я → А", uz: "San'atkor: Z → A" }
};

const sortOptions = Object.keys(sortLabels) as GallerySort[];

export default function GalleryScreen() {
  const isFocused = useIsFocused();
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const { account } = useAccount();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors, theme), [colors, theme]);
  const { favoriteArtworkIds, readArtworkIds, artworkVotes, resetReadArtworks } = useEngagement();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<GalleryMode>("new");
  const [statusFilter, setStatusFilter] = useState<GalleryStatusFilter>(null);
  const [sort, setSort] = useState<GallerySort>("default");
  const [sortOpen, setSortOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [discoverySeed] = useState(() => new Date().toISOString().slice(0, 10));
  const { artworks, loading: browseLoading } = useArtworks(500, isFocused);
  const trimmedQuery = query.trim();
  const isSearching = trimmedQuery.length > 0;
  const { catalog, loading: searchLoading, error: searchError } = useArtworkSearchCatalog(isSearching);
  const columns = width >= 1000 ? 5 : width >= 600 ? 4 : 3;
  const gap = width < 360 ? 6 : 8;
  const horizontalPadding = width < 360 ? 16 : width > 720 ? 24 : 18;
  const cardWidth = (width - horizontalPadding * 2 - gap * (columns - 1)) / columns;
  const sourceArtworks = isSearching ? catalog : artworks;
  const listLoading = isSearching ? searchLoading && !catalog.length : browseLoading;
  const filteredArtworks = useMemo(
    () => filterArtworksForGallery(sourceArtworks, {
      mode,
      statusFilter,
      sort,
      query: trimmedQuery,
      language,
      readArtworkIds,
      favoriteArtworkIds,
      artworkVotes,
      interests: account.interests,
      userKey: account.uid || account.username,
      seed: discoverySeed
    }),
    [account.interests, account.uid, account.username, artworkVotes, discoverySeed, favoriteArtworkIds, language, mode, readArtworkIds, sort, sourceArtworks, statusFilter, trimmedQuery]
  );
  const visibleArtworks = filteredArtworks.slice(0, visibleCount);
  const showUnreadFinishedCard = !isSearching && statusFilter === "unread" && !filteredArtworks.length && artworks.length > 0;

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [mode, query, sort, statusFilter]);

  return (
    <AppChrome title={copy.gallery[language]} eyebrow="Art Atlas">
      <View style={styles.searchLike}>
        <Ionicons name="search" size={17} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={labels.search[language]}
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
          returnKeyType="search"
        />
        {query ? (
          <Pressable accessibilityRole="button" onPress={() => setQuery("")} style={styles.clearButton}>
            <Ionicons name="close" size={15} color={colors.ivory} />
          </Pressable>
        ) : null}
      </View>

      <View style={styles.primaryTabs}>
        <FilterButton styles={styles} label={labels.new[language]} active={mode === "new"} onPress={() => setMode("new")} primary />
        <FilterButton styles={styles} label={labels.personalized[language]} active={mode === "personalized"} onPress={() => setMode("personalized")} primary />
        <FilterButton styles={styles} label={labels.undiscovered[language]} active={mode === "undiscovered"} onPress={() => setMode("undiscovered")} primary />
      </View>

      <View style={styles.utilityRow}>
        <View style={styles.statusTabs}>
          <FilterButton styles={styles} label={labels.favorites[language]} active={statusFilter === "favorites"} onPress={() => setStatusFilter((value) => value === "favorites" ? null : "favorites")} />
          <FilterButton styles={styles} label={labels.read[language]} active={statusFilter === "read"} onPress={() => setStatusFilter((value) => value === "read" ? null : "read")} />
          <FilterButton styles={styles} label={labels.unread[language]} active={statusFilter === "unread"} onPress={() => setStatusFilter((value) => value === "unread" ? null : "unread")} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={labels.sort[language]} onPress={() => setSortOpen(true)} style={[styles.sortButton, sort !== "default" && styles.statusTabActive]}>
          <Ionicons name="swap-vertical" size={15} color={sort === "default" ? colors.ivory : "#ffffff"} />
          {width >= 350 ? <Text style={[styles.sortButtonText, sort !== "default" && styles.statusTabTextActive]}>{labels.sort[language]}</Text> : null}
          {sort !== "default" ? <View style={styles.sortActiveDot} /> : null}
        </Pressable>
      </View>

      {showUnreadFinishedCard ? (
        <View style={styles.readResetCard}>
          <View style={styles.readResetTextBlock}>
            <Text style={styles.readResetTitle}>{labels.allRead[language]}</Text>
            <Text style={styles.readResetText}>{labels.resetRead[language]}</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={resetReadArtworks} style={styles.readResetButton}>
            <Ionicons name="refresh" size={17} color="#ffffff" />
          </Pressable>
        </View>
      ) : null}

      {listLoading ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>{isSearching ? labels.loadingSearch[language] : labels.loadingBrowse[language]}</Text>
        </View>
      ) : (
        <View style={[styles.grid, { columnGap: gap, rowGap: gap }]}> 
          {visibleArtworks.map((artwork) => (
            <ArtworkCard
              key={artwork.id}
              artwork={artwork}
              cardWidth={cardWidth}
              language={language}
              styles={styles}
              onPress={() => router.push({ pathname: "/artwork/[id]", params: { id: artwork.id } })}
            />
          ))}
        </View>
      )}

      {!listLoading && visibleCount < filteredArtworks.length ? (
        <Pressable accessibilityRole="button" onPress={() => setVisibleCount((value) => value + PAGE_SIZE)} style={styles.moreButton}>
          <Text style={styles.moreText}>{labels.more[language]}</Text>
        </Pressable>
      ) : null}
      {!listLoading && searchError ? (
        <View style={styles.emptyState}>
          <Ionicons name="cloud-offline-outline" size={24} color={v2Colors.primary} />
          <Text style={styles.emptyText}>{labels.searchUnavailable[language]}</Text>
        </View>
      ) : null}
      {!listLoading && !searchError && !filteredArtworks.length && !showUnreadFinishedCard ? (
        <View style={styles.emptyState}>
          <Ionicons name="search" size={24} color={v2Colors.primary} />
          <Text style={styles.emptyText}>{labels.noResults[language]}</Text>
        </View>
      ) : null}

      <SortModal
        visible={sortOpen}
        selected={sort}
        language={language}
        colors={colors}
        styles={styles}
        onClose={() => setSortOpen(false)}
        onSelect={(value) => {
          setSort(value);
          setSortOpen(false);
        }}
      />
    </AppChrome>
  );
}

const ArtworkCard = memo(function ArtworkCard({ artwork, cardWidth, language, styles, onPress }: { artwork: Artwork; cardWidth: number; language: Language; styles: ReturnType<typeof createStyles>; onPress: () => void }) {
  const dateLabel = artwork.year.trim();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${artwork.title[language]}, ${artwork.artist[language]}`} onPress={onPress} style={[styles.card, { width: cardWidth }]}>
      <View style={styles.imageWrap}>
        <CoverImage source={{ uri: artwork.image }} style={styles.image} imageFocus={artwork.imageFocus} />
        {dateLabel ? (
          <View style={styles.dateBadge}>
            <Text style={[styles.dateBadgeText, cardWidth < 100 && styles.dateBadgeTextCompact]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{dateLabel}</Text>
          </View>
        ) : null}
      </View>
      <View style={styles.body}>
        <Text style={styles.type} numberOfLines={1}>{artwork.period[language]}</Text>
        <Text style={styles.title} numberOfLines={2}>{artwork.title[language]}</Text>
        <Text style={styles.artist} numberOfLines={1}>{artwork.artist[language]}</Text>
      </View>
    </Pressable>
  );
});

function FilterButton({ label, active, onPress, styles, primary = false }: { label: string; active: boolean; onPress: () => void; styles: ReturnType<typeof createStyles>; primary?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[primary ? styles.primaryTab : styles.statusTab, active && (primary ? styles.primaryTabActive : styles.statusTabActive)]}>
      <Text style={[primary ? styles.primaryTabText : styles.statusTabText, active && styles.statusTabTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>{label}</Text>
    </Pressable>
  );
}

function SortModal({ visible, selected, language, colors, styles, onClose, onSelect }: { visible: boolean; selected: GallerySort; language: Language; colors: ReturnType<typeof getThemeColors>; styles: ReturnType<typeof createStyles>; onClose: () => void; onSelect: (value: GallerySort) => void }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable accessibilityRole="menu" style={styles.sortSheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.sortSheetHeader}>
            <Text style={styles.sortSheetTitle}>{labels.sortTitle[language]}</Text>
            <Pressable accessibilityRole="button" onPress={onClose} style={styles.modalCloseButton}>
              <Ionicons name="close" size={19} color={colors.ivory} />
            </Pressable>
          </View>
          {sortOptions.map((option) => (
            <Pressable key={option} accessibilityRole="menuitem" accessibilityState={{ selected: selected === option }} onPress={() => onSelect(option)} style={[styles.sortOption, selected === option && styles.sortOptionActive]}>
              <Text style={[styles.sortOptionText, selected === option && styles.sortOptionTextActive]}>{sortLabels[option][language]}</Text>
              {selected === option ? <Ionicons name="checkmark" size={18} color={v2Colors.primary} /> : null}
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>, theme: AppTheme) {
  return StyleSheet.create({
    searchLike: {
      minHeight: 46,
      borderRadius: radii.md,
      backgroundColor: v2Colors.surface2,
      borderWidth: 1,
      borderColor: v2Colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 9,
      paddingHorizontal: 14,
      marginBottom: 10,
      ...elevation(theme, "low")
    },
    searchInput: {
      flex: 1,
      minHeight: 46,
      color: colors.ivory,
      fontSize: 12.5,
      fontWeight: "700",
      paddingVertical: 0
    },
    clearButton: {
      width: 26,
      height: 26,
      borderRadius: 13,
      backgroundColor: hexAlpha(colors.ivory, 0.08),
      alignItems: "center",
      justifyContent: "center"
    },
    primaryTabs: {
      flexDirection: "row",
      gap: 5,
      marginBottom: 7
    },
    primaryTab: {
      flex: 1,
      minWidth: 0,
      minHeight: 38,
      borderRadius: radii.pill,
      backgroundColor: v2Colors.surface1,
      borderWidth: 1,
      borderColor: v2Colors.border,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 5
    },
    primaryTabActive: {
      backgroundColor: v2Colors.primary,
      borderColor: hexAlpha("#ffffff", 0.15),
      ...elevation(theme, "low")
    },
    primaryTabText: {
      color: colors.ivory,
      fontSize: 11,
      fontWeight: "800",
      textAlign: "center"
    },
    utilityRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginBottom: 12
    },
    statusTabs: {
      flex: 1,
      minWidth: 0,
      flexDirection: "row",
      gap: 4
    },
    statusTab: {
      flex: 1,
      minWidth: 0,
      minHeight: 32,
      borderRadius: radii.pill,
      backgroundColor: hexAlpha(colors.ivory, 0.055),
      borderWidth: 1,
      borderColor: v2Colors.border,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4
    },
    statusTabActive: {
      backgroundColor: hexAlpha(v2Colors.primary, 0.34),
      borderColor: v2Colors.primary
    },
    statusTabText: {
      color: colors.muted,
      fontSize: 10.5,
      fontWeight: "800",
      textAlign: "center"
    },
    statusTabTextActive: {
      color: "#ffffff"
    },
    sortButton: {
      minWidth: 50,
      height: 32,
      borderRadius: radii.pill,
      backgroundColor: hexAlpha(colors.ivory, 0.055),
      borderWidth: 1,
      borderColor: v2Colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingHorizontal: 8
    },
    sortButtonText: {
      color: colors.ivory,
      fontSize: 10.5,
      fontWeight: "800"
    },
    sortActiveDot: {
      width: 5,
      height: 5,
      borderRadius: 3,
      backgroundColor: "#ffffff"
    },
    readResetCard: {
      borderRadius: radii.md,
      backgroundColor: hexAlpha(v2Colors.primary, 0.1),
      borderWidth: 1,
      borderColor: hexAlpha(v2Colors.primary, 0.24),
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      padding: 12,
      marginBottom: 12,
      ...elevation(theme, "low")
    },
    readResetTextBlock: {
      flex: 1
    },
    readResetTitle: {
      color: colors.ivory,
      fontWeight: "800",
      fontSize: 13
    },
    readResetText: {
      color: colors.muted,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "600",
      marginTop: 2
    },
    readResetButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: v2Colors.primary,
      alignItems: "center",
      justifyContent: "center"
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      alignItems: "stretch"
    },
    card: {
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: v2Colors.surface1,
      ...elevation(theme, "low")
    },
    imageWrap: {
      width: "100%",
      aspectRatio: 0.86,
      position: "relative"
    },
    image: {
      width: "100%",
      height: "100%",
      borderTopLeftRadius: 12,
      borderTopRightRadius: 12
    },
    dateBadge: {
      position: "absolute",
      right: 4,
      bottom: 4,
      maxWidth: "86%",
      minHeight: 15,
      borderRadius: 6,
      backgroundColor: "rgba(15,23,42,0.46)",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: "rgba(255,255,255,0.14)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
      paddingVertical: 1
    },
    dateBadgeText: {
      color: "rgba(255,255,255,0.84)",
      fontSize: 8,
      lineHeight: 10,
      fontWeight: "600",
      letterSpacing: 0.05
    },
    dateBadgeTextCompact: {
      fontSize: 7.5
    },
    body: {
      minHeight: 70,
      paddingHorizontal: 7,
      paddingTop: 7,
      paddingBottom: 8
    },
    type: {
      color: colors.muted,
      fontSize: 8,
      lineHeight: 10,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.25
    },
    title: {
      minHeight: 29,
      color: colors.ivory,
      fontSize: 12,
      lineHeight: 14.5,
      fontWeight: "800",
      marginTop: 3
    },
    artist: {
      color: colors.muted,
      fontSize: 9.5,
      lineHeight: 12,
      fontWeight: "600",
      marginTop: 3
    },
    emptyState: {
      borderRadius: radii.md,
      backgroundColor: colors.panel,
      alignItems: "center",
      gap: 8,
      padding: 20,
      marginTop: 8,
      ...elevation(theme, "low")
    },
    emptyText: {
      color: colors.ivory,
      fontWeight: "700",
      textAlign: "center",
      fontSize: 13,
      lineHeight: 19
    },
    moreButton: {
      minHeight: 44,
      borderRadius: radii.pill,
      backgroundColor: v2Colors.primary,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 12,
      ...elevation(theme, "low")
    },
    moreText: {
      color: "#ffffff",
      fontSize: 13,
      fontWeight: "800"
    },
    modalBackdrop: {
      flex: 1,
      justifyContent: "flex-end",
      backgroundColor: "rgba(4,6,16,0.72)"
    },
    sortSheet: {
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      backgroundColor: colors.panel,
      borderWidth: 1,
      borderColor: v2Colors.border,
      paddingHorizontal: 18,
      paddingTop: 16,
      paddingBottom: 26,
      ...elevation(theme, "high")
    },
    sortSheetHeader: {
      minHeight: 38,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6
    },
    sortSheetTitle: {
      color: colors.ivory,
      fontSize: 17,
      fontWeight: "900"
    },
    modalCloseButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: hexAlpha(colors.ivory, 0.08),
      alignItems: "center",
      justifyContent: "center"
    },
    sortOption: {
      minHeight: 41,
      borderRadius: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 12,
      borderWidth: 1,
      borderColor: "transparent"
    },
    sortOptionActive: {
      backgroundColor: hexAlpha(v2Colors.primary, 0.12),
      borderColor: hexAlpha(v2Colors.primary, 0.3)
    },
    sortOptionText: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "700"
    },
    sortOptionTextActive: {
      color: colors.ivory,
      fontWeight: "900"
    }
  });
}
