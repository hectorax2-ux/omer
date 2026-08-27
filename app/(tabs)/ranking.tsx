import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { ClippedGradient } from "@/components/ui/clipped-gradient";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useFocusEffect, useRouter } from "expo-router";
import { AppChrome, AdSlot } from "@/components/app-chrome";
import { UserNameWithCountry } from "@/components/user-name-with-country";
import { ImagePreviewModal } from "@/components/image-preview-modal";
import { CommunityArtworkPreviewFooter } from "@/components/community-artwork-preview-footer";
import { areRewardedAdRequirementsEnabled } from "@/constants/ad-feature-flags";
import { AppTheme, getThemeColors, isBrightTheme } from "@/constants/theme";
import { radii, v2Colors } from "@/constants/design";
import { copy, countryCommunities, languages } from "@/data/content";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useCommunityArt } from "@/hooks/use-community-art";
import { useLanguage } from "@/hooks/use-language";
import { useAccount } from "@/hooks/use-account";
import { isOwnedArtwork } from "@/utils/user-identity";
import { profileRouteParam } from "@/utils/profile-route";
import { useCountryCodeLookup } from "@/hooks/use-country-code-lookup";
import { useAds } from "@/hooks/use-ads";
import { Language } from "@/types/content";
import { commonCopy } from "@/app/i18n/common";
import { t } from "@/utils/localized-text";
import { imageSource } from "@/utils/image-source";

type FeedLanguage = Language | "all";
const PAGE_SIZE = 12;

const superLikeModalLabels = {
  title: {
    tr: "Super Like",
    en: "Super Like",
    ru: "Super Like",
    uz: "Super Like"
  },
  premiumCta: {
    tr: "Premium'a Geç",
    en: "Go Premium",
    ru: "Оформить Premium",
    uz: "Premiumga o'tish"
  }
} as const;

