import { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { Alert, Animated, InteractionManager, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { DiscoveryPostCard, createStyles as createPostStyles } from "@/app/(tabs)/feed";
import { AppChrome } from "@/components/app-chrome";
import { ProfileAvatar } from "@/components/profile-avatar";
import { AuthRequired } from "@/components/auth-required";
import { UserNameWithCountry } from "@/components/user-name-with-country";
import { ArtworkGridCommentBadge } from "@/components/artwork-grid-comment-badge";
import { ImagePreviewModal } from "@/components/image-preview-modal";
import { CommunityArtworkPreviewFooter } from "@/components/community-artwork-preview-footer";
import { BadgeId, getBadgeItem, getRoleIcon, getRoleLabel, UserRoleId } from "@/constants/profile-taxonomy";
import { getThemeColors } from "@/constants/theme";
import { copy, countryCommunities } from "@/data/content";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useCommunityArt } from "@/hooks/use-community-art";
import { useArtSystems } from "@/hooks/use-art-systems";
import { useDiscoveryPosts } from "@/hooks/use-discovery-posts";
import { useLanguage } from "@/hooks/use-language";
import { useSocial } from "@/hooks/use-social";
import type { SuggestedUser } from "@/providers/social-provider";
import { useMessaging } from "@/hooks/use-messaging";
import { commonCopy, feedCopy } from "@/app/i18n/common";
import { t } from "@/utils/localized-text";
import { createReport } from "@/src/services/firebase/report-service";
import { belongsToProfileArtwork, belongsToProfileMuseum, belongsToProfilePost, isAuthoredByPost, isProfileVisibleArtwork, normalizeIdentityKey } from "@/utils/user-identity";
import { profileRouteParam } from "@/utils/profile-route";
import { isPremiumDataActive } from "@/utils/premium-status";
import { imageSource } from "@/utils/image-source";
import { resolveCountryCode, resolveCountryCodeFromUser, resolveCountryId } from "@/utils/country-utils";
import { findUserByIdentity, getUserDocumentFromServer, setUserSuspensionStatus, subscribeUserProfile } from "@/src/services/firebase/user-service";
import { UserProfileDocument } from "@/src/types/firestore";
import { msg, systemMessages } from "@/app/i18n/system-messages";
import { loadProfileCache, peekProfileCache, saveProfileCache } from "@/features/profile/profile-cache";
import { reconcileProfileHydration, type ProfileHydrationState } from "@/features/profile/profile-hydration";
import { recordProfileVisit } from "@/src/services/firebase/profile-visit-service";
import { useRuntimePerformanceMode } from "@/hooks/use-runtime-performance-mode";

const labels = {
  profile: { tr: "Profil", en: "Profile", ru: "Профиль", uz: "Profil" },
  posts: { tr: "Resimler", en: "Posts", ru: "Работы", uz: "Rasmlar" },
  noArtwork: {
    tr: "Bu profilde henüz paylaşılan görsel yok.",
    en: "This profile has not shared any visuals yet.",
    ru: "В этом профиле пока нет опубликованных изображений.",
    uz: "Bu profilda hali ulashilgan vizual yo'q."
  },
  artLover: { tr: "Sanatsever", en: "Art lover", ru: "Любитель искусства", uz: "San'atsevar" },
  artist: { tr: "Sanatçı", en: "Artist", ru: "Художник", uz: "San'atkor" },
  gallery: { tr: "Galeri", en: "Gallery", ru: "Галерея", uz: "Galereya" },
  defaultBio: {
    tr: "Bu kullanıcı henüz biyografi eklemedi.",
    en: "This user has not added a biography yet.",
    ru: "Пользователь пока не добавил биографию.",
    uz: "Bu foydalanuvchi hali biografiya qo'shmagan."
  },
  back: { tr: "Geri", en: "Back", ru: "Назад", uz: "Orqaga" },
  unfollow: { tr: "Takipten çıkar", en: "Unfollow", ru: "Отписаться", uz: "Kuzatishni bekor qilish" },
  follow: { tr: "Takip et", en: "Follow", ru: "Подписаться", uz: "Kuzatish" },
  following: { tr: "Takiptesin", en: "Following", ru: "Вы подписаны", uz: "Kuzatyapsiz" },
  sendMessage: { tr: "Mesaj gönder", en: "Send message", ru: "Написать", uz: "Xabar yuborish" },
  reportProfile: { tr: "Profili bildir", en: "Report profile", ru: "Пожаловаться на профиль", uz: "Profil haqida shikoyat" },
  suspendAccount: { tr: "Hesabı askıya al", en: "Suspend account", ru: "Заблокировать аккаунт", uz: "Hisobni to'xtatish" },
  unsuspendAccount: { tr: "Hesabı askıdan çıkar", en: "Unsuspend account", ru: "Разблокировать аккаунт", uz: "Hisobni tiklash" },
  suspendSuccess: { tr: "Hesap askıya alındı.", en: "Account suspended.", ru: "Аккаунт заблокирован.", uz: "Hisob to'xtatildi." },
  unsuspendSuccess: { tr: "Hesap askıdan çıkarıldı.", en: "Account unsuspended.", ru: "Аккаунт разблокирован.", uz: "Hisob tiklandi." },
  suspendFailed: { tr: "İşlem tamamlanamadı. Lütfen tekrar deneyin.", en: "Could not complete the action. Please try again.", ru: "Не удалось выполнить действие.", uz: "Amal bajarilmadi." },
  profileSuspendedNotice: {
    tr: "Bu hesap askıya alınmıştır. Profil içerikleri geçici olarak gizlenmiştir.",
    en: "This account is suspended. Profile content is temporarily hidden.",
    ru: "Аккаунт заблокирован. Контент профиля временно скрыт.",
    uz: "Bu hisob to'xtatilgan. Profil kontenti vaqtincha yashirilgan."
  },
  ownSuspendedNotice: {
    tr: "Hesabınız askıya alınmıştır. Paylaşımlarınız ve etkinlikleriniz geçici olarak gizlenmiştir.",
    en: "Your account is suspended. Your posts and activity are temporarily hidden.",
    ru: "Ваш аккаунт заблокирован. Публикации и активность временно скрыты.",
    uz: "Hisobingiz to'xtatilgan. Ulashuvlar va faolligingiz vaqtincha yashirilgan."
  },
  suggestedUsers: { tr: "Önerilen kullanıcılar", en: "Suggested users", ru: "Рекомендуемые пользователи", uz: "Tavsiya etilgan foydalanuvchilar" },
  followers: { tr: "Takipçi", en: "Followers", ru: "Подписчики", uz: "Kuzatuvchi" },
  followingCount: { tr: "Takip", en: "Following", ru: "Подписки", uz: "Kuzatish" }
};

export default function MemberProfileScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const postStyles = useMemo(() => createPostStyles(colors, theme), [colors, theme]);
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();
  const profileParam = Array.isArray(name) ? name[0] : name;
  const normalizedParam = normalizeIdentityKey(profileParam ?? "");
  const { account, isAuthenticated } = useAccount();
  const { items, loading: communityLoading, deleteSubmittedArtwork, commentsByArtwork } = useCommunityArt();
  const { posts, favoriteIds, likedIds, toggleFavorite, toggleLike } = useDiscoveryPosts();
  const { suggestedUsers, visibleSuggestedUsers, followUser, unfollowUser, isFollowing, getFollowersFor, getFollowingFor, patchSuggestedUser, watchFollowGraph } = useSocial();
  const { blockUser, hasBlockedUser, startConversationWith, unblockUser } = useMessaging();
  const { personalMuseums } = useArtSystems();
  const { width } = useWindowDimensions();
  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [socialListOpen, setSocialListOpen] = useState<null | "followers" | "following">(null);
  const [socialLinksOpen, setSocialLinksOpen] = useState(false);
  const [contentTab, setContentTab] = useState<"images" | "posts" | "favorites">("images");
  const [previewCopied, setPreviewCopied] = useState(false);
  const [previewArtworkNotice, setPreviewArtworkNotice] = useState("");
  const [museumNotice, setMuseumNotice] = useState("");
  const [profileSuspended, setProfileSuspended] = useState(false);
  const [suspendingProfile, setSuspendingProfile] = useState(false);
  const [profileHydration, setProfileHydration] = useState<ProfileHydrationState<UserProfileDocument>>(() => {
    const cachedProfile = peekProfileCache(profileParam ?? "");
    return {
      routeKey: normalizedParam,
      status: cachedProfile ? "cached" : "loading",
      profile: cachedProfile
    };
  });
  const [suggestedForProfile, setSuggestedForProfile] = useState<SuggestedUser[]>([]);
  const [profileRetryToken, setProfileRetryToken] = useState(0);
  const suggestionsLockedRef = useRef("");
  const profileRequestRef = useRef(0);

  const isRouteCurrentAccount =
    normalizeIdentityKey(account.username) === normalizedParam ||
    Boolean(account.uid && profileParam && account.uid === profileParam);
  const profileUser = suggestedUsers.find((user) =>
    normalizeIdentityKey(user.username) === normalizedParam ||
    normalizeIdentityKey(user.name) === normalizedParam ||
    Boolean(user.uid && profileParam && user.uid === profileParam)
  );
  const profileKnownUid = profileUser && (
    normalizeIdentityKey(profileUser.username) === normalizedParam
    || Boolean(profileUser.uid && profileParam && profileUser.uid === profileParam)
  ) ? profileUser.uid : undefined;
  const profileKnownUidRef = useRef(profileKnownUid);
  profileKnownUidRef.current = profileKnownUid;
  const activeHydration = profileHydration.routeKey === normalizedParam ? profileHydration : undefined;
  const fetchedProfileUser = activeHydration?.profile ?? null;
  const remoteProfileUser = fetchedProfileUser ? mapRemoteProfileUser(fetchedProfileUser) : undefined;
  const isCurrentAccount = isRouteCurrentAccount || Boolean(account.uid && fetchedProfileUser?.uid === account.uid);
  const resolvedProfileUser = isCurrentAccount ? undefined : remoteProfileUser;
  const profileDisplayName = isCurrentAccount ? account.displayName : resolvedProfileUser?.name ?? "";
  const profileUsername = isCurrentAccount ? account.username : resolvedProfileUser?.username ?? "";
  const profileUid = isCurrentAccount ? account.uid : resolvedProfileUser?.uid;
  const profilePhotoURL = isCurrentAccount ? account.avatar : resolvedProfileUser?.image;
  const profileIsAdmin = isCurrentAccount ? account.isAdmin : !!resolvedProfileUser?.isAdmin;
  const canManageSuspension = account.isAdmin && !isCurrentAccount && !!profileUid && !profileIsAdmin;
  const profileIsSuspended = !isCurrentAccount && !!resolvedProfileUser?.isDisabled;
  const profileBlocked = Boolean(!isCurrentAccount && profileUid && hasBlockedUser(profileUid));
  const hideProfileContent = (isCurrentAccount && account.isSuspended) || profileIsSuspended || profileBlocked;
  const followingProfile = isFollowing({ uid: profileUid, username: profileUsername });
  const profileBio = isCurrentAccount
    ? account.bio
    : resolvedProfileUser?.bio?.trim() || labels.defaultBio[language];
  const profileSocialLinks = isCurrentAccount ? account.socialLinks : resolvedProfileUser?.socialLinks;
  const artworks = useMemo(
    () => items.filter((item) => isProfileVisibleArtwork(item) && belongsToProfileArtwork(item, { uid: profileUid, username: profileUsername, displayName: profileDisplayName })),
    [items, profileDisplayName, profileUid, profileUsername]
  );
  const profilePosts = useMemo(
    () => posts.filter((post) => belongsToProfilePost(post, { uid: profileUid, username: profileUsername }) && (!post.hidden || isCurrentAccount)),
    [isCurrentAccount, posts, profileUid, profileUsername]
  );
  const favoritePosts = useMemo(
    () => posts.filter((post) => favoriteIds.includes(post.id) && !post.hidden),
    [favoriteIds, posts]
  );
  const selectedArtwork = selectedArtworkId ? items.find((item) => item.id === selectedArtworkId) ?? null : null;
  const bestNet = artworks.reduce((best, item) => Math.max(best, item.likes - item.dislikes), 0);
  const profileRole = isCurrentAccount ? account.role : resolvedProfileUser?.role ?? "art_lover";
  const roleLabel = getRoleLabel(profileRole, language);
  const profileLocation = isCurrentAccount
    ? [account.city, account.country].filter(Boolean).join(", ")
    : resolvedProfileUser?.city && resolvedProfileUser.country
      ? `${resolvedProfileUser.city}, ${resolvedProfileUser.country}`
      : resolvedProfileUser?.countryId
        ? countryCommunities.find((country) => country.id === resolvedProfileUser.countryId)?.name[language] ?? ""
        : resolvedProfileUser?.country ?? "";
  const profileCountryCode = isCurrentAccount
    ? resolveCountryCode(account.country)
    : resolveCountryCodeFromUser(resolvedProfileUser);
  const isPremiumProfile = isCurrentAccount ? account.isPremium : !!resolvedProfileUser?.isPremium;
  const badges = getProfileBadges(profileRole, isCurrentAccount ? account.totalScore : bestNet * 20, bestNet, language, isPremiumProfile, (isCurrentAccount ? account.badges : resolvedProfileUser?.badges)?.filter((badge) => badge !== "premium"));
  const followers = profileUid ? getFollowersFor(profileUid) : [];
  const followingList = profileUid ? getFollowingFor(profileUid) : [];
  const followerCount = isCurrentAccount
    ? Math.max(resolvedProfileUser?.followersCount ?? 0, followers.length)
    : Math.max(resolvedProfileUser?.followersCount ?? 0, followers.length);
  const followingCount = isCurrentAccount
    ? Math.max(resolvedProfileUser?.followingCount ?? 0, followingList.length)
    : Math.max(resolvedProfileUser?.followingCount ?? 0, followingList.length);
  const profileMuseum = personalMuseums.find((museum) => belongsToProfileMuseum(museum, { uid: profileUid, username: profileUsername }) && museum.active);
  const tileGap = width > 720 ? 8 : 4;
  const tileColumns = width > 840 ? 5 : width > 600 ? 4 : 3;
  const profileHorizontalPadding = width < 360 ? 16 : width > 720 ? 24 : 18;
  const tileSize = Math.floor((width - profileHorizontalPadding * 2 - tileGap * (tileColumns - 1)) / tileColumns);
  useEffect(() => {
    if (isCurrentAccount) {
      router.replace("/(tabs)/account");
    }
  }, [isCurrentAccount, router]);

  useEffect(() => {
    suggestionsLockedRef.current = "";
    setSuggestedForProfile([]);
  }, [profileParam]);

  useEffect(() => {
    if (isRouteCurrentAccount || !profileParam?.trim()) {
      return;
    }

    const routeKey = normalizeIdentityKey(profileParam);
    const requestId = profileRequestRef.current + 1;
    profileRequestRef.current = requestId;
    const knownProfileUid = profileKnownUidRef.current;
    const memoryProfile = peekProfileCache(profileParam, knownProfileUid);
    setProfileHydration({
      routeKey,
      status: memoryProfile ? "cached" : "loading",
      profile: memoryProfile
    });
    let unsubscribe: (() => void) | undefined;
    let subscribedUid = "";
    const knownUid = memoryProfile?.uid ?? knownProfileUid;
    const cachePromise = loadProfileCache(profileParam, knownUid).catch(() => memoryProfile);
    const serverProfilePromise = knownUid
      ? getUserDocumentFromServer(knownUid)
      : findUserByIdentity(profileParam);

    const startSubscription = (uid: string) => {
      if (subscribedUid === uid || profileRequestRef.current !== requestId) return;
      unsubscribe?.();
      subscribedUid = uid;
      unsubscribe = subscribeUserProfile(uid, (profile) => {
        if (profileRequestRef.current !== requestId || !profile || profile.uid !== uid) return;
        setProfileHydration((current) => reconcileProfileHydration(current, profileRequestRef.current, { requestId, routeKey, status: "hydrated", profile }));
        patchSuggestedUser(uid, suggestedUserPatchFromProfile(profile));
        void saveProfileCache(profile).catch(() => undefined);
      });
    };

    void cachePromise.then((cachedProfile) => {
      if (profileRequestRef.current !== requestId || !cachedProfile) return;
      setProfileHydration((current) => current.routeKey === routeKey && current.status === "hydrated"
        ? current
        : reconcileProfileHydration(current, profileRequestRef.current, { requestId, routeKey, status: "cached", profile: cachedProfile }));
      startSubscription(cachedProfile.uid);
    });

    void serverProfilePromise.then((serverProfile) => {
      if (profileRequestRef.current !== requestId) return;
      if (!serverProfile) {
        void cachePromise.then((cachedProfile) => {
          if (profileRequestRef.current !== requestId || cachedProfile) return;
          setProfileHydration((current) => reconcileProfileHydration(current, profileRequestRef.current, { requestId, routeKey, status: "missing", profile: null }));
        });
        return;
      }
      setProfileHydration((current) => reconcileProfileHydration(current, profileRequestRef.current, { requestId, routeKey, status: "hydrated", profile: serverProfile }));
      patchSuggestedUser(serverProfile.uid, suggestedUserPatchFromProfile(serverProfile));
      void saveProfileCache(serverProfile).catch(() => undefined);
      startSubscription(serverProfile.uid);
    }).catch((error) => {
      console.warn("[Profile] Core hydration failed.", firebaseErrorDetails(error));
      void cachePromise.then((cachedProfile) => {
        if (profileRequestRef.current !== requestId || cachedProfile) return;
        setProfileHydration((current) => reconcileProfileHydration(current, profileRequestRef.current, { requestId, routeKey, status: "error", profile: null }));
      });
    });

    return () => {
      if (profileRequestRef.current === requestId) profileRequestRef.current += 1;
      unsubscribe?.();
    };
  }, [isRouteCurrentAccount, patchSuggestedUser, profileParam, profileRetryToken]);

  useEffect(() => {
    const lockKey = profileParam ?? "";
    if (suggestionsLockedRef.current === lockKey && suggestedForProfile.length) return;
    if (!visibleSuggestedUsers.length) return;
    suggestionsLockedRef.current = lockKey;
    setSuggestedForProfile(
      visibleSuggestedUsers
        .filter((user) => user.uid !== profileUid && user.username !== profileUsername)
        .sort((left, right) => left.username.localeCompare(right.username, "tr"))
        .slice(0, 5)
    );
  }, [profileParam, profileUsername, suggestedForProfile.length, visibleSuggestedUsers]);

  useEffect(() => {
    if (profileUid) watchFollowGraph(profileUid);
  }, [profileUid, watchFollowGraph]);

  useEffect(() => {
    setProfileSuspended(!isCurrentAccount && !!resolvedProfileUser?.isDisabled);
  }, [isCurrentAccount, resolvedProfileUser?.isDisabled, profileUid]);

  useFocusEffect(useCallback(() => {
    if (!isAuthenticated || !account.uid || !profileUid || isCurrentAccount) return;
    let active = true;
    const task = InteractionManager.runAfterInteractions(() => {
      if (!active) return;
      void recordProfileVisit(profileUid).catch((error) => {
        console.warn("[Profile visits] Visit signal write failed.", firebaseErrorDetails(error));
      });
    });
    return () => {
      active = false;
      task.cancel();
    };
  }, [account.uid, isAuthenticated, isCurrentAccount, profileUid]));

  if (!isAuthenticated) {
    return <AuthRequired title={labels.profile[language]} />;
  }

  const profileCriticalReady = isCurrentAccount || Boolean(resolvedProfileUser && profileUid);
  if (!profileCriticalReady && activeHydration?.status !== "missing" && activeHydration?.status !== "error") {
    return (
      <AppChrome title={labels.profile[language]} eyebrow="Art Atlas" showTopAd={false}>
        <ProfileSkeleton styles={styles} />
      </AppChrome>
    );
  }

  if (!isCurrentAccount && activeHydration?.status === "error") {
    return (
      <AppChrome title={labels.profile[language]} eyebrow="Art Atlas" showTopAd={false}>
        <View style={styles.emptyCard}>
          <Ionicons name="cloud-offline-outline" size={28} color={colors.gold} />
          <Text style={styles.emptyText}>
            {language === "tr" ? "Profil şu anda yüklenemedi." : language === "ru" ? "Не удалось загрузить профиль." : language === "uz" ? "Profilni hozir yuklab bo'lmadi." : "The profile could not be loaded."}
          </Text>
          <Pressable onPress={() => setProfileRetryToken((value) => value + 1)} style={styles.profileRetryButton}>
            <Text style={styles.profileRetryText}>{language === "tr" ? "Tekrar dene" : language === "ru" ? "Повторить" : language === "uz" ? "Qayta urinish" : "Retry"}</Text>
          </Pressable>
        </View>
      </AppChrome>
    );
  }

  if (!isCurrentAccount && activeHydration?.status === "missing") {
    return (
      <AppChrome title={labels.profile[language]} eyebrow="Art Atlas" showTopAd={false}>
        <View style={styles.emptyCard}>
          <Ionicons name="person-outline" size={28} color={colors.gold} />
          <Text style={styles.emptyText}>{language === "tr" ? "Profil bulunamadı." : language === "ru" ? "Профиль не найден." : language === "uz" ? "Profil topilmadi." : "Profile not found."}</Text>
        </View>
      </AppChrome>
    );
  }

  function openMuseumOrNotice() {
    if (hideProfileContent) {
      setMuseumNotice(isCurrentAccount ? labels.ownSuspendedNotice[language] : labels.profileSuspendedNotice[language]);
      setTimeout(() => setMuseumNotice(""), 2200);
      return;
    }
    if (isCurrentAccount) {
      router.push("/my-museum");
      return;
    }
    if (profileMuseum) {
      router.push({ pathname: "/user-museum/[username]", params: { username: profileUsername } });
      return;
    }
    setMuseumNotice(language === "tr" ? "Kullanıcının müzesi yoktur." : language === "ru" ? "У пользователя нет музея." : language === "uz" ? "Foydalanuvchining muzeyi yo'q." : "This member has no museum.");
    setTimeout(() => setMuseumNotice(""), 1500);
  }

  async function toggleProfileSuspension() {
    if (!canManageSuspension || !profileUid || suspendingProfile) return;
    setProfileMenuOpen(false);
    setSuspendingProfile(true);
    const nextSuspended = !profileSuspended;
    try {
      await setUserSuspensionStatus(profileUid, nextSuspended);
      setProfileSuspended(nextSuspended);
      patchSuggestedUser(profileUid, { isDisabled: nextSuspended });
      Alert.alert(
        nextSuspended ? labels.suspendAccount[language] : labels.unsuspendAccount[language],
        nextSuspended ? labels.suspendSuccess[language] : labels.unsuspendSuccess[language]
      );
    } catch {
      Alert.alert(labels.suspendAccount[language], labels.suspendFailed[language]);
    } finally {
      setSuspendingProfile(false);
    }
  }

  async function submitProfileReport() {
    setProfileMenuOpen(false);
    if (!account.uid || !profileUid) {
      Alert.alert(t(feedCopy.reportFailedTitle, language), t(feedCopy.reportFailedBody, language));
      return;
    }
    try {
      await createReport({
        reporterId: account.uid,
        targetType: "profile",
        targetId: profileUid,
        category: "profile",
        subject: labels.reportProfile[language],
        message: `Reported profile: ${profileDisplayName} (@${profileUsername})\nUser ID: ${profileUid}\nLink: artatlas://profile/${encodeURIComponent(profileUsername || profileUid)}`
      });
      Alert.alert(t(feedCopy.reportReceivedTitle, language), t(feedCopy.reportReceivedBody, language));
    } catch {
      Alert.alert(t(feedCopy.reportFailedTitle, language), t(feedCopy.reportFailedBody, language));
    }
  }

  async function toggleUserBlock() {
    if (!profileUid) return;
    setProfileMenuOpen(false);
    if (profileBlocked) {
      try {
        await unblockUser(profileUid);
        Alert.alert(t(commonCopy.unblockUser, language), t(commonCopy.unblockUserSuccess, language));
      } catch {
        Alert.alert(t(commonCopy.unblockUser, language), t(commonCopy.blockUserFailed, language));
      }
      return;
    }
    Alert.alert(
      t(commonCopy.blockUserTitle, language),
      t(commonCopy.blockUserBody, language),
      [
        { text: t(commonCopy.cancel, language), style: "cancel" },
        {
          text: t(commonCopy.blockUser, language),
          style: "destructive",
          onPress: () => {
            void blockUser(profileUid)
              .then(() => Alert.alert(t(commonCopy.blockUser, language), t(commonCopy.blockUserSuccess, language)))
              .catch(() => Alert.alert(t(commonCopy.blockUser, language), t(commonCopy.blockUserFailed, language)));
          }
        }
      ]
    );
  }

  function closeArtworkPreview() {
    setSelectedArtworkId(null);
    setPreviewArtworkNotice("");
  }

  function handleDeleteProfileArtwork() {
    if (!selectedArtwork) return;
    const result = deleteSubmittedArtwork(selectedArtwork.id);
    if (!result.ok) {
      setPreviewArtworkNotice(result.message ?? msg(systemMessages.community.activeCompetitionDeleteBlocked, language));
      return;
    }
    closeArtworkPreview();
  }

  async function shareArtwork(id: string) {
    await Clipboard.setStringAsync(Linking.createURL(`/profile/${encodeURIComponent(profileUsername || profileDisplayName)}?artwork=${id}`));
    setPreviewCopied(true);
    setTimeout(() => setPreviewCopied(false), 1500);
  }

  return (
    <AppChrome title={labels.profile[language]} eyebrow="Art Atlas" showTopAd={false}>
      <ImagePreviewModal
        image={selectedArtwork?.image ?? null}
        onClose={closeArtworkPreview}
        footer={selectedArtwork ? (
          <CommunityArtworkPreviewFooter
            artwork={selectedArtwork}
            colors={colors}
            showOwnerActions={isCurrentAccount}
            onDelete={isCurrentAccount ? handleDeleteProfileArtwork : undefined}
            onShare={() => { void shareArtwork(selectedArtwork.id); }}
            shareCopied={previewCopied}
            notice={previewArtworkNotice}
          />
        ) : undefined}
      />
      <Modal visible={profileMenuOpen} transparent animationType="fade" onRequestClose={() => setProfileMenuOpen(false)}>
        <View style={styles.menuBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setProfileMenuOpen(false)} />
          <View style={styles.profileMenu}>
            {!isCurrentAccount && !profileBlocked ? (
              <Pressable
                onPress={() => {
                  void (followingProfile
                    ? unfollowUser({ uid: profileUid, username: profileUsername })
                    : followUser({ uid: profileUid, username: profileUsername })
                  ).then((result) => {
                    if (!result.ok && result.message) Alert.alert(labels.follow[language], result.message);
                  });
                  setProfileMenuOpen(false);
                }}
                style={styles.profileMenuRow}
              >
                <Ionicons name={followingProfile ? "person-remove-outline" : "person-add-outline"} size={18} color={colors.gold} />
                <Text style={styles.profileMenuText}>{followingProfile ? labels.unfollow[language] : labels.follow[language]}</Text>
              </Pressable>
            ) : null}
            {!isCurrentAccount && profileUid ? (
              <Pressable onPress={() => { void toggleUserBlock(); }} style={styles.profileMenuRow}>
                <Ionicons name={profileBlocked ? "checkmark-circle-outline" : "ban-outline"} size={18} color={colors.gold} />
                <Text style={styles.profileMenuText}>{t(profileBlocked ? commonCopy.unblockUser : commonCopy.blockUser, language)}</Text>
              </Pressable>
            ) : null}
            {canManageSuspension ? (
              <Pressable
                onPress={() => { void toggleProfileSuspension(); }}
                disabled={suspendingProfile}
                style={[styles.profileMenuRow, suspendingProfile && styles.profileMenuRowDisabled]}
              >
                <Ionicons name={profileSuspended ? "checkmark-circle-outline" : "ban-outline"} size={18} color={colors.gold} />
                <Text style={styles.profileMenuText}>
                  {profileSuspended ? labels.unsuspendAccount[language] : labels.suspendAccount[language]}
                </Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => { void submitProfileReport(); }}
              style={styles.profileMenuRow}
            >
              <Ionicons name="flag-outline" size={18} color={colors.gold} />
              <Text style={styles.profileMenuText}>{labels.reportProfile[language]}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <Modal visible={!!socialListOpen} transparent animationType="fade" onRequestClose={() => setSocialListOpen(null)}>
        <View style={styles.menuBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSocialListOpen(null)} />
          <View style={styles.socialListPanel}>
            <View style={styles.socialListHeader}>
              <Text style={styles.socialListTitle}>{socialListOpen === "followers" ? labels.followers[language] : labels.followingCount[language]}</Text>
              <Pressable onPress={() => setSocialListOpen(null)} style={styles.moreButton}>
                <Ionicons name="close" size={22} color={colors.ivory} />
              </Pressable>
            </View>
            {(socialListOpen === "followers" ? followers : followingList).map((user) => (
              <Pressable
                key={user.username}
                onPress={() => {
                  setSocialListOpen(null);
                  router.push({ pathname: "/profile/[name]", params: { name: profileRouteParam(user) } });
                }}
                style={styles.socialListRow}
              >
                <ProfileAvatar uri={user.image} size={42} />
                <View style={styles.socialListText}>
                  <UserNameWithCountry name={user.name} username={user.username} uid={user.uid} countryCode={resolveCountryCodeFromUser(user)} nameStyle={styles.socialListName} />
                  <Text style={styles.socialListUsername}>@{user.username}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
      <SocialLinksModal visible={socialLinksOpen} onClose={() => setSocialLinksOpen(false)} links={isCurrentAccount ? account.socialLinks : profileSocialLinks ?? account.socialLinks} styles={styles} colors={colors} language={language} />

      <View style={styles.profileHeader}>
        <View style={styles.profileTopBar}>
          <View style={styles.usernameRow}>
            <Text style={styles.username} numberOfLines={1}>@{profileUsername}</Text>
            <Ionicons name={getRoleIcon(profileRole)} size={15} color={colors.gold} />
          </View>
          <Pressable
            onPress={openMuseumOrNotice}
            style={[styles.museumIconButton, !profileMuseum && styles.museumIconMuted]}
            accessibilityLabel={language === "tr" ? "Müzesini gör" : "View museum"}
          >
            <Ionicons name="business-outline" size={18} color={colors.gold} />
          </Pressable>
          <Pressable onPress={() => setProfileMenuOpen(true)} style={styles.moreButton}>
            <Ionicons name="ellipsis-horizontal" size={22} color={colors.ivory} />
          </Pressable>
        </View>
        {museumNotice ? <Text style={styles.museumNotice}>{museumNotice}</Text> : null}

        <View style={styles.profileSummaryRow}>
          <ProfileAvatar uri={profilePhotoURL} size={84} borderColor="rgba(217, 184, 101, 0.42)" />
          <View style={styles.statsInline}>
            <View style={styles.statInline}>
              <Text style={styles.statInlineValue}>{artworks.length}</Text>
              <Text style={styles.statInlineLabel}>{labels.posts[language]}</Text>
            </View>
            <Pressable onPress={() => setSocialListOpen("followers")} style={styles.statInline}>
              <Text style={styles.statInlineValue}>{followerCount}</Text>
              <Text style={styles.statInlineLabel}>{labels.followers[language]}</Text>
            </Pressable>
            <Pressable onPress={() => setSocialListOpen("following")} style={styles.statInline}>
              <Text style={styles.statInlineValue}>{followingCount}</Text>
              <Text style={styles.statInlineLabel}>{labels.followingCount[language]}</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.bioBlock}>
          <UserNameWithCountry name={profileDisplayName} username={profileUsername} uid={profileUid} countryCode={profileCountryCode} nameStyle={styles.displayName} numberOfLines={2} />
          <BadgeRow badges={badges} styles={styles} colors={colors} />
          <Text style={styles.bio}>{profileBio}</Text>
          {profileLocation ? (
            <View style={styles.profileLocationRow}>
              <Ionicons name="location-outline" size={13} color={colors.gold} />
              <Text style={styles.profileLocationText} numberOfLines={1}>{profileLocation}</Text>
            </View>
          ) : null}
        </View>
        {isCurrentAccount ? (
          <>
            <View style={styles.compactProfileMetaRow}>
              <InfoPill icon="location-outline" text={`${account.city}, ${account.country}`} />
              <SocialIconRow links={account.socialLinks} styles={styles} colors={colors} onPress={() => setSocialLinksOpen(true)} language={language} />
            </View>
          </>
        ) : profileSocialLinks ? (
          <View style={styles.compactProfileMetaRow}>
            <SocialIconRow links={profileSocialLinks} styles={styles} colors={colors} onPress={() => setSocialLinksOpen(true)} language={language} />
          </View>
        ) : null}

        {!isCurrentAccount && !profileBlocked ? (
          <View style={styles.actionRow}>
            <Pressable
              onPress={() => {
                void (followingProfile
                  ? unfollowUser({ uid: profileUid, username: profileUsername })
                  : followUser({ uid: profileUid, username: profileUsername })
                ).then((result) => {
                  if (!result.ok && result.message) Alert.alert(labels.follow[language], result.message);
                });
              }}
              style={styles.primaryProfileAction}
            >
              <Text style={styles.primaryProfileActionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.74}>{followingProfile ? labels.following[language] : labels.follow[language]}</Text>
            </Pressable>
            {profileUid ? (
              <Pressable
                onPress={() => router.push({
                  pathname: `/messages/${startConversationWith(profileUid)}`,
                  params: { recipientId: profileUid, username: profileUsername }
                } as never)}
                style={styles.messageProfileAction}
              >
                <Ionicons name="mail-outline" size={16} color={colors.gold} />
                <Text style={styles.messageProfileActionText} numberOfLines={1}>{labels.sendMessage[language]}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {hideProfileContent ? (
        <View style={styles.profileSuspendedNotice}>
          <Ionicons name="ban-outline" size={24} color={colors.gold} />
          <Text style={styles.profileSuspendedNoticeText}>
            {profileBlocked
              ? t(commonCopy.blockedProfileNotice, language)
              : isCurrentAccount
                ? labels.ownSuspendedNotice[language]
                : labels.profileSuspendedNotice[language]}
          </Text>
        </View>
      ) : null}

      {!hideProfileContent ? (
      <>
      <View style={styles.galleryHeader}>
        <Pressable onPress={() => setContentTab("images")} style={[styles.profileTabButton, contentTab === "images" && styles.profileTabButtonActive]}>
          <Ionicons name="grid-outline" size={16} color={contentTab === "images" ? colors.ink : colors.gold} />
          <Text style={[styles.profileTabText, contentTab === "images" && styles.profileTabTextActive]}>{labels.posts[language]}</Text>
        </Pressable>
        <Pressable onPress={() => setContentTab("posts")} style={[styles.profileTabButton, contentTab === "posts" && styles.profileTabButtonActive]}>
          <Ionicons name="document-text-outline" size={16} color={contentTab === "posts" ? colors.ink : colors.gold} />
          <Text style={[styles.profileTabText, contentTab === "posts" && styles.profileTabTextActive]}>
            {language === "tr" ? "Yazılar" : language === "ru" ? "Записи" : language === "uz" ? "Yozuvlar" : "Posts"}
          </Text>
        </Pressable>
        {isCurrentAccount ? (
          <Pressable onPress={() => setContentTab("favorites")} style={[styles.profileTabButton, contentTab === "favorites" && styles.profileTabButtonActive]}>
            <Ionicons name="bookmark-outline" size={16} color={contentTab === "favorites" ? colors.ink : colors.gold} />
            <Text style={[styles.profileTabText, contentTab === "favorites" && styles.profileTabTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>
              {language === "tr" ? "Favorilerim" : language === "ru" ? "Избранное" : language === "uz" ? "Sevimlilarim" : "Favorites"}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {contentTab === "images" ? communityLoading ? null : artworks.length ? (
        <View style={[styles.grid, { gap: tileGap }]}>
          {artworks.map((item) => (
            <Pressable key={item.id} onPress={() => { setPreviewArtworkNotice(""); setSelectedArtworkId(item.id); }} style={[styles.profileArtworkCard, { width: tileSize }]} accessibilityRole="button" accessibilityLabel={item.title}>
              <Image source={imageSource(item.image, "thumbnail")} style={[styles.tileImage, { width: tileSize, height: tileSize }]} contentFit="cover" cachePolicy="memory-disk" allowDownscaling />
              <View style={styles.profileArtworkTitleRow}>
                <Text style={styles.profileArtworkTitle} numberOfLines={1}>{item.title}</Text>
                <ArtworkGridCommentBadge count={(commentsByArtwork[item.id] ?? []).length} colors={colors} />
              </View>
            </Pressable>
          ))}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons name="image-outline" size={28} color={colors.gold} />
          <Text style={styles.emptyText}>{labels.noArtwork[language]}</Text>
        </View>
      ) : contentTab === "posts" ? profilePosts.length ? (
        <View style={postStyles.feedList}>
          {profilePosts.map((post) => (
            <DiscoveryPostCard
              key={post.id}
              post={post}
              liked={likedIds.includes(post.id)}
              favorited={favoriteIds.includes(post.id)}
              isOwner={isCurrentAccount}
              onToggleFavorite={() => toggleFavorite(post.id)}
              onToggleLike={() => toggleLike(post.id)}
              language={language}
              styles={postStyles}
              colors={colors}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons name="document-text-outline" size={28} color={colors.gold} />
          <Text style={styles.emptyText}>
            {language === "tr" ? "Bu profilde henüz yazı yok." : language === "ru" ? "В этом профиле пока нет записей." : language === "uz" ? "Bu profilda hali yozuv yo'q." : "This profile has no posts yet."}
          </Text>
        </View>
      ) : favoritePosts.length ? (
        <View style={postStyles.feedList}>
          {favoritePosts.map((post) => (
            <DiscoveryPostCard
              key={post.id}
              post={post}
              liked={likedIds.includes(post.id)}
              favorited={favoriteIds.includes(post.id)}
              isOwner={isAuthoredByPost(post, account)}
              onToggleFavorite={() => toggleFavorite(post.id)}
              onToggleLike={() => toggleLike(post.id)}
              language={language}
              styles={postStyles}
              colors={colors}
            />
          ))}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Ionicons name="bookmark-outline" size={28} color={colors.gold} />
          <Text style={styles.emptyText}>
            {language === "tr" ? "Henüz favori yazı eklemedin." : language === "ru" ? "Пока нет избранных записей." : language === "uz" ? "Hali sevimli yozuv yo'q." : "No favorite posts yet."}
          </Text>
        </View>
      )}
      </>
      ) : null}
      <View style={styles.suggestedPanel}>
        <Text style={styles.suggestedTitle}>{labels.suggestedUsers[language]}</Text>
        {suggestedForProfile.map((user) => (
          <View key={user.username} style={styles.suggestedRow}>
            <Pressable onPress={() => router.push({ pathname: "/profile/[name]", params: { name: profileRouteParam(user) } })} style={styles.suggestedIdentity}>
              <ProfileAvatar uri={user.image} size={42} />
              <View style={styles.suggestedTextBlock}>
                <UserNameWithCountry name={user.name} username={user.username} uid={user.uid} countryCode={resolveCountryCodeFromUser(user)} nameStyle={styles.suggestedName} />
                <Text style={styles.suggestedUsername}>@{user.username}</Text>
              </View>
            </Pressable>
            <Pressable onPress={() => {
              void (isFollowing({ uid: user.uid, username: user.username })
                ? unfollowUser({ uid: user.uid, username: user.username })
                : followUser({ uid: user.uid, username: user.username })
              ).then((result) => {
                if (!result.ok && result.message) Alert.alert(labels.follow[language], result.message);
              });
            }} style={styles.suggestedFollow}>
              <Text style={styles.suggestedFollowText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                {isFollowing({ uid: user.uid, username: user.username }) ? labels.following[language] : labels.follow[language]}
              </Text>
            </Pressable>
          </View>
        ))}
      </View>
    </AppChrome>
  );
}

function ProfileSkeleton({ styles }: { styles: ReturnType<typeof createStyles> }) {
  const pulse = useRef(new Animated.Value(0)).current;
  const animate = useRuntimePerformanceMode() === "full";

  useEffect(() => {
    pulse.stopAnimation();
    pulse.setValue(0.35);
    if (!animate) return undefined;
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 760, useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 760, useNativeDriver: true })
    ]));
    animation.start();
    return () => animation.stop();
  }, [animate, pulse]);

  return (
    <Animated.View style={{ opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.52, 0.82] }) }} accessibilityLabel="Profile loading">
      <View style={styles.profileHeader}>
        <View style={styles.profileTopBar}>
          <View style={[styles.skeletonBlock, styles.skeletonUsername]} />
          <View style={[styles.skeletonBlock, styles.skeletonIcon]} />
          <View style={[styles.skeletonBlock, styles.skeletonIcon]} />
        </View>
        <View style={styles.profileSummaryRow}>
          <View style={[styles.skeletonBlock, styles.skeletonAvatar]} />
          <View style={styles.statsInline}>
            {[0, 1, 2].map((item) => (
              <View key={item} style={styles.statInline}>
                <View style={[styles.skeletonBlock, styles.skeletonStatValue]} />
                <View style={[styles.skeletonBlock, styles.skeletonStatLabel]} />
              </View>
            ))}
          </View>
        </View>
        <View style={styles.bioBlock}>
          <View style={[styles.skeletonBlock, styles.skeletonName]} />
          <View style={[styles.skeletonBlock, styles.skeletonBadge]} />
          <View style={[styles.skeletonBlock, styles.skeletonBio]} />
          <View style={[styles.skeletonBlock, styles.skeletonBioShort]} />
        </View>
        <View style={styles.actionRow}>
          <View style={[styles.skeletonBlock, styles.skeletonAction]} />
          <View style={[styles.skeletonBlock, styles.skeletonAction]} />
        </View>
      </View>
      <View style={styles.galleryHeader}>
        <View style={[styles.skeletonBlock, styles.skeletonTab]} />
        <View style={[styles.skeletonBlock, styles.skeletonTab]} />
      </View>
      <View style={[styles.skeletonBlock, styles.skeletonContent]} />
    </Animated.View>
  );
}

function InfoPill({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.infoPill}>
      <Ionicons name={icon} size={14} color={colors.gold} />
      <Text style={styles.infoPillText} numberOfLines={1}>{text}</Text>
    </View>
  );
}

function firebaseErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") return { code: "unknown" };
  const code = "code" in error && typeof error.code === "string" ? error.code : "unknown";
  const message = "message" in error && typeof error.message === "string" ? error.message : undefined;
  return { code, message };
}

type ProfileBadge = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

function suggestedUserPatchFromProfile(doc: UserProfileDocument): Partial<SuggestedUser> {
  const mapped = mapRemoteProfileUser(doc);
  return {
    name: mapped.name,
    username: mapped.username,
    image: mapped.image,
    role: mapped.role,
    badges: mapped.badges,
    isPremium: mapped.isPremium,
    isDisabled: mapped.isDisabled,
    isAdmin: mapped.isAdmin,
    country: mapped.country,
    countryId: mapped.countryId,
    countryCode: mapped.countryCode,
    followersCount: mapped.followersCount,
    followingCount: mapped.followingCount
  };
}

function mapRemoteProfileUser(doc: UserProfileDocument) {
  const badges = Array.from(new Set([
    ...(Array.isArray(doc.adminBadges) ? doc.adminBadges : []),
    ...(Array.isArray(doc.systemBadges) ? doc.systemBadges : [])
  ]
    .map((badge) => badge === "curator_pick" ? "editor_pick" : badge)
    .filter((badge): badge is BadgeId => badge !== "art_lover" && badge !== "artist" && Boolean(getBadgeItem(badge as BadgeId)))));

  return {
    uid: doc.uid,
    name: doc.displayName || doc.username,
    username: doc.username,
    image: doc.photoURL || "",
    role: mapRemoteProfileRole(doc.appRole ?? doc.role),
    badges,
    bio: doc.bio,
    city: doc.city,
    country: doc.country,
    countryId: resolveCountryId(doc.country),
    countryCode: doc.countryCode,
    socialLinks: doc.socialLinks,
    isPremium: isPremiumDataActive(doc),
    isDisabled: doc.isDisabled,
    isAdmin: doc.role === "admin",
    followersCount: doc.followersCount,
    followingCount: doc.followingCount
  };
}

function mapRemoteProfileRole(role: UserProfileDocument["role"] | UserProfileDocument["appRole"]): UserRoleId {
  if (role === "artist" || role === "curator" || role === "art_patron" || role === "verified_gallery" || role === "museum" || role === "critic" || role === "collector" || role === "researcher" || role === "educator") {
    return role;
  }
  return "art_lover";
}

function getProfileBadges(role: UserRoleId, totalScore: number, bestNet: number, language: "tr" | "en" | "ru" | "uz", isPremium = false, extraBadges: BadgeId[] = []): ProfileBadge[] {
  const badges: ProfileBadge[] = [
    ...(isPremium ? [{ label: getBadgeItem("premium")?.label[language] ?? "Premium", icon: getBadgeItem("premium")?.icon ?? "diamond" as const }] : []),
    { label: getRoleLabel(role, language), icon: getRoleIcon(role) }
  ];

  if (bestNet >= 25) {
    const badge = getBadgeItem("weekly_winner");
    if (badge) badges.push({ label: badge.label[language], icon: badge.icon });
  }

  if (totalScore >= 700) {
    const badge = getBadgeItem("quiz_master");
    if (badge) badges.push({ label: badge.label[language], icon: badge.icon });
  }

  extraBadges.forEach((badgeId) => {
    if (badgeId === "premium" && isPremium) return;
    const badge = getBadgeItem(badgeId);
    if (badge && !badges.some((item) => item.label === badge.label[language])) {
      badges.push({ label: badge.label[language], icon: badge.icon });
    }
  });

  return badges.slice(0, 6);
}

function BadgeRow({ badges, styles, colors }: { badges: ProfileBadge[]; styles: ReturnType<typeof createStyles>; colors: ReturnType<typeof getThemeColors> }) {
  return (
    <View style={styles.badgeRow}>
      {badges.map((badge) => (
        <View key={badge.label} style={styles.badgeChip}>
          <Ionicons name={badge.icon} size={13} color={colors.gold} />
          <Text style={styles.badgeText} numberOfLines={1}>{badge.label}</Text>
        </View>
      ))}
    </View>
  );
}

function SocialIconRow({ links, styles, colors, onPress, language }: {
  links: {
    instagram: string;
    x: string;
    facebook: string;
    website: string;
  };
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof getThemeColors>;
  onPress: () => void;
  language: "tr" | "en" | "ru" | "uz";
}) {
  const items = [
    { key: "instagram", icon: "logo-instagram" as const, value: links.instagram },
    { key: "x", icon: "logo-twitter" as const, value: links.x },
    { key: "facebook", icon: "logo-facebook" as const, value: links.facebook },
    { key: "website", icon: "globe-outline" as const, value: links.website }
  ].filter((item) => item.value.trim());

  if (!items.length) {
    return null;
  }

  return (
    <Pressable onPress={onPress} style={styles.socialNetworkButton}>
      <Text style={styles.socialNetworkLabel}>{language === "tr" ? "Sosyal ağlar" : language === "ru" ? "Социальные сети" : language === "uz" ? "Ijtimoiy tarmoqlar" : "Social networks"}</Text>
      <View style={styles.socialIconRow}>
        {items.map((item) => (
          <View key={item.key} style={styles.socialIconChip}>
            <Ionicons name={item.icon} size={16} color={colors.gold} />
          </View>
        ))}
      </View>
    </Pressable>
  );
}

function SocialLinksModal({ visible, onClose, links, styles, colors, language }: {
  visible: boolean;
  onClose: () => void;
  links: {
    instagram: string;
    x: string;
    facebook: string;
    website: string;
  };
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof getThemeColors>;
  language: "tr" | "en" | "ru" | "uz";
}) {
  const rows = [
    { label: "Instagram", value: links.instagram ? `instagram.com/${links.instagram.replace(/^@/, "")}` : "", icon: "logo-instagram" as const },
    { label: "X / Twitter", value: links.x ? `x.com/${links.x.replace(/^@/, "")}` : "", icon: "logo-twitter" as const },
    { label: "Facebook", value: links.facebook ? `facebook.com/${links.facebook.replace(/^@/, "")}` : "", icon: "logo-facebook" as const },
    { label: "Website", value: links.website, icon: "globe-outline" as const }
  ].filter((row) => row.value.trim());

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.menuBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.socialLinksPanel}>
          <View style={styles.socialListHeader}>
            <Text style={styles.socialListTitle}>{language === "tr" ? "Sosyal ağlar" : language === "ru" ? "Социальные сети" : language === "uz" ? "Ijtimoiy tarmoqlar" : "Social networks"}</Text>
            <Pressable onPress={onClose} style={styles.moreButton}>
              <Ionicons name="close" size={22} color={colors.ivory} />
            </Pressable>
          </View>
          {rows.map((row) => (
            <View key={row.label} style={styles.socialLinkRow}>
              <Ionicons name={row.icon} size={18} color={colors.gold} />
              <View style={styles.socialLinkTextBlock}>
                <Text style={styles.socialLinkLabel}>{row.label}</Text>
                <Text style={styles.socialLinkValue} numberOfLines={1}>{row.value}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </Modal>
  );
}

function makeUsername(name: string) {
  return name.trim().toLocaleLowerCase("tr").replace(/\s+/g, ".").replace(/[^a-z0-9ğüşöçıİ.]/gi, "");
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
return StyleSheet.create({
  backButton: {
    alignSelf: "flex-start",
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 12
  },
  backText: {
    color: colors.ivory,
    fontWeight: "900"
  },
  profileHeader: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 14,
    gap: 12
  },
  profileTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  usernameRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  moreButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  museumIconButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(217,184,101,0.34)",
    backgroundColor: colors.panelSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  museumIconMuted: {
    opacity: 0.62
  },
  museumNotice: {
    alignSelf: "flex-end",
    color: colors.gold,
    fontSize: 11,
    fontWeight: "900",
    marginTop: -6
  },
  profileSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18
  },
  avatar: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 1,
    borderColor: "rgba(217, 184, 101, 0.42)",
    backgroundColor: colors.panelSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  avatarImage: {
    width: "100%",
    height: "100%"
  },
  avatarLetter: {
    color: colors.gold,
    fontSize: 34,
    fontWeight: "900"
  },
  identity: {
    flex: 1
  },
  statsInline: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 8
  },
  statInline: {
    alignItems: "center",
    flex: 1
  },
  statInlineValue: {
    color: colors.ivory,
    fontSize: 18,
    fontWeight: "900"
  },
  statInlineLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
    textAlign: "center"
  },
  bioBlock: {
    gap: 3
  },
  displayName: {
    color: colors.ivory,
    fontSize: 18,
    fontWeight: "900",
    flexShrink: 1
  },
  displayNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  username: {
    color: colors.ivory,
    fontSize: 14,
    fontWeight: "900",
    flexShrink: 1
  },
  rolePill: {
    alignSelf: "flex-start",
    minHeight: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 9,
    marginTop: 8
  },
  roleText: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  bio: {
    color: colors.ivory,
    fontSize: 14,
    lineHeight: 20
  },
  profileLocationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3
  },
  profileLocationText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    flexShrink: 1
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 1
  },
  badgeChip: {
    minHeight: 24,
    maxWidth: "46%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(217,184,101,0.28)",
    backgroundColor: colors.panelSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 7
  },
  badgeText: {
    color: colors.ivory,
    fontSize: 10,
    fontWeight: "900",
    flexShrink: 1
  },
  socialIconRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7
  },
  socialNetworkButton: {
    alignSelf: "flex-start",
    minHeight: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 7
  },
  socialNetworkLabel: {
    color: colors.ivory,
    fontSize: 11,
    fontWeight: "900"
  },
  socialIconChip: {
    width: 32,
    height: 32,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14
  },
  profileMetaGrid: {
    gap: 8,
    marginTop: 12
  },
  compactProfileMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 7,
    marginTop: 6
  },
  socialGrid: {
    gap: 8,
    marginTop: 8
  },
  infoPill: {
    minHeight: 36,
    borderRadius: 8,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10
  },
  infoPillText: {
    color: colors.ivory,
    fontSize: 12,
    fontWeight: "800",
    flex: 1
  },
  actionRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 2
  },
  primaryProfileAction: {
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  primaryProfileActionText: {
    color: colors.ink,
    fontWeight: "900"
  },
  messageProfileAction: {
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.panelSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 10
  },
  messageProfileActionText: {
    color: colors.gold,
    fontWeight: "800",
    fontSize: 13
  },
  stat: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    padding: 10
  },
  statValue: {
    color: colors.ivory,
    fontSize: 20,
    fontWeight: "900"
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2
  },
  galleryHeader: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginTop: 14,
    marginBottom: 3
  },
  profileTabButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 10
  },
  profileTabButtonActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  profileTabText: {
    color: colors.ivory,
    fontSize: 12,
    fontWeight: "900"
  },
  profileTabTextActive: {
    color: colors.ink
  },
  menuBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.34)",
    paddingTop: 130,
    paddingHorizontal: 18
  },
  profileMenu: {
    marginLeft: "auto",
    width: 210,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 8
  },
  profileMenuRow: {
    minHeight: 42,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    paddingHorizontal: 10
  },
  profileMenuRowDisabled: {
    opacity: 0.55
  },
  profileMenuText: {
    color: colors.ivory,
    fontWeight: "900",
    flex: 1
  },
  socialListPanel: {
    maxHeight: "70%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 12,
    gap: 10
  },
  socialListHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  socialListTitle: {
    color: colors.ivory,
    fontSize: 18,
    fontWeight: "900",
    flex: 1
  },
  socialListRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 8
  },
  socialListAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21
  },
  socialListText: {
    flex: 1
  },
  socialListName: {
    color: colors.ivory,
    fontWeight: "900"
  },
  socialListUsername: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2
  },
  socialLinksPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 12,
    gap: 10
  },
  socialLinkRow: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: colors.panelSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10
  },
  socialLinkTextBlock: {
    flex: 1,
    minWidth: 0
  },
  socialLinkLabel: {
    color: colors.ivory,
    fontSize: 12,
    fontWeight: "900"
  },
  socialLinkValue: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  profileArtworkCard: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    overflow: "hidden",
    marginBottom: 3
  },
  profileArtworkTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    minHeight: 28,
    paddingHorizontal: 5,
    paddingVertical: 5
  },
  profileArtworkTitle: {
    color: colors.ivory,
    fontWeight: "900",
    flex: 1,
    fontSize: 10.5
  },
  tileImage: {
    borderTopLeftRadius: 7,
    borderTopRightRadius: 7
  },
  emptyCard: {
    minHeight: 132,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16
  },
  emptyText: {
    color: colors.muted,
    textAlign: "center",
    fontWeight: "800"
  },
  profileRetryButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  profileRetryText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900"
  },
  profileSuspendedNotice: {
    minHeight: 96,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(217, 184, 101, 0.28)",
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 18,
    marginBottom: 12
  },
  profileSuspendedNoticeText: {
    color: colors.muted,
    textAlign: "center",
    fontWeight: "800",
    lineHeight: 20
  },
  previewFooter: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(248, 240, 223, 0.16)",
    backgroundColor: "rgba(29, 23, 18, 0.9)",
    padding: 10,
    gap: 8
  },
  previewTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  previewOwner: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  previewTextBlock: {
    flex: 1
  },
  previewName: {
    color: colors.ivory,
    fontSize: 14,
    fontWeight: "900"
  },
  previewTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2
  },
  previewVotes: {
    flexDirection: "row",
    gap: 6
  },
  previewVoteButton: {
    minHeight: 36,
    minWidth: 54,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(217, 184, 101, 0.28)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 8
  },
  previewVoteActive: {
    backgroundColor: colors.gold
  },
  previewVoteText: {
    color: colors.gold,
    fontWeight: "900"
  },
  previewVoteTextActive: {
    color: colors.ink
  },
  previewCopiedText: {
    color: colors.gold,
    fontSize: 9,
    fontWeight: "900"
  },
  previewStory: {
    color: colors.ivory,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  previewMoreButton: {
    alignSelf: "flex-start"
  },
  previewMoreText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900"
  },
  previewDeleteButton: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(217, 184, 101, 0.28)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6
  },
  previewDeleteText: {
    color: colors.ivory,
    fontWeight: "900"
  },
  previewLockedText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700"
  },
  previewNoticeText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800"
  },
  suggestedPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 12,
    gap: 10,
    marginTop: 16
  },
  suggestedTitle: {
    color: colors.ivory,
    fontSize: 16,
    fontWeight: "900"
  },
  suggestedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  suggestedIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0
  },
  suggestedAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21
  },
  suggestedTextBlock: {
    flex: 1,
    minWidth: 0
  },
  suggestedName: {
    color: colors.ivory,
    fontWeight: "900"
  },
  suggestedUsername: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2
  },
  suggestedFollow: {
    width: 92,
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: colors.panelSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8
  },
  suggestedFollowText: {
    color: colors.ivory,
    fontSize: 12,
    fontWeight: "900"
  },
  skeletonBlock: {
    borderRadius: 8,
    backgroundColor: colors.panelSoft
  },
  skeletonUsername: {
    width: "42%",
    height: 16
  },
  skeletonIcon: {
    width: 36,
    height: 36
  },
  skeletonAvatar: {
    width: 84,
    height: 84,
    borderRadius: 42
  },
  skeletonStatValue: {
    width: 28,
    height: 20
  },
  skeletonStatLabel: {
    width: 46,
    height: 11,
    marginTop: 5
  },
  skeletonName: {
    width: "58%",
    height: 20
  },
  skeletonBadge: {
    width: "34%",
    height: 24,
    marginTop: 3
  },
  skeletonBio: {
    width: "96%",
    height: 14,
    marginTop: 4
  },
  skeletonBioShort: {
    width: "66%",
    height: 14
  },
  skeletonAction: {
    flex: 1,
    minHeight: 38
  },
  skeletonTab: {
    flex: 1,
    height: 38
  },
  skeletonContent: {
    minHeight: 132
  }
});
}
