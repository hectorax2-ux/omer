// Added Apple Sign In
import { useEffect, useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { firebaseAuth } from "@/src/services/firebase";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { AppChrome } from "@/components/app-chrome";
import { ProfileAvatar } from "@/components/profile-avatar";
import { UserNameWithCountry } from "@/components/user-name-with-country";
import { ArtworkGridCommentBadge } from "@/components/artwork-grid-comment-badge";
import { ImagePreviewModal } from "@/components/image-preview-modal";
import { CommunityArtworkPreviewFooter } from "@/components/community-artwork-preview-footer";
import { DiscoveryPostCard, PostEditorModal, createStyles as createPostStyles, kindLabels } from "@/app/(tabs)/feed";
import { msg, systemMessages } from "@/app/i18n/system-messages";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { legalUrls } from "@/constants/store-legal";
import { storeLegalTexts } from "@/constants/store-legal-platform";
import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  isValidDisplayName,
  isValidUsername,
  normalizeDisplayName,
  normalizeUsername
} from "@/constants/account-limits";
import { BadgeId, getBadgeItem, getRoleIcon, getRoleLabel, UserRoleId } from "@/constants/profile-taxonomy";
import { getThemeColors } from "@/constants/theme";
import { radii, v2Colors } from "@/constants/design";
import { copy, countryCommunities, uiCopy } from "@/data/content";
import { useAccount } from "@/hooks/use-account";
import { useGoogleSignIn, isGoogleSignInConfigured, getGoogleSignInConfigError } from "@/hooks/use-google-sign-in";
import { useArtSystems } from "@/hooks/use-art-systems";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useCommunityArt } from "@/hooks/use-community-art";
import { useDiscoveryPosts } from "@/hooks/use-discovery-posts";
import { useLanguage } from "@/hooks/use-language";
import { useLegal } from "@/hooks/use-legal";
import { useSocial } from "@/hooks/use-social";
import { useCountryLookup } from "@/providers/country-lookup-provider";
import { isAuthoredByPost, isOwnedArtwork, isOwnedMuseum, isProfileVisibleArtwork } from "@/utils/user-identity";
import { Language } from "@/types/content";
import { compressProfileImage } from "@/utils/image-compression";
import { uploadFormatHint, validatePickedImageAsset } from "@/utils/image-upload-validation";
import { buildLimitStatusText, buildRateLimitMessage, throttleAction, withinBurstLimit } from "@/utils/safety";
import { useRouter } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { resolveCountryCode, resolveCountryId } from "@/utils/country-utils";
import { isAppleCancelError, requestAppleSignInCredential } from "@/utils/apple-auth";

const BIO_MAX_LENGTH = 150;
const SOCIAL_LINK_MAX_LENGTH = 50;
const SOCIAL_EMAIL_MAX_LENGTH = 50;
const CITY_MAX_LENGTH = 30;
const PROFILE_IMAGE_STORY_MIN_LENGTH = 10;
const PROFILE_IMAGE_STORY_MAX_LENGTH = 300;

