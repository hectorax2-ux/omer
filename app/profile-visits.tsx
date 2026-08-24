import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { AuthRequired } from "@/components/auth-required";
import { ProfileAvatar } from "@/components/profile-avatar";
import { getThemeColors } from "@/constants/theme";
import { safeTextLayout } from "@/constants/text-layout";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { profileVisitsCopy } from "@/app/i18n/profile-visits";
import {
  fetchProfileVisits,
  loadProfileVisitCache,
  markProfileVisitsViewed,
  profileVisitErrorDetails,
  saveProfileVisitVisibility,
  type ProfileVisitIdentity,
  type ProfileVisitSnapshot,
  type ProfileVisitVisibility
} from "@/src/services/firebase/profile-visit-service";
import { t } from "@/utils/localized-text";

type LoadState = "loading" | "data" | "empty" | "error";

export default function ProfileVisitsScreen() {
  const { language } = useLanguage();
  const { account, isAuthenticated, updateAccount } = useAccount();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const { width } = useWindowDimensions();
  const styles = useMemo(() => createStyles(colors, width < 360), [colors, width]);
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const orbitProgress = useRef(new Animated.Value(0)).current;
  const requestRef = useRef(0);
  const snapshotRef = useRef<ProfileVisitSnapshot | null>(null);
  const [snapshot, setSnapshot] = useState<ProfileVisitSnapshot | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [reloadToken, setReloadToken] = useState(0);
  const [savingVisibility, setSavingVisibility] = useState(false);
  const [privacyError, setPrivacyError] = useState("");

  useEffect(() => {
    if (reducedMotion) {
      orbitProgress.setValue(0.12);
      return;
    }
    const animation = Animated.loop(Animated.timing(orbitProgress, {
      toValue: 1,
      duration: 18000,
      easing: Easing.linear,
      useNativeDriver: true
    }));
    animation.start();
    return () => animation.stop();
  }, [orbitProgress, reducedMotion]);

  useEffect(() => {
    if (!account.uid) return;
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    let active = true;
    const warmSnapshot = snapshotRef.current?.ownerUid === account.uid ? snapshotRef.current : null;
    if (!warmSnapshot) {
      snapshotRef.current = null;
      setSnapshot(null);
      setLoadState("loading");
    }

    const cachePromise = loadProfileVisitCache(account.uid).catch((error) => {
      console.warn("[Profile visits] Local cache read failed.", profileVisitErrorDetails(error));
      return null;
    });
    void cachePromise.then((cached) => {
      if (!active || requestRef.current !== requestId || !cached) return;
      snapshotRef.current = cached;
      setSnapshot(cached);
      setLoadState(cached.summaries.length ? "data" : "empty");
    });
    void fetchProfileVisits(account.uid, account.isPremium).then((fresh) => {
      if (!active || requestRef.current !== requestId) return;
      snapshotRef.current = fresh;
      setSnapshot(fresh);
      setLoadState(fresh.summaries.length ? "data" : "empty");
      void markProfileVisitsViewed(account.uid, fresh);
    }).catch(async (error) => {
      if (!active || requestRef.current !== requestId) return;
      console.warn("[Profile visits] Summary query failed.", profileVisitErrorDetails(error));
      const cached = snapshotRef.current?.ownerUid === account.uid ? snapshotRef.current : await cachePromise;
      if (!active || requestRef.current !== requestId || cached) return;
      setLoadState("error");
    });

    return () => {
      active = false;
    };
  }, [account.isPremium, account.uid, reloadToken]);

  if (!isAuthenticated) return <AuthRequired title={t(profileVisitsCopy.title, language)} />;

  const now = Date.now();
  const summaries = snapshot?.summaries ?? [];
  const recent = summaries.filter((item) => now - item.lastVisitedAt <= 7 * 24 * 60 * 60 * 1000);
  const today = recent.filter((item) => isToday(item.lastVisitedAt));
  const returning = recent.filter((item) => item.visitCount > 1);
  const identityById = new Map((snapshot?.identities ?? []).map((item) => [item.id, item]));
  const rotation = orbitProgress.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const reverseRotation = orbitProgress.interpolate({ inputRange: [0, 1], outputRange: ["360deg", "0deg"] });

  async function selectVisibility(visibility: ProfileVisitVisibility) {
    if (!account.uid || savingVisibility || account.profileVisitVisibility === visibility) return;
    const previous = account.profileVisitVisibility;
    setSavingVisibility(true);
    setPrivacyError("");
    updateAccount({ profileVisitVisibility: visibility });
    await saveProfileVisitVisibility(account.uid, visibility).catch(() => {
      updateAccount({ profileVisitVisibility: previous });
      setPrivacyError(t(profileVisitsCopy.privacyError, language));
    });
    setSavingVisibility(false);
  }

  function openVisitor(identity?: ProfileVisitIdentity) {
    if (!identity?.visitorUid || identity.visibilityMode === "anonymous") return;
    router.push({ pathname: "/profile/[name]", params: { name: identity.visitorUsername || identity.visitorUid } });
  }

  return (
    <AppChrome title={t(profileVisitsCopy.title, language)} eyebrow={t(profileVisitsCopy.eyebrow, language)} showBackButton backToHome>
      <LinearGradient colors={[colors.panel, colors.navy, colors.panelSoft]} style={styles.hero}>
        <View style={styles.portalStage} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Animated.View style={[styles.orbitOuter, { transform: [{ perspective: 600 }, { rotate: rotation }] }]}>
            <View style={[styles.orbitDot, styles.orbitDotOne]} />
            <View style={[styles.orbitDot, styles.orbitDotTwo]} />
          </Animated.View>
          <Animated.View style={[styles.orbitInner, { transform: [{ perspective: 600 }, { rotate: reverseRotation }] }]}>
            <View style={[styles.orbitDot, styles.orbitDotThree]} />
          </Animated.View>
          <LinearGradient colors={[colors.gold, colors.magenta]} style={styles.portalCore}>
            <Ionicons name="sparkles" size={19} color={colors.navy} />
          </LinearGradient>
        </View>
        <Text style={styles.heroTitle}>{t(profileVisitsCopy.heroTitle, language)}</Text>
        <Text style={styles.heroSubtitle}>{t(profileVisitsCopy.heroSubtitle, language)}</Text>
        <View style={styles.privacyBlock}>
          <Text style={styles.privacyEyebrow}>{t(profileVisitsCopy.privacyTitle, language).toLocaleUpperCase(language)}</Text>
          <View style={styles.segmented}>
            {(["visible", "anonymous"] as const).map((visibility) => {
              const selected = account.profileVisitVisibility === visibility;
              return (
                <Pressable
                  key={visibility}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled: savingVisibility }}
                  onPress={() => void selectVisibility(visibility)}
                  style={[styles.segment, selected && styles.segmentSelected]}
                >
                  <View style={[styles.statusDot, visibility === "anonymous" && styles.statusDotAnonymous]} />
                  <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{t(profileVisitsCopy[visibility], language)}</Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.privacyHint}>
            {t(account.profileVisitVisibility === "anonymous" ? profileVisitsCopy.anonymousHint : profileVisitsCopy.visibleHint, language)}
          </Text>
          {privacyError ? <Text style={styles.errorText}>{privacyError}</Text> : null}
        </View>
      </LinearGradient>

      <View style={styles.statsRow}>
        {[
          { label: profileVisitsCopy.last7Days, value: recent.length },
          { label: profileVisitsCopy.today, value: today.length },
          { label: profileVisitsCopy.returning, value: returning.length }
        ].map((stat) => (
          <View key={stat.label.en} style={styles.stat}>
            <Text style={styles.statLabel}>{t(stat.label, language).toLocaleUpperCase(language)}</Text>
            <Text style={styles.statValue}>{loadState === "data" || loadState === "empty" ? stat.value : "—"}</Text>
          </View>
        ))}
      </View>

      {loadState === "loading" ? <VisitorSkeleton styles={styles} label={t(profileVisitsCopy.loading, language)} /> : null}
      {loadState === "error" ? (
        <View style={styles.stateCard}>
          <Ionicons name="cloud-offline-outline" size={30} color={colors.gold} />
          <Text style={styles.stateTitle}>{t(profileVisitsCopy.errorTitle, language)}</Text>
          <Text style={styles.stateText}>{t(profileVisitsCopy.errorBody, language)}</Text>
          <Pressable onPress={() => { setLoadState("loading"); setReloadToken((value) => value + 1); }} style={styles.retryButton}>
            <Text style={styles.retryText}>{t(profileVisitsCopy.retry, language)}</Text>
          </Pressable>
        </View>
      ) : null}
      {loadState === "empty" ? (
        <View style={styles.stateCard}>
          <View style={styles.emptyOrbit}><View style={styles.emptyCore} /></View>
          <Text style={styles.stateTitle}>{t(profileVisitsCopy.emptyTitle, language)}</Text>
          <Text style={styles.stateText}>{t(profileVisitsCopy.emptyBody, language)}</Text>
          <Text style={styles.emptyNote}>{t(profileVisitsCopy.emptyNote, language)}</Text>
        </View>
      ) : null}
      {loadState === "data" && account.isPremium ? (
        <View style={styles.timelineSection}>
          <Text style={styles.sectionTitle}>{t(profileVisitsCopy.visitors, language)}</Text>
          {summaries.map((visit, index) => {
            const identity = identityById.get(visit.id);
            const anonymous = visit.anonymous || identity?.visibilityMode === "anonymous" || !identity?.visitorUid;
            const isNew = visit.lastVisitedAt > (snapshot?.lastViewedAt ?? 0);
            return (
              <Pressable
                key={visit.id}
                disabled={anonymous}
                onPress={() => openVisitor(identity)}
                style={({ pressed }) => [styles.visitorRow, pressed && !anonymous && styles.visitorRowPressed]}
              >
                <View style={styles.timelineRail}>
                  <View style={[styles.timelinePoint, isNew && styles.timelinePointNew]} />
                  {index < summaries.length - 1 ? <View style={styles.timelineLine} /> : null}
                </View>
                {anonymous ? (
                  <LinearGradient colors={[colors.plum, colors.navy]} style={styles.anonymousAvatar}>
                    <Ionicons name="sparkles-outline" size={21} color={colors.gold} />
                  </LinearGradient>
                ) : <ProfileAvatar uri={identity?.visitorPhotoURL} size={46} borderColor={colors.gold} />}
                <View style={styles.visitorInfo}>
                  <View style={styles.nameLine}>
                    <Text numberOfLines={1} style={styles.visitorName}>{anonymous ? t(profileVisitsCopy.anonymousVisitor, language) : identity?.visitorName || identity?.visitorUsername}</Text>
                    {isNew ? <Text style={styles.newLabel}>{t(profileVisitsCopy.new, language).toLocaleUpperCase(language)}</Text> : null}
                  </View>
                  {!anonymous && identity?.visitorUsername ? <Text numberOfLines={1} style={styles.username}>@{identity.visitorUsername}</Text> : null}
                  <View style={styles.metaLine}>
                    <Text style={styles.visitTime}>{formatVisitTime(visit.lastVisitedAt, language)}</Text>
                    {visit.visitCount > 1 ? <Text style={styles.returnedText}>↻ {visit.visitCount}. {t(profileVisitsCopy.visitNumber, language)}</Text> : null}
                  </View>
                </View>
                {!anonymous ? <Ionicons name="chevron-forward" size={18} color={colors.bronze} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
      {loadState === "data" && !account.isPremium ? (
        <LinearGradient colors={[colors.panel, colors.navy]} style={styles.premiumReveal}>
          <View style={styles.premiumIcon}><Ionicons name="diamond-outline" size={22} color={colors.gold} /></View>
          <View style={styles.premiumCopy}>
            <Text style={styles.premiumTitle}>{t(profileVisitsCopy.premiumTitle, language)}</Text>
            <Text style={styles.premiumCount}>+{summaries.length} {t(profileVisitsCopy.moreVisitors, language)}</Text>
            <Text style={styles.premiumBody}>{t(profileVisitsCopy.premiumBody, language)}</Text>
          </View>
          <Pressable onPress={() => router.push("/premium")} style={styles.premiumButton}>
            <Text style={styles.premiumButtonText}>{t(profileVisitsCopy.premiumCta, language)}</Text>
          </Pressable>
        </LinearGradient>
      ) : null}
    </AppChrome>
  );
}

function VisitorSkeleton({ styles, label }: { styles: ReturnType<typeof createStyles>; label: string }) {
  return (
    <View accessibilityLabel={label} style={styles.skeletonWrap}>
      {[0, 1, 2].map((item) => (
        <View key={item} style={styles.skeletonRow}>
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonCopy}>
            <View style={styles.skeletonTitle} />
            <View style={styles.skeletonLine} />
          </View>
        </View>
      ))}
    </View>
  );
}

function isToday(value: number) {
  const date = new Date(value);
  const today = new Date();
  return date.getFullYear() === today.getFullYear() && date.getMonth() === today.getMonth() && date.getDate() === today.getDate();
}

function formatVisitTime(value: number, language: "tr" | "en" | "ru" | "uz") {
  const difference = Math.max(0, Date.now() - value);
  if (difference < 60 * 1000) return t(profileVisitsCopy.justNow, language);
  if (difference < 60 * 60 * 1000) return `${Math.floor(difference / (60 * 1000))} ${t(profileVisitsCopy.minutesAgo, language)}`;
  const date = new Date(value);
  const time = new Intl.DateTimeFormat(localeFor(language), { hour: "2-digit", minute: "2-digit" }).format(date);
  if (isToday(value)) return `${t(profileVisitsCopy.today, language)} • ${time}`;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.getFullYear() === yesterday.getFullYear() && date.getMonth() === yesterday.getMonth() && date.getDate() === yesterday.getDate()) {
    return `${t(profileVisitsCopy.yesterday, language)} • ${time}`;
  }
  return new Intl.DateTimeFormat(localeFor(language), { day: "numeric", month: "long" }).format(date);
}

function localeFor(language: "tr" | "en" | "ru" | "uz") {
  if (language === "tr") return "tr-TR";
  if (language === "ru") return "ru-RU";
  if (language === "uz") return "uz-UZ";
  return "en-US";
}

function createStyles(colors: ReturnType<typeof getThemeColors>, compact: boolean) {
  return StyleSheet.create({
    hero: { borderRadius: 20, borderWidth: 1, borderColor: colors.line, padding: compact ? 16 : 20, alignItems: "center", overflow: "hidden", marginBottom: 12 },
    portalStage: { width: 176, height: 98, alignItems: "center", justifyContent: "center", marginBottom: 8 },
    orbitOuter: { position: "absolute", width: 172, height: 72, borderRadius: 90, borderWidth: 1, borderColor: `${colors.gold}55` },
    orbitInner: { position: "absolute", width: 118, height: 50, borderRadius: 70, borderWidth: 1, borderColor: `${colors.magenta}55` },
    orbitDot: { position: "absolute", width: 8, height: 8, borderRadius: 4, backgroundColor: colors.ivory, borderWidth: 2, borderColor: colors.gold },
    orbitDotOne: { left: 12, top: 10 },
    orbitDotTwo: { right: 14, bottom: 8, width: 6, height: 6, borderRadius: 3 },
    orbitDotThree: { right: 8, top: 14 },
    portalCore: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: `${colors.ivory}99` },
    heroTitle: { ...safeTextLayout, color: colors.ivory, fontSize: compact ? 21 : 23, lineHeight: compact ? 26 : 28, fontWeight: "900", textAlign: "center", maxWidth: 330 },
    heroSubtitle: { ...safeTextLayout, color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: "700", textAlign: "center", maxWidth: 330, marginTop: 5 },
    privacyBlock: { alignSelf: "stretch", marginTop: 16, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14 },
    privacyEyebrow: { ...safeTextLayout, color: colors.bronze, fontSize: 10, lineHeight: 14, letterSpacing: 0.8, fontWeight: "900", textAlign: "center" },
    segmented: { flexDirection: "row", alignSelf: "center", marginTop: 9, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: `${colors.ink}99`, padding: 3, width: "100%", maxWidth: 300 },
    segment: { flex: 1, minWidth: 0, minHeight: 38, borderRadius: 9, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7 },
    segmentSelected: { backgroundColor: colors.panelSoft, borderWidth: 1, borderColor: `${colors.gold}55` },
    statusDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.jade },
    statusDotAnonymous: { backgroundColor: colors.magenta },
    segmentText: { ...safeTextLayout, color: colors.muted, fontSize: 13, fontWeight: "900" },
    segmentTextSelected: { color: colors.ivory },
    privacyHint: { ...safeTextLayout, color: colors.muted, fontSize: 11.5, lineHeight: 16, fontWeight: "700", textAlign: "center", marginTop: 8 },
    errorText: { ...safeTextLayout, color: colors.wine, fontSize: 11, lineHeight: 15, fontWeight: "800", textAlign: "center", marginTop: 4 },
    statsRow: { flexDirection: "row", gap: compact ? 7 : 9, marginBottom: 16 },
    stat: { flex: 1, minWidth: 0, minHeight: 70, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
    statLabel: { ...safeTextLayout, color: colors.muted, fontSize: compact ? 8.5 : 9.5, lineHeight: 12, letterSpacing: compact ? 0.2 : 0.45, fontWeight: "900", textAlign: "center" },
    statValue: { ...safeTextLayout, color: colors.gold, fontSize: 23, lineHeight: 28, fontWeight: "900", marginTop: 2 },
    timelineSection: { marginBottom: 14 },
    sectionTitle: { ...safeTextLayout, color: colors.ivory, fontSize: 17, lineHeight: 22, fontWeight: "900", marginBottom: 8 },
    visitorRow: { minHeight: 76, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11, paddingHorizontal: compact ? 9 : 12, marginBottom: 8, overflow: "hidden" },
    visitorRowPressed: { opacity: 0.76, transform: [{ scale: 0.995 }] },
    timelineRail: { width: 10, alignSelf: "stretch", alignItems: "center" },
    timelinePoint: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.bronze, marginTop: 22, zIndex: 2 },
    timelinePointNew: { backgroundColor: colors.gold },
    timelineLine: { position: "absolute", width: 1, top: 28, bottom: -25, backgroundColor: colors.line },
    anonymousAvatar: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: `${colors.gold}88`, alignItems: "center", justifyContent: "center" },
    visitorInfo: { flex: 1, minWidth: 0 },
    nameLine: { flexDirection: "row", alignItems: "center", gap: 6, minWidth: 0 },
    visitorName: { ...safeTextLayout, color: colors.ivory, fontSize: 14.5, lineHeight: 19, fontWeight: "900" },
    newLabel: { ...safeTextLayout, color: colors.gold, fontSize: 8, lineHeight: 11, letterSpacing: 0.5, fontWeight: "900" },
    username: { ...safeTextLayout, color: colors.bronze, fontSize: 11.5, lineHeight: 16, fontWeight: "800" },
    metaLine: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 2 },
    visitTime: { ...safeTextLayout, color: colors.muted, fontSize: 10.5, lineHeight: 15, fontWeight: "700" },
    returnedText: { ...safeTextLayout, color: colors.gold, fontSize: 10.5, lineHeight: 15, fontWeight: "800" },
    premiumReveal: { borderRadius: 16, borderWidth: 1, borderColor: `${colors.gold}55`, padding: 14, flexDirection: compact ? "column" : "row", alignItems: compact ? "stretch" : "center", gap: 11, marginBottom: 14 },
    premiumIcon: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: `${colors.gold}55`, alignItems: "center", justifyContent: "center", alignSelf: compact ? "center" : "auto" },
    premiumCopy: { flex: 1, minWidth: 0 },
    premiumTitle: { ...safeTextLayout, color: colors.ivory, fontSize: 14, lineHeight: 18, fontWeight: "900", textAlign: compact ? "center" : "left" },
    premiumCount: { ...safeTextLayout, color: colors.gold, fontSize: 12, lineHeight: 17, fontWeight: "900", marginTop: 2, textAlign: compact ? "center" : "left" },
    premiumBody: { ...safeTextLayout, color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: "700", marginTop: 3, textAlign: compact ? "center" : "left" },
    premiumButton: { minHeight: 38, borderRadius: 10, borderWidth: 1, borderColor: colors.gold, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
    premiumButtonText: { ...safeTextLayout, color: colors.gold, fontSize: 11.5, lineHeight: 16, fontWeight: "900", textAlign: "center" },
    stateCard: { minHeight: 230, borderRadius: 18, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center", padding: 24, marginBottom: 14 },
    stateTitle: { ...safeTextLayout, color: colors.ivory, fontSize: 17, lineHeight: 22, fontWeight: "900", textAlign: "center", marginTop: 12 },
    stateText: { ...safeTextLayout, color: colors.muted, fontSize: 12.5, lineHeight: 18, fontWeight: "700", textAlign: "center", maxWidth: 290, marginTop: 5 },
    emptyNote: { ...safeTextLayout, color: colors.bronze, fontSize: 11, lineHeight: 16, fontStyle: "italic", fontWeight: "700", textAlign: "center", marginTop: 12 },
    emptyOrbit: { width: 86, height: 42, borderRadius: 44, borderWidth: 1, borderColor: `${colors.gold}66`, alignItems: "center", justifyContent: "center", transform: [{ rotate: "-8deg" }] },
    emptyCore: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.gold },
    retryButton: { minHeight: 40, borderRadius: 10, borderWidth: 1, borderColor: colors.gold, paddingHorizontal: 18, alignItems: "center", justifyContent: "center", marginTop: 14 },
    retryText: { ...safeTextLayout, color: colors.gold, fontSize: 12, fontWeight: "900" },
    skeletonWrap: { gap: 8, marginBottom: 14 },
    skeletonRow: { height: 76, borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 13 },
    skeletonAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.panelSoft },
    skeletonCopy: { flex: 1, gap: 8 },
    skeletonTitle: { width: "58%", height: 11, borderRadius: 6, backgroundColor: colors.panelSoft },
    skeletonLine: { width: "36%", height: 8, borderRadius: 4, backgroundColor: colors.panelSoft }
  });
}
