import { useMemo, useState } from "react";
import { Alert, Modal, Pressable, Share, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppChrome } from "@/components/app-chrome";
import { AuthActionNotice } from "@/components/auth-action-notice";
import { DetailScreenState } from "@/components/detail-screen-state";
import { ReadStatusToggle } from "@/components/read-status-toggle";
import { ZoomableHeroImage } from "@/components/zoomable-hero-image";
import { ReadingSizeControl } from "@/components/ui/reading-size-control";
import { useReadingScale } from "@/providers/reading-preferences-provider";
import { appStoreLinkForPlatform, artStoryDeepLink, artStoryWebLink } from "@/constants/app-links";
import { getThemeColors } from "@/constants/theme";
import { radii, v2Colors } from "@/constants/design";
import { commonCopy, feedCopy } from "@/app/i18n/common";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useArtStories } from "@/hooks/use-art-stories";
import { useArtStoryEngagement } from "@/hooks/use-art-story-engagement";
import { useLanguage } from "@/hooks/use-language";
import { firebaseAuth } from "@/src/services/firebase/core";
import { removeFavorite, setFavorite } from "@/src/services/firebase/favorite-service";
import { createReport } from "@/src/services/firebase/report-service";
import { t } from "@/utils/localized-text";
import { storyAuthorLabel } from "@/utils/story-author-label";
import { throttleAction } from "@/utils/safety";

const storyCopy = {
  shareMessage: {
    tr: (title: string, webLink: string, storeLink: string) => `${title}\n\nArt Atlas'ta oku: ${webLink}\n\nUygulama yüklü değilse: ${storeLink}`,
    en: (title: string, webLink: string, storeLink: string) => `${title}\n\nRead on Art Atlas: ${webLink}\n\nIf the app is not installed: ${storeLink}`,
    ru: (title: string, webLink: string, storeLink: string) => `${title}\n\nЧитать в Art Atlas: ${webLink}\n\nЕсли приложение не установлено: ${storeLink}`,
    uz: (title: string, webLink: string, storeLink: string) => `${title}\n\nArt Atlas'da o'qing: ${webLink}\n\nIlova o'rnatilmagan bo'lsa: ${storeLink}`
  },
  reportSubject: {
    tr: "Sanat yazısı bildirimi",
    en: "Art writing report",
    ru: "Жалоба на статью",
    uz: "San'at yozuvi shikoyati"
  },
  addFavorite: {
    tr: "Favorilere ekle",
    en: "Add to favorites",
    ru: "В избранное",
    uz: "Sevimlilarga qo'shish"
  },
  removeFavorite: {
    tr: "Favoriden çıkar",
    en: "Remove favorite",
    ru: "Убрать из избранного",
    uz: "Sevimlidan olib tashlash"
  }
};