export default function AccountScreen() {
  const isFocused = useIsFocused();
  const { language } = useLanguage();
  const router = useRouter();
  const styles = useAccountStyles();
  const { width } = useWindowDimensions();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const postStyles = useMemo(() => createPostStyles(colors, theme), [colors, theme]);
  const { items, loading: communityLoading, addProfileArtwork, deleteSubmittedArtwork, getArtworkLimitStatus, submitArtwork, commentsByArtwork } = useCommunityArt();
  const { personalMuseums } = useArtSystems();
  const { posts, addPost, deletePost, favoriteIds, getPostLimitStatus, likedIds, toggleFavorite, toggleHidden, toggleLike, updatePost } = useDiscoveryPosts();
  const { getFollowersFor, getFollowingFor, unfollowUser, patchSuggestedUser, watchFollowGraph } = useSocial();
  const { upsertIdentity } = useCountryLookup();
  const {
    account,
    profileHydrated,
    profileHydrationError,
    isAuthenticated,
    canUseMemberFeatures,
    pendingVerificationEmail,
    login,
    register,
    verifyEmailCode,
    forgotPassword,
    signInWithGoogle,
    signInWithApple,
    saveAccountProfile,
    deleteAccount,
    updateAccount,
    logout,
    retryProfileHydration
  } = useAccount();
  const [username, setUsername] = useState(account.username);
  const [displayName, setDisplayName] = useState(account.displayName);
  const [bio, setBio] = useState(account.bio);
  const [password, setPassword] = useState(account.password);
  const [email, setEmail] = useState(account.email);
  const [avatar, setAvatar] = useState(account.avatar);
  const [country, setCountry] = useState(account.country);
  const [city, setCity] = useState(account.city);
  const [interests, setInterests] = useState(account.interests.join(", "));
  const [instagram, setInstagram] = useState(account.socialLinks.instagram);
  const [xLink, setXLink] = useState(account.socialLinks.x);
  const [facebook, setFacebook] = useState(account.socialLinks.facebook);
  const [website, setWebsite] = useState(account.socialLinks.website);
  const [socialEmail, setSocialEmail] = useState(account.socialLinks.email);
  const [isDiscoverableByCountry, setIsDiscoverableByCountry] = useState(account.isDiscoverableByCountry);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [museumNotice, setMuseumNotice] = useState("");
  const [profileUploadOpen, setProfileUploadOpen] = useState(false);
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [socialListOpen, setSocialListOpen] = useState<null | "followers" | "following">(null);
  const [socialLinksOpen, setSocialLinksOpen] = useState(false);
  const [profileContentTab, setProfileContentTab] = useState<"images" | "posts" | "favorites">("images");
  const [postModalOpen, setPostModalOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [postDraftText, setPostDraftText] = useState("");
  const [postDraftKind, setPostDraftKind] = useState<keyof typeof kindLabels>("own");
  const [postEditorError, setPostEditorError] = useState("");
  const [, setClockTick] = useState(0);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [profileImageTitle, setProfileImageTitle] = useState("");
  const [profileImageStory, setProfileImageStory] = useState("");
  const [profileImageLanguage, setProfileImageLanguage] = useState(language);
  const [profileImageCompetition, setProfileImageCompetition] = useState(false);
  const [profileImageError, setProfileImageError] = useState("");
  const [profileImageMessage, setProfileImageMessage] = useState("");
  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(null);
  const [previewCopied, setPreviewCopied] = useState(false);
  const [profileArtworkNotice, setProfileArtworkNotice] = useState("");
  const postLimitStatus = getPostLimitStatus(account.username);
  const artworkLimitStatus = getArtworkLimitStatus(account.username);
  const profileGridGap = width > 720 ? 8 : 4;
  const profileGridColumns = width > 840 ? 5 : width > 600 ? 4 : 3;
  const profileHorizontalPadding = width < 360 ? 16 : width > 720 ? 24 : 18;
  const profileArtworkSize = Math.floor((width - profileHorizontalPadding * 2 - profileGridGap * (profileGridColumns - 1)) / profileGridColumns);

  useEffect(() => {
    if (isFocused && account.uid) watchFollowGraph(account.uid);
  }, [account.uid, isFocused, watchFollowGraph]);

  function resetDraftFromAccount() {
    setUsername(account.username);
    setDisplayName(account.displayName);
    setBio(account.bio);
    setPassword(account.password);
    setEmail(account.email);
    setAvatar(account.avatar);
    setCountry(account.country);
    setCity(account.city);
    setInterests(account.interests.join(", "));
    setInstagram(account.socialLinks.instagram);
    setXLink(account.socialLinks.x);
    setFacebook(account.socialLinks.facebook);
    setWebsite(account.socialLinks.website);
    setSocialEmail(account.socialLinks.email);
    setIsDiscoverableByCountry(account.isDiscoverableByCountry);
    setSaved(false);
  }

  useEffect(() => {
    resetDraftFromAccount();
  }, [account.username, account.displayName, account.bio, account.password, account.email, account.avatar, account.country, account.city, account.interests, account.socialLinks, account.isDiscoverableByCountry]);

  useEffect(() => {
    if (!postModalOpen && !profileUploadOpen) return;
    const timer = setInterval(() => setClockTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [postModalOpen, profileUploadOpen]);

  async function saveAccount() {
    setAccountError("");
    if (!canUseMemberFeatures) {
      setAccountError("Profil düzenlemek için e-posta adresinizi doğrulayın.");
      return;
    }

    if (!isValidUsername(username)) {
      setAccountError(`Kullanıcı adı ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} karakter olmalı.`);
      return;
    }

    if (!isValidDisplayName(displayName)) {
      setAccountError(`İsim ${DISPLAY_NAME_MIN_LENGTH}-${DISPLAY_NAME_MAX_LENGTH} karakter olmalı.`);
      return;
    }

    if (!throttleAction("save_profile", 3000) || !withinBurstLimit("save_profile_burst", 12, 30 * 60 * 1000)) {
      setAccountError(language === "tr"
        ? "Profili çok sık güncelliyorsun. Lütfen kısa bir süre sonra tekrar dene."
        : language === "ru"
          ? "Вы слишком часто обновляете профиль. Повторите чуть позже."
          : language === "uz"
            ? "Profilni juda tez yangilayapsiz. Birozdan so'ng qayta urinib ko'ring."
            : "You are updating your profile too often. Please try again shortly.");
      return;
    }

    setSaving(true);
    const result = await saveAccountProfile({
      username: normalizeUsername(username),
      displayName: normalizeDisplayName(displayName),
      bio: bio.trim().slice(0, BIO_MAX_LENGTH),
      avatarUri: avatar,
      country,
      city: city.trim().slice(0, CITY_MAX_LENGTH),
      interests: interests.split(",").map((item) => item.trim()).filter(Boolean),
      socialLinks: {
        instagram: instagram.trim().slice(0, SOCIAL_LINK_MAX_LENGTH),
        x: xLink.trim().slice(0, SOCIAL_LINK_MAX_LENGTH),
        facebook: facebook.trim().slice(0, SOCIAL_LINK_MAX_LENGTH),
        website: website.trim().slice(0, SOCIAL_LINK_MAX_LENGTH),
        email: socialEmail.trim().slice(0, SOCIAL_EMAIL_MAX_LENGTH)
      },
      isProfileVisible: true,
      isDiscoverableByCountry
    });
    setSaving(false);

    if (!result.ok) {
      setAccountError(result.message);
      return;
    }

    if (account.uid) {
      const savedCountryCode = resolveCountryCode(country) ?? undefined;
      patchSuggestedUser(account.uid, {
        username: normalizeUsername(username),
        name: normalizeDisplayName(displayName),
        country,
        countryId: resolveCountryId(country),
        countryCode: savedCountryCode
      });
      upsertIdentity({
        uid: account.uid,
        username: normalizeUsername(username),
        name: normalizeDisplayName(displayName),
        country,
        countryId: resolveCountryId(country),
        countryCode: savedCountryCode
      });
    }

    setSaved(true);
  }

  async function confirmDeleteAccount(reauth?: { password?: string; googleIdToken?: string; appleIdentityToken?: string; appleRawNonce?: string }) {
    setDeleteError("");
    setDeleting(true);
    const result = await deleteAccount(reauth ?? { password: deletePassword });
    setDeleting(false);
    if (!result.ok) {
      setDeleteError(result.message);
      return;
    }
    setDeleteModalOpen(false);
    setEditMode(false);
    router.replace("/");
  }

  async function reauthAndDeleteWithGoogle(promptGoogleSignIn: () => Promise<{ idToken?: string; cancelled?: boolean; error?: string }>) {
    const googleResult = await promptGoogleSignIn();
    if (googleResult.cancelled) return;
    if (!googleResult.idToken) {
      setDeleteError(googleResult.error ?? "Google doğrulaması başarısız.");
      return;
    }
    await confirmDeleteAccount({ googleIdToken: googleResult.idToken });
  }

  async function reauthAndDeleteWithApple() {
    try {
      const appleSignIn = await requestAppleSignInCredential();
      if (!appleSignIn.credential.identityToken) {
        setDeleteError("Apple doğrulama bilgisi alınamadı.");
        return;
      }
      await confirmDeleteAccount({
        appleIdentityToken: appleSignIn.credential.identityToken,
        appleRawNonce: appleSignIn.rawNonce
      });
    } catch (error) {
      if (isAppleCancelError(error)) return;
      console.error("[Apple Sign In] Delete reauthentication failed.", error);
      setDeleteError("Apple doğrulaması tamamlanamadı.");
    }
  }

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setAccountError(language === "tr" ? "Profil fotoğrafı için galeri izni gerekli. Ayarlardan izin verebilirsiniz." : language === "ru" ? "Для фото профиля нужен доступ к галерее." : language === "uz" ? "Profil rasmi uchun galereyaga ruxsat kerak." : "Gallery permission is required for profile photos.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1]
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const validation = validatePickedImageAsset(asset, language);
      if (!validation.ok) {
        setAccountError(validation.message);
        return;
      }
      const compressedUri = await compressProfileImage(asset.uri);
      setAvatar(compressedUri);
      setAccountError("");
      setSaved(false);
    }
  }

  async function pickProfileImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const validation = validatePickedImageAsset(asset, language);
      if (!validation.ok) {
        setProfileImageError(validation.message);
        return;
      }
      const compressedUri = await compressProfileImage(asset.uri);
      setProfileImage(compressedUri);
      setProfileImageError("");
    }
  }

  function addImageToProfile() {
    if (!canUseMemberFeatures) {
      setProfileImageError("Görsel yüklemek için e-posta adresinizi doğrulayın.");
      return;
    }
    if (!profileImage || !profileImageTitle.trim() || profileImageStory.trim().length < PROFILE_IMAGE_STORY_MIN_LENGTH) {
      setProfileImageError(language === "tr" ? "Görsel, başlık ve 10-300 karakter açıklama zorunlu." : language === "ru" ? "Изображение, название и описание 10-300 символов обязательны." : language === "uz" ? "Rasm, nom va 10-300 belgilik izoh majburiy." : "Image, title, and 10-300 character description are required.");
      return;
    }

    const artworkPayload = {
      language: profileImageLanguage,
      image: profileImage,
      artistName: account.displayName,
      title: profileImageTitle.trim(),
      story: profileImageStory.trim().slice(0, PROFILE_IMAGE_STORY_MAX_LENGTH),
      age: "",
      uploaderUsername: account.username
    };
    const result = profileImageCompetition
      ? submitArtwork({ ...artworkPayload, source: "competition" }, language)
      : addProfileArtwork(artworkPayload, language);
    if (!result.ok) {
      setProfileImageError(result.reason === "rate_limit" ? buildRateLimitMessage(result.status, language) : result.message ?? "");
      return;
    }

    if (profileImageCompetition) {
      setProfileImageMessage(language === "tr" ? "Görseliniz alındı; kısa süre içinde yarışmada görünecek." : language === "ru" ? "Работа принята и скоро появится в конкурсе." : language === "uz" ? "Rasm qabul qilindi; tez orada tanlovda ko'rinadi." : "Your image was received and will appear in the contest shortly.");
    } else {
      setProfileImageMessage(language === "tr" ? "Görsel profilinize eklendi." : language === "ru" ? "Изображение добавлено в профиль." : language === "uz" ? "Rasm profilingizga qo'shildi." : "Image added to your profile.");
    }
    setProfileImage(null);
    setProfileImageTitle("");
    setProfileImageStory("");
    setProfileImageError("");
  }

  function editField(setter: (value: string) => void) {
    return (value: string) => {
      setter(value);
      setSaved(false);
    };
  }

  if (!isAuthenticated) {
    return (
      <AuthScreen
        language={language}
        pendingVerificationEmail={pendingVerificationEmail}
        login={login}
        register={register}
        verifyEmailCode={verifyEmailCode}
        forgotPassword={forgotPassword}
        signInWithGoogle={signInWithGoogle}
        signInWithApple={signInWithApple}
      />
    );
  }

  if (profileHydrationError && !profileHydrated) {
    return (
      <AppChrome title={copy.account[language]} eyebrow={copy.profileInfo[language]} showTopAd={false} showFloatingShortcuts={false}>
        <View style={styles.profileHydrationError}>
          <Ionicons name="cloud-offline-outline" size={28} color={colors.gold} />
          <Text style={styles.profileHydrationErrorText}>
            {language === "tr" ? "Profil bilgileri şu anda yüklenemedi." : language === "ru" ? "Не удалось загрузить данные профиля." : language === "uz" ? "Profil ma'lumotlarini hozir yuklab bo'lmadi." : "Profile data could not be loaded."}
          </Text>
          <Pressable onPress={retryProfileHydration} style={styles.profileHydrationRetry}>
            <Text style={styles.profileHydrationRetryText}>{language === "tr" ? "Tekrar dene" : language === "ru" ? "Повторить" : language === "uz" ? "Qayta urinish" : "Retry"}</Text>
          </Pressable>
        </View>
      </AppChrome>
    );
  }

  if (!profileHydrated || !account.uid) {
    return (
      <AppChrome title={copy.account[language]} eyebrow={copy.profileInfo[language]} showTopAd={false} showFloatingShortcuts={false}>
        <AccountProfileSkeleton styles={styles} />
      </AppChrome>
    );
  }

  const ownArtworks = items.filter((item) => isProfileVisibleArtwork(item) && isOwnedArtwork(item, account));
  const selectedArtwork = selectedArtworkId ? ownArtworks.find((item) => item.id === selectedArtworkId) ?? null : null;
  const ownPosts = posts.filter((post) => isAuthoredByPost(post, account));
  const favoritePosts = posts.filter((post) => favoriteIds.includes(post.id) && !post.hidden);
  const followers = account.uid ? getFollowersFor(account.uid) : [];
  const followingProfiles = account.uid ? getFollowingFor(account.uid) : [];
  const accountMuseum = personalMuseums.find((museum) => isOwnedMuseum(museum, account) && museum.active);
  const countryDisplay = countryCommunities.find((item) => item.name.tr === country)?.name[language] ?? country;
  const badges = getProfileBadges(account.role, account.totalScore, ownArtworks, language, account.isPremium, account.badges.filter((badge) => badge !== "premium"));

  function openProfileArtworkPreview(id: string) {
    setPreviewCopied(false);
    setProfileArtworkNotice("");
    setSelectedArtworkId(id);
  }

  function closeProfileArtworkPreview() {
    setSelectedArtworkId(null);
    setPreviewCopied(false);
    setProfileArtworkNotice("");
  }

  async function shareSelectedArtwork() {
    if (!selectedArtwork) return;
    await Clipboard.setStringAsync(Linking.createURL(`/profile/${encodeURIComponent(account.displayName)}?artwork=${selectedArtwork.id}`));
    setPreviewCopied(true);
    setTimeout(() => setPreviewCopied(false), 1500);
  }

  function handleDeleteProfileArtwork() {
    if (!selectedArtwork) return;
    const result = deleteSubmittedArtwork(selectedArtwork.id);
    if (!result.ok) {
      setProfileArtworkNotice(result.message ?? msg(systemMessages.community.activeCompetitionDeleteBlocked, language));
      return;
    }
    closeProfileArtworkPreview();
  }

  function openNewProfilePost() {
    if (!canUseMemberFeatures) return;
    setEditingPostId(null);
    setPostDraftText("");
    setPostDraftKind("own");
    setPostEditorError("");
    setPostModalOpen(true);
  }

  function openMuseumOrNotice() {
    router.push("/my-museum");
  }

  function openEditProfilePost(postId: string) {
    if (!canUseMemberFeatures) return;
    const post = posts.find((item) => item.id === postId);
    if (!post) return;
    setEditingPostId(post.id);
    setPostDraftText(post.text);
    setPostDraftKind(post.kind);
    setPostEditorError("");
    setPostModalOpen(true);
  }

  function submitProfilePost() {
    if (!canUseMemberFeatures) {
      setPostEditorError("Yazı paylaşmak için e-posta adresinizi doğrulayın.");
      return;
    }
    const text = postDraftText.trim().slice(0, 1000);
    if (!text) return;
    if (editingPostId) {
      const result = updatePost(editingPostId, { text, kind: postDraftKind }, language);
      if (!result.ok) {
        setPostEditorError(result.reason === "rate_limit" ? buildRateLimitMessage(result.status, language) : result.message ?? "");
        return;
      }
    } else {
      const result = addPost({
        author: account.displayName,
        username: account.username,
        text,
        kind: postDraftKind,
        isPremium: account.isPremium || account.isAdmin,
        skipLimits: account.isPremium || account.isAdmin || account.staffBadges.includes("moderator") || account.staffBadges.includes("editor")
      }, language);
      if (!result.ok) {
        setPostEditorError(result.reason === "rate_limit" ? buildRateLimitMessage(result.status, language) : result.message ?? "");
        return;
      }
    }
    setPostEditorError("");
    setPostModalOpen(false);
    setEditingPostId(null);
    setPostDraftText("");
    setPostDraftKind("own");
    setProfileContentTab("posts");
  }

  if (!editMode) {
    return (
      <AppChrome title={uiCopy.myProfile[language]} eyebrow={copy.profileInfo[language]} showTopAd={false}>
        <Modal visible={profileMenuOpen} transparent animationType="fade" onRequestClose={() => setProfileMenuOpen(false)}>
          <View style={styles.menuBackdrop}>
            <Pressable style={StyleSheet.absoluteFill} onPress={() => setProfileMenuOpen(false)} />
            <View style={styles.profileMenu}>
              <Pressable onPress={() => { setProfileMenuOpen(false); if (canUseMemberFeatures) setEditMode(true); else setAccountError("Profil düzenlemek için e-posta adresinizi doğrulayın."); }} style={styles.profileMenuRow}>
                <Ionicons name="create-outline" size={18} color={colors.gold} />
                <Text style={styles.profileMenuText}>{uiCopy.editProfile[language]}</Text>
              </Pressable>
              <Pressable onPress={() => { setProfileMenuOpen(false); router.push("/profile-visits" as never); }} style={styles.profileMenuRow}>
                <Ionicons name="eye-outline" size={18} color={colors.gold} />
                <Text style={styles.profileMenuText}>
                  {language === "tr" ? "Profil Ziyaretleri" : language === "ru" ? "Посещения профиля" : language === "uz" ? "Profil tashriflari" : "Profile Visits"}
                </Text>
              </Pressable>
              <Pressable onPress={() => { setProfileMenuOpen(false); logout(); }} style={styles.profileMenuRow}>
                <Ionicons name="log-out-outline" size={18} color={colors.gold} />
                <Text style={styles.profileMenuText}>{copy.logout[language]}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
        <ProfileUploadModal
          visible={profileUploadOpen}
          onClose={() => setProfileUploadOpen(false)}
          profileImage={profileImage}
          profileImageTitle={profileImageTitle}
          profileImageStory={profileImageStory}
          profileImageError={profileImageError}
          setProfileImageTitle={setProfileImageTitle}
          setProfileImageStory={setProfileImageStory}
          profileImageLanguage={profileImageLanguage}
          setProfileImageLanguage={setProfileImageLanguage}
          profileImageCompetition={profileImageCompetition}
          setProfileImageCompetition={setProfileImageCompetition}
          profileImageMessage={profileImageMessage}
          artworkLimitStatusText={buildLimitStatusText(artworkLimitStatus, language)}
          pickProfileImage={pickProfileImage}
          addImageToProfile={addImageToProfile}
          language={language}
          styles={styles}
          colors={colors}
        />
        <SocialListModal
          visible={!!socialListOpen}
          title={socialListOpen === "followers" ? { tr: "Takipçiler", en: "Followers", ru: "Подписчики", uz: "Kuzatuvchilar" }[language] : { tr: "Takip edilenler", en: "Following", ru: "Подписки", uz: "Kuzatilayotganlar" }[language]}
          users={socialListOpen === "followers" ? followers : followingProfiles}
          onClose={() => setSocialListOpen(null)}
          onOpenProfile={(name) => {
            setSocialListOpen(null);
            router.push({ pathname: "/profile/[name]", params: { name } });
          }}
          canRemove={socialListOpen === "followers"}
          onRemove={(username) => { void unfollowUser({ username }); }}
          styles={styles}
          colors={colors}
          language={language}
        />
        <SocialLinksModal visible={socialLinksOpen} onClose={() => setSocialLinksOpen(false)} links={account.socialLinks} styles={styles} colors={colors} language={language} />
        <PostEditorModal
          visible={postModalOpen}
          editing={!!editingPostId}
          draftText={postDraftText}
          draftKind={postDraftKind}
          setDraftText={(text) => setPostDraftText(text.slice(0, 1000))}
          setDraftKind={setPostDraftKind}
          onClose={() => setPostModalOpen(false)}
          onSubmit={submitProfilePost}
          errorText={postEditorError}
          limitStatus={postLimitStatus}
          language={language}
          styles={postStyles}
          colors={colors}
        />
        <ImagePreviewModal
          image={selectedArtwork?.image ?? null}
          onClose={closeProfileArtworkPreview}
          footer={selectedArtwork ? (
            <CommunityArtworkPreviewFooter
              artwork={selectedArtwork}
              colors={colors}
              showOwnerActions
              onDelete={handleDeleteProfileArtwork}
              onShare={() => { void shareSelectedArtwork(); }}
              shareCopied={previewCopied}
              notice={profileArtworkNotice}
            />
          ) : undefined}
        />

        {account.isSuspended ? (
          <View style={styles.suspendedNotice}>
            <Ionicons name="ban-outline" size={22} color={colors.gold} />
            <Text style={styles.suspendedNoticeText}>
              {language === "tr"
                ? "Hesabınız askıya alınmıştır. Paylaşımlarınız ve etkinlikleriniz geçici olarak gizlenmiştir."
                : language === "ru"
                  ? "Ваш аккаунт заблокирован. Публикации и активность временно скрыты."
                  : language === "uz"
                    ? "Hisobingiz to'xtatilgan. Ulashuvlar va faolligingiz vaqtincha yashirilgan."
                    : "Your account is suspended. Your posts and activity are temporarily hidden."}
            </Text>
          </View>
        ) : null}

        <View style={styles.socialProfile}>
          <View style={styles.socialTopBar}>
            <View style={styles.socialUsernameRow}>
              <UserNameWithCountry
                name={`@${account.username}`}
                countryCode={resolveCountryCode(account.country)}
                nameStyle={styles.socialUsername}
                style={styles.socialUsernameNameRow}
              />
              <Ionicons name={getRoleIcon(account.role)} size={15} color={colors.gold} />
            </View>
            <Pressable onPress={openMuseumOrNotice} style={[styles.museumIconButton, !accountMuseum && styles.museumIconMuted]}>
              <Ionicons name="business-outline" size={18} color={colors.gold} />
            </Pressable>
            <Pressable onPress={() => setProfileMenuOpen(true)} style={styles.moreButton}>
              <Ionicons name="ellipsis-horizontal" size={22} color={colors.ivory} />
            </Pressable>
          </View>
          {museumNotice ? <Text style={styles.museumNotice}>{museumNotice}</Text> : null}

          <View style={styles.socialSummaryRow}>
            <View style={styles.profileAvatarOrbit}>
              <View style={styles.profileOrbitLine} pointerEvents="none" />
              <ProfileAvatar uri={account.avatar} size={82} borderColor={account.isPremium ? v2Colors.premium : v2Colors.brightViolet} />
            </View>
            <View style={styles.socialStats}>
              <View style={styles.socialStat}>
                <Text style={styles.socialStatValue}>{ownArtworks.length}</Text>
                <Text style={styles.socialStatLabel}>{uiCopy.images[language]}</Text>
              </View>
              <Pressable onPress={() => setSocialListOpen("followers")} style={styles.socialStat}>
                <Text style={styles.socialStatValue}>{followers.length}</Text>
                <Text style={styles.socialStatLabel}>{language === "tr" ? "Takipçi" : language === "ru" ? "Подписчики" : language === "uz" ? "Kuzatuvchi" : "Followers"}</Text>
              </Pressable>
              <Pressable onPress={() => setSocialListOpen("following")} style={styles.socialStat}>
                <Text style={styles.socialStatValue}>{followingProfiles.length}</Text>
                <Text style={styles.socialStatLabel}>{language === "tr" ? "Takip" : language === "ru" ? "Подписки" : language === "uz" ? "Kuzatish" : "Following"}</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.socialBioBlock}>
            <UserNameWithCountry
              name={account.displayName}
              countryCode={resolveCountryCode(account.country)}
              nameStyle={styles.socialDisplayName}
              style={styles.socialDisplayNameRow}
              numberOfLines={2}
            />
            <BadgeRow badges={badges} styles={styles} colors={colors} />
            <Text style={styles.socialBio}>{account.bio || (language === "tr" ? "Henüz biyografi eklenmedi." : language === "ru" ? "Биография пока не добавлена." : language === "uz" ? "Hali biografiya qo'shilmagan." : "No biography yet.")}</Text>
            <View style={styles.compactProfileMetaRow}>
              {account.country ? <Text style={styles.profilePill} numberOfLines={1}>{account.city ? `${account.city}, ` : ""}{countryDisplay}</Text> : null}
              <SocialIconRow links={account.socialLinks} styles={styles} colors={colors} onPress={() => setSocialLinksOpen(true)} language={language} />
            </View>
          </View>
        </View>

        <View style={styles.profileTabsRow}>
          <Pressable onPress={() => setProfileContentTab("images")} style={[styles.profileTabButton, profileContentTab === "images" && styles.profileTabButtonActive]}>
            <Text style={[styles.profileTabText, profileContentTab === "images" && styles.profileTabTextActive]}>{uiCopy.images[language]}</Text>
          </Pressable>
          <Pressable onPress={() => setProfileContentTab("posts")} style={[styles.profileTabButton, profileContentTab === "posts" && styles.profileTabButtonActive]}>
            <Text style={[styles.profileTabText, profileContentTab === "posts" && styles.profileTabTextActive]}>{language === "tr" ? "Yazılar" : language === "ru" ? "Записи" : language === "uz" ? "Yozuvlar" : "Posts"}</Text>
          </Pressable>
          <Pressable onPress={() => setProfileContentTab("favorites")} style={[styles.profileTabButton, profileContentTab === "favorites" && styles.profileTabButtonActive]}>
            <Text style={[styles.profileTabText, profileContentTab === "favorites" && styles.profileTabTextActive]}>{language === "tr" ? "Favorilerim" : language === "ru" ? "Избранное" : language === "uz" ? "Sevimlilarim" : "Favorites"}</Text>
          </Pressable>
          {profileContentTab !== "favorites" ? <Pressable onPress={profileContentTab === "images" ? () => setProfileUploadOpen(true) : openNewProfilePost} style={styles.addImageIconButton}>
            <Ionicons name="add" size={20} color={v2Colors.text} />
          </Pressable> : null}
        </View>

        {profileContentTab === "images" ? communityLoading ? null : ownArtworks.length ? (
          <View style={[styles.profileGrid, { gap: profileGridGap }]}>
            {ownArtworks.map((item) => (
              <Pressable key={item.id} onPress={() => openProfileArtworkPreview(item.id)} style={[styles.profileArtworkCard, { width: profileArtworkSize }]} accessibilityRole="button" accessibilityLabel={item.title}>
                <Image source={{ uri: item.image }} style={[styles.profileArtworkImage, { width: profileArtworkSize, height: profileArtworkSize }]} contentFit="cover" />
                <View style={styles.profileArtworkTitleRow}>
                  <Text style={styles.profileArtworkTitle} numberOfLines={1}>{item.title}</Text>
                  <ArtworkGridCommentBadge count={(commentsByArtwork[item.id] ?? []).length} colors={colors} />
                </View>
              </Pressable>
            ))}
          </View>
        ) : (
          <View style={styles.profileEmpty}>
            <Ionicons name="images-outline" size={25} color={colors.gold} />
            <Text style={styles.profileEmptyText}>{uiCopy.noApprovedImages[language]}</Text>
          </View>
        ) : profileContentTab === "posts" ? ownPosts.length ? (
          <View style={postStyles.feedList}>
            {ownPosts.map((post) => (
              <DiscoveryPostCard
                key={post.id}
                post={post}
                liked={likedIds.includes(post.id)}
                favorited={favoriteIds.includes(post.id)}
                isOwner
                onDelete={() => deletePost(post.id)}
                onEdit={() => openEditProfilePost(post.id)}
                onToggleFavorite={() => toggleFavorite(post.id)}
                onToggleHidden={() => toggleHidden(post.id)}
                onToggleLike={() => toggleLike(post.id)}
                language={language}
                styles={postStyles}
                colors={colors}
              />
            ))}
          </View>
        ) : (
          <View style={styles.profileEmpty}>
            <Ionicons name="document-text-outline" size={25} color={colors.gold} />
            <Text style={styles.profileEmptyText}>{language === "tr" ? "Henüz yazı paylaşmadın." : language === "ru" ? "Пока нет записей." : language === "uz" ? "Hali yozuv yo'q." : "No posts yet."}</Text>
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
          <View style={styles.profileEmpty}>
            <Ionicons name="bookmark-outline" size={25} color={colors.gold} />
            <Text style={styles.profileEmptyText}>{language === "tr" ? "Henüz favori yazı eklemedin." : language === "ru" ? "Пока нет избранных записей." : language === "uz" ? "Hali sevimli yozuv yo'q." : "No favorite posts yet."}</Text>
          </View>
        )}

      </AppChrome>
    );
  }

  return (
    <AppChrome title={copy.account[language]} eyebrow={copy.profileInfo[language]} showTopAd={false} showFloatingShortcuts={false} keyboardAvoiding>
      {() => (
        <>
          <ResetOnRefresh onRefresh={resetDraftFromAccount} />
          <View style={styles.summary}>
            <View style={styles.summaryTop}>
              <View style={styles.avatarButtonWrap}>
                <Pressable onPress={pickAvatar} style={styles.avatarButton}>
                  {avatar ? (
                    <Image source={{ uri: avatar }} style={styles.avatarImage} contentFit="cover" />
                  ) : (
                    <Ionicons name="person" size={28} color={colors.gold} />
                  )}
                </Pressable>
                <View style={styles.avatarEditBadge}>
                  <Ionicons name="camera" size={13} color="#15120d" />
                </View>
              </View>
              <View style={styles.summaryText}>
                <View style={styles.accountNameRow}>
                  <Text style={styles.name}>{account.username}</Text>
                  <Ionicons name={getRoleIcon(account.role)} size={17} color={colors.gold} />
                </View>
                <Text style={styles.meta}>
                  {getRoleLabel(account.role, language)}
                </Text>
              </View>
            </View>
            <Text style={styles.avatarHint}>
              {language === "tr"
                ? "Profil fotoğrafını değiştirmek için fotoğrafa dokunun"
                : language === "ru"
                  ? "Нажмите на фото, чтобы изменить его"
                  : language === "uz"
                    ? "Profil rasmini o'zgartirish uchun rasmga bosing"
                    : "Tap your photo to change it"}
            </Text>
          </View>

          <View style={styles.panel}>
            <Pressable onPress={() => { resetDraftFromAccount(); setEditMode(false); }} style={styles.backToProfileButton}>
              <Ionicons name="arrow-back" size={18} color={colors.gold} />
              <Text style={styles.backToProfileText}>{uiCopy.backToProfile[language]}</Text>
            </Pressable>
            <Field label={copy.username[language]} value={username} onChangeText={(value) => editField(setUsername)(value.slice(0, USERNAME_MAX_LENGTH))} maxLength={USERNAME_MAX_LENGTH} />
            <Field label={uiCopy.fullName[language]} value={displayName} onChangeText={(value) => editField(setDisplayName)(value.slice(0, DISPLAY_NAME_MAX_LENGTH))} maxLength={DISPLAY_NAME_MAX_LENGTH} />
            <Field label={uiCopy.biography[language]} value={bio} onChangeText={(value) => editField(setBio)(value.slice(0, BIO_MAX_LENGTH))} multiline maxLength={BIO_MAX_LENGTH} />
            <View style={styles.twoColumns}>
              <CountrySelect label={uiCopy.country[language]} value={countryDisplay} onPress={() => setCountryPickerOpen(true)} />
              <Field label={uiCopy.city[language]} value={city} onChangeText={(value) => editField(setCity)(value.slice(0, CITY_MAX_LENGTH))} maxLength={CITY_MAX_LENGTH} />
            </View>
            <CountryPickerModal
              visible={countryPickerOpen}
              language={language}
              onClose={() => setCountryPickerOpen(false)}
              onSelect={(value) => {
                setCountry(value);
                setCountryPickerOpen(false);
                setSaved(false);
              }}
              styles={styles}
              colors={colors}
            />
            <Field label={uiCopy.interests[language]} value={interests} onChangeText={editField(setInterests)} />
            <Field label={copy.password[language]} value={password} onChangeText={editField(setPassword)} secureTextEntry />
            <Field label={copy.email[language]} value={email} onChangeText={editField(setEmail)} keyboardType="email-address" />
            <Text style={styles.label}>{uiCopy.socialLinks[language]}</Text>
            <Field label="Instagram" value={instagram} onChangeText={(value) => editField(setInstagram)(value.slice(0, SOCIAL_LINK_MAX_LENGTH))} maxLength={SOCIAL_LINK_MAX_LENGTH} />
            <Field label="X / Twitter" value={xLink} onChangeText={(value) => editField(setXLink)(value.slice(0, SOCIAL_LINK_MAX_LENGTH))} maxLength={SOCIAL_LINK_MAX_LENGTH} />
            <Field label="Facebook" value={facebook} onChangeText={(value) => editField(setFacebook)(value.slice(0, SOCIAL_LINK_MAX_LENGTH))} maxLength={SOCIAL_LINK_MAX_LENGTH} />
            <Field label="Website" value={website} onChangeText={(value) => editField(setWebsite)(value.slice(0, SOCIAL_LINK_MAX_LENGTH))} maxLength={SOCIAL_LINK_MAX_LENGTH} />
            <Field label="E-posta" value={socialEmail} onChangeText={(value) => editField(setSocialEmail)(value.slice(0, SOCIAL_EMAIL_MAX_LENGTH))} keyboardType="email-address" maxLength={SOCIAL_EMAIL_MAX_LENGTH} />
            <Text style={styles.label}>{uiCopy.countryDiscoveryTitle[language]}</Text>
            <ToggleDraft label={uiCopy.countryDiscovery[language]} value={isDiscoverableByCountry} onPress={() => { setIsDiscoverableByCountry((value) => !value); setSaved(false); }} />

            <Text style={styles.label}>{copy.memberRole[language]}</Text>
            <Pressable onPress={() => router.push("/roles-badges")} style={styles.roleBox}>
              <Ionicons name={getRoleIcon(account.role)} size={18} color={colors.gold} />
              <Text style={styles.roleText}>{getRoleLabel(account.role, language).toLocaleUpperCase("tr")}</Text>
              <Ionicons name="chevron-forward" size={17} color={colors.muted} />
            </Pressable>
            <Text style={styles.roleNote}>
              {language === "tr"
                ? "Herkes Sanatsever rozetiyle başlar. Diğer rol ve rozetler topluluk katkısına göre verilir."
                : language === "en"
                  ? "Everyone starts with the Art lover badge. Other roles and badges are earned through community contribution."
                  : language === "ru"
                    ? "Все начинают со значка любителя искусства. Другие роли и значки присваиваются за вклад в сообщество."
                    : "Hamma San'atsevar nishoni bilan boshlaydi. Boshqa rol va nishonlar jamiyat hissasi uchun beriladi."}
            </Text>

            <Pressable disabled={saving} onPress={saveAccount} style={[styles.saveButton, saving && styles.buttonDisabled]}>
              <Text style={styles.saveText}>{saving ? (language === "tr" ? "Kaydediliyor..." : language === "ru" ? "Сохранение..." : language === "uz" ? "Saqlanmoqda..." : "Saving...") : copy.save[language]}</Text>
            </Pressable>
            {accountError ? <Text style={styles.errorText}>{accountError}</Text> : null}
            {saved ? (
              <Text style={styles.savedText}>
                {language === "tr" ? "Bilgileriniz kaydedildi." : language === "en" ? "Your details were saved." : language === "ru" ? "Данные сохранены." : "Ma'lumotlaringiz saqlandi."}
              </Text>
            ) : null}

            <DeleteAccountSection
              language={language}
              visible={deleteModalOpen}
              deleting={deleting}
              deletePassword={deletePassword}
              deleteError={deleteError}
              onOpen={() => { setDeleteError(""); setDeletePassword(""); setDeleteModalOpen(true); }}
              onClose={() => setDeleteModalOpen(false)}
              onChangePassword={setDeletePassword}
              onConfirmPassword={() => confirmDeleteAccount()}
              onConfirmGoogle={reauthAndDeleteWithGoogle}
              onConfirmApple={reauthAndDeleteWithApple}
              styles={styles}
              colors={colors}
            />
          </View>

          <Pressable onPress={logout} style={styles.logoutButton}>
            <Ionicons name="log-out-outline" size={20} color={colors.ivory} />
            <Text style={styles.logoutText}>{copy.logout[language]}</Text>
          </Pressable>
        </>
      )}
    </AppChrome>
  );
}

