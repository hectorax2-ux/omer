import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { AdSlot, AppChrome } from "@/components/app-chrome";
import { TabScreenMountGate } from "@/components/tab-screen-mount-gate";
import { ScreenDataState } from "@/components/screen-data-state";
import { ProfileAvatar } from "@/components/profile-avatar";
import { useAds } from "@/hooks/use-ads";
import { AuthRequired } from "@/components/auth-required";
import { UserNameWithCountry } from "@/components/user-name-with-country";
import { getThemeColors, type AppTheme } from "@/constants/theme";
import { elevation, hexAlpha, radii, v2Colors } from "@/constants/design";
import { uiCopy } from "@/data/content";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDiscoveryPosts } from "@/hooks/use-discovery-posts";
import { useLanguage } from "@/hooks/use-language";
import { useSocial } from "@/hooks/use-social";
import { useMessaging } from "@/hooks/use-messaging";
import { DiscoveryPost, PostKind } from "@/providers/discovery-post-provider";
import { Language } from "@/types/content";
import { buildActivePremiumUsernameSet, isActivePremiumAuthor } from "@/utils/premium-authors";
import { useCountryCodeLookup } from "@/hooks/use-country-code-lookup";
import { isAuthoredByPost } from "@/utils/user-identity";
import { profileRouteParam } from "@/utils/profile-route";
import { buildPopularFeedPosts } from "@/utils/popular-feed";
import { shouldShowFeedInlineAd } from "@/utils/ad-routes";
import { t } from "@/utils/localized-text";
import { commonCopy, feedCopy, feedLanguageFilterItems } from "@/app/i18n/common";
import { buildLimitStatusText, buildRateLimitMessage, buildCooldownMessage, isPostCooldownActive, RateLimitStatus } from "@/utils/safety";
import { createReport } from "@/src/services/firebase/report-service";
import { firebaseAuth } from "@/src/services/firebase/core";

const MAX_POST_LENGTH = 1000;
const PREVIEW_LENGTH = 150;
const PAGE_SIZE = 10;
type FeedSection = "new" | "premium" | "popular" | "contributors";
type FeedLanguageFilter = Language | "all";

export const kindLabels: Record<PostKind, Record<"tr" | "en" | "ru" | "uz", string>> = {
  quote: { tr: "Alıntı", en: "Quote", ru: "Цитата", uz: "Iqtibos" },
  own: { tr: "Kendi kalemimden", en: "In my own words", ru: "От себя", uz: "O'z qalamimdan" },
  knowledge: { tr: "Bilgi", en: "Knowledge", ru: "Знание", uz: "Ma'lumot" },
  note: { tr: "Kısa not", en: "Short note", ru: "Короткая заметка", uz: "Qisqa izoh" }
};

const commentActionLabels = {
  tr: "Yorum yap",
  en: "Comment",
  ru: "Комментировать",
  uz: "Izoh yozish"
};

const deletePostConfirmText = {
  title: { tr: "Gönderi silinsin mi?", en: "Delete post?", ru: "Удалить запись?", uz: "Post o'chirilsinmi?" },
  message: {
    tr: "Bu keşfet yazısını silmek istediğinize emin misiniz? Silinen yazı profilinizde ve keşfette görünmez.",
    en: "Are you sure you want to delete this Discover post? Deleted posts will no longer appear in your profile or Discover.",
    ru: "Вы уверены, что хотите удалить эту запись? Удаленная запись больше не будет видна в профиле и ленте.",
    uz: "Bu postni o'chirishni xohlaysizmi? O'chirilgan post profilingizda va keşfda ko'rinmaydi."
  },
  cancel: { tr: "Vazgeç", en: "Cancel", ru: "Отмена", uz: "Bekor qilish" },
  confirm: { tr: "Sil", en: "Delete", ru: "Удалить", uz: "O'chirish" }
};

export default function FeedDiscoverScreen() {
  const { language } = useLanguage();
  return <TabScreenMountGate title={uiCopy.feedDiscover[language]}><FeedDiscoverContent /></TabScreenMountGate>;
}

