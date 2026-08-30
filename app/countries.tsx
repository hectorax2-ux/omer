import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { getThemeColors } from "@/constants/theme";
import { searchCountries } from "@/utils/country-utils";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";

const copy = {
  tr: { title: "Ülke keşfi", search: "Ülke ara...", profiles: "Profilleri keşfet", empty: "Ülke bulunamadı." },
  en: { title: "Country discovery", search: "Search countries...", profiles: "Discover profiles", empty: "No country found." },
  ru: { title: "Обзор стран", search: "Поиск страны...", profiles: "Открыть профили", empty: "Страна не найдена." },
  uz: { title: "Mamlakatlar", search: "Mamlakat qidirish...", profiles: "Profillarni kashf et", empty: "Mamlakat topilmadi." }
};

export default function CountriesScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const countries = useMemo(() => searchCountries(language, search), [language, search]);
  const items = useMemo(() => [
    { key: "search", content: <TextInput value={search} onChangeText={setSearch} placeholder={copy[language].search} placeholderTextColor={colors.muted} autoCorrect={false} style={styles.search} /> },
    ...countries.map((country) => ({
      key: country.code,
      content: <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: "/country/[id]", params: { id: country.code } })} style={styles.card}>
        <View style={styles.flag}><Text style={styles.code}>{country.code}</Text></View>
        <View style={styles.info}>
          <Text style={styles.name}>{country.name[language]}</Text>
          <Text style={styles.members}>{copy[language].profiles}</Text>
        </View>
        <Ionicons name="chevron-forward" size={17} color={colors.muted} />
      </Pressable>
    })),
    ...(!countries.length ? [{ key: "empty", content: <Text style={styles.members}>{copy[language].empty}</Text> }] : [])
  ], [colors.muted, countries, language, router, search, styles]);

  return (
    <AppChrome title={copy[language].title} eyebrow="ART ATLAS" showBackButton backToHome virtualizedItems={items} virtualizedInitialNumToRender={12} />
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
return StyleSheet.create({
  search: { minHeight: 46, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, color: colors.ivory, paddingHorizontal: 12, marginBottom: 10 },
card: { marginBottom: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 10, padding: 12 },
  flag: { width: 44, height: 44, borderRadius: 8, backgroundColor: "rgba(217,184,101,0.16)", alignItems: "center", justifyContent: "center" },
  code: { color: colors.gold, fontWeight: "900" },
  info: { flex: 1, minWidth: 0 },
  name: { color: colors.ivory, fontSize: 16, fontWeight: "900" },
  members: { color: colors.muted, fontSize: 12, fontWeight: "800", marginTop: 3 }
});
}