type AuthScreenProps = {
  language: "tr" | "en" | "ru" | "uz";
  pendingVerificationEmail?: string;
  login: (email: string, password: string) => Promise<{ ok: boolean; message: string; requiresVerification?: boolean }>;
  register: (nextAccount: { username: string; password: string; email: string }) => Promise<{ ok: boolean; message: string; requiresVerification?: boolean }>;
  verifyEmailCode: (code?: string) => Promise<{ ok: boolean; message: string; requiresVerification?: boolean }>;
  forgotPassword: (email: string) => Promise<{ ok: boolean; message: string; requiresVerification?: boolean }>;
  signInWithGoogle: (idToken?: string) => Promise<{ ok: boolean; message: string; requiresVerification?: boolean }>;
  signInWithApple: () => Promise<{ ok: boolean; message: string; requiresVerification?: boolean }>;
};

function DeleteAccountGoogleButton({
  deleting,
  onConfirmGoogle,
  styles
}: {
  deleting: boolean;
  onConfirmGoogle: (promptGoogleSignIn: () => Promise<{ idToken?: string; cancelled?: boolean; error?: string }>) => Promise<void>;
  styles: ReturnType<typeof createStyles>;
}) {
  const googleSignIn = useGoogleSignIn();
  const copy = { tr: "Google ile doğrula ve sil", en: "Verify with Google and delete", ru: "Подтвердить через Google", uz: "Google bilan tasdiqlash" };

  return (
    <Pressable disabled={deleting || !googleSignIn.ready} onPress={() => onConfirmGoogle(googleSignIn.signIn)} style={[styles.deleteConfirmButton, deleting && styles.buttonDisabled]}>
      <Text style={styles.deleteConfirmText}>{copy.tr}</Text>
    </Pressable>
  );
}

