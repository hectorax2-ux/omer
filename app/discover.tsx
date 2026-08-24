import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { AuthRequired } from "@/components/auth-required";
import { ProfileAvatar } from "@/components/profile-avatar";
import { getRoleIcon, getRoleItem, roleItems, type UserRoleId } from "@/constants/profile-taxonomy";
import { getThemeColors } from "@/constants/theme";
import { radii, v2Colors } from "@/constants/design";
import { safeTextLayout } from "@/constants/text-layout";
import { countryCommunities, uiCopy } from "@/data/content";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useSocial } from "@/hooks/use-social";
import type { SuggestedUser } from "@/providers/social-provider";
import { rankProfileDiscoveryUsers } from "@/features/profile/profile-discovery-ranking";
import { resolveCountryCodeFromUser, resolveCountryId } from "@/utils/country-utils";
import { profileRouteParam } from "@/utils/profile-route";

type ProfileFilter = "all" | "recommended" | "premium" | UserRoleId;
type Language = "tr" | "en" | "ru" | "uz";

const labels = {
  filter: { tr: "Rozet / rol seç", en: "Choose role", ru: "Выберите роль", uz: "Rolni tanlang" },
  featured: { tr: "Galeride Öne Çıkanlar", en: "Featured in the Gallery", ru: "Избранное в галерее", uz: "Galereyada tanlanganlar" },
  discover: { tr: "Yeni İnsanlar Keşfet", en: "Discover New People", ru: "Откройте новых людей", uz: "Yangi insonlarni kashf et" },
  emptyTitle: { tr: "Galeride yeni yüzler aranıyor.", en: "The gallery is seeking new faces.", ru: "Галерея ищет новые лица.", uz: "Galereya yangi chehralarni kutmoqda." },
  emptyBody: { tr: "Filtreyi değiştirerek tekrar bakabilirsin.", en: "Try another filter or search.", ru: "Измените фильтр или поиск.", uz: "Filtr yoki qidiruvni o'zgartirib ko'ring." },
  errorTitle: { tr: "Profiller şu anda getirilemedi.", en: "Profiles could not be loaded.", ru: "Не удалось загрузить профили.", uz: "Profillarni yuklab bo'lmadi." },
  retry: { tr: "Tekrar dene", en: "Retry", ru: "Повторить", uz: "Qayta urinish" },
  more: { tr: "Galeriyi genişlet", en: "Expand the gallery", ru: "Расширить галерею", uz: "Galereyani kengaytir" },
  all: { tr: "Tüm Profiller", en: "All Profiles", ru: "Все профили", uz: "Barcha profillar" },
  recommended: { tr: "Önerilen", en: "Suggested", ru: "Рекомендуемые", uz: "Tavsiya etilgan" },
  premium: { tr: "Premium", en: "Premium", ru: "Премиум", uz: "Premium" },
  refreshing: { tr: "Galeri yenileniyor", en: "Refreshing gallery", ru: "Галерея обновляется", uz: "Galereya yangilanmoqda" }
} as const;

export default function DiscoverScreen() {
  const { isAuthenticated } = useAccount();
  const { language } = useLanguage();
  if (!isAuthenticated) return <AuthRequired title={uiCopy.discover[language]} />;
  return <AuthenticatedDiscoverScreen />;
}

function AuthenticatedDiscoverScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const { width } = useWindowDimensions();
  const compact = width < 360;
  const horizontalGap = compact ? 9 : 11;
  const contentWidth = width - (compact ? 32 : width > 720 ? 48 : 36);
  const cardWidth = Math.floor((contentWidth - horizontalGap) / 2);
  const styles = useMemo(() => createStyles(colors, compact), [colors, compact]);
  const social = useSocial();
  const loadMoreUsers = social.loadMoreUsers;
  const { account } = useAccount();
  const router = useRouter();
  const reducedMotion = useReducedMotion();
  const [filter, setFilter] = useState<ProfileFilter>("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(12);
  const [queryText, setQueryText] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(queryText.trim().toLocaleLowerCase("tr")), 300);
    return () => clearTimeout(timer);
  }, [queryText]);

  useEffect(() => setVisibleCount(12), [debouncedQuery, filter]);

  const userCountryId = resolveCountryId(account.country);
  const ranked = useMemo(() => rankProfileDiscoveryUsers(social.visibleSuggestedUsers, {
    followingUids: social.followingUids,
    countryId: userCountryId,
    interests: account.interests
  }), [account.interests, social.followingUids, social.visibleSuggestedUsers, userCountryId]);
  const featured = ranked.slice(0, 3);
  const filtered = useMemo(() => ranked
    .filter((user) => matchesFilter(user, filter))
    .filter((user) => !debouncedQuery || `${user.name} ${user.username} ${user.country ?? ""}`.toLocaleLowerCase("tr").includes(debouncedQuery)), [debouncedQuery, filter, ranked]);
  const visible = filtered.slice(0, visibleCount);
  const supportedRoles = useMemo(() => roleItems.filter((role) => ranked.some((user) => user.role === role.id)), [ranked]);
  const options = useMemo(() => [
    { key: "all" as const, icon: "sparkles" as const, label: labels.all },
    { key: "recommended" as const, icon: "compass" as const, label: labels.recommended },
    ...supportedRoles.map((role) => ({ key: role.id as ProfileFilter, icon: role.icon, label: role.label })),
    ...(ranked.some((user) => user.isPremium) ? [{ key: "premium" as const, icon: "diamond" as const, label: labels.premium }] : [])
  ], [ranked, supportedRoles]);
  const selected = options.find((item) => item.key === filter) ?? options[0];
  const showInitialLoading = social.profileDiscoveryStatus === "loading" && !ranked.length;
  const showError = social.profileDiscoveryStatus === "error" && !ranked.length;
  const showEmpty = social.profileDiscoveryStatus === "success" && !filtered.length && !social.hasMoreUsers;

  useEffect(() => {
    if (social.profileDiscoveryStatus !== "success" || filtered.length || !social.hasMoreUsers) return;
    void loadMoreUsers();
  }, [debouncedQuery, filter, filtered.length, loadMoreUsers, social.hasMoreUsers, social.profileDiscoveryStatus]);

  async function showMore() {
    if (visibleCount + 8 > filtered.length && social.hasMoreUsers) await loadMoreUsers();
    setVisibleCount((value) => value + 8);
  }

  function openProfile(user: SuggestedUser) {
    router.push({ pathname: "/profile/[name]", params: { name: profileRouteParam(user) } });
  }

  return (
    <AppChrome title={uiCopy.discover[language]} showBackButton backToHome>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={v2Colors.cyan} />
        <TextInput
          value={queryText}
          onChangeText={setQueryText}
          placeholder={language === "tr" ? "Kullanıcı adı, isim veya soyisim ara" : language === "ru" ? "Поиск по имени или логину" : language === "uz" ? "Ism yoki username qidirish" : "Search name or username"}
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />
      </View>

      <DiscoveryHero users={featured} reducedMotion={reducedMotion} styles={styles} language={language} />

      {featured.length ? (
        <View style={styles.section}>
          <SectionTitle title={labels.featured[language]} styles={styles} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRail} decelerationRate="fast">
            {featured.map((user, index) => (
              <PortraitCard key={user.uid || user.username} user={user} width={Math.min(230, contentWidth * 0.64)} index={index} featured language={language} reducedMotion={reducedMotion} onPress={() => openProfile(user)} styles={styles} />
            ))}
          </ScrollView>
        </View>
      ) : null}

      <Pressable onPress={() => setPickerOpen((value) => !value)} style={styles.selector}>
        <View style={styles.selectorLeft}>
          <View style={styles.selectorIcon}><Ionicons name={selected.icon} size={17} color={v2Colors.cyan} /></View>
          <View style={styles.selectorCopy}>
            <Text style={styles.selectorLabel}>{labels.filter[language]}</Text>
            <Text style={styles.selectorValue}>{selected.label[language]}</Text>
          </View>
        </View>
        <Ionicons name={pickerOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.muted} />
      </Pressable>

      {pickerOpen ? (
        <View style={styles.optionPanel}>
          {options.map((option) => (
            <Pressable key={option.key} onPress={() => { setFilter(option.key); setPickerOpen(false); }} style={[styles.optionChip, filter === option.key && styles.optionActive]}>
              <Ionicons name={option.icon} size={13} color={filter === option.key ? "#071126" : colors.gold} />
              <Text style={[styles.optionText, filter === option.key && styles.optionTextActive]} numberOfLines={1}>{option.label[language]}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.galleryHeading}>
        <SectionTitle title={labels.discover[language]} styles={styles} />
        {social.profileDiscoveryRefreshing ? <Text style={styles.refreshingText}>{labels.refreshing[language]}</Text> : null}
      </View>

      {showInitialLoading ? <PortraitSkeletonGrid cardWidth={cardWidth} gap={horizontalGap} styles={styles} /> : null}
      {showError ? <DiscoveryState icon="cloud-offline-outline" title={labels.errorTitle[language]} action={labels.retry[language]} onAction={social.retryProfileDiscovery} styles={styles} /> : null}
      {showEmpty ? <DiscoveryState icon="planet-outline" title={labels.emptyTitle[language]} body={labels.emptyBody[language]} styles={styles} /> : null}

      {visible.length ? (
        <View style={[styles.galleryGrid, { gap: horizontalGap }]}>
          {visible.map((user, index) => (
            <PortraitCard key={user.uid || user.username} user={user} width={cardWidth} index={index} language={language} reducedMotion={reducedMotion} onPress={() => openProfile(user)} styles={styles} />
          ))}
        </View>
      ) : null}

      {visibleCount < filtered.length || social.hasMoreUsers ? (
        <Pressable onPress={() => void showMore()} style={styles.moreButton}>
          <Text style={styles.moreText}>{labels.more[language]}</Text>
          <Ionicons name="chevron-down" size={17} color={v2Colors.cyan} />
        </Pressable>
      ) : null}
    </AppChrome>
  );
}

function DiscoveryHero({ users, reducedMotion, styles, language }: { users: SuggestedUser[]; reducedMotion: boolean; styles: ReturnType<typeof createStyles>; language: Language }) {
  const rotation = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reducedMotion) return;
    const animation = Animated.loop(Animated.timing(rotation, { toValue: 1, duration: 18000, easing: Easing.linear, useNativeDriver: true }));
    animation.start();
    return () => animation.stop();
  }, [reducedMotion, rotation]);
  const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] });
  const reverse = rotation.interpolate({ inputRange: [0, 1], outputRange: ["360deg", "0deg"] });
  return (
    <LinearGradient colors={["#111831", "#172344", "#26385E"]} style={styles.hero}>
      <View style={styles.heroLightOne} pointerEvents="none" />
      <View style={styles.heroLightTwo} pointerEvents="none" />
      <View style={styles.heroCopy}>
        <Text style={styles.heroKicker}>ART ATLAS DISCOVERY</Text>
        <Text style={styles.heroTitle}>{uiCopy.discover[language]}</Text>
        <Text style={styles.heroText}>{uiCopy.discoverSubtitle[language]}</Text>
      </View>
      <View style={styles.orbitStage} pointerEvents="none">
        <Animated.View style={[styles.orbitOuter, { transform: [{ perspective: 700 }, { rotate: spin }] }]} />
        <Animated.View style={[styles.orbitMiddle, { transform: [{ perspective: 700 }, { rotate: reverse }] }]} />
        <Animated.View style={[styles.orbitInner, { transform: [{ perspective: 700 }, { rotate: spin }] }]} />
        <LinearGradient colors={[v2Colors.violet, v2Colors.blue, v2Colors.cyan]} style={styles.compassOrb}><Ionicons name="compass" size={25} color="#F6F0DF" /></LinearGradient>
        {users.slice(0, 3).map((user, index) => <ProfileAvatar key={user.uid || user.username} uri={user.image} size={index === 0 ? 28 : 23} style={index === 0 ? styles.orbitPortrait0 : index === 1 ? styles.orbitPortrait1 : styles.orbitPortrait2} />)}
      </View>
    </LinearGradient>
  );
}

