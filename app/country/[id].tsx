import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { ProfileAvatar } from "@/components/profile-avatar";
import { getThemeColors } from "@/constants/theme";
import { countryCommunities } from "@/data/content";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { findCountryByInput } from "@/utils/country-utils";

const sampleMembers = ["Aylin Demir", "Mert Kaya", "Madina Karim", "Daria Volkova", "Aziz Rahim", "Elif Moran"];

export default function CountryDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { account } = useAccount();
  const router = useRouter();
  const country = useMemo(() => countryCommunities.find((item) => item.id === id), [id]);

  if (!country) {
    return (
      <AppChrome title="Art Atlas" eyebrow="Community" showBackButton backToHome>
        <Text style={styles.emptyText}>Country not found.</Text>
      </AppChrome>
    );
  }

  const accountCountry = findCountryByInput(account.country);
  const shouldShowAccount = account.isDiscoverableByCountry && accountCountry?.id === country.id;
  const visibleMembers = shouldShowAccount ? [account.displayName, ...sampleMembers] : sampleMembers;

  return (
    <AppChrome title={country.name[language]} eyebrow={country.code} showBackButton>
      <View style={styles.hero}>
        <Text style={styles.code}>{country.code}</Text>
        <Text style={styles.count}>{country.members.toLocaleString("tr-TR")} {language === "tr" ? "görünür üye" : "visible members"}</Text>
      </View>
      <View style={styles.list}>
        {visibleMembers.map((member) => (
          <Pressable key={member} onPress={() => router.push({ pathname: "/profile/[name]", params: { name: member } })} style={styles.row}>
            <ProfileAvatar size={40} />
            <Text style={styles.name}>{member}</Text>
            <Ionicons name="chevron-forward" size={17} color={colors.muted} />
          </Pressable>
        ))}
      </View>
    </AppChrome>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
return StyleSheet.create({
  hero: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 18, alignItems: "center", gap: 8, marginBottom: 14 },
  code: { color: colors.gold, fontSize: 30, fontWeight: "900" },
  count: { color: colors.ivory, fontWeight: "900" },
  list: { gap: 10 },
  row: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.panelSoft, alignItems: "center", justifyContent: "center" },
  initial: { color: colors.gold, fontWeight: "900" },
  name: { color: colors.ivory, fontWeight: "900", flex: 1 },
  emptyText: { color: colors.ivory, fontWeight: "900" }
});
}
