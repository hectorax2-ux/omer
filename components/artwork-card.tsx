import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { CoverImage } from "@/components/cover-image";
import { Artwork } from "@/types/content";
import { colors } from "@/constants/theme";
import { copy } from "@/data/content";
import { useLanguage } from "@/hooks/use-language";

export function ArtworkCard({ artwork, large = false, onPress }: { artwork: Artwork; large?: boolean; onPress?: () => void }) {
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const cardHeight = large ? Math.min(360, Math.max(292, width * 0.82)) : Math.min(238, Math.max(190, width * 0.56));
  const titleSize = large ? Math.min(26, Math.max(22, width * 0.058)) : Math.min(21, Math.max(18, width * 0.05));
  const content = (
    <>
      <CoverImage source={{ uri: artwork.image }} style={styles.image} imageFocus={artwork.imageFocus} transition={300} />
      <LinearGradient colors={["transparent", "rgba(16, 16, 15, 0.88)"]} style={styles.gradient} />
      <View style={styles.meta}>
        <Text style={styles.period}>{artwork.period[language]} · {artwork.year}</Text>
        <Text style={[styles.title, { fontSize: titleSize }]} numberOfLines={2} adjustsFontSizeToFit>{artwork.title[language]}</Text>
        <Text style={styles.artist}>{artwork.artist[language]}</Text>
        {large ? <Text style={styles.description} numberOfLines={3}>{artwork.description[language]}</Text> : null}
        {onPress ? (
          <View style={styles.readMore}>
            <Text style={styles.readMoreText}>{copy.readMore[language]}</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.gold} />
          </View>
        ) : null}
      </View>
    </>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={[styles.card, { height: cardHeight }]}>
        {content}
      </Pressable>
    );
  }

  return (
    <View style={[styles.card, { height: cardHeight }]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 14
  },
  image: {
    ...StyleSheet.absoluteFillObject
  },
  gradient: {
    ...StyleSheet.absoluteFillObject
  },
  meta: {
    marginTop: "auto",
    padding: 14,
    gap: 4
  },
  period: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ivory,
    fontSize: 24,
    fontWeight: "900"
  },
  artist: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "700"
  },
  description: {
    color: colors.ivory,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4
  },
  readMore: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8
  },
  readMoreText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "900"
  }
});
