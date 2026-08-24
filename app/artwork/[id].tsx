import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { AppChrome, AdSlot } from "@/components/app-chrome";
import { AuthActionNotice } from "@/components/auth-action-notice";
import { DetailScreenState } from "@/components/detail-screen-state";
import { ReadStatusToggle } from "@/components/read-status-toggle";
import { ZoomableHeroImage } from "@/components/zoomable-hero-image";
import { ReadingSizeControl } from "@/components/ui/reading-size-control";
import { useReadingScale } from "@/providers/reading-preferences-provider";
import { getThemeColors } from "@/constants/theme";
import { radii, v2Colors } from "@/constants/design";
import { copy } from "@/data/content";
import { commonCopy } from "@/app/i18n/common";
import { useAccount } from "@/hooks/use-account";
import { useAds } from "@/hooks/use-ads";
import { useArtwork } from "@/hooks/use-artworks";
import { useArtSystems } from "@/hooks/use-art-systems";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useEngagement } from "@/hooks/use-engagement";
import { useLanguage } from "@/hooks/use-language";
import { isOwnedMuseum } from "@/utils/user-identity";
import { t } from "@/utils/localized-text";

export default function ArtworkDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { scale } = useReadingScale();
  const readingTextStyle = { fontSize: 16 * scale, lineHeight: 25 * scale };
  const { account, isAuthenticated, canUseMemberFeatures } = useAccount();
  const { favoriteArtworkIds, readArtworkIds, artworkVotes, toggleArtworkRead, toggleFavorite, voteArtwork } = useEngagement();
  const { personalMuseums, toggleArtworkInMuseum } = useArtSystems();
  const { showBottomSheetAd } = useAds();
  const [museumMessage, setMuseumMessage] = useState("");
  const [authNoticeTrigger, setAuthNoticeTrigger] = useState(0);
  const { artwork, loading } = useArtwork(id);

  useEffect(() => {
    if (artwork && canUseMemberFeatures) {
      const timer = setTimeout(() => showBottomSheetAd(), 900);
      return () => clearTimeout(timer);
    }

    return undefined;
  }, [artwork, canUseMemberFeatures, showBottomSheetAd]);

  if (loading || !artwork) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <AppChrome title="Art Atlas" eyebrow={copy.gallery[language]} showBackButton backToHome showTopAd={false}>
          <DetailScreenState
            emptyLabel={t(commonCopy.artworkUnavailable, language)}
            hasContent={false}
            loading={loading}
            loadingLabel={t(commonCopy.detailPreparing, language)}
          />
        </AppChrome>
      </>
    );
  }

  const detail = artwork.detail?.[language] ?? artwork.description[language];
  const isFavorite = favoriteArtworkIds.includes(artwork.id);
  const isRead = readArtworkIds.includes(artwork.id);
  const vote = artworkVotes[artwork.id];
  const country = artwork.country?.[language] ?? artwork.origin;
  const myMuseum = personalMuseums.find((museum) => isOwnedMuseum(museum, account) && museum.active);
  const isInMuseum = Boolean(myMuseum?.artworkIds.includes(artwork.id));
  const needsMuseum = isAuthenticated && !myMuseum;
  const createMuseumHint = language === "tr"
    ? "Önce müzeni oluştur."
    : language === "ru"
      ? "Сначала создайте музей."
      : language === "uz"
        ? "Avval muzeyingizni yarating."
        : "Create your museum first.";
  const createMuseumLabel = language === "tr"
    ? "Müze oluştur"
    : language === "ru"
      ? "Создать музей"
      : language === "uz"
        ? "Muzey yaratish"
        : "Create museum";
  const goToMuseumLabel = language === "tr"
    ? "Benim Müzeme git"
    : language === "ru"
      ? "В мой музей"
      : language === "uz"
        ? "Muzeyimga o'tish"
        : "Go to my museum";

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <AppChrome title={artwork.title[language]} eyebrow={artwork.period[language]} showBackButton showTopAd={false}>
        <DetailScreenState
          emptyLabel={t(commonCopy.artworkUnavailable, language)}
          hasContent
          loading={loading}
          loadingLabel={t(commonCopy.detailPreparing, language)}
        >
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color={v2Colors.primary} />
          <Text style={styles.backText}>{copy.gallery[language]}</Text>
        </Pressable>
        <ZoomableHeroImage uri={artwork.image} containerStyle={styles.hero}>
          <LinearGradient colors={["transparent", "rgba(16, 16, 15, 0.96)"]} style={styles.fade} />
          <View style={styles.heroText}>
            <Text style={styles.year}>{artwork.year} · {artwork.origin}</Text>
            <Text style={styles.title}>{artwork.title[language]}</Text>
            <Text style={styles.artist}>{artwork.artist[language]}</Text>
          </View>
        </ZoomableHeroImage>
        <View style={styles.article}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>
              {language === "tr" ? "Eser anlatımı" : language === "en" ? "Artwork story" : language === "ru" ? "История произведения" : "Asar hikoyasi"}
            </Text>
          </View>
          <ReadingSizeControl theme={theme} />
          <View style={styles.metaGrid}>
            <Meta label={language === "tr" ? "Müze" : "Museum"} value={artwork.origin} />
            <Meta label={language === "tr" ? "Ülke" : "Country"} value={country} />
            <Meta label={language === "tr" ? "Dönem" : "Period"} value={artwork.period[language]} />
            <Meta label={language === "tr" ? "Tarih" : "Date"} value={artwork.year} />
          </View>
          <Text style={[styles.bodyText, readingTextStyle]}>{detail}</Text>
          <Text style={[styles.bodyText, readingTextStyle]}>
            {language === "tr"
              ? "Bu detay sayfası ileride daha uzun sanat tarihi metinleri, sesli rehber, kaynak notları ve ilgili quiz bağlantıları için hazırlandı."
              : language === "en"
                ? "This detail page is prepared for longer art history notes, audio guides, source notes, and related quiz links."
                : language === "ru"
                  ? "Эта страница готова для длинных заметок по истории искусства, аудиогида, источников и связанных вопросов."
                  : "Bu sahifa keyinroq uzun san'at tarixi matnlari, audio gid, manbalar va bog'liq savollar uchun tayyor."}
          </Text>
          <AuthActionNotice trigger={authNoticeTrigger} />
          <View style={styles.actions}>
            <ReadStatusToggle
              language={language}
              isRead={isRead}
              onPress={() => {
                if (!isAuthenticated) return setAuthNoticeTrigger((value) => value + 1);
                toggleArtworkRead(artwork.id);
              }}
              style={styles.readStatusChip}
            />
            <Pressable onPress={() => {
              if (!isAuthenticated) return setAuthNoticeTrigger((value) => value + 1);
              voteArtwork(artwork.id, "like");
            }} style={[styles.actionButton, vote === "like" && styles.actionButtonActive]}>
              <Ionicons name={vote === "like" ? "heart" : "heart-outline"} size={18} color={vote === "like" ? "#ffffff" : v2Colors.primary} />
              <Text style={[styles.actionText, vote === "like" && styles.actionTextActive]}>{language === "tr" ? "Beğen" : "Like"}</Text>
            </Pressable>
            <Pressable onPress={() => {
              if (!isAuthenticated) return setAuthNoticeTrigger((value) => value + 1);
              toggleFavorite(artwork.id);
            }} style={[styles.actionButton, isFavorite && styles.actionButtonActive]}>
              <Ionicons name={isFavorite ? "bookmark" : "bookmark-outline"} size={18} color={isFavorite ? "#ffffff" : v2Colors.primary} />
              <Text style={[styles.actionText, isFavorite && styles.actionTextActive]}>{language === "tr" ? "Favori" : "Favorite"}</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push({
                pathname: "/support",
                params: {
                  category: "artwork",
                  subcategory: "content",
                  subject: language === "tr" ? `${artwork.title[language]} içeriği hakkında` : `About ${artwork.title[language]}`,
                  topic: language === "tr"
                    ? `Eser: ${artwork.title[language]}\nSanatçı: ${artwork.artist[language]}\n\nLütfen bu içerikle ilgili inceleme talebinizi yazın.`
                    : `Artwork: ${artwork.title[language]}\nArtist: ${artwork.artist[language]}\n\nPlease write your review request about this content.`
                }
              })}
              style={styles.actionButton}
            >
              <Ionicons name="flag-outline" size={18} color={v2Colors.primary} />
              <Text style={styles.actionText}>{language === "tr" ? "Bildir" : language === "ru" ? "Жалоба" : language === "uz" ? "Shikoyat" : "Report"}</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => {
              if (!isAuthenticated) {
                setAuthNoticeTrigger((value) => value + 1);
                return;
              }
              if (needsMuseum) {
                setMuseumMessage(createMuseumHint);
                return;
              }
              const result = toggleArtworkInMuseum(artwork.id);
              setMuseumMessage(result.message);
            }}
            style={[styles.museumButton, isInMuseum && styles.museumButtonSecondary]}
          >
            <Ionicons name={isInMuseum ? "remove-circle-outline" : "business-outline"} size={18} color={isInMuseum ? v2Colors.primary : "#ffffff"} />
            <Text style={[styles.museumButtonText, isInMuseum && styles.museumButtonTextSecondary]}>
              {isInMuseum
                ? language === "tr" ? "Müzemden Kaldır" : "Remove from My Museum"
                : language === "tr" ? "Müzeme Ekle" : "Add to My Museum"}
            </Text>
          </Pressable>
          {needsMuseum ? (
            <View style={styles.museumHintRow}>
              <Text style={styles.museumHintText}>{museumMessage || createMuseumHint}</Text>
              <Pressable onPress={() => router.push("/my-museum")} style={styles.createMuseumShortcut}>
                <Ionicons name="business-outline" size={14} color={v2Colors.primary} />
                <Text style={styles.createMuseumShortcutText}>{createMuseumLabel}</Text>
              </Pressable>
            </View>
          ) : (
            <>
              {museumMessage ? <Text style={styles.museumMessage}>{museumMessage}</Text> : null}
              {myMuseum ? (
                <Pressable onPress={() => router.push("/my-museum")} style={styles.goMuseumShortcut}>
                  <Ionicons name="albums-outline" size={16} color={v2Colors.primary} />
                  <Text style={styles.goMuseumShortcutText}>{goToMuseumLabel}</Text>
                  <Ionicons name="chevron-forward" size={16} color={v2Colors.primary} />
                </Pressable>
              ) : null}
            </>
          )}
        </View>
        <AdSlot label={copy.adSlot[language]} placement="artwork_detail_bottom" />
        </DetailScreenState>
      </AppChrome>
    </>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
