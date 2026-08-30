import { memo, useEffect, useState } from "react";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { imageSource } from "@/utils/image-source";
import { localizeNews } from "@/src/services/firebase/news-service";
import { ArtNewsDocument } from "@/src/types/firestore";
import { toExpoContentPosition } from "@/firebase/shared/image-focus";
import { saveResourceCache } from "@/src/services/cache/resource-cache";

type Props = {
  item: ArtNewsDocument;
  variant?: "headline" | "homeHeadline" | "latest" | "supporting" | "feed" | "compact" | "editorial";
};

export const NewsCard = memo(function NewsCard({ item, variant = "feed" }: Props) {
  const router = useRouter();
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const isHeadline = variant === "headline" || variant === "homeHeadline";
  const isHomeHeadline = variant === "homeHeadline";
  const isLatest = variant === "latest";
  const isSupporting = variant === "supporting";
  const isEditorial = variant === "editorial";
  const isHorizontal = variant === "feed" || variant === "compact" || isEditorial;
  const image = isHeadline ? item.coverMedium || item.coverImage : item.coverThumbnail || item.thumbnailImage || item.coverMedium || item.coverImage;
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(image) && !imageFailed;
  const showPlaceholder = !showImage && isHorizontal;
  const category = localizeNews(item.categoryLabel, language) || item.categoryId;
  const title = isHeadline ? localizeNews(item.headlineTitle, language) || localizeNews(item.title, language) : localizeNews(item.title, language);
  const spot = localizeNews(item.spot, language);
  const minutes = { tr: "dk", en: "min", ru: "мин", uz: "daq" }[language];

  useEffect(() => setImageFailed(false), [image]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      onPress={() => {
        void saveResourceCache(`art-news:item:${item.id}`, item);
        router.push(`/news/${item.id}` as never);
      }}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.panel, borderColor: colors.line },
        isHeadline && showImage && styles.headline,
        isHomeHeadline && showImage && styles.homeHeadline,
        isLatest && showImage && styles.latest,
        isSupporting && showImage && styles.supporting,
        isHorizontal && styles.horizontal,
        variant === "compact" && styles.compact,
        isEditorial && styles.editorial,
        !showImage && !showPlaceholder && styles.textOnly,
        pressed && styles.pressed
      ]}
    >
      {showImage ? (
        <Image
          source={imageSource(image, isHeadline ? "large" : "thumbnail")}
          recyclingKey={`news:${item.id}:${image}`}
          style={[styles.image, isHeadline && styles.headlineImage, isHomeHeadline && styles.homeHeadlineImage, isLatest && styles.latestImage, isSupporting && styles.supportingImage, isHorizontal && styles.horizontalImage, variant === "compact" && styles.compactImage, isEditorial && styles.editorialImage]}
          contentFit="cover"
          contentPosition={toExpoContentPosition(item.imageFocalPoint)}
          cachePolicy="memory-disk"
          allowDownscaling
          transition={140}
          onError={() => setImageFailed(true)}
        />
      ) : showPlaceholder ? (
        <View style={[styles.imagePlaceholder, variant === "compact" && styles.compactImage, isEditorial && styles.editorialImage, { backgroundColor: colors.panelSoft, borderRightColor: colors.line }]}>
          <Ionicons name={categoryIcon(item.categoryId)} size={isEditorial ? 30 : 25} color={colors.gold} />
        </View>
      ) : null}
      <View style={[styles.content, isHeadline && showImage && styles.headlineContent, isHomeHeadline && showImage && styles.homeHeadlineContent, isSupporting && showImage && styles.supportingContent, isHorizontal && styles.horizontalContent, isEditorial && styles.editorialContent, !showImage && !showPlaceholder && styles.textOnlyContent]}>
        <Text style={[styles.category, { color: colors.gold }]} numberOfLines={1}>{category}</Text>
        <Text style={[styles.title, { color: colors.ivory }, isHeadline && styles.headlineTitle, isHomeHeadline && styles.homeHeadlineTitle, isSupporting && styles.supportingTitle, isHorizontal && styles.horizontalTitle, isEditorial && styles.editorialTitle]} numberOfLines={isLatest || isEditorial ? 2 : 3}>{title}</Text>
        {(isHeadline || isEditorial) && spot ? <Text style={[styles.spot, { color: colors.muted }]} numberOfLines={showImage ? 2 : 3}>{spot}</Text> : null}
        {isHorizontal ? <View style={styles.metaRow}><Text style={[styles.meta, styles.horizontalMeta, { color: colors.muted }]} numberOfLines={1}>{newsDate(item.publishedAt, language)}{item.location ? ` · ${item.location}` : ""} · {Math.max(1, item.readingMinutes || 1)} {minutes}</Text><Ionicons name="arrow-forward" size={14} color={colors.gold} /></View> : <Text style={[styles.meta, { color: colors.muted }]} numberOfLines={1}>{newsDate(item.publishedAt, language)}{item.location ? ` · ${item.location}` : ""} · {Math.max(1, item.readingMinutes || 1)} {minutes}</Text>}
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  card: { width: "100%", borderRadius: 18, borderWidth: 1, overflow: "hidden" },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  image: { width: "100%", aspectRatio: 1.55 },
  content: { minWidth: 0, padding: 14, gap: 5 },
  category: { fontSize: 10, lineHeight: 14, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.8 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: "700" },
  spot: { fontSize: 12, lineHeight: 18, fontWeight: "500" },
  meta: { fontSize: 10, lineHeight: 14, fontWeight: "600", marginTop: 2 },
  headline: { minHeight: 360 },
  headlineImage: { aspectRatio: 1.62 },
  headlineContent: { padding: 16 },
  headlineTitle: { fontSize: 21, lineHeight: 26 },
  homeHeadline: { minHeight: 282 },
  homeHeadlineImage: { aspectRatio: 1.92 },
  homeHeadlineContent: { padding: 13, gap: 4 },
  homeHeadlineTitle: { fontSize: 17, lineHeight: 21 },
  latest: { width: 206, minHeight: 250 },
  latestImage: { aspectRatio: 1.63 },
  supporting: { flex: 1, minWidth: 0 },
  supportingImage: { aspectRatio: 1.28 },
  supportingContent: { minHeight: 118, padding: 11, gap: 4 },
  supportingTitle: { fontSize: 14, lineHeight: 18 },
  horizontal: { flexDirection: "row", minHeight: 116 },
  horizontalImage: { width: 116, height: 116, aspectRatio: undefined },
  imagePlaceholder: { width: 116, height: 116, borderRightWidth: StyleSheet.hairlineWidth, alignItems: "center", justifyContent: "center" },
  horizontalContent: { flex: 1, justifyContent: "center", padding: 12 },
  horizontalTitle: { fontSize: 15, lineHeight: 20 },
  metaRow: { minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  horizontalMeta: { flex: 1, minWidth: 0, marginTop: 0 },
  compact: { minHeight: 104 },
  compactImage: { width: 104, height: 104 },
  editorial: { minHeight: 132 },
  editorialImage: { width: 128, height: 132 },
  editorialContent: { paddingVertical: 12, paddingHorizontal: 13, gap: 4 },
  editorialTitle: { fontSize: 16, lineHeight: 21 },
  textOnly: { minHeight: 0, width: "100%" },
  textOnlyContent: { minHeight: 132, justifyContent: "center", paddingVertical: 16 }
});