function FeedDiscoverContent() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const { account, isAuthenticated, canUseMemberFeatures } = useAccount();
  const { adSettings } = useAds();
  const { commentsByPost, posts, feedStatus, retryFeed, addPost, deletePost, favoriteIds, getPostLimitStatus, hasMorePosts, likedIds, loadMorePosts, loadingMorePosts, toggleFavorite, toggleHidden, toggleLike, updatePost } = useDiscoveryPosts();
  const { suggestedUsers } = useSocial();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors, theme), [colors, theme]);
  const premiumUsernames = useMemo(
    () => buildActivePremiumUsernameSet(suggestedUsers, account.username, account.isPremium),
    [account.isPremium, account.username, suggestedUsers]
  );
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<DiscoveryPost | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftKind, setDraftKind] = useState<PostKind>("own");
  const [editorError, setEditorError] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [section, setSection] = useState<FeedSection>("new");
  const [feedLanguage, setFeedLanguage] = useState<FeedLanguageFilter>(language);
  const matchesFeedLanguage = useCallback((post: DiscoveryPost) => feedLanguage === "all" || post.language === feedLanguage, [feedLanguage]);
  const activePosts = useMemo(() => posts.filter((post) => !post.hidden && matchesFeedLanguage(post)), [matchesFeedLanguage, posts]);
  const newPosts = useMemo(() => posts.filter((post) => matchesFeedLanguage(post) && (!post.hidden || isAuthoredByPost(post, account))), [account, matchesFeedLanguage, posts]);
  const popularPosts = useMemo(
    () => buildPopularFeedPosts(activePosts),
    [activePosts]
  );
  const lookupUserCountry = useCountryCodeLookup();
  const contributors = useMemo(() => getTopContributors(activePosts, premiumUsernames, lookupUserCountry), [activePosts, lookupUserCountry, premiumUsernames]);
  const premiumPosts = useMemo(
    () => newPosts.filter((post) => isActivePremiumAuthor(post.username, premiumUsernames)),
    [newPosts, premiumUsernames]
  );
  const filteredPosts = section === "popular" ? popularPosts : section === "premium" ? premiumPosts : newPosts;
  const visiblePosts = filteredPosts.slice(0, visibleCount);
  const visibleContributors = contributors.slice(0, visibleCount);
  const totalSectionItems = section === "contributors" ? contributors.length : filteredPosts.length;
  const canRevealMoreLocally = visibleCount < totalSectionItems;
  const showMoreButton = canRevealMoreLocally || (section !== "contributors" && hasMorePosts);
  const postLimitStatus = getPostLimitStatus(account.username);

  async function handleShowMore() {
    if (section !== "contributors" && visibleCount + PAGE_SIZE > filteredPosts.length && hasMorePosts) {
      await loadMorePosts();
    }
    setVisibleCount((value) => value + PAGE_SIZE);
  }

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [feedLanguage, section]);

  useEffect(() => {
    setFeedLanguage(language);
  }, [language]);

  if (!isAuthenticated) {
    return <AuthRequired title={uiCopy.feedDiscover[language]} />;
  }

  if (!posts.length && feedStatus !== "success") {
    return (
      <AppChrome title={uiCopy.feedDiscover[language]} eyebrow="Art Atlas">
        <ScreenDataState status={feedStatus} onRetry={retryFeed} />
      </AppChrome>
    );
  }

  function openNewPostModal() {
    setEditingPost(null);
    setDraftText("");
    setDraftKind("own");
    setEditorError("");
    setModalOpen(true);
  }

  function openEditPostModal(post: DiscoveryPost) {
    setEditingPost(post);
    setDraftText(post.text);
    setDraftKind(post.kind);
    setEditorError("");
    setModalOpen(true);
  }

  function submitPost() {
    const text = draftText.trim().slice(0, MAX_POST_LENGTH);
    if (!text) return;

    if (editingPost) {
      const result = updatePost(editingPost.id, { text, kind: draftKind }, language);
      if (!result.ok) {
        setEditorError(
          result.reason === "rate_limit"
            ? buildRateLimitMessage(result.status, language)
            : result.reason === "cooldown"
              ? buildCooldownMessage(result.status, language)
              : result.message ?? ""
        );
        return;
      }
    } else {
      const result = addPost({
        author: isAuthenticated ? account.displayName : "Art Atlas Üyesi",
        username: isAuthenticated ? account.username : "artatlas.user",
        text,
        kind: draftKind,
        isPremium: account.isPremium || account.isAdmin,
        skipLimits: account.isPremium || account.isAdmin || account.staffBadges.includes("moderator") || account.staffBadges.includes("editor")
      }, language);
      if (!result.ok) {
        setEditorError(
          result.reason === "rate_limit"
            ? buildRateLimitMessage(result.status, language)
            : result.reason === "cooldown"
              ? buildCooldownMessage(result.status, language)
              : result.message ?? ""
        );
        return;
      }
    }

    setEditorError("");
    setDraftText("");
    setDraftKind("own");
    setEditingPost(null);
    setModalOpen(false);
  }

  function confirmDeletePost(id: string) {
    Alert.alert(deletePostConfirmText.title[language], deletePostConfirmText.message[language], [
      { text: deletePostConfirmText.cancel[language], style: "cancel" },
      { text: deletePostConfirmText.confirm[language], style: "destructive", onPress: () => deletePost(id) }
    ]);
  }

  return (
    <AppChrome
      title={uiCopy.feedDiscover[language]}
      eyebrow="Art Atlas"
      floatingCreateAction={canUseMemberFeatures ? {
        label: t(feedCopy.addPost, language),
        accessibilityHint: t(feedCopy.addPostHint, language),
        onPress: openNewPostModal
      } : undefined}
    >
      <PostEditorModal
        visible={modalOpen}
        editing={!!editingPost}
        draftText={draftText}
        draftKind={draftKind}
        setDraftText={(text) => setDraftText(text.slice(0, MAX_POST_LENGTH))}
        setDraftKind={setDraftKind}
        onClose={() => setModalOpen(false)}
        onSubmit={submitPost}
        errorText={editorError}
        limitStatus={postLimitStatus}
        language={language}
        styles={styles}
        colors={colors}
      />

      <View style={styles.languageTabs}>
        {feedLanguageFilterItems(language).map((item) => (
          <Pressable key={item.id} onPress={() => setFeedLanguage(item.id)} style={[styles.languageTab, feedLanguage === item.id && styles.languageTabActive]}>
            <Text style={[styles.languageTabText, feedLanguage === item.id && styles.languageTabTextActive]}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.sectionTabs}>
        {([
          { id: "new" as const, icon: "sparkles-outline" as const, label: t(feedCopy.newPosts, language) },
          { id: "premium" as const, icon: "diamond-outline" as const, label: t(feedCopy.premium, language) },
          { id: "popular" as const, icon: "flame-outline" as const, label: t(feedCopy.popular, language) },
          { id: "contributors" as const, icon: "podium-outline" as const, label: t(feedCopy.contributors, language) }
        ]).map((item) => (
          <Pressable key={item.id} onPress={() => setSection(item.id)} style={[styles.sectionTab, section === item.id && styles.sectionTabActive]}>
            <Ionicons name={item.icon} size={14} color={section === item.id ? "#ffffff" : v2Colors.textMuted} />
            <Text style={[styles.sectionTabText, section === item.id && styles.sectionTabTextActive]} numberOfLines={2}>{item.label}</Text>
          </Pressable>
        ))}
      </View>

      {section === "contributors" ? (
        <View style={styles.contributorList}>
          {visibleContributors.map((item, index) => (
            <ContributorRow key={item.username} item={item} index={index} language={language} styles={styles} colors={colors} />
          ))}
        </View>
      ) : (
        <View style={styles.feedList}>
          {visiblePosts.map((post, index) => (
            <View key={post.id} style={styles.feedItemWrap}>
              <DiscoveryPostCard
                post={post}
                authorIsPremium={isActivePremiumAuthor(post.username, premiumUsernames)}
                liked={likedIds.includes(post.id)}
                favorited={favoriteIds.includes(post.id)}
                isOwner={isAuthoredByPost(post, account)}
                onDelete={() => confirmDeletePost(post.id)}
                onEdit={() => openEditPostModal(post)}
                onToggleFavorite={() => toggleFavorite(post.id)}
                onToggleHidden={() => toggleHidden(post.id)}
                onToggleLike={() => toggleLike(post.id)}
                commentCount={(commentsByPost[post.id] ?? []).length}
                language={language}
                styles={styles}
                colors={colors}
              />
              {visiblePosts.length && shouldShowFeedInlineAd(index, adSettings) ? <AdSlot label={t(commonCopy.adSpace, language)} placement="discover_inline" compact /> : null}
            </View>
          ))}
        </View>
      )}
      {showMoreButton ? (
        <Pressable onPress={handleShowMore} disabled={loadingMorePosts} style={[styles.moreButton, loadingMorePosts && styles.moreButtonDisabled]}>
          <Text style={styles.moreText}>
            {loadingMorePosts ? t(commonCopy.loading, language) : t(commonCopy.showMore, language)}
          </Text>
        </Pressable>
      ) : null}
    </AppChrome>
  );
}

type Contributor = {
  authorId?: string;
  author: string;
  username: string;
  authorPhotoURL?: string;
  count: number;
  isPremium?: boolean;
  countryCode?: string;
};

function getTopContributors(activePosts: DiscoveryPost[], premiumUsernames: Set<string>, lookupUserCountry: (keys: (string | undefined | null)[]) => string | null): Contributor[] {
  const map = new Map<string, Contributor>();

  activePosts.forEach((post) => {
    const authorIsPremium = isActivePremiumAuthor(post.username, premiumUsernames);
    const current = map.get(post.username);
    if (current) {
      map.set(post.username, {
        ...current,
        count: current.count + 1,
        isPremium: current.isPremium || authorIsPremium,
        authorPhotoURL: current.authorPhotoURL || post.authorPhotoURL
      });
      return;
    }

    map.set(post.username, {
      author: post.author,
      authorId: post.authorId,
      username: post.username,
      authorPhotoURL: post.authorPhotoURL,
      count: 1,
      isPremium: authorIsPremium,
      countryCode: lookupUserCountry([post.username, post.author, post.authorId]) ?? undefined
    });
  });

  return [...map.values()].sort((a, b) => b.count - a.count || a.author.localeCompare(b.author, "tr"));
}

function ContributorRow({ item, index, language, styles, colors }: {
  item: Contributor;
  index: number;
  language: "tr" | "en" | "ru" | "uz";
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof getThemeColors>;
}) {
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push({ pathname: "/profile/[name]", params: { name: profileRouteParam({ username: item.username, displayName: item.author, uid: item.authorId }) } })} style={[styles.contributorRow, item.isPremium && styles.premiumContributorRow]}>
      <View style={styles.contributorRank}>
        <Text style={styles.contributorRankText}>{index + 1}</Text>
      </View>
      <View style={styles.contributorAvatar}>
        <ProfileAvatar uri={item.authorPhotoURL} size={28} />
      </View>
      <View style={styles.contributorInfo}>
        <View style={styles.authorRow}>
          <UserNameWithCountry name={item.author} username={item.username} countryCode={item.countryCode} nameStyle={styles.contributorName} />
          {item.isPremium ? <Ionicons name="diamond" size={13} color={colors.gold} /> : null}
        </View>
        <Text style={styles.contributorUsername}>@{item.username}</Text>
      </View>
      <View style={styles.contributorCount}>
        <Text style={styles.contributorCountValue}>{item.count}</Text>
        <Text style={styles.contributorCountLabel}>{t(feedCopy.activePosts, language)}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

export function PostEditorModal({ visible, editing, draftText, draftKind, setDraftText, setDraftKind, onClose, onSubmit, errorText, limitStatus, language, styles, colors }: {
  visible: boolean;
  editing: boolean;
  draftText: string;
  draftKind: PostKind;
  setDraftText: (text: string) => void;
  setDraftKind: (kind: PostKind) => void;
  onClose: () => void;
  onSubmit: () => void;
  errorText?: string;
  limitStatus?: RateLimitStatus;
  language: "tr" | "en" | "ru" | "uz";
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof getThemeColors>;
}) {
  const [, setClockTick] = useState(0);

  useEffect(() => {
    if (!visible) return undefined;
    const timer = setInterval(() => setClockTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [visible]);

  const now = Date.now();
  const cooldownActive = !editing && isPostCooldownActive(limitStatus, now);
  const cooldownText = cooldownActive ? buildCooldownMessage(limitStatus, language, now) : "";
  const limitWarningText = limitStatus?.showWarning ? buildLimitStatusText(limitStatus, language, now) : "";
  const blockingError = errorText && !cooldownActive ? errorText : "";

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <View style={styles.modalPanel}>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalPanelContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editing ? t(feedCopy.editPost, language) : t(feedCopy.addPost, language)}</Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={21} color={colors.ivory} />
              </Pressable>
            </View>
            <TextInput
              value={draftText}
              onChangeText={setDraftText}
              multiline
              maxLength={MAX_POST_LENGTH}
              placeholder={t(feedCopy.postPlaceholder, language)}
              placeholderTextColor={colors.muted}
              style={styles.postInput}
            />
            <Text style={styles.charCounter}>{draftText.length} / {MAX_POST_LENGTH}</Text>
            {limitWarningText ? (
              <View style={styles.editorNotice}>
                <Ionicons name="information-circle-outline" size={16} color={colors.gold} />
                <Text style={styles.editorNoticeText}>{limitWarningText}</Text>
              </View>
            ) : null}
            <View style={styles.kindGrid}>
              {(Object.keys(kindLabels) as PostKind[]).map((kind) => (
                <Pressable key={kind} onPress={() => setDraftKind(kind)} style={[styles.kindChip, draftKind === kind && styles.kindChipActive]}>
                  <Text style={[styles.kindChipText, draftKind === kind && styles.kindChipTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.74}>{kindLabels[kind][language]}</Text>
                </Pressable>
              ))}
            </View>
            {cooldownText ? (
              <View style={styles.editorNotice}>
                <Ionicons name="timer-outline" size={16} color={colors.gold} />
                <Text style={styles.editorNoticeText}>{cooldownText}</Text>
              </View>
            ) : null}
            {blockingError ? <Text style={styles.editorErrorText}>{blockingError}</Text> : null}
            <Pressable disabled={cooldownActive} onPress={onSubmit} style={[styles.submitButton, cooldownActive && styles.submitButtonDisabled]}>
              <Text style={styles.submitText}>{editing ? t(commonCopy.update, language) : t(feedCopy.publishPost, language)}</Text>
            </Pressable>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export function DiscoveryPostCard({ post, authorIsPremium, liked, favorited = false, isOwner, commentCount = 0, onDelete, onEdit, onShare, onToggleFavorite, onToggleHidden, onToggleLike, language, styles, colors }: {
  post: DiscoveryPost;
  authorIsPremium?: boolean;
  liked: boolean;
  favorited?: boolean;
  isOwner: boolean;
  commentCount?: number;
  onDelete?: () => void;
  onEdit?: () => void;
  onShare?: () => void;
  onToggleFavorite?: () => void;
  onToggleHidden?: () => void;
  onToggleLike?: () => void;
  language: "tr" | "en" | "ru" | "uz";
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof getThemeColors>;
}) {
  const router = useRouter();
  const { account, isAuthenticated } = useAccount();
  const { suggestedUsers } = useSocial();
  const { blockUser } = useMessaging();
  const lookupUserCountry = useCountryCodeLookup();
  const authorCountryCode = lookupUserCountry([post.username, post.author, post.authorId]);
  const authorPhotoURL = post.authorPhotoURL?.trim()
    || (isOwner ? account.avatar : undefined)
    || suggestedUsers.find((user) => user.uid === post.authorId || user.username === post.username)?.image
    || "";
  const [copied, setCopied] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [blockSubmitting, setBlockSubmitting] = useState(false);
  const shouldTrim = post.text.length > PREVIEW_LENGTH;
  const previewText = shouldTrim ? `${post.text.slice(0, PREVIEW_LENGTH).trim()}...` : post.text;
  const canReport = isAuthenticated;
  const showPremiumAuthor = authorIsPremium ?? Boolean(post.isPremium);
  const profileLinked = !post.profileLinkDisabled && Boolean(post.authorId || post.username);
  const postAuthorId = post.authorId ?? suggestedUsers.find((user) => user.username === post.username)?.uid;

  function openAuthorProfile() {
    if (!profileLinked) return;
    router.push({ pathname: "/profile/[name]", params: { name: profileRouteParam({ username: post.username, displayName: post.author, uid: post.authorId }) } });
  }

  function openPost() {
    router.push({ pathname: "/post/[id]", params: { id: post.id } });
  }

  async function handleShare() {
    await Clipboard.setStringAsync(Linking.createURL(`/post/${post.id}`));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    if (onShare) {
      onShare();
    }
  }

  async function reportPost() {
    const reason = reportReason.trim();
    const reporterId = firebaseAuth.currentUser?.uid;
    if (!reporterId || !reason) {
      Alert.alert(
        t(feedCopy.reportMissingTitle, language),
        t(feedCopy.reportMissingBody, language)
      );
      return;
    }

    setReportSubmitting(true);
    try {
      await createReport({
        reporterId,
        targetType: "post",
        targetId: post.id,
        category: "content",
        subject: t(feedCopy.reportSubject, language),
        message: `Post: ${post.id}\nAuthor: ${post.author} (@${post.username})\nLink: ${Linking.createURL(`/post/${post.id}`)}\nReason: ${reason}`
      });
      setReportOpen(false);
      setReportReason("");
      Alert.alert(
        t(feedCopy.reportReceivedTitle, language),
        t(feedCopy.reportReceivedBody, language)
      );
    } catch {
      Alert.alert(
        t(feedCopy.reportFailedTitle, language),
        t(feedCopy.reportFailedBody, language)
      );
    } finally {
      setReportSubmitting(false);
    }
  }

  function confirmBlockUser() {
    if (!postAuthorId || blockSubmitting) return;
    Alert.alert(
      t(commonCopy.blockUserTitle, language),
      t(commonCopy.blockUserBody, language),
      [
        { text: t(commonCopy.cancel, language), style: "cancel" },
        {
          text: t(commonCopy.blockUser, language),
          style: "destructive",
          onPress: () => {
            setBlockSubmitting(true);
            void blockUser(postAuthorId)
              .then(() => Alert.alert(t(commonCopy.blockUser, language), t(commonCopy.blockUserSuccess, language)))
              .catch(() => Alert.alert(t(commonCopy.blockUser, language), t(commonCopy.blockUserFailed, language)))
              .finally(() => setBlockSubmitting(false));
          }
        }
      ]
    );
  }

  return (
    <View style={[styles.postCard, showPremiumAuthor && styles.premiumPostCard, post.hidden && styles.hiddenPostCard]}>
      <Modal visible={reportOpen} transparent animationType="fade" onRequestClose={() => setReportOpen(false)}>
        <View style={styles.reportModalBackdrop}>
          <View style={styles.reportModalPanel}>
            <View style={styles.reportModalHeader}>
              <Ionicons name="flag-outline" size={22} color={v2Colors.primary} />
              <Text style={styles.reportModalTitle}>{t(feedCopy.reportPost, language)}</Text>
              <Pressable onPress={() => setReportOpen(false)} style={styles.reportCloseButton}>
                <Ionicons name="close" size={20} color={colors.ivory} />
              </Pressable>
            </View>
            {canReport ? (
              <>
                <Text style={styles.reportModalText}>
                  {t(feedCopy.reportHint, language)}
                </Text>
                <TextInput
                  value={reportReason}
                  onChangeText={setReportReason}
                  placeholder={t(feedCopy.reportReasonPlaceholder, language)}
                  placeholderTextColor={colors.muted}
                  style={styles.reportInput}
                  multiline
                />
                <Pressable onPress={reportPost} disabled={reportSubmitting} style={[styles.reportSubmitButton, reportSubmitting && styles.reportSubmitButtonDisabled]}>
                  <Text style={styles.reportSubmitText}>{t(commonCopy.report, language)}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.reportModalText}>
                  {t(feedCopy.reportSignInRequired, language)}
                </Text>
                <Pressable onPress={() => setReportOpen(false)} style={styles.reportSubmitButton}>
                  <Text style={styles.reportSubmitText}>{t(commonCopy.ok, language)}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </Modal>
      <View style={styles.postHeader}>
        {profileLinked ? (
          <Pressable onPress={openAuthorProfile}>
            <ProfileAvatar uri={authorPhotoURL} size={28} />
          </Pressable>
        ) : (
          <ProfileAvatar uri={authorPhotoURL} size={28} />
        )}
        {profileLinked ? (
          <Pressable onPress={openAuthorProfile} style={styles.postIdentity}>
            <View style={styles.authorRow}>
              <UserNameWithCountry name={post.author} username={post.username} uid={post.authorId} countryCode={authorCountryCode} nameStyle={styles.author} />
              {showPremiumAuthor ? <Ionicons name="diamond" size={10} color={v2Colors.premium} /> : null}
            </View>
            <Text style={styles.postMeta}>@{post.username}</Text>
          </Pressable>
        ) : (
          <View style={styles.postIdentity}>
            <View style={styles.authorRow}>
              <UserNameWithCountry name={post.author} username={post.username} uid={post.authorId} countryCode={authorCountryCode} nameStyle={styles.author} />
              {showPremiumAuthor ? <Ionicons name="diamond" size={10} color={v2Colors.premium} /> : null}
            </View>
            {post.username ? <Text style={styles.postMeta}>@{post.username}</Text> : null}
          </View>
        )}
        <View style={styles.kindPill}>
          <Text style={styles.kindText} numberOfLines={1}>{kindLabels[post.kind][language]}</Text>
        </View>
      </View>
      {post.hidden ? <Text style={styles.hiddenText}>{t(feedCopy.hiddenPost, language)}</Text> : null}
      <Pressable onPress={openPost} style={styles.postBodyTap}>
        <Text style={styles.postText}>{previewText}</Text>
        {shouldTrim ? <Text style={styles.readMoreInline}>{t(commonCopy.readMore, language)}</Text> : null}
      </Pressable>
      <View style={styles.actionRow}>
        <Pressable onPress={onToggleLike} hitSlop={8} style={[styles.likeButton, liked && styles.likeButtonActive]}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={16} color={liked ? "#ffffff" : v2Colors.primary} />
          <Text style={[styles.likeText, liked && styles.likeTextActive]}>{post.likes}</Text>
        </Pressable>
        {copied ? <Text style={styles.copiedInline}>{t(commonCopy.copied, language)}</Text> : null}
        <View style={styles.actionGroup}>
          <Pressable onPress={handleShare} hitSlop={8} style={styles.iconActionButton} accessibilityLabel={t(commonCopy.share, language)}>
            <Ionicons name="share-social-outline" size={16} color={v2Colors.primary} />
          </Pressable>
          <Pressable onPress={onToggleFavorite} hitSlop={8} style={[styles.iconActionButton, favorited && styles.iconActionButtonActive]} accessibilityLabel={t(commonCopy.favorite, language)}>
            <Ionicons name={favorited ? "bookmark" : "bookmark-outline"} size={16} color={favorited ? "#ffffff" : v2Colors.primary} />
          </Pressable>
          <Pressable onPress={() => router.push({ pathname: "/post/[id]", params: { id: post.id } })} hitSlop={8} style={styles.commentActionButton} accessibilityLabel={commentActionLabels[language]}>
            <Ionicons name="chatbubble-outline" size={16} color={v2Colors.primary} />
            {commentCount ? <Text style={styles.commentCount}>{commentCount}</Text> : null}
          </Pressable>
          {!isOwner ? (
            <>
              <Pressable onPress={() => setReportOpen(true)} hitSlop={8} style={[styles.iconActionButton, !canReport && styles.reportButtonLocked]} accessibilityLabel={t(commonCopy.report, language)}>
                <Ionicons name="flag-outline" size={16} color={v2Colors.primary} />
              </Pressable>
              {postAuthorId && isAuthenticated ? (
                <Pressable onPress={confirmBlockUser} hitSlop={8} disabled={blockSubmitting} style={[styles.iconActionButton, blockSubmitting && styles.reportButtonLocked]} accessibilityLabel={t(commonCopy.blockUser, language)}>
                  <Ionicons name="ban-outline" size={16} color={v2Colors.primary} />
                </Pressable>
              ) : null}
            </>
          ) : null}
          {isOwner ? (
            <>
              <Pressable onPress={onEdit} hitSlop={8} style={styles.iconActionButton} accessibilityLabel={t(commonCopy.edit, language)}>
                <Ionicons name="create-outline" size={16} color={v2Colors.primary} />
              </Pressable>
              <Pressable onPress={onToggleHidden} hitSlop={8} style={styles.iconActionButton} accessibilityLabel={t(commonCopy.hide, language)}>
                <Ionicons name={post.hidden ? "eye-outline" : "eye-off-outline"} size={16} color={v2Colors.primary} />
              </Pressable>
              <Pressable onPress={onDelete} hitSlop={8} style={styles.iconActionButton} accessibilityLabel={t(commonCopy.delete, language)}>
                <Ionicons name="trash-outline" size={16} color={colors.wine} />
              </Pressable>
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

export function createStyles(colors: ReturnType<typeof getThemeColors>, theme: AppTheme = "dark") {
  return StyleSheet.create({
    languageTabs: { flexDirection: "row", gap: 6 },
    languageTab: {
      flex: 1,
      minHeight: 32,
      borderRadius: radii.pill,
      backgroundColor: v2Colors.surface1,
      borderWidth: 1,
      borderColor: v2Colors.border,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
      paddingVertical: 4
    },
    languageTabActive: { backgroundColor: v2Colors.primary, borderColor: v2Colors.primary },
    languageTabText: { color: colors.ivory, fontSize: 10.5, fontWeight: "800" },
    languageTabTextActive: { color: "#ffffff" },
    sectionTabs: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
    sectionTab: {
      width: "48.5%",
      minHeight: 40,
      borderRadius: radii.pill,
      backgroundColor: v2Colors.surface1,
      borderWidth: 1,
      borderColor: v2Colors.border,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingHorizontal: 8,
      paddingVertical: 5
    },
    sectionTabActive: { backgroundColor: v2Colors.primary, borderColor: v2Colors.primary },
    sectionTabText: { flex: 1, minWidth: 0, color: v2Colors.textSecondary, fontSize: 10.5, lineHeight: 13, fontWeight: "700", textAlign: "center", flexShrink: 1 },
    sectionTabTextActive: { color: "#ffffff" },
    shareToast: { minHeight: 34, borderRadius: 8, backgroundColor: colors.panelSoft, borderWidth: 1, borderColor: "rgba(217,184,101,0.26)", color: colors.gold, fontSize: 12, fontWeight: "900", textAlign: "center", textAlignVertical: "center", paddingVertical: 8, marginTop: 10 },
    feedList: { gap: 8, marginTop: 10 },
    feedItemWrap: { gap: 4 },
    postCard: {
      borderRadius: 17,
      backgroundColor: v2Colors.surface1,
      borderWidth: 1,
      borderColor: v2Colors.border,
      paddingHorizontal: 12,
      paddingVertical: 11,
      ...elevation(theme, "low")
    },
    premiumPostCard: { backgroundColor: "rgba(246,196,83,0.055)", borderColor: "rgba(246,196,83,0.28)" },
    hiddenPostCard: { opacity: 0.78 },
    postHeader: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 5 },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.panelSoft,
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.08)",
      alignItems: "center",
      justifyContent: "center"
    },
    avatarText: { color: colors.gold, fontWeight: "700", fontSize: 11 },
    postIdentity: { flex: 1, minWidth: 0 },
    authorRow: { flexDirection: "row", alignItems: "center", gap: 4 },
    author: { color: colors.ivory, fontSize: 11, fontWeight: "600", flexShrink: 1 },
    postMeta: { color: colors.muted, fontSize: 10, fontWeight: "400", marginTop: 1 },
    kindPill: {
      minHeight: 18,
      borderRadius: 999,
      backgroundColor: "rgba(217, 184, 101, 0.06)",
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.08)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
      paddingVertical: 2,
      maxWidth: 96
    },
    kindText: { color: colors.muted, fontSize: 9, fontWeight: "500" },
    hiddenText: { color: colors.gold, fontSize: 10, fontWeight: "600", marginBottom: 6 },
    postText: {
      color: colors.ivory,
      fontSize: 13.5,
      lineHeight: 20,
      fontWeight: "500"
    },
    postBodyTap: {
      marginTop: 0,
      marginBottom: 0,
      paddingVertical: 2,
      borderRadius: 8
    },
    readMoreInline: {
      color: colors.gold,
      fontWeight: "700",
      fontSize: 11,
      marginTop: 2
    },
    readMoreButton: { alignSelf: "flex-start", marginBottom: 2 },
    readMoreText: { color: colors.gold, fontWeight: "600", fontSize: 11 },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 7,
      flexWrap: "wrap"
    },
    actionGroup: {
      flexGrow: 1,
      flexShrink: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: 3,
      flexWrap: "wrap"
    },
    likeButton: {
      height: 26,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: v2Colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 7,
      flexShrink: 0
    },
    likeButtonActive: { backgroundColor: v2Colors.primary, borderColor: v2Colors.primary },
    likeText: { color: v2Colors.primary, fontWeight: "700", fontSize: 11 },
    likeTextActive: { color: "#ffffff" },
    iconActionButton: {
      width: 26,
      height: 26,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: v2Colors.border,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 2,
      flexShrink: 0
    },
    iconActionButtonActive: { backgroundColor: v2Colors.primary, borderColor: v2Colors.primary },
    commentActionButton: {
      height: 26,
      minWidth: 26,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: v2Colors.border,
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      paddingHorizontal: 5,
      flexShrink: 0
    },
    commentCount: { color: colors.muted, fontSize: 9, fontWeight: "700", marginLeft: 1 },
    shareButton: {
      height: 26,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.08)",
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      paddingHorizontal: 6,
      flexShrink: 0
    },
    shareText: { color: colors.gold, fontSize: 11, fontWeight: "500" },
    favoriteButtonActive: { backgroundColor: colors.gold, borderColor: colors.gold },
    favoriteTextActive: { color: colors.ink },
    reportButton: {
      width: 28,
      height: 28,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.08)",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0
    },
    reportButtonLocked: { opacity: 0.55 },
    reportModalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.58)", justifyContent: "center", padding: 18 },
    reportModalPanel: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 14, gap: 10 },
    reportModalHeader: { minHeight: 38, flexDirection: "row", alignItems: "center", gap: 8 },
    reportModalTitle: { color: colors.ivory, fontSize: 18, fontWeight: "900", flex: 1 },
    reportCloseButton: { width: 34, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    reportModalText: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: "800" },
    reportInput: { minHeight: 76, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, color: colors.ivory, fontSize: 13, lineHeight: 18, fontWeight: "800", padding: 10, textAlignVertical: "top" },
    reportSubmitButton: { minHeight: 44, borderRadius: radii.sm, backgroundColor: v2Colors.primary, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
    reportSubmitButtonDisabled: { opacity: 0.5 },
    reportSubmitText: { color: "#ffffff", fontWeight: "800" },
    copiedInline: { color: colors.gold, fontSize: 10, fontWeight: "600", flexShrink: 1 },
    ownerActions: { flexDirection: "row", gap: 4, flexWrap: "nowrap" },
    ownerButton: {
      width: 28,
      height: 28,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.08)",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
      flexShrink: 0
    },
    contributorList: { gap: 10, marginTop: 14 },
    contributorRow: { minHeight: 72, borderRadius: radii.md, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 10, padding: 12, ...elevation(theme, "low") },
    premiumContributorRow: { backgroundColor: hexAlpha(colors.gold, 0.1) },
    contributorRank: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.panelSoft, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
    contributorRankText: { color: colors.gold, fontSize: 12, fontWeight: "900" },
    contributorAvatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panelSoft, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
    contributorAvatarText: { color: colors.gold, fontWeight: "900" },
    contributorInfo: { flex: 1, minWidth: 0 },
    contributorName: { color: colors.ivory, fontSize: 14, fontWeight: "900", flexShrink: 1 },
    contributorUsername: { color: colors.gold, fontSize: 12, fontWeight: "800", marginTop: 2 },
    contributorCount: { minWidth: 74, minHeight: 42, borderRadius: 8, borderWidth: 1, borderColor: "rgba(217,184,101,0.24)", alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
    contributorCountValue: { color: colors.ivory, fontSize: 15, fontWeight: "900" },
    contributorCountLabel: { color: colors.muted, fontSize: 9, fontWeight: "800", textAlign: "center" },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.58)", justifyContent: "center", padding: 18 },
    modalPanel: { maxHeight: "88%", borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 14 },
    modalPanelContent: { gap: 12, paddingBottom: 4 },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    modalTitle: { color: colors.ivory, fontSize: 20, fontWeight: "900" },
    closeButton: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    postInput: { minHeight: 132, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, color: colors.ivory, fontSize: 15, lineHeight: 22, fontWeight: "700", padding: 12, textAlignVertical: "top" },
    charCounter: { color: colors.ivory, fontSize: 13, fontWeight: "800", textAlign: "right", marginTop: -4, opacity: 0.94 },
    editorNotice: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 8,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(210,184,121,0.38)",
      backgroundColor: "rgba(210,184,121,0.14)",
      paddingHorizontal: 12,
      paddingVertical: 10
    },
    editorNoticeText: { flex: 1, color: colors.gold, fontSize: 13, lineHeight: 19, fontWeight: "800" },
    limitText: { color: colors.gold, fontSize: 12, lineHeight: 17, fontWeight: "900" },
    editorErrorText: { color: "#efb4b4", fontSize: 13, lineHeight: 19, fontWeight: "800" },
    errorText: { color: "#efb4b4", fontSize: 12, lineHeight: 17, fontWeight: "900" },
    kindGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    kindChip: { minHeight: 36, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, alignItems: "center", justifyContent: "center", paddingHorizontal: 10 },
    kindChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
    kindChipText: { color: colors.ivory, fontWeight: "900", fontSize: 12 },
    kindChipTextActive: { color: colors.ink },
    submitButton: { minHeight: 48, borderRadius: radii.pill, backgroundColor: v2Colors.primary, alignItems: "center", justifyContent: "center", ...elevation(theme, "low") },
    submitButtonDisabled: { opacity: 0.55 },
    submitText: { color: "#ffffff", fontSize: 15, fontWeight: "800" },
    moreButton: { minHeight: 48, borderRadius: radii.pill, backgroundColor: v2Colors.primary, alignItems: "center", justifyContent: "center", marginTop: 14, ...elevation(theme, "low") },
    moreButtonDisabled: { opacity: 0.6 },
    moreText: { color: "#ffffff", fontSize: 14, fontWeight: "800" }
  });
}