export default function StoryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language } = useLanguage();
  const { account, canUseMemberFeatures, isAuthenticated } = useAccount();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { scale } = useReadingScale();
  const readingTextStyle = { fontSize: 16 * scale, lineHeight: 25 * scale };
  const { stories, loading } = useArtStories();
  const { favoriteIds, readIds, toggleRead } = useArtStoryEngagement(account.uid);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [authNoticeTrigger, setAuthNoticeTrigger] = useState(0);
  const story = useMemo(() => stories.find((item) => item.id === id), [id, stories]);
  const storyTitle = story?.title[language] ?? "";
  const isFavorite = story ? favoriteIds.includes(story.id) : false;
  const isRead = story ? readIds.includes(story.id) : false;

  async function handleToggleRead() {
    if (!story) return;
    if (!isAuthenticated || !account.uid) {
      setAuthNoticeTrigger((value) => value + 1);
      return;
    }
    if (!throttleAction(`read_artstory_${story.id}`, 500)) return;
    const ok = await toggleRead(story.id);
    if (!ok) {
      Alert.alert(
        language === "tr" ? "Kaydedilemedi" : "Could not save",
        language === "tr" ? "Okundu durumu kaydedilemedi. Lütfen tekrar dene." : "Read status could not be saved. Please try again."
      );
    }
  }

  async function toggleFavorite() {
    if (!story) return;
    if (!isAuthenticated || !account.uid) {
      setAuthNoticeTrigger((value) => value + 1);
      return;
    }
    if (!canUseMemberFeatures) return;
    if (!throttleAction(`fav_artstory_${story.id}`, 700)) return;
    const exists = favoriteIds.includes(story.id);
    (exists ? removeFavorite(account.uid, "artStory", story.id) : setFavorite(account.uid, "artStory", story.id)).catch(() => undefined);
  }

  async function shareStory() {
    if (!story) return;
    const webLink = artStoryWebLink(story.id);
    const storeLink = appStoreLinkForPlatform();
    const message = storyCopy.shareMessage[language](storyTitle, webLink, storeLink);
    await Share.share({
      message,
      url: artStoryDeepLink(story.id),
      title: storyTitle
    }).catch(() => undefined);
  }

  async function submitReport() {
    if (!story) return;
    const reason = reportReason.trim();
    const reporterId = firebaseAuth.currentUser?.uid;
    if (!reporterId || !reason) {
      Alert.alert(t(feedCopy.reportMissingTitle, language), t(feedCopy.reportMissingBody, language));
      return;
    }
    setReportSubmitting(true);
    try {
      await createReport({
        reporterId,
        targetType: "artStory",
        targetId: story.id,
        category: "content",
        subject: storyCopy.reportSubject[language],
        message: `Story: ${story.id}\nTitle: ${storyTitle}\nAuthor: ${story.authorDisplayName || story.authorUsername || "-"}\nLink: ${artStoryWebLink(story.id)}\nReason: ${reason}`
      });
      setReportOpen(false);
      setReportReason("");
      Alert.alert(t(feedCopy.reportReceivedTitle, language), t(feedCopy.reportReceivedBody, language));
    } catch {
      Alert.alert(t(feedCopy.reportFailedTitle, language), t(feedCopy.reportFailedBody, language));
    } finally {
      setReportSubmitting(false);
    }
  }

  if (!story) {
    return (
      <AppChrome title="Art Atlas" eyebrow="Stories" showBackButton backToHome>
        <DetailScreenState
          emptyLabel={t(commonCopy.storyUnavailable, language)}
          hasContent={false}
          loading={loading}
          loadingLabel={t(commonCopy.detailPreparing, language)}
        />
      </AppChrome>
    );
  }

  const storyAuthor = story ? storyAuthorLabel(story) : "";

  return (
    <AppChrome title={storyTitle} eyebrow={storyAuthor || undefined} showBackButton>
      <DetailScreenState
        emptyLabel={t(commonCopy.storyUnavailable, language)}
        hasContent
        loading={loading}
        loadingLabel={t(commonCopy.detailPreparing, language)}
      >
      <ZoomableHeroImage uri={story.image} containerStyle={styles.hero} />
      <View style={styles.article}>
        <View style={styles.articleMeta}><Ionicons name="time-outline" size={14} color={v2Colors.cyan} /><Text style={styles.articleMetaText}>{story.readTime[language]}</Text>{storyAuthor ? <Text style={styles.articleMetaText}>· {storyAuthor}</Text> : null}</View>
        <Text style={styles.title}>{storyTitle}</Text>
        <ReadingSizeControl theme={theme} />
        <Text style={[styles.bodyText, readingTextStyle]}>{story.body[language]}</Text>

        <AuthActionNotice trigger={authNoticeTrigger} />
        <View style={styles.footer}>
          <View style={styles.footerActions}>
            <ReadStatusToggle language={language} isRead={isRead} onPress={() => { void handleToggleRead(); }} />
            <Pressable onPress={() => setReportOpen(true)} style={styles.iconAction} accessibilityLabel={t(commonCopy.report, language)}>
              <Ionicons name="flag-outline" size={18} color={colors.gold} />
              <Text style={styles.iconActionText}>{t(commonCopy.report, language)}</Text>
            </Pressable>
            <Pressable onPress={() => { void toggleFavorite(); }} style={[styles.iconAction, isFavorite && styles.iconActionActive]} accessibilityLabel={isFavorite ? storyCopy.removeFavorite[language] : storyCopy.addFavorite[language]}>
              <Ionicons name={isFavorite ? "heart" : "heart-outline"} size={18} color={isFavorite ? colors.ink : colors.gold} />
              <Text style={[styles.iconActionText, isFavorite && styles.iconActionTextActive]}>{isFavorite ? storyCopy.removeFavorite[language] : storyCopy.addFavorite[language]}</Text>
            </Pressable>
          </View>
          <Pressable onPress={() => { void shareStory(); }} style={styles.shareButton}>
            <Ionicons name="share-social-outline" size={17} color={v2Colors.text} />
            <Text style={styles.shareButtonText}>{t(commonCopy.share, language)}</Text>
          </Pressable>
        </View>
      </View>

      <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
        <View style={styles.reportBackdrop}>
          <View style={styles.reportPanel}>
            <View style={styles.reportHeader}>
              <Text style={styles.reportTitle}>{t(commonCopy.report, language)}</Text>
              <Pressable onPress={() => setReportOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={22} color={colors.muted} />
              </Pressable>
            </View>
            <Text style={styles.reportHint}>{t(feedCopy.reportHint, language)}</Text>
            <TextInput
              value={reportReason}
              onChangeText={setReportReason}
              placeholder={t(feedCopy.reportReasonPlaceholder, language)}
              placeholderTextColor={colors.muted}
              style={styles.reportInput}
              multiline
            />
            <Pressable disabled={reportSubmitting} onPress={submitReport} style={[styles.reportSubmit, reportSubmitting && styles.reportSubmitDisabled]}>
              <Text style={styles.reportSubmitText}>{t(commonCopy.report, language)}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      </DetailScreenState>
    </AppChrome>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    hero: { width: "100%", height: 286, borderRadius: radii.xl, borderWidth: 1, borderColor: "rgba(139,92,246,0.22)" },
    article: { paddingHorizontal: 3, marginTop: 20, gap: 14 },
    articleMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5 },
    articleMetaText: { maxWidth: "70%", color: v2Colors.textMuted, fontSize: 11, lineHeight: 15, fontWeight: "600" },
    title: { color: colors.ivory, fontSize: 28, lineHeight: 34, fontWeight: "800", letterSpacing: -0.55 },
    bodyText: { color: colors.ivory, fontSize: 16, lineHeight: 25 },
    footer: { marginTop: 8, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line, gap: 10 },
    footerActions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
    iconAction: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      minHeight: 34,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panelSoft,
      paddingHorizontal: 10,
      paddingVertical: 7
    },
    iconActionActive: { backgroundColor: colors.gold, borderColor: colors.gold },
    iconActionText: { color: colors.gold, fontSize: 11, fontWeight: "900" },
    iconActionTextActive: { color: colors.ink },
    shareButton: {
      minHeight: 42,
      borderRadius: radii.pill,
      backgroundColor: v2Colors.violet,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 14
    },
    shareButtonText: { color: v2Colors.text, fontSize: 13, fontWeight: "900" },
    reportBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.58)", justifyContent: "center", padding: 18 },
    reportPanel: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 14, gap: 10 },
    reportHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    reportTitle: { color: colors.ivory, fontSize: 18, fontWeight: "900", flex: 1 },
    reportHint: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: "800" },
    reportInput: {
      minHeight: 90,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panelSoft,
      color: colors.ivory,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "800",
      padding: 10,
      textAlignVertical: "top"
    },
    reportSubmit: { minHeight: 42, borderRadius: 8, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
    reportSubmitDisabled: { opacity: 0.5 },
    reportSubmitText: { color: colors.ink, fontWeight: "900" }
  });
}
