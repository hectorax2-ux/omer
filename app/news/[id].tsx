import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import { AppChrome } from "@/components/app-chrome";
import { NewsCard } from "@/components/news-card";
import { ScreenDataState } from "@/components/screen-data-state";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useArtNews, useArtNewsDetail } from "@/hooks/use-art-news";
import { useEngagement } from "@/hooks/use-engagement";
import { useLanguage } from "@/hooks/use-language";
import { localizeNews } from "@/src/services/firebase/news-service";
import { ArtNewsContentBlock, FirestoreTimestamp } from "@/src/types/firestore";
import { imageSource } from "@/utils/image-source";

const copy = {
  title: { tr: "Sanat Haberi", en: "Art News", ru: "Новости искусства", uz: "San’at yangiligi" },
  save: { tr: "Kaydet", en: "Save", ru: "Сохранить", uz: "Saqlash" },
  saved: { tr: "Kaydedildi", en: "Saved", ru: "Сохранено", uz: "Saqlandi" },
  share: { tr: "Paylaş", en: "Share", ru: "Поделиться", uz: "Ulashish" },
  related: { tr: "İlgili Haberler", en: "Related News", ru: "Похожие новости", uz: "O‘xshash yangiliklar" },
  relations: { tr: "İlgili İçerikler", en: "Related Content", ru: "Связанные материалы", uz: "Bog‘liq kontent" },
  minutes: { tr: "dk", en: "min", ru: "мин", uz: "daq" }
} as const;

export default function ArtNewsDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const id = typeof params.id === "string" ? params.id : "";
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const router = useRouter();
  const detail = useArtNewsDetail(id);
  const feed = useArtNews();
  const { favoriteNewsIds, toggleNewsFavorite } = useEngagement();
  const item = detail.item;

  if (!item) {
    return <AppChrome title={copy.title[language]} eyebrow="ART ATLAS • NEWS" showBackButton><ScreenDataState status={detail.status === "loading" ? "loading" : "error"} /></AppChrome>;
  }

  const title = localizeNews(item.title, language);
  const spot = localizeNews(item.spot, language);
  const body = localizeNews(item.body, language);
  const saved = favoriteNewsIds.includes(item.id);
  const relatedIds = new Set(item.relatedNewsIds ?? []);
  const related = feed.allItems.filter((candidate) => candidate.id !== item.id && (relatedIds.has(candidate.id) || candidate.categoryId === item.categoryId)).slice(0, 3);
  const relations = [
    ...(item.relatedArtistIds ?? []).map((relationId) => ({ label: "Artist", path: `/artist/${relationId}` })),
    ...(item.relatedArtworkIds ?? []).map((relationId) => ({ label: "Artwork", path: `/artwork/${relationId}` })),
    ...(item.relatedMuseumIds ?? []).map((relationId) => ({ label: "Museum", path: `/museum/${relationId}` }))
  ];

  return (
    <AppChrome title={copy.title[language]} eyebrow="ART ATLAS • NEWS" showBackButton>
      <View style={styles.page}>
        <Text style={[styles.category, { color: colors.gold }]}>{localizeNews(item.categoryLabel, language) || item.categoryId}</Text>
        <Text style={[styles.title, { color: colors.ivory }]}>{title}</Text>
        <Text style={[styles.spot, { color: colors.muted }]}>{spot}</Text>
        <Text style={[styles.meta, { color: colors.muted }]}>{formatDate(item.publishedAt, language)} · {Math.max(1, item.readingMinutes || 1)} {copy.minutes[language]} · {item.author}</Text>
        {item.coverImage ? <Image source={imageSource(item.coverImage, "detail")} recyclingKey={`news-detail:${item.id}`} style={styles.cover} contentFit="cover" cachePolicy="memory-disk" allowDownscaling transition={160} /> : null}
        {localizeNews(item.imageCaption, language) ? <Text style={[styles.caption, { color: colors.muted }]}>{localizeNews(item.imageCaption, language)}</Text> : null}
        <View style={styles.actions}>
          <Action icon={saved ? "bookmark" : "bookmark-outline"} label={saved ? copy.saved[language] : copy.save[language]} onPress={() => toggleNewsFavorite(item.id)} colors={colors} />
          <Action icon="share-social-outline" label={copy.share[language]} onPress={() => void Share.share({ title, message: `${title}\nhttps://artatlas.app/news/${item.id}` })} colors={colors} />
        </View>
        {item.contentBlocks?.length ? item.contentBlocks.map((block) => <ContentBlock key={block.id} block={block} language={language} colors={colors} />) : body.split(/\n\s*\n/).filter(Boolean).map((paragraph, index) => <Text key={`${item.id}:${index}`} style={[styles.paragraph, { color: colors.ivory }]}>{paragraph}</Text>)}
        {relations.length ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.ivory }]}>{copy.relations[language]}</Text>
            <View style={styles.relationWrap}>{relations.map((relation) => <Pressable key={relation.path} onPress={() => router.push(relation.path as never)} style={[styles.relation, { borderColor: colors.line, backgroundColor: colors.panel }]}><Text style={[styles.relationText, { color: colors.ivory }]}>{relation.label}</Text><Ionicons name="chevron-forward" color={colors.gold} size={16} /></Pressable>)}</View>
          </View>
        ) : null}
        {related.length ? <View style={styles.section}><Text style={[styles.sectionTitle, { color: colors.ivory }]}>{copy.related[language]}</Text>{related.map((candidate) => <View key={candidate.id} style={styles.related}><NewsCard item={candidate} variant="compact" /></View>)}</View> : null}
      </View>
    </AppChrome>
  );
}