function PortraitCard({ user, width, index, featured = false, language, reducedMotion, onPress, styles }: { user: SuggestedUser; width: number; index: number; featured?: boolean; language: Language; reducedMotion: boolean; onPress: () => void; styles: ReturnType<typeof createStyles> }) {
  const entrance = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reducedMotion) return;
    Animated.timing(entrance, { toValue: 1, duration: 300, delay: Math.min(index, 4) * 35, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [entrance, index, reducedMotion]);
  const country = localizedCountry(user, language);
  const role = getRoleItem(user.role);
  const imageSize = Math.round(width * (featured ? 1.18 : 1.25));
  return (
    <Animated.View style={{ width, opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }, { scale: Animated.multiply(entrance.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }), pressScale) }] }}>
      <Pressable onPress={onPress} onPressIn={() => Animated.spring(pressScale, { toValue: 0.97, speed: 32, bounciness: 0, useNativeDriver: true }).start()} onPressOut={() => Animated.spring(pressScale, { toValue: 1, speed: 24, bounciness: 7, useNativeDriver: true }).start()} style={[styles.portraitCard, featured && styles.featuredCard]} accessibilityRole="button" accessibilityLabel={`${user.name}, @${user.username}`}>
        <ProfileAvatar uri={user.image} size={imageSize} borderRadius={20} style={styles.portraitImage} />
        <LinearGradient colors={["rgba(8,12,30,0.02)", "rgba(8,12,30,0.42)", "rgba(8,12,30,0.98)"]} locations={[0.28, 0.58, 1]} style={StyleSheet.absoluteFill} />
        <View style={styles.cardHighlight} />
        <View style={styles.portraitInfo}>
          <View style={styles.rolePill}>
            <Ionicons name={user.isPremium ? "diamond" : getRoleIcon(user.role)} size={10} color={user.isPremium ? "#F4BF4F" : "#38D7E8"} />
            <Text style={styles.roleText} numberOfLines={1}>{user.isPremium ? labels.premium[language] : role.label[language]}</Text>
          </View>
          <Text style={styles.portraitName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.76}>{user.name}</Text>
          <Text style={styles.portraitUsername} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>@{user.username}</Text>
          {country ? <Text style={styles.countryText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>{country}</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function SectionTitle({ title, styles }: { title: string; styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.sectionTitleRow}><View style={styles.sectionAccent} /><Text style={styles.sectionTitle}>{title}</Text></View>;
}

function PortraitSkeletonGrid({ cardWidth, gap, styles }: { cardWidth: number; gap: number; styles: ReturnType<typeof createStyles> }) {
  return <View style={[styles.galleryGrid, { gap }]}>{[0, 1, 2, 3].map((item) => <View key={item} style={[styles.skeletonCard, { width: cardWidth }]}><View style={styles.skeletonGlow} /></View>)}</View>;
}

function DiscoveryState({ icon, title, body, action, onAction, styles }: { icon: keyof typeof Ionicons.glyphMap; title: string; body?: string; action?: string; onAction?: () => void; styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.stateCard}><View style={styles.stateOrbit}><Ionicons name={icon} size={25} color={v2Colors.cyan} /></View><Text style={styles.stateTitle}>{title}</Text>{body ? <Text style={styles.stateBody}>{body}</Text> : null}{action && onAction ? <Pressable onPress={onAction} style={styles.retryButton}><Text style={styles.retryText}>{action}</Text></Pressable> : null}</View>;
}

function matchesFilter(user: SuggestedUser, filter: ProfileFilter) {
  if (filter === "all" || filter === "recommended") return true;
  if (filter === "premium") return Boolean(user.isPremium);
  return user.role === filter;
}

function localizedCountry(user: SuggestedUser, language: Language) {
  const code = resolveCountryCodeFromUser(user);
  const match = countryCommunities.find((country) => country.id === user.countryId || country.code === code);
  if (!match && !user.country) return "";
  return `${code ? flagFromCode(code) : ""}${code ? " " : ""}${match?.name[language] ?? user.country}`;
}

function flagFromCode(code: string) {
  const normalized = code.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) return "";
  return String.fromCodePoint(...[...normalized].map((character) => 127397 + character.charCodeAt(0)));
}

function createStyles(colors: ReturnType<typeof getThemeColors>, compact: boolean) {
  return StyleSheet.create({
    searchBox: { minHeight: 46, borderRadius: radii.pill, borderWidth: 1, borderColor: "rgba(56,215,232,0.2)", backgroundColor: "rgba(17,24,49,0.82)", flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14 },
    searchInput: { ...safeTextLayout, flex: 1, minWidth: 0, color: colors.ivory, fontSize: compact ? 12.5 : 14, fontWeight: "800" },
    hero: { minHeight: compact ? 158 : 176, borderRadius: 22, overflow: "hidden", marginTop: 12, padding: compact ? 15 : 18, justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" },
    heroLightOne: { position: "absolute", right: -28, top: -20, width: 150, height: 150, borderRadius: 75, backgroundColor: "rgba(118,87,255,0.17)" },
    heroLightTwo: { position: "absolute", right: 50, bottom: -72, width: 130, height: 130, borderRadius: 65, backgroundColor: "rgba(56,215,232,0.08)" },
    heroCopy: { width: compact ? "57%" : "59%", zIndex: 2 },
    heroKicker: { ...safeTextLayout, color: "#38D7E8", fontSize: 8.5, lineHeight: 12, fontWeight: "900", letterSpacing: 1.25 },
    heroTitle: { ...safeTextLayout, color: "#F6F0DF", fontSize: compact ? 21 : 25, lineHeight: compact ? 26 : 30, fontWeight: "900", marginTop: 5 },
    heroText: { ...safeTextLayout, color: "#AEB8D0", fontSize: 11, lineHeight: 16, fontWeight: "700", marginTop: 4 },
    orbitStage: { position: "absolute", right: compact ? -4 : 4, width: compact ? 132 : 148, height: compact ? 132 : 148, alignItems: "center", justifyContent: "center" },
    orbitOuter: { position: "absolute", width: "100%", height: "58%", borderRadius: 100, borderWidth: 1, borderColor: "rgba(56,215,232,0.34)" },
    orbitMiddle: { position: "absolute", width: "78%", height: "78%", borderRadius: 100, borderWidth: 1, borderColor: "rgba(118,87,255,0.36)" },
    orbitInner: { position: "absolute", width: "61%", height: "38%", borderRadius: 100, borderWidth: 1, borderColor: "rgba(244,191,79,0.4)" },
    compassOrb: { width: 54, height: 54, borderRadius: 27, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.28)", elevation: 4 },
    orbitPortrait0: { position: "absolute", right: 2, top: 28, borderColor: "rgba(244,191,79,0.8)" },
    orbitPortrait1: { position: "absolute", left: 8, bottom: 22, borderColor: "rgba(56,215,232,0.8)" },
    orbitPortrait2: { position: "absolute", right: 27, bottom: 2, borderColor: "rgba(118,87,255,0.8)" },
    section: { marginTop: 21 },
    sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
    sectionAccent: { width: 3, height: 22, borderRadius: 2, backgroundColor: "#38D7E8" },
    sectionTitle: { ...safeTextLayout, color: "#F6F0DF", fontSize: compact ? 16 : 18, lineHeight: 23, fontWeight: "900", flexShrink: 1 },
    featuredRail: { paddingTop: 11, paddingRight: 16, gap: 11 },
    selector: { minHeight: 58, borderRadius: 17, borderWidth: 1, borderColor: "rgba(118,87,255,0.26)", backgroundColor: "rgba(17,24,49,0.86)", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, marginTop: 22 },
    selectorLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1, minWidth: 0 },
    selectorIcon: { width: 34, height: 34, borderRadius: 17, backgroundColor: "rgba(56,215,232,0.09)", borderWidth: 1, borderColor: "rgba(56,215,232,0.2)", alignItems: "center", justifyContent: "center" },
    selectorCopy: { flex: 1, minWidth: 0 },
    selectorLabel: { ...safeTextLayout, color: "#AEB8D0", fontSize: 9.5, lineHeight: 13, fontWeight: "900", textTransform: "uppercase", letterSpacing: 0.6 },
    selectorValue: { ...safeTextLayout, color: "#F6F0DF", fontSize: 14, lineHeight: 19, fontWeight: "900", marginTop: 1 },
    optionPanel: { borderRadius: 17, borderWidth: 1, borderColor: "rgba(118,87,255,0.24)", backgroundColor: "rgba(18,28,56,0.96)", padding: 10, marginTop: 7, flexDirection: "row", flexWrap: "wrap", gap: 7 },
    optionChip: { minHeight: 34, maxWidth: "100%", borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "rgba(255,255,255,0.05)", flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10 },
    optionActive: { backgroundColor: "#38D7E8", borderColor: "#38D7E8" },
    optionText: { ...safeTextLayout, color: "#F6F0DF", fontWeight: "800", fontSize: 11.5, flexShrink: 1 },
    optionTextActive: { color: "#071126" },
    galleryHeading: { minHeight: 52, marginTop: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    refreshingText: { ...safeTextLayout, color: "#38D7E8", fontSize: 9.5, lineHeight: 13, fontWeight: "800", textAlign: "right", maxWidth: 100 },
    galleryGrid: { flexDirection: "row", flexWrap: "wrap", alignItems: "flex-start" },
    portraitCard: { width: "100%", aspectRatio: 0.8, borderRadius: 20, overflow: "hidden", backgroundColor: "#16213D", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", elevation: 4 },
    featuredCard: { aspectRatio: 0.84, elevation: 6 },
    portraitImage: { position: "absolute", left: 0, top: 0, borderWidth: 0, backgroundColor: "#21335A" },
    cardHighlight: { position: "absolute", left: 15, right: 15, top: 1, height: 1, backgroundColor: "rgba(255,255,255,0.2)" },
    portraitInfo: { position: "absolute", left: 11, right: 11, bottom: 11 },
    rolePill: { alignSelf: "flex-start", minHeight: 20, maxWidth: "92%", borderRadius: 999, borderWidth: 1, borderColor: "rgba(255,255,255,0.14)", backgroundColor: "rgba(8,12,30,0.58)", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7, marginBottom: 5 },
    roleText: { ...safeTextLayout, color: "#F6F0DF", fontSize: 8.5, lineHeight: 12, fontWeight: "900", flexShrink: 1 },
    portraitName: { ...safeTextLayout, color: "#FFF9EC", fontSize: compact ? 13.5 : 15, lineHeight: compact ? 17 : 19, fontWeight: "900", minHeight: compact ? 34 : 38 },
    portraitUsername: { ...safeTextLayout, color: "#BFC8DB", fontSize: compact ? 9.5 : 10.5, lineHeight: 14, fontWeight: "800" },
    countryText: { ...safeTextLayout, color: "#F4BF4F", fontSize: compact ? 9 : 10, lineHeight: 14, fontWeight: "800", marginTop: 2 },
    stateCard: { minHeight: 210, borderRadius: 20, borderWidth: 1, borderColor: "rgba(56,215,232,0.16)", backgroundColor: "rgba(17,24,49,0.72)", alignItems: "center", justifyContent: "center", padding: 22 },
    stateOrbit: { width: 68, height: 42, borderRadius: 35, borderWidth: 1, borderColor: "rgba(56,215,232,0.36)", alignItems: "center", justifyContent: "center", transform: [{ rotate: "-8deg" }] },
    stateTitle: { ...safeTextLayout, color: "#F6F0DF", fontSize: 16, lineHeight: 22, fontWeight: "900", textAlign: "center", marginTop: 13 },
    stateBody: { ...safeTextLayout, color: "#AEB8D0", fontSize: 12, lineHeight: 18, fontWeight: "700", textAlign: "center", marginTop: 4 },
    retryButton: { minHeight: 40, borderRadius: 999, borderWidth: 1, borderColor: "#38D7E8", alignItems: "center", justifyContent: "center", paddingHorizontal: 17, marginTop: 13 },
    retryText: { color: "#38D7E8", fontSize: 12, fontWeight: "900" },
    skeletonCard: { aspectRatio: 0.8, borderRadius: 20, overflow: "hidden", backgroundColor: "rgba(33,51,90,0.72)" },
    skeletonGlow: { position: "absolute", left: 12, right: 12, bottom: 13, height: 45, borderRadius: 10, backgroundColor: "rgba(255,255,255,0.06)" },
    moreButton: { minHeight: 48, borderRadius: 999, backgroundColor: "rgba(56,215,232,0.09)", borderWidth: 1, borderColor: "rgba(56,215,232,0.24)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 14 },
    moreText: { color: "#F6F0DF", fontSize: 12, fontWeight: "900" }
  });
}
