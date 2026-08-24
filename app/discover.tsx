import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { AuthRequired } from "@/components/auth-required";
import { ProfileAvatar } from "@/components/profile-avatar";
import { UserNameWithCountry } from "@/components/user-name-with-country";
import { BadgeId, badgeItems, getBadgeItem, getRoleIcon, getRoleItem, roleItems, UserRoleId } from "@/constants/profile-taxonomy";
import { getThemeColors } from "@/constants/theme";
import { radii, v2Colors } from "@/constants/design";
import { uiCopy } from "@/data/content";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { useSocial } from "@/hooks/use-social";
import { SuggestedUser } from "@/providers/social-provider";
import { resolveCountryCodeFromUser, resolveCountryId } from "@/utils/country-utils";
import { profileRouteParam } from "@/utils/profile-route";

type BadgeFilter = "all" | "achievements" | "recommended" | UserRoleId | BadgeId;

const labels = {
  filter: { tr: "Rozet / rol seç", en: "Choose badge / role", ru: "Выберите значок / роль", uz: "Nishon / rol tanlang" },
  more: { tr: "Daha fazla gör", en: "Show more", ru: "Показать еще", uz: "Ko'proq ko'rish" },
  empty: { tr: "Bu seçim için profil bulunamadı.", en: "No profiles found for this filter.", ru: "Для этого фильтра профили не найдены.", uz: "Bu tanlov uchun profil topilmadi." }
};

const staticFilterOptions: { key: BadgeFilter; icon: keyof typeof Ionicons.glyphMap; label: Record<"tr" | "en" | "ru" | "uz", string> }[] = [
  { key: "all", icon: "sparkles", label: { tr: "Tüm profiller", en: "All profiles", ru: "Все профили", uz: "Barcha profillar" } },
  { key: "achievements", icon: "trophy", label: { tr: "Başarımlar", en: "Achievements", ru: "Достижения", uz: "Yutuqlar" } },
  { key: "recommended", icon: "people-circle", label: { tr: "Önerilen", en: "Suggested", ru: "Рекомендуемые", uz: "Tavsiya etilgan" } }
];

// Roles/badges intentionally hidden from the discover filter to keep the list short and relevant.
const HIDDEN_FILTER_KEYS = new Set<string>([
  "museum",
  "verified_gallery",
  "weekly_winner",
  "quiz_master",
  "editor_pick",
  "top_writer",
  "duel_champion",
  "lucky_one"
]);