export default function CommunityArtScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { account, isAuthenticated } = useAccount();
  const { items, votes, approveArtwork, voteArtwork, superLiked, superLikeArtwork, getSuperLikeStatus, getRankedCompetitionItems, boostArtwork, getBoostStatus, getRewardedBoostStatus, watchRewardedBoostAd, refreshArtworks } = useCommunityArt();
  const lookupUserCountry = useCountryCodeLookup();
  const { showRewardedAd } = useAds();
  const [tab, setTab] = useState<"current" | "new" | "liked">("current");
  const [selectedArtworkId, setSelectedArtworkId] = useState<string | null>(null);
  const [feedLanguage, setFeedLanguage] = useState<FeedLanguage>("all");
  const [rulesOpen, setRulesOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [previewCopied, setPreviewCopied] = useState(false);
  const [actionToast, setActionToast] = useState<{ message: string; target: { type: "boost"; artworkId: string } | { type: "reward" } } | null>(null);
  const [superLikeModal, setSuperLikeModal] = useState<{ kind: "premium" | "info"; message: string } | null>(null);
  const [timeTick, setTimeTick] = useState(Date.now());
  const actionToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshArtworksRef = useRef(refreshArtworks);
  refreshArtworksRef.current = refreshArtworks;

  const didInitialFocusRef = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!didInitialFocusRef.current) {
        didInitialFocusRef.current = true;
        return undefined;
      }
      refreshArtworksRef.current();
      return undefined;
    }, [])
  );

  useEffect(() => {
    setFeedLanguage("all");
  }, [language]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [feedLanguage, tab]);

  useEffect(() => {
    const timer = setInterval(() => setTimeTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => () => {
    if (actionToastTimerRef.current) clearTimeout(actionToastTimerRef.current);
  }, []);

  function showActionToast(message: string, target: { type: "boost"; artworkId: string } | { type: "reward" }) {
    if (!message.trim()) return;
    if (actionToastTimerRef.current) clearTimeout(actionToastTimerRef.current);
    setActionToast({ message, target });
    actionToastTimerRef.current = setTimeout(() => {
      setActionToast(null);
      actionToastTimerRef.current = null;
    }, 2600);
  }

  const approved = useMemo(() => getRankedCompetitionItems(feedLanguage, tab === "liked" ? "liked" : tab === "new" ? "new" : "smart"), [feedLanguage, getRankedCompetitionItems, tab]);
  const pending = items.filter((item) => !item.deleted && !item.approved && (feedLanguage === "all" || item.language === feedLanguage) && (item.source ?? "competition") === "competition");
  const visibleApproved = approved.slice(0, visibleCount);
  const ownApprovedArtworks = items.filter((item) => !item.deleted && item.approved && (item.source ?? "competition") === "competition" && isOwnedArtwork(item, account));
  const ownsApprovedArtwork = ownApprovedArtworks.length > 0;
  const hasAdFreeStatus = isAuthenticated && (account.isPremium || account.isAdmin || account.staffBadges.includes("moderator") || account.staffBadges.includes("editor"));
  const rewardedAdRequirementsEnabled = areRewardedAdRequirementsEnabled();
  const rewardStatus = getRewardedBoostStatus();
  const shouldShowRewardBoostAd = !hasAdFreeStatus && ownsApprovedArtwork && rewardStatus.rewardCredits <= 0;
  const columnGap = 8;
  const gridColumns = 2;
  const cardWidth = Math.floor((width - (width < 360 ? 32 : 36) - columnGap * (gridColumns - 1)) / gridColumns);
  const artImageHeight = Math.max(132, Math.round(cardWidth * 0.95));
  const selectedArtwork = selectedArtworkId ? items.find((item) => item.id === selectedArtworkId) ?? null : null;

  function requireAuth(action: () => void) {
    if (!isAuthenticated) {
      router.push("/(tabs)/account");
      return;
    }

    action();
  }

  async function shareArtwork(id: string) {
    await Clipboard.setStringAsync(Linking.createURL(`/(tabs)/ranking?artwork=${id}`));
    setPreviewCopied(true);
    setTimeout(() => setPreviewCopied(false), 1500);
  }

  function runPremiumBoost(id: string) {
    const result = boostArtwork(id);
    showActionToast(result.message ?? "", { type: "boost", artworkId: id });
  }

  function runSuperLike(id: string) {
    const status = getSuperLikeStatus(id);
    const result = superLikeArtwork(id);
    if (!result.message) return;
    setSuperLikeModal({
      kind: status.isPremium ? "info" : "premium",
      message: result.message
    });
  }

  async function runRewardedAd() {
    const completed = await showRewardedAd("admob_rewarded");
    if (!completed) {
      showActionToast(
        language === "tr" ? "Sponsorlu içerik tamamlanamadı." : language === "ru" ? "Спонсорский контент не завершён." : language === "uz" ? "Homiy kontent yakunlanmadi." : "Sponsored content was not completed.",
        { type: "reward" }
      );
      return;
    }
    const result = watchRewardedBoostAd();
    setTimeTick(Date.now());
    showActionToast(result.message ?? "", { type: "reward" });
  }

  return (
    <AppChrome
      title={copy.communityArt[language]}
      eyebrow="Community"
      showTopAd={!hasAdFreeStatus}
      topAdContent={shouldShowRewardBoostAd ? (
        <RewardedBoostAdSlot
          language={language}
          ownsApprovedArtwork={ownsApprovedArtwork}
          status={rewardStatus}
          onWatch={() => { void runRewardedAd(); }}
          now={timeTick}
          rewardedAdRequirementsEnabled={rewardedAdRequirementsEnabled}
          styles={styles}
        />
      ) : (
        <AdSlot label={copy.adSlot[language]} placement="weekly_top" compact />
      )}
    >
      {(refreshVersion) => (
      <>
      <RefreshOnPull version={refreshVersion} onRefresh={refreshArtworks} />
      <ImagePreviewModal
        image={selectedArtwork?.image ?? null}
        onClose={() => setSelectedArtworkId(null)}
        footer={selectedArtwork ? (
          <CommunityArtworkPreviewFooter
            artwork={selectedArtwork}
            colors={colors}
            onShare={() => { void shareArtwork(selectedArtwork.id); }}
            shareCopied={previewCopied}
          />
        ) : undefined}
      />
      <Modal visible={rulesOpen} transparent animationType="fade" onRequestClose={() => setRulesOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.rulesPanel}>
            <Pressable onPress={() => setRulesOpen(false)} style={styles.rulesClose}>
              <Ionicons name="close" size={21} color={colors.ivory} />
            </Pressable>
            <Ionicons name="document-text-outline" size={30} color={colors.gold} />
            <Text style={styles.rulesTitle}>{language === "tr" ? "Resim Yarışması Kuralları" : language === "ru" ? "Правила конкурса рисунков" : language === "uz" ? "Rasm tanlovi qoidalari" : "Painting Contest Rules"}</Text>
            <Text style={styles.rulesText}>
              {language === "tr"
                ? "Yüklenen resimler kısa süre içinde listede görünür. Her üye haftada en fazla iki görselle katılabilir; değerlendirme sürecindeki paylaşımlar da hak kullanır. Liste 15 dakikada bir yeniden hesaplanır. Sponsorlu içerik izleyerek 30 dakikada bir yukarı taşıma hakkı kazanabilirsiniz. Sıralama net puan, aktiflik ve keşif dengesiyle hesaplanır."
                : language === "ru"
                  ? "Загруженные работы скоро появятся в списке. Участник может отправить до двух работ в неделю, включая работы на проверке. Список обновляется каждые 15 минут. Просмотр спонсорского контента даёт право поднять работу раз в 30 минут."
                  : language === "uz"
                    ? "Yuklangan rasmlar tez orada ro'yxatda ko'rinadi. Har a'zo haftasiga ikki rasm yuborishi mumkin; tekshiruvdagi rasmlar ham huquq ishlatadi. Ro'yxat har 15 daqiqada yangilanadi. Homiy kontent ko'rib 30 daqiqada bir oldinga chiqarish huquqi olish mumkin."
                    : "Uploaded images appear in the list shortly. Each member can submit up to two works per week, including works under review. The list recalculates every 15 minutes. Watching sponsored content earns one boost credit every 30 minutes."}
            </Text>
          </View>
        </View>
      </Modal>

      <Modal visible={!!superLikeModal} transparent animationType="fade" onRequestClose={() => setSuperLikeModal(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setSuperLikeModal(null)}>
          <Pressable style={styles.superLikeModalCard} onPress={() => undefined}>
            <Pressable onPress={() => setSuperLikeModal(null)} style={styles.rulesClose}>
              <Ionicons name="close" size={20} color={colors.ivory} />
            </Pressable>
            <View style={styles.superLikeModalHeader}>
              <Ionicons name="star" size={22} color="#f3c24b" />
              <Text style={styles.superLikeModalTitle}>{superLikeModalLabels.title[language]}</Text>
            </View>
            <Text style={styles.superLikeModalText}>{superLikeModal?.message}</Text>
            {superLikeModal?.kind === "premium" ? (
              <Pressable
                style={styles.superLikeModalPrimary}
                onPress={() => {
                  setSuperLikeModal(null);
                  router.push("/premium" as never);
                }}
              >
                <Ionicons name="diamond" size={15} color={colors.ink} />
                <Text style={styles.superLikeModalPrimaryText}>{superLikeModalLabels.premiumCta[language]}</Text>
              </Pressable>
            ) : null}
          </Pressable>
        </Pressable>
      </Modal>

      {actionToast?.target.type === "reward" && actionToast.message ? (
        <View style={styles.actionFeedbackStrip}>
          <Ionicons name="sparkles" size={13} color={colors.gold} />
          <Text style={styles.actionFeedbackText} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit minimumFontScale={0.78}>
            {actionToast.message}
          </Text>
        </View>
      ) : null}

      <View style={styles.competitionHero}>
        <ClippedGradient colors={["#312E81", "#6D28D9", "#9D174D"]} androidColors={["#29255F", "#612552"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} radius={radii.xl} />
        <View style={styles.heroGlow} pointerEvents="none" />
        <View style={styles.heroCopy}>
          <Text style={styles.heroKicker}>{language === "tr" ? "AKTİF YARIŞMA" : language === "ru" ? "АКТИВНЫЙ КОНКУРС" : language === "uz" ? "FAOL TANLOV" : "ACTIVE COMPETITION"}</Text>
          <Text style={styles.heroTitle}>{language === "tr" ? "Resim Yarışması" : language === "ru" ? "Конкурс живописи" : language === "uz" ? "Rasm tanlovi" : "Painting Competition"}</Text>
          <View style={styles.heroStats}><View style={styles.heroChip}><Ionicons name="images" size={12} color={v2Colors.premium} /><Text style={styles.heroChipText}>{approved.length}</Text></View><View style={styles.heroChip}><Ionicons name="people" size={12} color={v2Colors.cyan} /><Text style={styles.heroChipText}>{language === "tr" ? "Topluluk oylaması" : language === "ru" ? "Голосование" : language === "uz" ? "Ovoz berish" : "Community vote"}</Text></View></View>
          <Pressable onPress={() => requireAuth(() => router.push("/upload-artwork"))} style={styles.heroCta}><Text style={styles.heroCtaText}>{language === "tr" ? "Katıl" : language === "ru" ? "Участвовать" : language === "uz" ? "Qatnashish" : "Join"}</Text><Ionicons name="arrow-forward" size={14} color={v2Colors.text} /></Pressable>
        </View>
        <View style={styles.trophyOrbit}>
          <View style={styles.trophyRing} />
          {approved[0]?.image ? <Image source={imageSource(approved[0].image, "large")} style={styles.heroArtwork} contentFit="cover" cachePolicy="memory-disk" allowDownscaling /> : <View style={styles.heroArtworkFallback}><Ionicons name="trophy" size={42} color={v2Colors.premium} /></View>}
          <View style={styles.trophyBadge}><Ionicons name="trophy" size={18} color="#3A2603" /></View>
        </View>
      </View>

      <View style={styles.quickActions}>
        <Pressable onPress={() => requireAuth(() => router.push("/upload-artwork"))} style={styles.quickAction}>
          <Ionicons name="cloud-upload" size={15} color={colors.gold} />
          <Text style={styles.quickActionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>{copy.uploadArtwork[language]}</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/weekly-winners")} style={styles.quickAction}>
          <Ionicons name="trophy-outline" size={15} color={colors.gold} />
          <Text style={styles.quickActionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58}>{copy.previousWinners[language]}</Text>
        </Pressable>
        <Pressable onPress={() => router.push("/rewards")} style={styles.quickAction}>
          <Ionicons name="ribbon-outline" size={15} color={colors.gold} />
          <Text style={styles.quickActionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>{language === "tr" ? "Ödüller" : language === "ru" ? "Награды" : language === "uz" ? "Mukofotlar" : "Awards"}</Text>
        </Pressable>
        <Pressable onPress={() => setRulesOpen(true)} style={styles.quickAction}>
          <Ionicons name="document-text-outline" size={15} color={colors.gold} />
          <Text style={styles.quickActionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>{language === "tr" ? "Kurallar" : language === "ru" ? "Правила" : language === "uz" ? "Qoidalar" : "Rules"}</Text>
        </Pressable>
      </View>

      <View style={styles.languageFilters}>
        {[{ code: "all" as const, label: t(commonCopy.filterAll, language) }, ...["tr", "uz", "ru", "en"].map((code) => languages.find((item) => item.code === code)!)].map((item) => (
          <Pressable
            key={item.code}
            onPress={() => setFeedLanguage(item.code)}
            style={[styles.languageFilter, feedLanguage === item.code && styles.languageFilterActive]}
          >
            <Text style={[styles.languageFilterText, feedLanguage === item.code && styles.languageFilterTextActive]}>
              {item.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isAuthenticated && account.isAdmin && pending.length ? (
        <View style={styles.pending}>
          <Text style={styles.sectionTitle}>{copy.approvalQueue[language]}</Text>
          {pending.map((item) => (
            <View key={item.id} style={styles.pendingRow}>
              <Image source={imageSource(item.image, "thumbnail")} style={styles.pendingImage} contentFit="cover" cachePolicy="memory-disk" allowDownscaling />
              <View style={styles.pendingInfo}>
                <Pressable onPress={() => requireAuth(() => router.push({ pathname: "/profile/[name]", params: { name: profileRouteParam({ username: item.uploaderUsername, displayName: item.artistName, uid: item.ownerId }) } }))}>
                  <View style={styles.nameRow}>
                    <Ionicons name="brush" size={12} color={colors.gold} />
                    <UserNameWithCountry name={item.artistName} username={item.uploaderUsername} uid={item.ownerId} countryCode={lookupUserCountry([item.uploaderUsername, item.artistName, item.ownerId])} nameStyle={styles.cardTitle} />
                  </View>
                </Pressable>
                <Text style={styles.cardText} numberOfLines={2}>{item.story}</Text>
              </View>
              <Pressable onPress={() => approveArtwork(item.id)} style={styles.approveButton}>
                <Ionicons name="checkmark" size={18} color={colors.ink} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.tabs}>
        <Pressable onPress={() => setTab("current")} style={[styles.tab, tab === "current" && styles.tabActive]}>
          <Text style={[styles.tabText, tab === "current" && styles.tabTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
            {language === "tr" ? "Güncel" : language === "ru" ? "Актуальные" : language === "uz" ? "Dolzarb" : "Current"}
          </Text>
        </Pressable>
        <Pressable onPress={() => setTab("new")} style={[styles.tab, tab === "new" && styles.tabActive]}>
          <Text style={[styles.tabText, tab === "new" && styles.tabTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{copy.newArtworks[language]}</Text>
        </Pressable>
        <Pressable onPress={() => setTab("liked")} style={[styles.tab, tab === "liked" && styles.tabActive]}>
          <Text style={[styles.tabText, tab === "liked" && styles.tabTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{copy.mostLiked[language]}</Text>
        </Pressable>
      </View>

      <View style={styles.grid}>
        {visibleApproved.map((item) => (
          <View
            key={item.id}
            style={[
              styles.artCard,
              { width: cardWidth },
              actionToast?.target.type === "boost" && actionToast.target.artworkId === item.id && styles.artCardToastActive
            ]}
          >
            <Pressable onPress={() => setSelectedArtworkId(item.id)}>
              <Image source={imageSource(item.image, "card")} style={[styles.artImage, { height: artImageHeight }]} contentFit="cover" cachePolicy="memory-disk" allowDownscaling />
              <View style={styles.zoomHint}>
                <Ionicons name="expand-outline" size={12} color={colors.ivory} />
              </View>
            </Pressable>
            <View style={styles.artBody}>
              <Pressable onPress={() => requireAuth(() => router.push({ pathname: "/profile/[name]", params: { name: profileRouteParam({ username: item.uploaderUsername, displayName: item.artistName, uid: item.ownerId }) } }))}>
                <View style={styles.nameRow}>
                  <Ionicons name="brush" size={10} color={colors.gold} />
                  <UserNameWithCountry name={item.artistName} username={item.uploaderUsername} uid={item.ownerId} countryCode={lookupUserCountry([item.uploaderUsername, item.artistName, item.ownerId])} nameStyle={styles.cardTitle} />
                </View>
              </Pressable>
              <Text style={styles.artworkTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>{item.title}</Text>
              <View style={styles.countryRow}>
                <Ionicons name="location-outline" size={10} color={colors.gold} />
                <Text style={styles.countryText} numberOfLines={1}>{getArtworkCountry(item.artistName, language)}</Text>
              </View>
              <View style={styles.voteRow}>
                <Pressable onPress={() => requireAuth(() => voteArtwork(item.id, "like"))} style={[styles.likeButton, votes[item.id] === "like" && styles.voteButtonDone]}>
                  <Ionicons name={votes[item.id] === "like" ? "heart" : "heart-outline"} size={13} color={votes[item.id] === "like" ? colors.ink : colors.gold} />
                  <Text style={[styles.voteText, votes[item.id] === "like" && styles.voteTextDone]}>{item.likes}</Text>
                </Pressable>
                <Pressable onPress={() => requireAuth(() => runSuperLike(item.id))} style={[styles.superLikeButton, superLiked[item.id] && styles.superLikeButtonDone]}>
                  <Ionicons name={superLiked[item.id] ? "star" : "star-outline"} size={14} color={superLiked[item.id] ? "#3a2a05" : "#f3c24b"} />
                  <Text style={[styles.superLikeText, superLiked[item.id] && styles.voteTextDone]}>{item.superLikes ?? 0}</Text>
                </Pressable>
              </View>
              {isOwnedArtwork(item, account) ? (
                <ActionAnchor
                  active={actionToast?.target.type === "boost" && actionToast.target.artworkId === item.id}
                  message={actionToast?.target.type === "boost" && actionToast.target.artworkId === item.id ? actionToast.message : ""}
                  styles={styles}
                >
                  <Pressable disabled={!getBoostStatus(item.id).canBoost} onPress={() => runPremiumBoost(item.id)} style={[styles.boostButton, !getBoostStatus(item.id).canBoost && styles.boostButtonDisabled]}>
                    <Ionicons name="rocket-outline" size={11} color={getBoostStatus(item.id).canBoost ? colors.ink : colors.muted} />
                    <Text style={[styles.boostText, !getBoostStatus(item.id).canBoost && styles.boostTextDisabled]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                      {getBoostLabel(getBoostStatus(item.id), language, timeTick)}
                    </Text>
                  </Pressable>
                </ActionAnchor>
              ) : null}
            </View>
          </View>
        ))}
      </View>
      {visibleCount < approved.length ? (
        <Pressable onPress={() => setVisibleCount((value) => value + PAGE_SIZE)} style={styles.moreButton}>
          <Text style={styles.moreText}>{language === "tr" ? "Daha fazla gör" : language === "ru" ? "Показать еще" : language === "uz" ? "Ko'proq ko'rish" : "Show more"}</Text>
        </Pressable>
      ) : null}

      {!isAuthenticated ? (
        <View style={styles.emptyState}>
          <Ionicons name="trophy-outline" size={28} color={colors.gold} />
          <Text style={styles.emptyTitle}>
            {language === "tr"
              ? "Sıralamaları görmek için giriş yapmalısınız"
              : language === "en"
                ? "Sign in to view the rankings"
                : language === "ru"
                  ? "Войдите, чтобы увидеть рейтинг"
                  : "Reytinglarni ko'rish uchun tizimga kiring"}
          </Text>
          <Text style={styles.loginHint}>
            {language === "tr"
              ? "Giriş yaptıktan sonra yarışma sıralamalarını ve oy durumunuzu görebilirsiniz."
              : language === "en"
                ? "After signing in, you can view contest rankings and your voting status."
                : language === "ru"
                  ? "После входа вы увидите рейтинг конкурса и статус своих голосов."
                  : "Tizimga kirgandan so'ng tanlov reytingi va ovoz holatingizni ko'rasiz."}
          </Text>
          <Pressable onPress={() => router.push("/(tabs)/account")} style={styles.loginEmptyButton}>
            <Ionicons name="log-in-outline" size={16} color={colors.ink} />
            <Text style={styles.loginEmptyButtonText}>
              {language === "tr" ? "Giriş yap" : language === "en" ? "Sign in" : language === "ru" ? "Войти" : "Kirish"}
            </Text>
          </Pressable>
        </View>
      ) : !approved.length ? (
        <View style={styles.emptyState}>
          <Ionicons name="images-outline" size={24} color={colors.gold} />
          <Text style={styles.emptyTitle}>
            {language === "tr"
              ? "Bu dil için henüz onaylı resim yok"
              : language === "en"
                ? "No approved images for this language yet"
                : language === "ru"
                  ? "Для этого языка пока нет одобренных рисунков"
                  : "Bu til uchun hozircha tasdiqlangan rasmlar yo'q"}
          </Text>
        </View>
      ) : null}
      </>
      )}
    </AppChrome>
  );
}

function RefreshOnPull({ version, onRefresh }: { version: number; onRefresh: () => void }) {
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  useEffect(() => {
    if (version > 0) onRefreshRef.current();
  }, [version]);
  return null;
}

function ActionAnchor({
  active,
  message,
  styles,
  placement = "above",
  children
}: {
  active: boolean;
  message: string;
  styles: ReturnType<typeof createStyles>;
  placement?: "above" | "below";
  children: ReactNode;
}) {
  return (
    <View style={styles.actionAnchor}>
      {active && message && placement === "above" ? (
        <View style={styles.actionToastAbove}>
          <Text style={styles.actionToastText} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit minimumFontScale={0.72}>{message}</Text>
        </View>
      ) : null}
      {children}
      {active && message && placement === "below" ? (
        <View style={styles.actionToastBelow}>
          <Text style={styles.actionToastText} numberOfLines={1} ellipsizeMode="tail" adjustsFontSizeToFit minimumFontScale={0.72}>{message}</Text>
        </View>
      ) : null}
    </View>
  );
}

function RewardedBoostAdSlot({
  language,
  ownsApprovedArtwork,
  status,
  onWatch,
  now,
  rewardedAdRequirementsEnabled,
  styles
}: {
  language: Language;
  ownsApprovedArtwork: boolean;
  status: { canWatchAd: boolean; nextRewardAt?: number; rewardCredits: number };
  onWatch: () => void;
  now: number;
  rewardedAdRequirementsEnabled: boolean;
  styles: ReturnType<typeof createStyles>;
}) {
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const waiting = !!status.nextRewardAt && status.nextRewardAt > now;
  const title = language === "tr"
    ? rewardedAdRequirementsEnabled ? "Resmini öne çıkarmak için reklam izle" : "Resmini öne çıkar"
    : language === "ru"
      ? rewardedAdRequirementsEnabled ? "Посмотрите рекламу, чтобы поднять рисунок" : "Поднять рисунок"
      : language === "uz"
        ? rewardedAdRequirementsEnabled ? "Rasmingizni oldinga chiqarish uchun reklama ko'ring" : "Rasmingizni oldinga chiqaring"
        : rewardedAdRequirementsEnabled ? "Watch an ad to boost your image" : "Boost your image";
  const helper = status.rewardCredits > 0
    ? language === "tr" ? "Yukarı taşıma hakkınız hazır." : language === "ru" ? "Право продвижения готово." : language === "uz" ? "Oldinga chiqarish huquqi tayyor." : "Your boost credit is ready."
    : waiting
      ? `${language === "tr" ? "Tekrar" : language === "ru" ? "Снова" : language === "uz" ? "Yana" : "Again"}: ${formatRemaining(status.nextRewardAt! - now, language)}`
      : rewardedAdRequirementsEnabled
        ? language === "tr" ? "Sponsorlu içerik tamamlanınca tek kullanımlık yukarı taşıma hakkı açılır." : language === "ru" ? "После просмотра спонсорского контента откроется одно право продвижения." : language === "uz" ? "Homiy kontentdan so'ng bir martalik oldinga chiqarish huquqi ochiladi." : "Watching sponsored content unlocks one boost credit."
        : language === "tr" ? "Tek kullanımlık yukarı taşıma hakkı açılır." : language === "ru" ? "Откроется одно право продвижения." : language === "uz" ? "Bir martalik oldinga chiqarish huquqi ochiladi." : "Unlocks one boost credit.";

  return (
    <View style={[styles.rewardAdSlot, { borderColor: colors.line, backgroundColor: getRewardAdBackground(theme) }]}>
      <View style={styles.rewardAdTextBlock}>
        <View style={styles.rewardAdTitleRow}>
          <Ionicons name="sparkles-outline" size={17} color={colors.gold} />
          <Text style={[styles.rewardAdTitle, { color: colors.ivory }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{title}</Text>
        </View>
        <Text style={[styles.rewardAdHelper, { color: colors.muted }]} numberOfLines={2}>{ownsApprovedArtwork ? helper : language === "tr" ? "Yarışmada yer alan resmin olduğunda bu alandan öne taşıma hakkı kazanabilirsin." : language === "en" ? "When you have a work in the contest, you can earn a boost here." : language === "ru" ? "Когда ваша работа участвует в конкурсе, здесь можно получить продвижение." : "Tanlovda ishtirok etgan rasm bo'lganda bu yerda oldinga chiqarish huquqi olish mumkin."}</Text>
      </View>
      <Pressable disabled={!ownsApprovedArtwork || !status.canWatchAd || status.rewardCredits > 0} onPress={onWatch} style={[styles.rewardAdButton, { backgroundColor: colors.gold }, (!ownsApprovedArtwork || !status.canWatchAd || status.rewardCredits > 0) && styles.rewardAdButtonDisabled]}>
        <Text style={[styles.rewardAdButtonText, { color: colors.ink }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
          {status.rewardCredits > 0
            ? language === "tr" ? "Hazır" : language === "ru" ? "Готово" : language === "uz" ? "Tayyor" : "Ready"
            : status.canWatchAd
              ? rewardedAdRequirementsEnabled
                ? language === "tr" ? "İzle" : language === "ru" ? "Смотреть" : language === "uz" ? "Ko'rish" : "Watch"
                : language === "tr" ? "Al" : language === "ru" ? "Получить" : language === "uz" ? "Olish" : "Get"
              : formatRemaining((status.nextRewardAt ?? now) - now, language)}
        </Text>
      </Pressable>
    </View>
  );
}

function getRewardAdBackground(theme: AppTheme) {
  if (isBrightTheme(theme)) return "rgba(255,250,241,0.82)";
  if (theme === "vangogh") return "rgba(16,42,70,0.62)";
  if (theme === "dali") return "rgba(66,42,20,0.58)";
  return "rgba(29, 23, 18, 0.54)";
}

function getBoostLabel(
  status: { canBoost: boolean; nextBoostAt?: number; needsRewardAd: boolean; isPremiumBoost: boolean },
  language: Language,
  now: number
) {
  if (status.canBoost) {
    return language === "tr" ? "Yukarı taşı" : language === "ru" ? "Поднять" : language === "uz" ? "Yuqoriga" : "Boost";
  }
  if (status.needsRewardAd) {
    return language === "tr" ? "Sponsorlu içerik" : language === "ru" ? "Спонсор" : language === "uz" ? "Homiy" : "Sponsor";
  }
  if (status.nextBoostAt && status.nextBoostAt > now) {
    return `${language === "tr" ? "Tekrar" : language === "ru" ? "Снова" : language === "uz" ? "Yana" : "Again"}: ${formatRemaining(status.nextBoostAt - now, language)}`;
  }
  return language === "tr" ? "Beklemede" : language === "ru" ? "Ожидание" : language === "uz" ? "Kutilmoqda" : "Waiting";
}

function formatRemaining(milliseconds: number, language: Language) {
  const totalMinutes = Math.max(1, Math.floor(Math.max(0, milliseconds) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) {
    return language === "tr" ? `${minutes} dk` : language === "ru" ? `${minutes} мин` : language === "uz" ? `${minutes} daq` : `${minutes}m`;
  }
  return language === "tr" ? `${hours} sa ${minutes} dk` : language === "ru" ? `${hours} ч ${minutes} мин` : language === "uz" ? `${hours} soat ${minutes} daq` : `${hours}h ${minutes}m`;
}

function getArtworkCountry(artistName: string, language: Language) {
  const countryByArtist: Record<string, string> = {
    "Aylin Demir": "turkiye",
    "Mert Kaya": "turkiye",
    "Efe Sönmez": "turkiye",
    "Elif Moran": "turkiye",
    "Aziz Rahim": "uzbekistan",
    "Timur Yıldız": "uzbekistan",
    "Daria Volkova": "russia"
  };
  const countryId = countryByArtist[artistName] ?? "turkiye";
  return countryCommunities.find((country) => country.id === countryId)?.name[language] ?? countryId;
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
return StyleSheet.create({
  quickActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 7,
    marginTop: 2
  },
  competitionHero: { minHeight: 196, borderRadius: radii.xl, overflow: "hidden", flexDirection: "row", alignItems: "center", padding: 18, marginBottom: 16, borderWidth: 1, borderColor: "rgba(217,70,239,0.25)" },
  heroGlow: { position: "absolute", right: -25, top: -25, width: 180, height: 180, borderRadius: 90, backgroundColor: "rgba(59,130,246,0.14)", shadowColor: v2Colors.magenta, shadowOpacity: 0.72, shadowRadius: 32, shadowOffset: { width: 0, height: 0 } },
  heroCopy: { width: "59%", minWidth: 0, zIndex: 2 },
  heroKicker: { color: v2Colors.premium, fontSize: 9, lineHeight: 12, fontWeight: "900", letterSpacing: 1.35 },
  heroTitle: { color: v2Colors.text, fontSize: 24, lineHeight: 29, fontWeight: "800", letterSpacing: -0.5, marginTop: 4 },
  heroStats: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
  heroChip: { minHeight: 27, borderRadius: radii.pill, backgroundColor: "rgba(7,10,18,0.38)", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8 },
  heroChipText: { color: v2Colors.textSecondary, fontSize: 9, fontWeight: "700" },
  heroCta: { alignSelf: "flex-start", minHeight: 38, borderRadius: radii.pill, backgroundColor: "rgba(99,102,241,0.72)", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, marginTop: 10 },
  heroCtaText: { color: v2Colors.text, fontSize: 11, fontWeight: "900" },
  trophyOrbit: { position: "absolute", right: 8, width: 132, height: 132, alignItems: "center", justifyContent: "center" },
  trophyRing: { position: "absolute", width: 126, height: 94, borderRadius: 64, borderWidth: 1, borderColor: "rgba(246,196,83,0.48)", transform: [{ rotate: "-18deg" }] },
  heroArtwork: { width: 92, height: 92, borderRadius: 46, borderWidth: 2, borderColor: v2Colors.premium },
  heroArtworkFallback: { width: 92, height: 92, borderRadius: 46, backgroundColor: "rgba(7,10,18,0.52)", borderWidth: 2, borderColor: v2Colors.premium, alignItems: "center", justifyContent: "center" },
  trophyBadge: { position: "absolute", right: 11, bottom: 7, width: 36, height: 36, borderRadius: 18, backgroundColor: v2Colors.premium, borderWidth: 2, borderColor: "rgba(255,255,255,0.45)", alignItems: "center", justifyContent: "center" },
  actionFeedbackStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(243, 194, 75, 0.38)",
    backgroundColor: "rgba(22, 17, 12, 0.97)",
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8
  },
  actionFeedbackText: {
    flex: 1,
    color: colors.gold,
    fontSize: 11,
    fontWeight: "800",
    lineHeight: 14
  },
  rewardAdSlot: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    marginTop: 10
  },
  rewardAdTextBlock: {
    flex: 1,
    minWidth: 0
  },
  rewardAdTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minWidth: 0
  },
  rewardAdTitle: {
    flex: 1,
    fontSize: 12,
    fontWeight: "900"
  },
  rewardAdHelper: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "700",
    marginTop: 3
  },
  rewardAdButton: {
    minWidth: 72,
    minHeight: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  rewardAdButtonDisabled: {
    opacity: 0.62
  },
  rewardAdButtonText: {
    fontSize: 11,
    fontWeight: "900",
    textAlign: "center"
  },
  quickAction: {
    width: "48.5%",
    minHeight: 42,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: "rgba(217, 184, 101, 0.24)",
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 6
  },
  quickActionText: {
    flex: 1,
    color: colors.ivory,
    fontSize: 10,
    fontWeight: "900",
    textAlign: "center"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.54)",
    justifyContent: "center",
    padding: 18
  },
  rulesPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 18,
    gap: 10
  },
  rulesClose: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2
  },
  rulesTitle: {
    color: colors.ivory,
    fontSize: 21,
    fontWeight: "900",
    marginTop: 4
  },
  rulesText: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700"
  },
  superLikeModalCard: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(243, 194, 75, 0.28)",
    backgroundColor: colors.panel,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 16,
    gap: 12,
    maxWidth: 340,
    width: "100%",
    alignSelf: "center"
  },
  superLikeModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 28
  },
  superLikeModalTitle: {
    color: colors.ivory,
    fontSize: 17,
    fontWeight: "900",
    flexShrink: 1
  },
  superLikeModalText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700"
  },
  superLikeModalPrimary: {
    minHeight: 42,
    borderRadius: 10,
    backgroundColor: colors.gold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 2
  },
  superLikeModalPrimaryText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900"
  },
  languageFilters: {
    flexDirection: "row",
    gap: 6,
    marginTop: 10
  },
  languageFilter: {
    flex: 1,
    minHeight: 30,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  languageFilterActive: {
    borderColor: colors.gold,
    backgroundColor: colors.gold
  },
  languageFilterText: {
    color: colors.ivory,
    fontSize: 11,
    fontWeight: "900"
  },
  languageFilterTextActive: {
    color: colors.ink
  },
  sectionTitle: {
    color: colors.ivory,
    fontSize: 18,
    fontWeight: "900"
  },
  winnerBanner: {
    minHeight: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(217, 184, 101, 0.34)",
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    marginTop: 14
  },
  winnerTextBlock: {
    flex: 1,
    minWidth: 0
  },
  winnerLabel: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  winnerTitle: {
    color: colors.ivory,
    fontSize: 13,
    fontWeight: "900",
    marginTop: 2
  },
  winnerScore: {
    minWidth: 34,
    color: colors.ink,
    backgroundColor: colors.gold,
    borderRadius: 8,
    overflow: "hidden",
    textAlign: "center",
    paddingVertical: 6,
    fontWeight: "900"
  },
  pending: {
    marginTop: 14,
    gap: 10
  },
  pendingRow: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    gap: 10
  },
  pendingImage: {
    width: 58,
    height: 58,
    borderRadius: 8
  },
  pendingInfo: {
    flex: 1
  },
  approveButton: {
    width: 38,
    height: 38,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center"
  },
  tabs: {
    flexDirection: "row",
    gap: 6,
    marginTop: 12,
    marginBottom: 10
  },
  tab: {
    flex: 1,
    minHeight: 34,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panel,
    paddingHorizontal: 6
  },
  tabActive: {
    backgroundColor: v2Colors.violet,
    borderColor: v2Colors.brightViolet
  },
  tabText: {
    color: colors.ivory,
    fontWeight: "900",
    fontSize: 11,
    textAlign: "center"
  },
  tabTextActive: {
    color: v2Colors.text
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  artCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: "rgba(255,255,255,0.035)",
    overflow: "hidden"
  },
  artImage: {
    width: "100%"
  },
  zoomHint: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.25)"
  },
  artBody: {
    padding: 6
  },
  cardTitle: {
    color: colors.ivory,
    fontSize: 11,
    fontWeight: "900",
    flexShrink: 1
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    minWidth: 0
  },
  cardText: {
    color: colors.muted,
    fontSize: 11,
    lineHeight: 15,
    marginTop: 2
  },
  artworkTitle: {
    color: colors.ivory,
    fontSize: 10,
    lineHeight: 14,
    marginTop: 3,
    fontWeight: "900"
  },
  countryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    marginTop: 3
  },
  countryText: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "800",
    flex: 1
  },
  voteRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 6
  },
  voteButton: {
    minHeight: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(217, 184, 101, 0.22)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    paddingHorizontal: 4,
    flex: 1
  },
  likeButton: {
    flex: 1,
    minHeight: 26,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(217, 184, 101, 0.22)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 8
  },
  superLikeButton: {
    flex: 1,
    minHeight: 26,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(243, 194, 75, 0.6)",
    backgroundColor: "rgba(243, 194, 75, 0.14)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 8
  },
  superLikeButtonDone: {
    backgroundColor: "#f3c24b",
    borderColor: "#f3c24b"
  },
  superLikeText: {
    color: "#f3c24b",
    fontSize: 10,
    fontWeight: "900"
  },
  voteButtonDone: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  voteText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "900"
  },
  voteTextDone: {
    color: colors.ink
  },
  netPill: {
    minHeight: 24,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(217, 184, 101, 0.22)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    flex: 1
  },
  netLabel: {
    color: colors.muted,
    fontSize: 7,
    fontWeight: "900",
    lineHeight: 9
  },
  netValue: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "900",
    lineHeight: 12
  },
  boostButton: {
    minHeight: 24,
    borderRadius: 6,
    backgroundColor: colors.gold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 5,
    paddingHorizontal: 6
  },
  boostButtonDisabled: {
    borderWidth: 1,
    borderColor: "rgba(217, 184, 101, 0.18)",
    backgroundColor: colors.panelSoft
  },
  boostText: {
    color: colors.ink,
    fontSize: 10,
    fontWeight: "900"
  },
  boostTextDisabled: {
    color: colors.muted
  },
  actionAnchor: {
    position: "relative",
    zIndex: 2
  },
  actionToastAbove: {
    position: "absolute",
    bottom: "100%",
    left: -4,
    right: -4,
    marginBottom: 6,
    zIndex: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(243, 194, 75, 0.38)",
    backgroundColor: "rgba(22, 17, 12, 0.97)",
    paddingHorizontal: 8,
    paddingVertical: 7,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8
  },
  actionToastBelow: {
    position: "absolute",
    top: "100%",
    left: -8,
    right: -8,
    marginTop: 6,
    zIndex: 30,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(243, 194, 75, 0.38)",
    backgroundColor: "rgba(22, 17, 12, 0.97)",
    paddingHorizontal: 8,
    paddingVertical: 7,
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 8
  },
  actionToastText: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "800",
    lineHeight: 14,
    textAlign: "center"
  },
  artCardToastActive: {
    zIndex: 40,
    elevation: 14
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
    fontWeight: "900",
    flexShrink: 1
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
  previewVoteText: {
    color: colors.gold,
    fontWeight: "900"
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
  emptyState: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    alignItems: "center",
    gap: 8,
    padding: 18
  },
  emptyTitle: {
    color: colors.ivory,
    fontWeight: "900",
    textAlign: "center"
  },
  loginHint: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700",
    textAlign: "center"
  },
  loginEmptyButton: {
    minHeight: 42,
    paddingHorizontal: 20,
    borderRadius: 8,
    backgroundColor: colors.gold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 4
  },
  loginEmptyButtonText: {
    color: colors.ink,
    fontSize: 13,
    fontWeight: "900"
  },
  moreButton: {
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12
  },
  moreText: {
    color: colors.ink,
    fontSize: 14,
    fontWeight: "900"
  },
});
}