function DeleteAccountSection({
  language,
  visible,
  deleting,
  deletePassword,
  deleteError,
  onOpen,
  onClose,
  onChangePassword,
  onConfirmPassword,
  onConfirmGoogle,
  onConfirmApple,
  styles,
  colors
}: {
  language: Language;
  visible: boolean;
  deleting: boolean;
  deletePassword: string;
  deleteError: string;
  onOpen: () => void;
  onClose: () => void;
  onChangePassword: (value: string) => void;
  onConfirmPassword: () => void;
  onConfirmGoogle: (promptGoogleSignIn: () => Promise<{ idToken?: string; cancelled?: boolean; error?: string }>) => Promise<void>;
  onConfirmApple: () => Promise<void>;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof getThemeColors>;
}) {
  const providerIds = firebaseAuth.currentUser?.providerData.map((item) => item.providerId) ?? [];
  const usesGoogle = providerIds.includes("google.com");
  const usesApple = providerIds.includes("apple.com");
  const usesPassword = providerIds.includes("password") || (!usesGoogle && !usesApple);
  const googleConfigured = isGoogleSignInConfigured();

  const copy = {
    sectionTitle: {
      tr: "Hesap yönetimi",
      en: "Account management",
      ru: "Управление аккаунтом",
      uz: "Hisob boshqaruvi"
    }[language],
    sectionHint: {
      tr: "Hesabınızı kalıcı olarak silmek isterseniz aşağıdaki seçeneği kullanabilirsiniz.",
      en: "If you want to permanently delete your account, use the option below.",
      ru: "Если вы хотите навсегда удалить аккаунт, используйте опцию ниже.",
      uz: "Hisobingizni butunlay o'chirmoqchi bo'lsangiz, quyidagi variantdan foydalaning."
    }[language],
    title: { tr: "Hesabımı sil", en: "Delete my account", ru: "Удалить аккаунт", uz: "Hisobni o'chirish" }[language],
    warning: {
      tr: "Bu işlem geri alınamaz. Profiliniz, oturumunuz ve hesabınıza bağlı temel veriler silinir. Devam etmek için kimliğinizi doğrulayın.",
      en: "This action cannot be undone. Your profile, session, and core account data will be deleted. Verify your identity to continue.",
      ru: "Это действие необратимо. Профиль, сессия и основные данные аккаунта будут удалены.",
      uz: "Bu amal qaytarilmaydi. Profil, sessiya va hisob ma'lumotlari o'chiriladi."
    }[language],
    confirm: { tr: "Hesabımı kalıcı olarak sil", en: "Permanently delete account", ru: "Удалить навсегда", uz: "Hisobni butunlay o'chirish" }[language],
    cancel: { tr: "Vazgeç", en: "Cancel", ru: "Отмена", uz: "Bekor qilish" }[language],
    password: { tr: "Şifrenizi girin", en: "Enter your password", ru: "Введите пароль", uz: "Parolingizni kiriting" }[language],
    google: { tr: "Google ile doğrula ve sil", en: "Verify with Google and delete", ru: "Подтвердить через Google", uz: "Google bilan tasdiqlash" }[language],
    apple: { tr: "Apple ile doğrula ve sil", en: "Verify with Apple and delete", ru: "Подтвердить через Apple", uz: "Apple bilan tasdiqlash" }[language]
  };

  return (
    <>
      <View style={styles.deleteAccountSection}>
        <Text style={styles.deleteAccountSectionTitle}>{copy.sectionTitle}</Text>
        <Text style={styles.deleteAccountSectionHint}>{copy.sectionHint}</Text>
        <Pressable onPress={onOpen} style={styles.deleteAccountButton}>
          <Ionicons name="trash-outline" size={16} color="rgba(248, 210, 198, 0.88)" />
          <Text style={styles.deleteAccountText}>{copy.title}</Text>
        </Pressable>
      </View>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.uploadModalBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
          <View style={styles.uploadModalPanel}>
            <Text style={styles.uploadModalTitle}>{copy.title}</Text>
            <Text style={styles.deleteAccountWarning}>{copy.warning}</Text>
            {usesPassword ? (
              <TextInput
                value={deletePassword}
                onChangeText={onChangePassword}
                placeholder={copy.password}
                placeholderTextColor={colors.muted}
                secureTextEntry
                style={styles.profileUploadInput}
              />
            ) : null}
            {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}
            {usesPassword ? (
              <Pressable disabled={deleting || deletePassword.length < 6} onPress={onConfirmPassword} style={[styles.deleteConfirmButton, (deleting || deletePassword.length < 6) && styles.buttonDisabled]}>
                <Text style={styles.deleteConfirmText}>{deleting ? "..." : copy.confirm}</Text>
              </Pressable>
            ) : null}
            {usesGoogle ? (
              googleConfigured ? (
                <DeleteAccountGoogleButton deleting={deleting} onConfirmGoogle={onConfirmGoogle} styles={styles} />
              ) : (
                <Text style={styles.errorText}>{getGoogleSignInConfigError()}</Text>
              )
            ) : null}
            {usesApple ? (
              <Pressable disabled={deleting} onPress={onConfirmApple} style={[styles.deleteConfirmButton, deleting && styles.buttonDisabled]}>
                <Text style={styles.deleteConfirmText}>{copy.apple}</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onClose} style={styles.backToProfileButton}>
              <Text style={styles.backToProfileText}>{copy.cancel}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

function AuthGoogleSignInButton({
  loading,
  runAuthAction,
  signInWithGoogle,
  onSuccess,
  setMessage,
  styles,
  colors,
  language,
  requireLegalAcceptance,
  legalAccepted
}: {
  loading: boolean;
  runAuthAction: (action: () => Promise<{ ok: boolean; message: string; requiresVerification?: boolean }>, onSuccess?: () => void) => Promise<void>;
  signInWithGoogle: AuthScreenProps["signInWithGoogle"];
  onSuccess: () => void;
  setMessage: (value: string) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof getThemeColors>;
  language: AuthScreenProps["language"];
  requireLegalAcceptance: () => boolean;
  legalAccepted: boolean;
}) {
  const googleSignIn = useGoogleSignIn();

  async function handlePress() {
    if (!requireLegalAcceptance()) return;

    if (Platform.OS === "web") {
      await runAuthAction(() => signInWithGoogle(), onSuccess);
      return;
    }

    if (!googleSignIn.ready) {
      setMessage(googleSignIn.configError ?? "Google girişi yapılandırılmamış.");
      return;
    }

    const googleResult = await googleSignIn.signIn();
    if (googleResult.cancelled) {
      return;
    }
    if (!googleResult.idToken) {
      setMessage(googleResult.error ?? "Google ile giriş başarısız.");
      return;
    }

    await runAuthAction(() => signInWithGoogle(googleResult.idToken), onSuccess);
  }

  return (
    <Pressable disabled={loading || !googleSignIn.ready} onPress={handlePress} style={[styles.googleButton, !legalAccepted && styles.buttonDisabled]}>
      <Ionicons name="logo-google" size={20} color={colors.ivory} />
      <Text style={styles.googleText}>{uiCopy.googleContinue[language]}</Text>
    </Pressable>
  );
}

function AccountProfileSkeleton({ styles }: { styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.profileHydrationStack} accessibilityLabel="Profile loading">
      <View style={styles.summary}>
        <View style={styles.summaryTop}>
          <View style={[styles.profileSkeletonBlock, styles.profileSkeletonAvatar]} />
          <View style={styles.summaryText}>
            <View style={[styles.profileSkeletonBlock, styles.profileSkeletonName]} />
            <View style={[styles.profileSkeletonBlock, styles.profileSkeletonMeta]} />
          </View>
        </View>
        <View style={[styles.profileSkeletonBlock, styles.profileSkeletonBio]} />
        <View style={[styles.profileSkeletonBlock, styles.profileSkeletonBioShort]} />
      </View>
      <View style={styles.panel}>
        <View style={styles.profileSkeletonStats}>
          {[0, 1, 2].map((item) => <View key={item} style={[styles.profileSkeletonBlock, styles.profileSkeletonStat]} />)}
        </View>
        <View style={[styles.profileSkeletonBlock, styles.profileSkeletonBadge]} />
        <View style={[styles.profileSkeletonBlock, styles.profileSkeletonAction]} />
        <View style={[styles.profileSkeletonBlock, styles.profileSkeletonContent]} />
      </View>
    </View>
  );
}

function AuthScreen({ language, pendingVerificationEmail, login, register, verifyEmailCode, forgotPassword, signInWithGoogle, signInWithApple }: AuthScreenProps) {
  const router = useRouter();
  const styles = useAccountStyles();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const { acceptLegal } = useLegal();
  const googleConfigured = isGoogleSignInConfigured();
  const googleConfigError = getGoogleSignInConfigError();
  const [mode, setMode] = useState<"login" | "register" | "verify" | "forgot">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [secure, setSecure] = useState(true);
  const [accepted, setAccepted] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [legalModal, setLegalModal] = useState<null | "terms" | "privacy">(null);

  async function runAuthAction(action: () => Promise<{ ok: boolean; message: string; requiresVerification?: boolean }>, onSuccess?: () => void) {
    setLoading(true);
    setMessage("");
    try {
      const result = await action();
      setMessage(result.message);
      if (result.requiresVerification) {
        setMode("verify");
      }
      if (result.ok) {
        onSuccess?.();
      }
    } finally {
      setLoading(false);
    }
  }

  function requireLegalAcceptance() {
    if (!accepted) {
      setMessage(uiCopy.policyRequired[language]);
      return false;
    }
    acceptLegal();
    return true;
  }

  function submitLogin() {
    if (!requireLegalAcceptance()) return;
    if (!username.includes("@") || password.length < 6) {
      setMessage("Lütfen e-posta adresinizi ve şifrenizi kontrol edin.");
      return;
    }

    runAuthAction(() => login(username, password), () => router.replace("/"));
  }

  function submitRegister() {
    if (!requireLegalAcceptance()) return;
    if (!username.trim() || password.length < 6 || !email.includes("@")) {
      setMessage(language === "tr"
        ? "Tüm alanları doldur, şifre en az 6 karakter olsun ve politikayı onayla."
        : "Fill all fields, use at least 6 password characters, and accept the policy.");
      return;
    }

    if (!isValidUsername(username)) {
      setMessage(`Kullanıcı adı ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} karakter olmalı.`);
      return;
    }

    runAuthAction(() => register({ username: normalizeUsername(username), password, email }), () => setMode("verify"));
  }

  function submitVerify() {
    runAuthAction(() => verifyEmailCode(), () => router.replace("/"));
  }

  function submitForgot() {
    if (!username.includes("@")) {
      setMessage("Lütfen kayıtlı e-posta adresinizi yazın.");
      return;
    }

    runAuthAction(() => forgotPassword(username));
  }

  return (
    <AppChrome title={copy.account[language]} eyebrow={uiCopy.secureAccess[language]} showTopAd={false} showFloatingShortcuts={false}>
      <Modal visible={!!legalModal} transparent animationType="fade" onRequestClose={() => setLegalModal(null)}>
        <View style={styles.legalBackdrop}>
          <View style={styles.legalPanel}>
            <View style={styles.legalHeader}>
              <Text style={styles.legalTitle}>{legalModal === "terms" ? uiCopy.terms[language] : uiCopy.privacy[language]}</Text>
              <Pressable onPress={() => setLegalModal(null)} style={styles.legalClose}>
                <Ionicons name="close" size={22} color={colors.ivory} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.legalText}>{legalModal ? storeLegalTexts[legalModal][language] : ""}</Text>
              {Platform.OS === "ios" && legalModal === "terms" ? (
                <Pressable
                  accessibilityRole="link"
                  onPress={() => Linking.openURL(legalUrls.eula).catch(() => undefined)}
                  style={styles.legalEulaLink}
                >
                  <Ionicons name="open-outline" size={18} color={colors.gold} />
                  <View style={styles.legalEulaTextWrap}>
                    <Text style={styles.legalEulaTitle}>
                      {{
                        tr: "Apple Standart Kullanım Koşulları'nı (EULA) aç",
                        en: "Open Apple Standard Terms of Use (EULA)",
                        ru: "Открыть стандартные условия Apple (EULA)",
                        uz: "Apple standart foydalanish shartlarini (EULA) ochish"
                      }[language]}
                    </Text>
                    <Text style={styles.legalEulaUrl} numberOfLines={1}>{legalUrls.eula}</Text>
                  </View>
                </Pressable>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>
      <View style={styles.authHero}>
        <Ionicons name="shield-checkmark" size={24} color={colors.gold} />
        <Text style={styles.authTitle}>
          {uiCopy.artGoAccount[language]}
        </Text>
        <Text style={styles.authText}>
          {uiCopy.guestAccessText[language]}
        </Text>
      </View>

      <View style={styles.authTabs}>
        <Pressable onPress={() => { setMode("login"); setMessage(""); }} style={[styles.authTab, mode === "login" && styles.authTabActive]}>
          <Text style={[styles.authTabText, mode === "login" && styles.authTabTextActive]}>{uiCopy.login[language]}</Text>
        </Pressable>
        <Pressable onPress={() => { setMode("register"); setMessage(""); }} style={[styles.authTab, mode === "register" && styles.authTabActive]}>
          <Text style={[styles.authTabText, mode === "register" && styles.authTabTextActive]}>{uiCopy.register[language]}</Text>
        </Pressable>
      </View>

      <View style={styles.authPanel}>
        {mode === "verify" ? (
          <>
            <Text style={styles.authPanelTitle}>{uiCopy.emailVerification[language]}</Text>
            <Text style={styles.authNotice}>{pendingVerificationEmail}</Text>
            <Text style={styles.authNotice}>E-posta kutunuzdaki doğrulama bağlantısına tıkladıktan sonra üyeliği tamamlayabilirsiniz.</Text>
            <Pressable disabled={loading} onPress={submitVerify} style={[styles.primaryButton, loading && styles.buttonDisabled]}>
              <Text style={styles.primaryButtonText}>{loading ? "Kontrol ediliyor..." : uiCopy.completeAccount[language]}</Text>
            </Pressable>
          </>
        ) : mode === "forgot" ? (
          <>
            <Text style={styles.authPanelTitle}>{uiCopy.forgotPassword[language]}</Text>
            <AuthInput icon="mail" value={username} onChangeText={setUsername} placeholder={copy.email[language]} keyboardType="email-address" />
            <Pressable disabled={loading} onPress={submitForgot} style={[styles.primaryButton, loading && styles.buttonDisabled]}>
              <Text style={styles.primaryButtonText}>{loading ? "Gönderiliyor..." : uiCopy.recoverPassword[language]}</Text>
            </Pressable>
            <Pressable onPress={() => setMode("login")} style={styles.textButton}>
              <Text style={styles.textButtonText}>{uiCopy.backToLogin[language]}</Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.authPanelTitle}>{mode === "login" ? uiCopy.memberLogin[language] : uiCopy.newAccount[language]}</Text>
            <AuthInput icon={mode === "login" ? "mail" : "person"} value={username} onChangeText={(value) => setUsername(mode === "login" ? value : value.slice(0, USERNAME_MAX_LENGTH))} placeholder={mode === "login" ? copy.email[language] : copy.username[language]} keyboardType={mode === "login" ? "email-address" : "default"} maxLength={mode === "login" ? undefined : USERNAME_MAX_LENGTH} />
            {mode === "register" ? (
              <>
                <AuthInput icon="mail" value={email} onChangeText={setEmail} placeholder={copy.email[language]} keyboardType="email-address" />
              </>
            ) : null}
            <View style={styles.passwordWrap}>
              <AuthInput icon="lock-closed" value={password} onChangeText={setPassword} placeholder={copy.password[language]} secureTextEntry={secure} />
              <Pressable onPress={() => setSecure((value) => !value)} style={styles.authEye}>
                <Ionicons name={secure ? "eye" : "eye-off"} size={20} color={colors.gold} />
              </Pressable>
            </View>
            <Pressable onPress={() => setAccepted((value) => !value)} style={styles.policyRow} accessibilityRole="checkbox" accessibilityState={{ checked: accepted }}>
              <Ionicons name={accepted ? "checkbox" : "square-outline"} size={22} color={colors.gold} />
              <Text style={styles.policyText}>{uiCopy.acceptPolicy[language]}</Text>
            </Pressable>
            <View style={styles.legalLinks}>
              <Pressable onPress={() => setLegalModal("terms")}><Text style={styles.legalLinkText}>{uiCopy.readTerms[language]}</Text></Pressable>
              <Pressable onPress={() => setLegalModal("privacy")}><Text style={styles.legalLinkText}>{uiCopy.readPrivacy[language]}</Text></Pressable>
            </View>
            <Pressable disabled={loading} onPress={mode === "login" ? submitLogin : submitRegister} style={[styles.primaryButton, (loading || !accepted) && styles.buttonDisabled]}>
              <Text style={styles.primaryButtonText}>{loading ? "İşleniyor..." : mode === "login" ? uiCopy.logIn[language] : uiCopy.sendCode[language]}</Text>
            </Pressable>
            {mode === "login" ? (
              <Pressable onPress={() => setMode("forgot")} style={styles.textButton}>
                <Text style={styles.textButtonText}>{uiCopy.forgotPassword[language]}</Text>
              </Pressable>
            ) : null}
          </>
        )}

        {message ? <Text style={styles.authMessage}>{message}</Text> : null}

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>{uiCopy.or[language]}</Text>
          <View style={styles.dividerLine} />
        </View>
        {googleConfigured ? (
          <AuthGoogleSignInButton
            loading={loading}
            runAuthAction={runAuthAction}
            signInWithGoogle={signInWithGoogle}
            onSuccess={() => router.replace("/")}
            setMessage={setMessage}
            styles={styles}
            colors={colors}
            language={language}
            requireLegalAcceptance={requireLegalAcceptance}
            legalAccepted={accepted}
          />
        ) : (
          <>
            <View style={[styles.googleButton, styles.buttonDisabled]}>
              <Ionicons name="logo-google" size={20} color={colors.ivory} />
              <Text style={styles.googleText}>{uiCopy.googleContinue[language]}</Text>
            </View>
            {googleConfigError ? <Text style={styles.authMessage}>{googleConfigError}</Text> : null}
          </>
        )}
        {Platform.OS === "ios" || Platform.OS === "web" ? (
          <Pressable disabled={loading} onPress={() => {
            if (!requireLegalAcceptance()) return;
            void runAuthAction(signInWithApple, () => router.replace("/"));
          }} style={[styles.googleButton, !accepted && styles.buttonDisabled]}>
            <Ionicons name="logo-apple" size={20} color={colors.ivory} />
            <Text style={styles.googleText}>{uiCopy.appleContinue[language]}</Text>
          </Pressable>
        ) : null}
      </View>
    </AppChrome>
  );
}

function AuthInput({ icon, ...props }: {
  icon: keyof typeof Ionicons.glyphMap;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
  maxLength?: number;
}) {
  const styles = useAccountStyles();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  return (
    <View style={styles.authInputWrap}>
      <Ionicons name={icon} size={18} color={colors.gold} />
      <TextInput {...props} placeholderTextColor={colors.muted} style={styles.authInput} />
    </View>
  );
}

function ResetOnRefresh({ onRefresh }: { onRefresh: () => void }) {
  useEffect(() => {
    onRefresh();
  }, []);

  return null;
}

type FieldProps = {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
  multiline?: boolean;
  maxLength?: number;
};

function Field({ label, value, onChangeText, secureTextEntry, keyboardType = "default", multiline = false, maxLength }: FieldProps) {
  const styles = useAccountStyles();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const [visible, setVisible] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureTextEntry && !visible}
          keyboardType={keyboardType}
          placeholderTextColor={colors.muted}
          multiline={multiline}
          maxLength={maxLength}
          textAlignVertical={multiline ? "top" : "center"}
          style={[styles.input, multiline && styles.bioInput, secureTextEntry && styles.inputWithIcon]}
        />
        {secureTextEntry ? (
          <Pressable onPress={() => setVisible((current) => !current)} style={styles.eyeButton}>
            <Ionicons name={visible ? "eye-off" : "eye"} size={20} color={colors.gold} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ToggleDraft({ label, value, onPress }: { label: string; value: boolean; onPress: () => void }) {
  const styles = useAccountStyles();
  return (
    <Pressable onPress={onPress} style={styles.toggleDraft}>
      <Text style={styles.toggleDraftText}>{label}</Text>
      <View style={[styles.switchTrack, value && styles.switchTrackActive]}>
        <View style={[styles.switchKnob, value && styles.switchKnobActive]} />
      </View>
    </Pressable>
  );
}

function ProfileUploadModal({
  visible,
  onClose,
  profileImage,
  profileImageTitle,
  profileImageStory,
  profileImageError,
  profileImageLanguage,
  profileImageCompetition,
  profileImageMessage,
  artworkLimitStatusText,
  setProfileImageTitle,
  setProfileImageStory,
  setProfileImageLanguage,
  setProfileImageCompetition,
  pickProfileImage,
  addImageToProfile,
  language,
  styles,
  colors
}: {
  visible: boolean;
  onClose: () => void;
  profileImage: string | null;
  profileImageTitle: string;
  profileImageStory: string;
  profileImageError: string;
  profileImageLanguage: Language;
  profileImageCompetition: boolean;
  profileImageMessage: string;
  artworkLimitStatusText: string;
  setProfileImageTitle: (value: string) => void;
  setProfileImageStory: (value: string) => void;
  setProfileImageLanguage: (value: Language) => void;
  setProfileImageCompetition: (value: boolean) => void;
  pickProfileImage: () => void;
  addImageToProfile: () => void;
  language: "tr" | "en" | "ru" | "uz";
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof getThemeColors>;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.uploadModalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.uploadModalPanel}>
          <View style={styles.uploadModalHeader}>
            <View style={styles.profileUploadHeader}>
              <Ionicons name="image-outline" size={20} color={colors.gold} />
              <View style={styles.profileUploadTextBlock}>
                <Text style={styles.profileUploadTitle}>{uiCopy.addProfileImage[language]}</Text>
                <Text style={styles.profileUploadNote}>{uiCopy.profileImageNote[language]}</Text>
                <Text style={styles.profileUploadNote}>{uploadFormatHint[language]}</Text>
              </View>
            </View>
            <Pressable onPress={onClose} style={styles.modalCloseSmall}>
              <Ionicons name="close" size={21} color={colors.ivory} />
            </Pressable>
          </View>
          <Pressable onPress={pickProfileImage} style={styles.profileImagePicker}>
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.profileImagePreview} contentFit="cover" />
            ) : (
              <>
                <Ionicons name="add-circle-outline" size={26} color={colors.gold} />
                <Text style={styles.profileImagePickerText}>{uiCopy.chooseProfileImage[language]}</Text>
              </>
            )}
          </Pressable>
          <TextInput
            value={profileImageTitle}
            onChangeText={setProfileImageTitle}
            placeholder={uiCopy.imageTitle[language]}
            placeholderTextColor={colors.muted}
            style={styles.profileUploadInput}
          />
          <TextInput
            value={profileImageStory}
            onChangeText={(value) => setProfileImageStory(value.slice(0, PROFILE_IMAGE_STORY_MAX_LENGTH))}
            maxLength={PROFILE_IMAGE_STORY_MAX_LENGTH}
            placeholder={language === "tr" ? "Açıklama yaz" : language === "ru" ? "Добавьте описание" : language === "uz" ? "Izoh yozing" : "Write a description"}
            placeholderTextColor={colors.muted}
            multiline
            textAlignVertical="top"
            style={[styles.profileUploadInput, styles.profileUploadStoryInput]}
          />
          <View style={styles.profileUploadLangRow}>
            {(["tr", "uz", "ru", "en"] as const).map((code) => (
              <Pressable key={code} onPress={() => setProfileImageLanguage(code)} style={[styles.profileUploadLang, profileImageLanguage === code && styles.profileUploadLangActive]}>
                <Text style={[styles.profileUploadLangText, profileImageLanguage === code && styles.profileUploadLangTextActive]}>{code.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={() => setProfileImageCompetition(!profileImageCompetition)} style={styles.competitionToggle}>
            <View style={styles.competitionToggleTextBlock}>
              <Text style={styles.competitionToggleTitle}>{language === "tr" ? "Yarışmaya katılsın mı?" : language === "ru" ? "Участвовать в конкурсе?" : language === "uz" ? "Tanlovda qatnashsinmi?" : "Enter weekly challenge?"}</Text>
              <Text style={styles.competitionToggleNote}>{language === "tr" ? "Açılırsa Resim Yarışması'nda paylaşılır ve topluluk oylamasına açılır." : language === "ru" ? "Если включено, работа участвует в конкурсе и открыта для голосования." : language === "uz" ? "Yoqilsa, rasm tanlovida ulashiladi va ovoz berishga ochiladi." : "If enabled, it is shared in the Painting Contest and opened to community voting."}</Text>
            </View>
            <View style={[styles.switchTrack, profileImageCompetition && styles.switchTrackActive]}>
              <View style={[styles.switchKnob, profileImageCompetition && styles.switchKnobActive]} />
            </View>
          </Pressable>
          {artworkLimitStatusText ? <Text style={styles.limitText}>{artworkLimitStatusText}</Text> : null}
          {profileImageError ? <Text style={styles.errorText}>{profileImageError}</Text> : null}
          {profileImageMessage ? <Text style={styles.savedText}>{profileImageMessage}</Text> : null}
          <Pressable onPress={addImageToProfile} style={styles.profileUploadButton}>
            <Text style={styles.profileUploadButtonText}>{uiCopy.add[language]}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function CountrySelect({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  const styles = useAccountStyles();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable onPress={onPress} style={styles.countrySelect}>
        <Text style={styles.countrySelectText} numberOfLines={1}>{value || label}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.gold} />
      </Pressable>
    </View>
  );
}

function CountryPickerModal({ visible, language, onClose, onSelect, styles, colors }: {
  visible: boolean;
  language: "tr" | "en" | "ru" | "uz";
  onClose: () => void;
  onSelect: (country: string) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof getThemeColors>;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.uploadModalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.countryModalPanel}>
          <View style={styles.uploadModalHeader}>
            <Text style={styles.uploadModalTitle}>{uiCopy.country[language]}</Text>
            <Pressable onPress={onClose} style={styles.modalCloseSmall}>
              <Ionicons name="close" size={21} color={colors.ivory} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {countryCommunities.map((country) => (
              <Pressable key={country.id} onPress={() => onSelect(country.name.tr)} style={styles.countryOption}>
                <Text style={styles.countryOptionText}>{country.name[language]}</Text>
                <Text style={styles.countryCode}>{country.code}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function SocialListModal({ visible, title, users, onClose, onOpenProfile, canRemove, onRemove, styles, colors, language }: {
  visible: boolean;
  title: string;
  users: { name: string; username: string; image: string }[];
  onClose: () => void;
  onOpenProfile: (name: string) => void;
  canRemove: boolean;
  onRemove: (username: string) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof getThemeColors>;
  language: Language;
}) {
  const [rowMenu, setRowMenu] = useState<string | null>(null);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.uploadModalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.socialListPanel}>
          <View style={styles.uploadModalHeader}>
            <Text style={styles.uploadModalTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.modalCloseSmall}>
              <Ionicons name="close" size={21} color={colors.ivory} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            {users.map((user) => (
              <View key={user.username}>
                <View style={styles.socialListRow}>
                  <Pressable onPress={() => onOpenProfile(user.username)} style={styles.socialListIdentity}>
                    <ProfileAvatar uri={user.image} size={42} />
                    <View style={styles.socialListText}>
                      <Text style={styles.socialListName}>{user.name}</Text>
                      <Text style={styles.socialListUsername}>@{user.username}</Text>
                    </View>
                  </Pressable>
                  {canRemove ? (
                    <Pressable onPress={() => setRowMenu((current) => current === user.username ? null : user.username)} style={styles.socialListMore}>
                      <Ionicons name="ellipsis-horizontal" size={20} color={colors.muted} />
                    </Pressable>
                  ) : null}
                </View>
                {rowMenu === user.username ? (
                  <Pressable onPress={() => { onRemove(user.username); setRowMenu(null); }} style={styles.removeFollowerButton}>
                    <Ionicons name="person-remove-outline" size={16} color={colors.gold} />
                    <Text style={styles.removeFollowerText}>{language === "tr" ? "Takipçiyi çıkar" : language === "ru" ? "Удалить подписчика" : language === "uz" ? "Kuzatuvchini chiqarish" : "Remove follower"}</Text>
                  </Pressable>
                ) : null}
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

type ProfileBadge = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

function getProfileBadges(role: UserRoleId, totalScore: number, artworks: { likes: number; dislikes: number }[], language: Language, isPremium = false, extraBadges: BadgeId[] = []): ProfileBadge[] {
  const bestNet = artworks.reduce((best, item) => Math.max(best, item.likes - item.dislikes), 0);
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
    email: string;
  };
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof getThemeColors>;
  onPress: () => void;
  language: Language;
}) {
  const items = [
    { key: "instagram", icon: "logo-instagram" as const, value: links.instagram },
    { key: "x", icon: "logo-twitter" as const, value: links.x },
    { key: "facebook", icon: "logo-facebook" as const, value: links.facebook },
    { key: "website", icon: "globe-outline" as const, value: links.website },
    { key: "email", icon: "mail-outline" as const, value: links.email }
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
    email: string;
  };
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof getThemeColors>;
  language: Language;
}) {
  const rows = [
    { label: "Instagram", value: links.instagram ? `instagram.com/${links.instagram.replace(/^@/, "")}` : "", icon: "logo-instagram" as const },
    { label: "X / Twitter", value: links.x ? `x.com/${links.x.replace(/^@/, "")}` : "", icon: "logo-twitter" as const },
    { label: "Facebook", value: links.facebook ? `facebook.com/${links.facebook.replace(/^@/, "")}` : "", icon: "logo-facebook" as const },
    { label: "Website", value: links.website, icon: "globe-outline" as const },
    { label: "E-posta", value: links.email, icon: "mail-outline" as const }
  ].filter((row) => row.value.trim());

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.uploadModalBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.socialLinksPanel}>
          <View style={styles.uploadModalHeader}>
            <Text style={styles.uploadModalTitle}>{language === "tr" ? "Sosyal ağlar" : language === "ru" ? "Социальные сети" : language === "uz" ? "Ijtimoiy tarmoqlar" : "Social networks"}</Text>
            <Pressable onPress={onClose} style={styles.modalCloseSmall}>
              <Ionicons name="close" size={21} color={colors.ivory} />
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

function useAccountStyles() {
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  return useMemo(() => createStyles(colors), [colors]);
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
return StyleSheet.create({
  authHero: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(217, 184, 101, 0.3)",
    backgroundColor: colors.panel,
    padding: 12,
    gap: 5,
    marginBottom: 10
  },
  authTitle: {
    color: colors.ivory,
    fontSize: 20,
    fontWeight: "900"
  },
  authText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  authTabs: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8
  },
  authTab: {
    flex: 1,
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center"
  },
  authTabActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  authTabText: {
    color: colors.ivory,
    fontWeight: "900"
  },
  authTabTextActive: {
    color: colors.ink
  },
  authPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 12,
    gap: 7
  },
  authPanelTitle: {
    color: colors.ivory,
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 2
  },
  authNotice: {
    color: colors.gold,
    fontWeight: "800",
    marginBottom: 4
  },
  authInputWrap: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12
  },
  authInput: {
    flex: 1,
    color: colors.ivory,
    fontSize: 14,
    fontWeight: "800"
  },
  passwordWrap: {
    position: "relative"
  },
  authEye: {
    position: "absolute",
    right: 6,
    top: 2,
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  policyRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 2
  },
  policyText: {
    flex: 1,
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700"
  },
  legalLinks: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  legalLinkText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900"
  },
  legalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    padding: 18
  },
  legalPanel: {
    maxHeight: "76%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(217,184,101,0.34)",
    backgroundColor: colors.panel,
    padding: 16
  },
  legalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10
  },
  legalTitle: {
    color: colors.ivory,
    fontSize: 18,
    fontWeight: "900",
    flex: 1
  },
  legalClose: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.panelSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  legalText: {
    color: colors.ivory,
    lineHeight: 22,
    fontWeight: "700"
  },
  legalEulaLink: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginTop: 18,
    marginBottom: 2
  },
  legalEulaTextWrap: {
    flex: 1,
    minWidth: 0,
    gap: 3
  },
  legalEulaTitle: {
    color: colors.gold,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "900"
  },
  legalEulaUrl: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: "700"
  },
  primaryButton: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4
  },
  buttonDisabled: {
    opacity: 0.65
  },
  primaryButtonText: {
    color: colors.ink,
    fontSize: 16,
    fontWeight: "900"
  },
  textButton: {
    minHeight: 28,
    alignItems: "center",
    justifyContent: "center"
  },
  textButtonText: {
    color: colors.gold,
    fontWeight: "900"
  },
  authMessage: {
    color: colors.gold,
    textAlign: "center",
    fontWeight: "800",
    lineHeight: 20
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 2
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.line
  },
  dividerText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  googleButton: {
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  googleText: {
    color: colors.ivory,
    fontWeight: "900"
  },
  summary: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 16,
    gap: 10,
    marginBottom: 14
  },
  summaryTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  avatarButtonWrap: {
    position: "relative"
  },
  avatarButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: "rgba(217, 184, 101, 0.38)",
    backgroundColor: colors.panelSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  avatarEditBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.gold,
    borderWidth: 2,
    borderColor: colors.panel,
    alignItems: "center",
    justifyContent: "center"
  },
  avatarHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "600"
  },
  avatarImage: {
    width: "100%",
    height: "100%"
  },
  summaryText: {
    flex: 1
  },
  name: {
    color: colors.ivory,
    fontSize: 22,
    fontWeight: "900",
    flexShrink: 1
  },
  accountNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7
  },
  meta: {
    color: colors.gold,
    fontWeight: "900",
    marginTop: 4
  },
  panel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 16,
    gap: 12
  },
  profileHero: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 16,
    gap: 10,
    marginBottom: 14
  },
  socialProfile: {
    borderRadius: radii.xl,
    backgroundColor: "transparent",
    paddingHorizontal: 2,
    paddingVertical: 10,
    gap: 15,
    marginBottom: 18
  },
  socialTopBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10
  },
  socialUsernameRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6
  },
  socialUsername: {
    color: colors.ivory,
    fontWeight: "900",
    flexShrink: 1
  },
  socialUsernameNameRow: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0
  },
  moreButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: v2Colors.surface1,
    borderWidth: 1,
    borderColor: v2Colors.border,
    alignItems: "center",
    justifyContent: "center"
  },
  museumIconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
  suspendedNotice: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(217, 184, 101, 0.28)",
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 16,
    marginBottom: 12
  },
  suspendedNoticeText: {
    color: colors.muted,
    textAlign: "center",
    fontWeight: "800",
    lineHeight: 20
  },
  socialSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 18,
    minHeight: 112,
    paddingVertical: 5
  },
  profileAvatarOrbit: { width: 104, height: 104, alignItems: "center", justifyContent: "center", position: "relative" },
  profileOrbitLine: { position: "absolute", width: 104, height: 74, borderRadius: 52, borderWidth: 1, borderColor: "rgba(139,92,246,0.5)", transform: [{ rotate: "-23deg" }], shadowColor: v2Colors.violet, shadowOpacity: 0.7, shadowRadius: 12, shadowOffset: { width: 0, height: 0 } },
  socialStats: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "space-around",
    gap: 8
  },
  socialStat: {
    flex: 1,
    alignItems: "center"
  },
  socialStatValue: {
    color: colors.ivory,
    fontSize: 20,
    fontWeight: "900"
  },
  socialStatLabel: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 2,
    textAlign: "center"
  },
  socialBioBlock: {
    gap: 5
  },
  socialDisplayName: {
    color: colors.ivory,
    fontSize: 21,
    fontWeight: "900"
  },
  socialDisplayNameRow: {
    flexShrink: 1,
    minWidth: 0
  },
  socialRole: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: "800"
  },
  socialBio: {
    color: colors.ivory,
    fontSize: 14,
    lineHeight: 20
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
  profileMenuText: {
    color: colors.ivory,
    fontWeight: "900",
    flex: 1
  },
  profileTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between"
  },
  profileAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1,
    borderColor: colors.gold,
    backgroundColor: colors.panelSoft,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  profileAvatarImage: {
    width: "100%",
    height: "100%"
  },
  profileInitial: {
    color: colors.gold,
    fontSize: 28,
    fontWeight: "900"
  },
  editIconButton: {
    width: 42,
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  profileDisplayName: {
    color: colors.ivory,
    fontSize: 24,
    fontWeight: "900",
    flexShrink: 1
  },
  profileUsername: {
    color: colors.gold,
    fontWeight: "900"
  },
  profileBio: {
    color: colors.muted,
    lineHeight: 21,
    fontWeight: "700"
  },
  profilePills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  compactProfileMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 7,
    marginTop: 2
  },
  profilePill: {
    minHeight: 30,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    color: colors.ivory,
    fontSize: 12,
    fontWeight: "900",
    paddingHorizontal: 10,
    paddingTop: 6,
    maxWidth: "58%"
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
    borderRadius: radii.pill,
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
  profileSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10
  },
  profileTabsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 18,
    marginBottom: 10
  },
  profileTabButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: v2Colors.surface1,
    alignItems: "center",
    justifyContent: "center"
  },
  profileTabButtonActive: {
    backgroundColor: v2Colors.violet,
    borderColor: v2Colors.brightViolet
  },
  profileTabText: {
    color: colors.ivory,
    fontSize: 13,
    fontWeight: "900"
  },
  profileTabTextActive: {
    color: v2Colors.text
  },
  profileSectionTitle: {
    color: colors.ivory,
    fontSize: 18,
    fontWeight: "900",
    flex: 1
  },
  addImageIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: v2Colors.violet,
    alignItems: "center",
    justifyContent: "center"
  },
  uploadModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.68)",
    justifyContent: "center",
    padding: 18
  },
  uploadModalPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 14,
    gap: 10
  },
  uploadModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 10
  },
  uploadModalTitle: {
    color: colors.ivory,
    fontSize: 18,
    fontWeight: "900",
    flex: 1
  },
  modalCloseSmall: {
    width: 34,
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.panelSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  profileUploadBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 12,
    gap: 10,
    marginBottom: 14
  },
  profileUploadHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9
  },
  profileUploadTextBlock: {
    flex: 1,
    minWidth: 0
  },
  profileUploadTitle: {
    color: colors.ivory,
    fontSize: 15,
    fontWeight: "900"
  },
  profileUploadNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    marginTop: 2
  },
  profileImagePicker: {
    minHeight: 128,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    overflow: "hidden"
  },
  profileImagePreview: {
    width: "100%",
    height: "100%"
  },
  profileImagePickerText: {
    color: colors.gold,
    fontWeight: "900",
    textAlign: "center"
  },
  profileUploadRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center"
  },
  profileUploadInput: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    color: colors.ivory,
    paddingHorizontal: 12,
    fontWeight: "800"
  },
  profileUploadButton: {
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  profileUploadButtonText: {
    color: colors.ink,
    fontWeight: "900"
  },
  profileUploadLangRow: {
    flexDirection: "row",
    gap: 7
  },
  profileUploadLang: {
    flex: 1,
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  profileUploadLangActive: {
    borderColor: colors.gold,
    backgroundColor: colors.gold
  },
  profileUploadLangText: {
    color: colors.ivory,
    fontSize: 12,
    fontWeight: "900"
  },
  profileUploadLangTextActive: {
    color: colors.ink
  },
  competitionToggle: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10
  },
  competitionToggleTextBlock: {
    flex: 1,
    minWidth: 0
  },
  competitionToggleTitle: {
    color: colors.ivory,
    fontWeight: "900"
  },
  competitionToggleNote: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
    marginTop: 2
  },
  profileUploadStoryInput: {
    minHeight: 92,
    paddingTop: 12
  },
  countrySelect: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 12
  },
  countrySelectText: {
    color: colors.ivory,
    fontSize: 16,
    fontWeight: "800",
    flex: 1
  },
  countryModalPanel: {
    maxHeight: "76%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 12,
    gap: 10
  },
  countryOption: {
    minHeight: 42,
    borderRadius: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 10
  },
  countryOptionText: {
    color: colors.ivory,
    fontWeight: "900",
    flex: 1
  },
  countryCode: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900"
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
  socialListRow: {
    minHeight: 56,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    paddingVertical: 8
  },
  socialListIdentity: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minWidth: 0
  },
  socialListMore: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  removeFollowerButton: {
    alignSelf: "flex-end",
    minHeight: 34,
    borderRadius: 8,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10,
    marginBottom: 6
  },
  removeFollowerText: {
    color: colors.ivory,
    fontSize: 12,
    fontWeight: "900"
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
  compactEditButton: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  compactEditText: {
    color: colors.ivory,
    fontSize: 12,
    fontWeight: "900"
  },
  profileGrid: {
    flexDirection: "row",
    flexWrap: "wrap"
  },
  profileArtworkCard: {
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: v2Colors.surface1,
    overflow: "hidden"
  },
  profileArtworkImage: {
    aspectRatio: 1
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
    alignItems: "flex-start",
    gap: 10
  },
  previewTextBlock: {
    flex: 1
  },
  previewName: {
    color: colors.ivory,
    fontSize: 14,
    fontWeight: "900"
  },
  previewStory: {
    color: colors.ivory,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 6
  },
  previewMoreButton: {
    alignSelf: "flex-start",
    marginTop: 4
  },
  previewMoreText: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800"
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
  profileEmpty: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    alignItems: "center",
    gap: 8,
    padding: 18
  },
  profileEmptyText: {
    color: colors.muted,
    fontWeight: "800",
    textAlign: "center"
  },
  backToProfileButton: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  backToProfileText: {
    color: colors.ivory,
    fontWeight: "900"
  },
  field: {
    gap: 7,
    flex: 1
  },
  twoColumns: {
    flexDirection: "row",
    gap: 8
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  input: {
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    color: colors.ivory,
    paddingHorizontal: 12,
    fontSize: 16,
    fontWeight: "700"
  },
  bioInput: {
    minHeight: 96,
    paddingTop: 12
  },
  inputWrap: {
    position: "relative"
  },
  inputWithIcon: {
    paddingRight: 48
  },
  toggleDraft: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 12
  },
  toggleDraftText: {
    color: colors.ivory,
    fontWeight: "800",
    flex: 1
  },
  switchTrack: {
    width: 46,
    height: 26,
    borderRadius: 13,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderWidth: 1,
    borderColor: colors.line,
    padding: 3,
    justifyContent: "center"
  },
  switchTrackActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  switchKnob: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.muted,
    alignSelf: "flex-start"
  },
  switchKnobActive: {
    backgroundColor: colors.ink,
    alignSelf: "flex-end"
  },
  eyeButton: {
    position: "absolute",
    right: 6,
    top: 6,
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  roleBox: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12
  },
  roleText: {
    color: colors.ivory,
    fontWeight: "900",
    fontSize: 14,
    flex: 1
  },
  saveButton: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4
  },
  saveText: {
    color: colors.ink,
    fontWeight: "900",
    fontSize: 16
  },
  deleteAccountSection: {
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: 8
  },
  deleteAccountSectionTitle: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase"
  },
  deleteAccountSectionHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600"
  },
  deleteAccountButton: {
    alignSelf: "flex-start",
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(248, 200, 180, 0.28)",
    backgroundColor: "rgba(92, 18, 28, 0.28)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2
  },
  deleteAccountText: {
    color: "rgba(248, 210, 198, 0.88)",
    fontWeight: "700",
    fontSize: 14
  },
  deleteAccountWarning: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700"
  },
  deleteConfirmButton: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: colors.wine,
    alignItems: "center",
    justifyContent: "center"
  },
  deleteConfirmText: {
    color: colors.ivory,
    fontWeight: "900"
  },
  savedText: {
    color: colors.gold,
    fontWeight: "900",
    textAlign: "center"
  },
  limitText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17,
    textAlign: "center"
  },
  errorText: {
    color: "#ffd6d6",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18,
    textAlign: "center",
    backgroundColor: "rgba(116, 35, 35, 0.42)",
    borderWidth: 1,
    borderColor: "rgba(255, 120, 120, 0.55)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  roleNote: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18
  },
  logoutButton: {
    minHeight: 50,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(248, 240, 223, 0.18)",
    backgroundColor: colors.wine,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 16
  },
  logoutText: {
    color: colors.ivory,
    fontSize: 16,
    fontWeight: "900"
  },
  profileHydrationError: {
    minHeight: 180,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: 20
  },
  profileHydrationErrorText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "800",
    textAlign: "center"
  },
  profileHydrationRetry: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16
  },
  profileHydrationRetryText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900"
  },
  profileHydrationStack: {
    gap: 14
  },
  profileSkeletonBlock: {
    borderRadius: 8,
    backgroundColor: colors.panelSoft,
    opacity: 0.72
  },
  profileSkeletonAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36
  },
  profileSkeletonName: {
    width: "62%",
    height: 22
  },
  profileSkeletonMeta: {
    width: "38%",
    height: 14,
    marginTop: 8
  },
  profileSkeletonBio: {
    width: "96%",
    height: 14
  },
  profileSkeletonBioShort: {
    width: "68%",
    height: 14
  },
  profileSkeletonStats: {
    flexDirection: "row",
    gap: 8
  },
  profileSkeletonStat: {
    flex: 1,
    height: 54
  },
  profileSkeletonBadge: {
    width: "38%",
    height: 24
  },
  profileSkeletonAction: {
    width: "100%",
    height: 40
  },
  profileSkeletonContent: {
    width: "100%",
    height: 132
  }
});
}
