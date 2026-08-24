import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { getThemeColors } from "@/constants/theme";
import { countryCommunities } from "@/data/content";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";

export default function CountriesScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  return (
    <AppChrome title={language === "tr" ? "Ülke keşfi" : "Country discovery"} eyebrow="Community" showBackButton backToHome>
      <View style={styles.grid}>
        {countryCommunities.map((country) => (
          <Pressable key={country.id} onPress={() => router.push({ pathname: "/country/[id]", params: { id: country.id } })} style={styles.card}>
            <View style={styles.flag}>
              <Text style={styles.code}>{country.code}</Text>
            </View>
            <View style={styles.info}>
              <Text style={styles.name}>{country.name[language]}</Text>
              <Text style={styles.members}>{country.members.toLocaleString("tr-TR")} üye</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.muted} />
          </Pressable>
        ))}
      </View>
    </AppChrome>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
return StyleSheet.create({
  grid: { gap: 10 },
  card: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  flag: { width: 44, height: 44, borderRadius: 8, backgroundColor: "rgba(217,184,101,0.16)", alignItems: "center", justifyContent: "center" },
  code: { color: colors.gold, fontWeight: "900" },
  info: { flex: 1 },
  name: { color: colors.ivory, fontSize: 16, fontWeight: "900" },
  members: { color: colors.muted, fontSize: 12, fontWeight: "800", marginTop: 3 }
});
}