return StyleSheet.create({
  backButton: {
    alignSelf: "flex-start",
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 14
  },
  backText: {
    color: colors.ivory,
    fontWeight: "800"
  },
  hero: {
    aspectRatio: 0.82,
    borderRadius: 22,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel
  },
  image: {
    ...StyleSheet.absoluteFillObject
  },
  fade: {
    ...StyleSheet.absoluteFillObject
  },
  heroText: {
    marginTop: "auto",
    padding: 18
  },
  year: {
    color: v2Colors.textSecondary,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ivory,
    fontSize: 34,
    fontWeight: "900",
    marginTop: 6
  },
  artist: {
    color: colors.muted,
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4
  },
  article: {
    paddingHorizontal: 2,
    paddingTop: 10,
    marginTop: 10,
    gap: 16
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  sectionTitle: {
    color: v2Colors.text,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: "800"
  },
  bodyText: {
    color: colors.ivory,
    fontSize: 16,
    lineHeight: 25
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6
  },
  metaItem: {
    width: "48.5%",
    borderRadius: radii.sm,
    backgroundColor: v2Colors.surface1,
    borderWidth: 1,
    borderColor: v2Colors.border,
    padding: 11
  },
  metaLabel: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "800",
    textTransform: "uppercase"
  },
  metaValue: {
    color: colors.ivory,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 3
  },
  tags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  tag: {
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.28)",
    color: v2Colors.primary,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontWeight: "900"
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  readStatusChip: {
    flexGrow: 0
  },
  actionButton: {
    flex: 1,
    minWidth: 92,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.28)",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 5,
    paddingHorizontal: 6
  },
  actionButtonActive: {
    backgroundColor: v2Colors.primary,
    borderColor: v2Colors.primary
  },
  actionText: {
    color: v2Colors.primary,
    fontSize: 11,
    fontWeight: "900"
  },
  actionTextActive: {
    color: "#ffffff"
  },
  museumButton: {
    minHeight: 44,
    borderRadius: radii.sm,
    backgroundColor: v2Colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7
  },
  museumButtonSecondary: {
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.28)"
  },
  museumButtonText: {
    color: "#ffffff",
    fontWeight: "900"
  },
  museumButtonTextSecondary: {
    color: v2Colors.primary
  },
  museumMessage: {
    color: v2Colors.primary,
    fontWeight: "900",
    textAlign: "center"
  },
  museumHintRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    flexWrap: "wrap",
    gap: 8
  },
  museumHintText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    textAlign: "center"
  },
  createMuseumShortcut: {
    minHeight: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.28)",
    backgroundColor: colors.panelSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10
  },
  createMuseumShortcutText: {
    color: v2Colors.primary,
    fontSize: 11,
    fontWeight: "800"
  },
  goMuseumShortcut: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(99,102,241,0.28)",
    backgroundColor: colors.panelSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12
  },
  goMuseumShortcutText: {
    color: v2Colors.primary,
    fontSize: 13,
    fontWeight: "900"
  },
  reportButton: {
    alignSelf: "flex-start",
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: colors.panelSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10
  },
  reportText: {
    color: colors.muted,
    fontWeight: "800"
  },
  missing: {
    color: colors.ivory,
    fontSize: 18,
    fontWeight: "800"
  },
});
}