const nearbyCountries: Record<string, string[]> = {
  turkiye: ["uzbekistan", "russia", "germany"],
  uzbekistan: ["turkiye", "kazakhstan", "russia"],
  russia: ["uzbekistan", "kazakhstan", "turkiye"],
  usa: ["canada", "uk"],
  uk: ["usa", "canada", "germany"],
  canada: ["usa", "uk"],
  germany: ["turkiye", "uk", "russia"],
  kazakhstan: ["uzbekistan", "russia"]
};

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
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { visibleSuggestedUsers, hasMoreUsers, loadMoreUsers } = useSocial();
  const { account } = useAccount();
  const router = useRouter();
  const [filter, setFilter] = useState<BadgeFilter>("all");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(8);
  const [query, setQuery] = useState("");
  const users = visibleSuggestedUsers;
  const filterOptions = useMemo(() => [
    staticFilterOptions[0],
    staticFilterOptions[2],
    ...roleItems
      .filter((item) => !HIDDEN_FILTER_KEYS.has(item.id))
      .map((item) => ({ key: item.id as BadgeFilter, icon: item.icon, label: item.label })),
    ...badgeItems
      .filter((item) => !HIDDEN_FILTER_KEYS.has(item.id))
      .map((item) => ({ key: item.id as BadgeFilter, icon: item.icon, label: item.label }))
  ], []);
  const selectedFilter = filterOptions.find((item) => item.key === filter) ?? filterOptions[0];
  const userCountryId = resolveCountryId(account.country ?? "");
  const filtered = users
    .filter((user) => matchesFilter(user, filter))
    .filter((user) => {
      const normalizedQuery = query.trim().toLocaleLowerCase("tr");
      if (!normalizedQuery) return true;
      return `${user.name} ${user.username}`.toLocaleLowerCase("tr").includes(normalizedQuery);
    })
    .sort((a, b) => filter === "recommended"
      ? getRecommendationScore(b, userCountryId, language) - getRecommendationScore(a, userCountryId, language) || (a.lastActiveMinutesAgo ?? 9999) - (b.lastActiveMinutesAgo ?? 9999)
      : (a.lastActiveMinutesAgo ?? 9999) - (b.lastActiveMinutesAgo ?? 9999)
    );
  const visible = filtered.slice(0, visibleCount);

  function setNextFilter(nextFilter: BadgeFilter) {
    setFilter(nextFilter);
    setVisibleCount(8);
    setPickerOpen(false);
  }

  async function showMore() {
    if (visibleCount + 8 > filtered.length && hasMoreUsers) await loadMoreUsers();
    setVisibleCount((value) => value + 8);
  }

  return (
    <AppChrome title={uiCopy.discover[language]} showBackButton backToHome>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.gold} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={language === "tr" ? "Kullanıcı adı, isim veya soyisim ara" : language === "ru" ? "Поиск по имени или логину" : language === "uz" ? "Ism yoki username qidirish" : "Search name or username"}
          placeholderTextColor={colors.muted}
          style={styles.searchInput}
        />
      </View>

      <View style={styles.hero}>
        <View style={styles.heroAtmosphere} pointerEvents="none" />
        <View style={styles.heroCopy}>
          <Text style={styles.heroKicker}>ART ATLAS DISCOVERY</Text>
          <Text style={styles.heroTitle}>{uiCopy.discover[language]}</Text>
          <Text style={styles.heroText}>{uiCopy.discoverSubtitle[language]}</Text>
        </View>
        <View style={styles.orbitCluster} pointerEvents="none">
          <View style={styles.orbitLine} />
          <LinearGradient colors={[v2Colors.blue, v2Colors.violet]} style={[styles.discoveryOrb, styles.discoveryOrbMain]}><Ionicons name="compass" size={24} color={v2Colors.text} /></LinearGradient>
          <LinearGradient colors={[v2Colors.violet, v2Colors.magenta]} style={[styles.discoveryOrb, styles.discoveryOrbSmall]}><Ionicons name="people" size={15} color={v2Colors.text} /></LinearGradient>
          <LinearGradient colors={["#0E7490", v2Colors.cyan]} style={[styles.discoveryOrb, styles.discoveryOrbTiny]}><Ionicons name="sparkles" size={12} color={v2Colors.text} /></LinearGradient>
        </View>
      </View>

      <Pressable onPress={() => setPickerOpen((value) => !value)} style={styles.selector}>
        <View style={styles.selectorLeft}>
          <Ionicons name={selectedFilter.icon} size={19} color={colors.gold} />
          <View>
            <Text style={styles.selectorLabel}>{labels.filter[language]}</Text>
            <Text style={styles.selectorValue}>{selectedFilter.label[language]}</Text>
          </View>
        </View>
        <Ionicons name={pickerOpen ? "chevron-up" : "chevron-down"} size={19} color={colors.muted} />
      </Pressable>

      {pickerOpen ? (
        <View style={styles.optionPanel}>
          {filterOptions.map((option) => (
            <Pressable key={option.key} onPress={() => setNextFilter(option.key)} style={[styles.optionChip, filter === option.key && styles.optionActive]}>
              <Ionicons name={option.icon} size={14} color={filter === option.key ? colors.ink : colors.gold} />
              <Text style={[styles.optionText, filter === option.key && styles.optionTextActive]} numberOfLines={1}>{option.label[language]}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <View style={styles.list}>
        {visible.map((user) => (
          <Pressable key={user.uid || user.username} onPress={() => router.push({ pathname: "/profile/[name]", params: { name: profileRouteParam(user) } })} style={[styles.userCard, user.isPremium && styles.premiumCard]}>
            <ProfileAvatar uri={user.image} size={46} />
            <View style={styles.userInfo}>
              <View style={styles.nameRow}>
                <UserNameWithCountry name={user.name} username={user.username} uid={user.uid} countryCode={resolveCountryCodeFromUser(user)} nameStyle={styles.name} />
                {user.isPremium ? <Ionicons name="diamond" size={14} color={colors.gold} /> : null}
              </View>
              <Text style={styles.username}>@{user.username}</Text>
              <View style={styles.badgeRow}>
                {getUserBadges(user, language).slice(0, 2).map((badge) => (
                  <View key={badge.label} style={styles.badge}>
                    <Ionicons name={badge.icon} size={12} color={colors.gold} />
                    <Text style={styles.badgeText} numberOfLines={1}>{badge.label}</Text>
                  </View>
                ))}
              </View>
            </View>
            <View style={styles.affinity}><Text style={styles.affinityValue}>{Math.min(99, getRecommendationScore(user, userCountryId, language))}%</Text><Text style={styles.affinityLabel}>{language === "tr" ? "uyum" : language === "ru" ? "связь" : language === "uz" ? "mos" : "match"}</Text></View>
          </Pressable>
        ))}
      </View>

      {!visible.length ? <Text style={styles.empty}>{labels.empty[language]}</Text> : null}
      {visibleCount < filtered.length || hasMoreUsers ? (
        <Pressable onPress={() => void showMore()} style={styles.moreButton}>
          <Text style={styles.moreText}>{labels.more[language]}</Text>
        </Pressable>
      ) : null}
    </AppChrome>
  );
}

function matchesFilter(user: SuggestedUser, filter: BadgeFilter) {
  if (filter === "all") return true;
  if (filter === "recommended") return true;
  if (isRoleFilter(filter)) return user.role === filter;
  if (filter === "premium") return !!user.isPremium;
  if (filter === "achievements") return !!user.badges?.some((badge) => badge === "weekly_winner" || badge === "quiz_master");
  return isBadgeFilter(filter) ? user.badges?.includes(filter) ?? false : false;
}

function isRoleFilter(filter: BadgeFilter): filter is UserRoleId {
  return roleItems.some((item) => item.id === filter);
}

function isBadgeFilter(filter: BadgeFilter): filter is BadgeId {
  return badgeItems.some((item) => item.id === filter);
}

function getRecommendationScore(user: SuggestedUser, countryId: string | undefined, language: "tr" | "en" | "ru" | "uz") {
  let score = 0;
  if (user.language === language) score += 40;
  if (countryId && user.countryId === countryId) score += 35;
  if (countryId && nearbyCountries[countryId]?.includes(user.countryId ?? "")) score += 18;
  if (user.isPremium) score += 6;
  score += Math.max(0, 20 - Math.floor((user.lastActiveMinutesAgo ?? 999) / 3));
  return score;
}

export function getUserBadges(user: Pick<SuggestedUser, "role" | "badges" | "isPremium">, language: "tr" | "en" | "ru" | "uz") {
  const role = getRoleItem(user.role);
  const badges = [
    user.isPremium ? { label: badgeItems[0].label[language], icon: badgeItems[0].icon } : null,
    {
      label: role.label[language],
      icon: getRoleIcon(user.role)
    },
    ...(user.badges ?? []).map((badge) => {
      const option = getBadgeItem(badge);
      return option ? { label: option.label[language], icon: option.icon } : null;
    })
  ].filter(Boolean);
  return badges.filter(Boolean) as { label: string; icon: keyof typeof Ionicons.glyphMap }[];
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    hero: {
      flexDirection: "row",
      alignItems: "center",
      minHeight: 126,
      position: "relative",
      overflow: "visible",
      marginTop: 7,
      marginBottom: 6
    },
    heroAtmosphere: { position: "absolute", right: -8, width: 154, height: 116, borderRadius: 70, backgroundColor: "rgba(37,99,235,0.12)", shadowColor: v2Colors.blue, shadowOpacity: 0.72, shadowRadius: 24, shadowOffset: { width: 0, height: 0 } },
    heroCopy: { width: "61%", minWidth: 0, zIndex: 2 },
    heroKicker: { color: v2Colors.cyan, fontSize: 9, lineHeight: 12, fontWeight: "800", letterSpacing: 1.35 },
    heroTitle: { color: v2Colors.text, fontSize: 23, lineHeight: 27, fontWeight: "800", letterSpacing: -0.45, marginTop: 4 },
    heroText: { color: v2Colors.textMuted, fontSize: 11, lineHeight: 15, fontWeight: "600", marginTop: 4 },
    orbitCluster: { position: "absolute", right: 2, width: 112, height: 112 },
    orbitLine: { position: "absolute", left: 6, top: 10, width: 100, height: 82, borderRadius: 52, borderWidth: 1, borderColor: "rgba(34,211,238,0.34)", transform: [{ rotate: "-17deg" }] },
    discoveryOrb: { position: "absolute", borderRadius: 999, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "rgba(255,255,255,0.22)", shadowColor: v2Colors.violet, shadowOpacity: 0.75, shadowRadius: 15, shadowOffset: { width: 0, height: 0 } },
    discoveryOrbMain: { width: 58, height: 58, left: 28, top: 27 },
    discoveryOrbSmall: { width: 36, height: 36, right: 1, top: 3 },
    discoveryOrbTiny: { width: 30, height: 30, left: 2, bottom: 3 },
    selector: { minHeight: 52, borderRadius: radii.xl, borderWidth: 1, borderColor: "rgba(139,92,246,0.24)", backgroundColor: v2Colors.surface1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12, marginTop: 8 },
    searchBox: { minHeight: 46, borderRadius: radii.pill, borderWidth: 1, borderColor: v2Colors.border, backgroundColor: v2Colors.surface1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 13, marginTop: 0 },
    searchInput: { flex: 1, color: colors.ivory, fontSize: 14, fontWeight: "800" },
    selectorLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
    selectorLabel: { color: colors.muted, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
    selectorValue: { color: colors.ivory, fontSize: 14, fontWeight: "900", marginTop: 1 },
    optionPanel: { borderRadius: radii.lg, borderWidth: 1, borderColor: v2Colors.border, backgroundColor: v2Colors.glass, padding: 10, marginTop: 8, flexDirection: "row", flexWrap: "wrap", gap: 7 },
    optionChip: { minHeight: 32, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 4 },
    optionActive: { backgroundColor: colors.gold, borderColor: colors.gold },
    optionText: { color: colors.ivory, fontWeight: "800", fontSize: 12 },
    optionTextActive: { color: colors.ink },
    list: { gap: 3, marginTop: 10 },
    userCard: { minHeight: 70, borderRadius: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: v2Colors.border, backgroundColor: "rgba(255,255,255,0.018)", flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 7, paddingVertical: 7 },
    premiumCard: { borderWidth: 1, borderColor: "rgba(246,196,83,0.26)", backgroundColor: "rgba(246,196,83,0.035)" },
    avatar: { width: 54, height: 54, borderRadius: 27 },
    userInfo: { flex: 1, minWidth: 0 },
    nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    name: { color: colors.ivory, fontSize: 14, fontWeight: "900", flexShrink: 1 },
    username: { color: colors.gold, fontSize: 11, fontWeight: "800", marginTop: 0 },
    badgeRow: { flexDirection: "row", flexWrap: "nowrap", gap: 4, marginTop: 4, overflow: "hidden" },
    badge: { minHeight: 20, maxWidth: "48%", borderRadius: radii.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, flexDirection: "row", alignItems: "center", gap: 3, paddingHorizontal: 6 },
    badgeText: { color: colors.ivory, fontSize: 9, fontWeight: "900", flexShrink: 1 },
    affinity: { width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: v2Colors.cyan, backgroundColor: "rgba(14,116,144,0.12)", alignItems: "center", justifyContent: "center" },
    affinityValue: { color: v2Colors.text, fontSize: 10, lineHeight: 12, fontWeight: "900" },
    affinityLabel: { color: v2Colors.textFaint, fontSize: 7.5, lineHeight: 9, fontWeight: "700" },
    empty: { color: colors.muted, textAlign: "center", fontWeight: "800", padding: 18 },
    moreButton: { minHeight: 46, borderRadius: radii.pill, backgroundColor: "rgba(99,102,241,0.28)", borderWidth: 1, borderColor: "rgba(139,92,246,0.35)", alignItems: "center", justifyContent: "center", marginTop: 12 },
    moreText: { color: v2Colors.text, fontWeight: "900" }
  });
}