function categoryIcon(categoryId: string): keyof typeof Ionicons.glyphMap {
  const normalized = categoryId.toLocaleLowerCase("tr");
  if (normalized.includes("müze") || normalized.includes("museum")) return "business-outline";
  if (normalized.includes("sergi") || normalized.includes("exhibition")) return "images-outline";
  if (normalized.includes("kitap") || normalized.includes("book")) return "book-outline";
  if (normalized.includes("film") || normalized.includes("cinema")) return "film-outline";
  if (normalized.includes("müzayede") || normalized.includes("auction")) return "hammer-outline";
  return "color-palette-outline";
}

function newsDate(value: ArtNewsDocument["publishedAt"], language: "tr" | "en" | "ru" | "uz") {
  if (!value) return "";
  const milliseconds = typeof value.toMillis === "function"
    ? value.toMillis()
    : typeof value === "object" && "seconds" in value && typeof value.seconds === "number"
      ? value.seconds * 1000
      : 0;
  if (!milliseconds) return "";
  const date = new Date(milliseconds);
  const months = {
    tr: ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"],
    en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    ru: ["янв.", "февр.", "мар.", "апр.", "май", "июн.", "июл.", "авг.", "сент.", "окт.", "нояб.", "дек."],
    uz: ["yan", "fev", "mar", "apr", "may", "iyun", "iyul", "avg", "sen", "okt", "noy", "dek"]
  } as const;
  const day = String(date.getDate()).padStart(2, "0");
  const month = months[language][date.getMonth()];
  return language === "en" ? `${month} ${day}` : `${day} ${month}`;
}
