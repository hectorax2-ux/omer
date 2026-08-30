import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { AuthRequired } from "@/components/auth-required";
import { ProfileAvatar } from "@/components/profile-avatar";
import { getThemeColors } from "@/constants/theme";
import { ScreenDataState } from "@/components/screen-data-state";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { findCountryByInput, resolveCountryCodeFromUser } from "@/utils/country-utils";
import { useSocial } from "@/hooks/use-social";
import { profileRouteParam } from "@/utils/profile-route";
import { PROFILE_DISCOVERY_SESSION_LIMIT } from "@/src/services/firebase/profile-discovery-service";

const copy = {
  tr: { profiles: "Yüklenen profiller", empty: "Yüklenen profillerde bu ülkeye ait üye yok.", missing: "Ülke bulunamadı.", more: "Daha fazla profil getir" },
  en: { profiles: "Loaded profiles", empty: "No members from this country in the loaded profiles.", missing: "Country not found.", more: "Load more profiles" },
  ru: { profiles: "Загруженные профили", empty: "Среди загруженных профилей нет участников из этой страны.", missing: "Страна не найдена.", more: "Загрузить ещё профили" },
  uz: { profiles: "Yuklangan profillar", empty: "Yuklangan profillarda bu mamlakatdan a’zolar yo‘q.", missing: "Mamlakat topilmadi.", more: "Yana profil yuklash" }
};

export default function CountryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { account, isAuthenticated } = useAccount();
  const router = useRouter();
  const country = useMemo(() => findCountryByInput(id ?? ""), [id]);
  const social = useSocial();
  const members = useMemo(() => {
    if (!country) return [];
    const others = social.visibleSuggestedUsers.filter((user) => user.showInCountryExplore === true && resolveCountryCodeFromUser(user) === country.code);
    if (!account.uid || !account.isDiscoverableByCountry || resolveCountryCodeFromUser(account) !== country.code) return others;
    return [{ uid: account.uid, name: account.displayName, username: account.username, image: account.avatar }, ...others];
  }, [account, country, social.visibleSuggestedUsers]);

  if (!country) {
    return (
      <AppChrome title="Art Atlas" eyebrow="Community" showBackButton backToHome>
        <Text style={styles.emptyText}>{copy[language].missing}</Text>
      </AppChrome>
    );
  }

  if (!isAuthenticated) return <AuthRequired title={country.name[language]} />;

  return (
    <AppChrome title={country.name[language]} eyebrow={country.code} showBackButton virtualizedItems={[
      { key: "heading", content: <View style={styles.hero}>
        <Text style={styles.code}>{country.code}</Text>
        <Text style={styles.count}>{copy[language].profiles}: {members.length}</Text>
      </View> },
      ...members.map((member) => ({
        key: member.uid || member.username,
        content: <Pressable onPress={() => router.push({ pathname: "/profile/[name]", params: { name: profileRouteParam(member) } })} style={styles.row}>
            <ProfileAvatar uri={member.image} size={40} />
            <Text style={styles.name}>{member.name}</Text>
            <Ionicons name="chevron-forward" size={17} color={colors.muted} />
          </Pressable>
      })),
      { key: "state", content: social.profileDiscoveryStatus === "loading" && !members.length
        ? <ScreenDataState status="loading" />
        : social.profileDiscoveryStatus === "error"
          ? <ScreenDataState status="error" onRetry={social.retryProfileDiscovery} />
          : !members.length ? <Text style={styles.emptyText}>{copy[language].empty}</Text> : null },
      { key: "more", content: social.hasMoreUsers && social.suggestedUsers.length < PROFILE_DISCOVERY_SESSION_LIMIT
        ? <Pressable onPress={() => void social.loadMoreUsers()} style={styles.row}><Text style={styles.name}>{copy[language].more}</Text></Pressable> : null }
    ]} />
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
return StyleSheet.create({
  hero: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 18, alignItems: "center", gap: 8, marginBottom: 14 },
  code: { color: colors.gold, fontSize: 30, fontWeight: "900" },
  count: { color: colors.ivory, fontWeight: "900" },
  list: { gap: 10 },
row: { marginBottom: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.panelSoft, alignItems: "center", justifyContent: "center" },
  initial: { color: colors.gold, fontWeight: "900" },
  name: { color: colors.ivory, fontWeight: "900", flex: 1 },
  emptyText: { color: colors.ivory, fontWeight: "900" }
});
}