function Action({ icon, label, onPress, colors }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; colors: ReturnType<typeof getThemeColors> }) {
  return <Pressable onPress={onPress} style={[styles.action, { borderColor: colors.line, backgroundColor: colors.panel }]}><Ionicons name={icon} size={18} color={colors.gold} /><Text style={[styles.actionText, { color: colors.ivory }]}>{label}</Text></Pressable>;
}

function ContentBlock({ block, language, colors }: { block: ArtNewsContentBlock; language: "tr" | "en" | "ru" | "uz"; colors: ReturnType<typeof getThemeColors> }) {
  if (block.type === "divider") return <View style={[styles.divider, { backgroundColor: colors.line }]} />;
  if (block.type === "image" && block.imageUrl) return <View><Image source={imageSource(block.imageUrl, "detail")} style={styles.blockImage} contentFit="cover" cachePolicy="memory-disk" allowDownscaling /><Text style={[styles.caption, { color: colors.muted }]}>{localizeNews(block.caption, language)}</Text></View>;
  const text = localizeNews(block.text, language);
  if (block.type === "heading") return <Text style={[styles.blockHeading, { color: colors.ivory }]}>{text}</Text>;
  if (block.type === "quote") return <Text style={[styles.quote, { color: colors.gold, borderColor: colors.gold }]}>{text}</Text>;
  return <Text style={[styles.paragraph, { color: colors.ivory }]}>{text}</Text>;
}

function formatDate(value: FirestoreTimestamp, language: string) {
  if (!value) return "";
  const milliseconds = typeof value.toMillis === "function"
    ? value.toMillis()
    : typeof value === "object" && "seconds" in value && typeof value.seconds === "number"
      ? value.seconds * 1000
      : 0;
  if (!milliseconds) return "";
  const locales = { tr: "tr-TR", en: "en-US", ru: "ru-RU", uz: "uz-UZ" } as const;
  return new Date(milliseconds).toLocaleDateString(locales[language as keyof typeof locales] ?? "en-US", { day: "numeric", month: "long", year: "numeric" });
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: 18, paddingBottom: 150, gap: 12 },
  category: { fontSize: 11, lineHeight: 15, fontWeight: "800", letterSpacing: 1, textTransform: "uppercase" },
  title: { fontSize: 30, lineHeight: 36, fontWeight: "800" },
  spot: { fontSize: 16, lineHeight: 24, fontWeight: "600" },
  meta: { fontSize: 11, lineHeight: 16, fontWeight: "600" },
  cover: { width: "100%", aspectRatio: 1.48, borderRadius: 18, marginTop: 8 },
  caption: { fontSize: 10, lineHeight: 15, fontWeight: "500" },
  actions: { flexDirection: "row", gap: 10, marginVertical: 6 },
  action: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderRadius: 22, borderWidth: 1, paddingHorizontal: 16 },
  actionText: { fontSize: 12, fontWeight: "700" },
  paragraph: { fontSize: 16, lineHeight: 27, fontWeight: "400" },
  blockHeading: { fontSize: 22, lineHeight: 29, fontWeight: "800", marginTop: 12 },
  quote: { fontSize: 18, lineHeight: 28, fontWeight: "700", borderLeftWidth: 3, paddingLeft: 16, marginVertical: 8 },
  divider: { height: 1, marginVertical: 12 },
  blockImage: { width: "100%", aspectRatio: 1.5, borderRadius: 16, marginTop: 8 },
  section: { gap: 12, marginTop: 18 },
  sectionTitle: { fontSize: 21, lineHeight: 27, fontWeight: "800" },
  relationWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  relation: { minHeight: 44, flexDirection: "row", alignItems: "center", gap: 7, borderRadius: 22, borderWidth: 1, paddingHorizontal: 14 },
  relationText: { fontSize: 12, fontWeight: "700" },
  related: { marginBottom: 10 }
});
