import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { CoverImage } from "@/components/cover-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { getThemeColors } from "@/constants/theme";
import { uiCopy } from "@/data/content";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { useMuseums } from "@/hooks/use-museums";

export default function MuseumsScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { museums } = useMuseums();
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr");
    return museums.filter((museum) => [museum.name[language], museum.city[language], museum.country[language]].join(" ").toLocaleLowerCase("tr").includes(q));
  }, [language, query]);

  return (
    <AppChrome title={uiCopy.museums[language]} eyebrow="Art Atlas" showBackButton backToHome>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput value={query} onChangeText={setQuery} placeholder={{ tr: "Müze ara", en: "Search museums", ru: "Поиск музеев", uz: "Muzey qidirish" }[language]} placeholderTextColor={colors.muted} style={styles.searchInput} />
      </View>
      <View style={styles.list}>
        {filtered.map((museum) => (
          <Pressable key={museum.id} onPress={() => router.push({ pathname: "/museum/[id]", params: { id: museum.id } })} style={styles.card}>
            <CoverImage source={{ uri: museum.image }} style={styles.image} imageFocus={museum.imageFocus} />
            <View style={styles.info}>
              <Text style={styles.title}>{museum.name[language]}</Text>
              <Text style={styles.meta}>{museum.city[language]} · {museum.country[language]}</Text>
              <Text style={styles.desc} numberOfLines={2}>{museum.description[language]}</Text>
            </View>
          </Pressable>
        ))}
      </View>
    </AppChrome>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
return StyleSheet.create({
  searchBox: { minHeight: 44, borderRadius: 8, backgroundColor: colors.panelSoft, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, marginBottom: 14 },
  searchInput: { flex: 1, color: colors.ivory, fontWeight: "800" },
  list: { gap: 12 },
  card: { borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel },
  image: { width: "100%", height: 150 },
  info: { padding: 13, gap: 5 },
  title: { color: colors.ivory, fontSize: 18, fontWeight: "900" },
  meta: { color: colors.gold, fontSize: 12, fontWeight: "900" },
  desc: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" }
});
}
