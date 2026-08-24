import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { AppChrome } from "@/components/app-chrome";
import { AuthRequired } from "@/components/auth-required";
import { SectionHeading } from "@/components/ui/section-heading";
import { EqualHeightHeaderSlot } from "@/components/ui/equal-height-header-slot";
import { radii, v2Colors } from "@/constants/design";
import { copy } from "@/data/content";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { useAccount } from "@/hooks/use-account";
import { useRegisterRefresh } from "@/providers/refresh-provider";
import { firestoreDb } from "@/src/services/firebase";

const PAGE_SIZE = 20;
type LocalizedText = Record<"tr" | "en" | "ru" | "uz", string>;
type BookFilmItem = { id: string; type: "book" | "film"; title: LocalizedText; description: LocalizedText; pinned: boolean; image: string; creator: string; year: string; duration: string };

export default function RecommendationsScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(width), [width]);
  const { isAuthenticated } = useAccount();
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [items, setItems] = useState<BookFilmItem[]>([]);
  const [refreshCounter, setRefreshCounter] = useState(0);
  useRegisterRefresh(() => setRefreshCounter((value) => value + 1));

  useEffect(() => {
    let active = true;
    getDocs(query(collection(firestoreDb, "bookFilms"), where("status", "==", "published"), limit(200)))
      .then((snapshot) => { if (active) setItems(snapshot.docs.map((item) => mapBookFilm(item.id, item.data() as Record<string, unknown>))); })
      .catch(() => { if (active) setItems([]); });
    return () => { active = false; };
  }, [refreshCounter]);

  if (!isAuthenticated) return <AuthRequired title={copy.recommendations[language]} />;

  const films = items.filter((item) => item.type === "film");
  const books = items.filter((item) => item.type === "book");
  const featuredFilm = films.find((item) => item.pinned) ?? films[0];
  const featuredBooks = books.filter((item) => item.pinned).concat(books.filter((item) => !item.pinned)).slice(0, 3);
  const remaining = items.filter((item) => item.id !== featuredFilm?.id && !featuredBooks.some((book) => book.id === item.id)).slice(0, visibleCount);

  return (
    <AppChrome title={copy.recommendations[language]} eyebrow="CURATED" showTopAd={false}>
      {featuredFilm ? (
        <View style={styles.filmHero}>
          {featuredFilm.image ? <Image source={{ uri: featuredFilm.image }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
          <LinearGradient colors={["rgba(5,8,18,0.1)", "rgba(7,10,18,0.65)", "#070A12"]} style={StyleSheet.absoluteFill} />
          <View style={styles.filmGlow} pointerEvents="none" />
          <Text style={styles.heroEyebrow}>{filmLabel(language)}</Text>
          <Text style={styles.heroTitle} numberOfLines={3}>{featuredFilm.title[language]}</Text>
          <Text style={styles.heroMeta} numberOfLines={1}>{[featuredFilm.creator, featuredFilm.year, featuredFilm.duration].filter(Boolean).join(" · ")}</Text>
          <View style={styles.playOrb}><Ionicons name="play" size={21} color={v2Colors.text} /></View>
        </View>
      ) : null}

      {featuredBooks.length ? (
        <View style={styles.section}>
          <SectionHeading theme={theme} title={booksLabel(language)} accent={v2Colors.premium} />
          <View style={styles.bookShelf}>
            {featuredBooks.map((book, index) => (
              <View key={book.id} style={[styles.bookObject, index === 1 && styles.bookRaised]}>
                {book.image ? <Image source={{ uri: book.image }} style={styles.bookCover} contentFit="cover" /> : <LinearGradient colors={["#1E1B4B", "#4C1D95", "#11182A"]} style={styles.bookCover}><Ionicons name="book" size={28} color={v2Colors.premium} /></LinearGradient>}
                <LinearGradient colors={["transparent", "rgba(5,8,18,0.92)"]} style={styles.bookScrim} />
                <Text style={styles.bookTitle} numberOfLines={3}>{book.title[language]}</Text>
                {book.creator ? <Text style={styles.bookAuthor} numberOfLines={1}>{book.creator}</Text> : null}
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.section}>
        <SectionHeading theme={theme} title={collectionLabel(language)} accent={v2Colors.cyan} />
        <View style={styles.mediaGrid}>
          {remaining.map((item) => (
            <View key={item.id} style={styles.mediaItem}>
              <View style={[styles.poster, item.type === "book" && styles.coverRatio]}>
                {item.image ? <Image source={{ uri: item.image }} style={StyleSheet.absoluteFill} contentFit="cover" /> : <LinearGradient colors={item.type === "film" ? ["#0C4A6E", "#312E81", "#11182A"] : ["#4C1D95", "#7E22CE", "#11182A"]} style={[StyleSheet.absoluteFill, styles.fallback]}><Ionicons name={item.type === "film" ? "film" : "book"} size={30} color={v2Colors.text} /></LinearGradient>}
                <LinearGradient colors={["transparent", "rgba(5,8,18,0.96)"]} style={styles.posterScrim} />
                <View style={styles.typeOrb}><Ionicons name={item.type === "film" ? "play" : "bookmark"} size={12} color={v2Colors.text} /></View>
              </View>
              <EqualHeightHeaderSlot lineHeight={18} style={styles.mediaTitleSlot}>
                <Text style={styles.mediaTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.82} maxFontSizeMultiplier={1.25}>{item.title[language]}</Text>
              </EqualHeightHeaderSlot>
              <Text style={styles.mediaMeta} numberOfLines={1}>{item.creator || item.description[language]}</Text>
            </View>
          ))}
        </View>
        {!items.length ? <View style={styles.empty}><Ionicons name="library-outline" size={34} color={v2Colors.brightViolet} /><Text style={styles.emptyText}>{emptyLabel(language)}</Text></View> : null}
      </View>
      {visibleCount < items.length ? <Pressable onPress={() => setVisibleCount((value) => value + PAGE_SIZE)} style={styles.moreButton}><Text style={styles.moreText}>{moreLabel(language)}</Text><Ionicons name="arrow-down" size={15} color={v2Colors.text} /></Pressable> : null}
    </AppChrome>
  );
}

function mapBookFilm(id: string, data: Record<string, unknown>): BookFilmItem {
  return {
    id,
    type: data.type === "film" ? "film" : "book",
    title: normalizeLocalized(data.title, stringValue(data.title)),
    description: normalizeLocalized(data.description, stringValue(data.description)),
    pinned: Boolean(data.pinned),
    image: stringValue(data.image) || stringValue(data.coverImage) || stringValue(data.posterImage) || stringValue(data.imageUrl),
    creator: stringValue(data.author) || stringValue(data.director),
    year: stringValue(data.year),
    duration: stringValue(data.duration)
  };
}
function normalizeLocalized(value: unknown, fallback = ""): LocalizedText { if (value && typeof value === "object") { const record = value as Record<string, unknown>; return { tr: stringValue(record.tr) || fallback, en: stringValue(record.en) || fallback, ru: stringValue(record.ru) || fallback, uz: stringValue(record.uz) || fallback }; } return { tr: fallback, en: fallback, ru: fallback, uz: fallback }; }
function stringValue(value: unknown) { return typeof value === "string" ? value : ""; }
function filmLabel(language: keyof LocalizedText) { return { tr: "ÖNERİLEN FİLM", en: "FEATURED FILM", ru: "ФИЛЬМ НЕДЕЛИ", uz: "TAVSIYA ETILGAN FILM" }[language]; }
function booksLabel(language: keyof LocalizedText) { return { tr: "Öne çıkan kitaplar", en: "Featured books", ru: "Избранные книги", uz: "Tanlangan kitoblar" }[language]; }
function collectionLabel(language: keyof LocalizedText) { return { tr: "Kitap ve film seçkisi", en: "Books & films", ru: "Книги и фильмы", uz: "Kitoblar va filmlar" }[language]; }
function emptyLabel(language: keyof LocalizedText) { return { tr: "Henüz yayınlanmış kitap veya film önerisi yok.", en: "No published recommendations yet.", ru: "Пока нет опубликованных рекомендаций.", uz: "Hali tavsiyalar yo'q." }[language]; }
function moreLabel(language: keyof LocalizedText) { return { tr: "Daha fazla gör", en: "Show more", ru: "Показать еще", uz: "Ko'proq ko'rish" }[language]; }

function createStyles(width: number) {
  const compact = width < 360;
  return StyleSheet.create({
    filmHero: { minHeight: compact ? 188 : 218, borderRadius: radii.xl, overflow: "hidden", justifyContent: "flex-end", padding: compact ? 16 : 20, marginBottom: 26, borderWidth: 1, borderColor: "rgba(59,130,246,0.2)" },
    filmGlow: { position: "absolute", right: -30, bottom: -40, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(99,102,241,0.18)", shadowColor: v2Colors.blue, shadowOpacity: 0.8, shadowRadius: 30, shadowOffset: { width: 0, height: 0 } },
    heroEyebrow: { color: v2Colors.cyan, fontSize: 9.5, lineHeight: 13, fontWeight: "800", letterSpacing: 1.5 },
    heroTitle: { maxWidth: "78%", color: v2Colors.text, fontSize: compact ? 22 : 26, lineHeight: compact ? 27 : 31, fontWeight: "800", letterSpacing: -0.5, marginTop: 5 },
    heroMeta: { maxWidth: "75%", color: v2Colors.textSecondary, fontSize: 10.5, fontWeight: "600", marginTop: 6 },
    playOrb: { position: "absolute", right: 16, bottom: 16, width: 48, height: 48, borderRadius: 24, backgroundColor: "rgba(99,102,241,0.72)", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
    section: { marginTop: 4, marginBottom: 24 },
    bookShelf: { flexDirection: "row", alignItems: "flex-end", gap: compact ? 8 : 10, minHeight: compact ? 170 : 192 },
    bookObject: { flex: 1, minWidth: 0, aspectRatio: 0.68, borderRadius: radii.md, overflow: "hidden", position: "relative", backgroundColor: v2Colors.elevated, shadowColor: "#000", shadowOpacity: 0.55, shadowRadius: 14, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
    bookRaised: { transform: [{ translateY: -10 }, { rotate: "1.5deg" }] },
    bookCover: { flex: 1, width: "100%", alignItems: "center", justifyContent: "center" },
    bookScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "55%" },
    bookTitle: { position: "absolute", left: 9, right: 7, bottom: 23, color: v2Colors.text, fontSize: compact ? 10.5 : 12, lineHeight: compact ? 13 : 15, fontWeight: "800" },
    bookAuthor: { position: "absolute", left: 9, right: 7, bottom: 8, color: v2Colors.textMuted, fontSize: 8.5, fontWeight: "600" },
    mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
    mediaItem: { width: "48%", flexGrow: 1, flexBasis: compact ? "46%" : "47%", minWidth: 0, marginBottom: 8 },
    poster: { width: "100%", aspectRatio: 0.72, borderRadius: radii.lg, overflow: "hidden", backgroundColor: v2Colors.elevated },
    coverRatio: { aspectRatio: 0.68 },
    fallback: { alignItems: "center", justifyContent: "center" },
    posterScrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "45%" },
    typeOrb: { position: "absolute", right: 9, bottom: 9, width: 30, height: 30, borderRadius: 15, backgroundColor: "rgba(99,102,241,0.72)", alignItems: "center", justifyContent: "center" },
    mediaTitleSlot: { marginTop: 8 },
    mediaTitle: { color: v2Colors.text, fontSize: 14, lineHeight: 18, fontWeight: "800" },
    mediaMeta: { color: v2Colors.textMuted, fontSize: 10.5, lineHeight: 14, fontWeight: "600", marginTop: 2 },
    empty: { minHeight: 190, alignItems: "center", justifyContent: "center", gap: 10 },
    emptyText: { color: v2Colors.textMuted, fontSize: 12.5, lineHeight: 19, fontWeight: "700", textAlign: "center", maxWidth: 260 },
    moreButton: { minHeight: 46, borderRadius: radii.pill, alignSelf: "center", backgroundColor: "rgba(99,102,241,0.24)", borderWidth: 1, borderColor: "rgba(139,92,246,0.35)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, paddingHorizontal: 18 },
    moreText: { color: v2Colors.text, fontSize: 12, fontWeight: "800" }
  });
}
