import { useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import type { Language } from "@/types/content";
import { searchCountries } from "@/utils/country-utils";
import type { CountryOption } from "@/utils/country-options";

type CountryListItem =
  | { type: "section"; id: string; title: string }
  | { type: "country"; id: string; country: CountryOption };

const copy: Record<Language, { title: string; search: string; empty: string }> = {
  tr: { title: "Ülke", search: "Ülke ara...", empty: "Ülke bulunamadı." },
  en: { title: "Country", search: "Search countries...", empty: "No country found." },
  ru: { title: "Страна", search: "Поиск страны...", empty: "Страна не найдена." },
  uz: { title: "Mamlakat", search: "Mamlakat qidirish...", empty: "Mamlakat topilmadi." }
};

export function CountryPicker({ visible, selectedCode, onClose, onSelect }: {
  visible: boolean;
  selectedCode?: string | null;
  onClose: () => void;
  onSelect: (country: CountryOption) => void;
}) {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const colors = getThemeColors(theme);
  const [query, setQuery] = useState("");
  const normalizedSelectedCode = selectedCode?.trim().toUpperCase();
  const rows = useMemo(() => {
    const filtered = visible ? searchCountries(language, query) : [];
    return filtered.flatMap<CountryListItem>((country, index) => {
      const section = sectionLetter(country.name[language], language);
      const previousSection = index ? sectionLetter(filtered[index - 1].name[language], language) : "";
      const row: CountryListItem = { type: "country", id: `country:${country.code}`, country };
      return section === previousSection ? [row] : [{ type: "section", id: `section:${section}:${country.code}`, title: section }, row];
    });
  }, [language, query, visible]);

  useEffect(() => {
    if (!visible) setQuery("");
  }, [visible]);

  function close() {
    setQuery("");
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} />
        <View style={[styles.panel, { width: Math.min(width - 32, 520), backgroundColor: colors.panel, borderColor: colors.line }]}>
          <View style={styles.header}>
            <View style={styles.heading}>
              <Text style={[styles.eyebrow, { color: colors.gold }]}>ART ATLAS</Text>
              <Text style={[styles.title, { color: colors.ivory }]}>{copy[language].title}</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel={language === "tr" ? "Kapat" : language === "ru" ? "Закрыть" : language === "uz" ? "Yopish" : "Close"} onPress={close} style={[styles.closeButton, { backgroundColor: colors.panelSoft, borderColor: colors.line }]} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.ivory} />
            </Pressable>
          </View>
          <View style={[styles.search, { backgroundColor: colors.panelSoft, borderColor: colors.line }]}>
            <Ionicons name="search" size={18} color={colors.gold} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={copy[language].search}
              placeholderTextColor={colors.muted}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.searchInput, { color: colors.ivory }]}
            />
            {query ? <Pressable onPress={() => setQuery("")} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
          </View>
          <FlatList
            style={styles.viewport}
            data={rows}
            keyExtractor={(item) => item.id}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={18}
            maxToRenderPerBatch={16}
            updateCellsBatchingPeriod={40}
            windowSize={7}
            removeClippedSubviews={Platform.OS === "android"}
            contentContainerStyle={styles.list}
            ListEmptyComponent={<Text style={[styles.empty, { color: colors.muted }]}>{copy[language].empty}</Text>}
            renderItem={({ item }) => item.type === "section" ? (
              <Text style={[styles.section, { color: colors.gold, borderBottomColor: colors.line }]}>{item.title}</Text>
            ) : (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: item.country.code === normalizedSelectedCode }}
                onPress={() => {
                  onSelect(item.country);
                  close();
                }}
                style={[styles.row, { borderBottomColor: colors.line }, item.country.code === normalizedSelectedCode && { backgroundColor: colors.panelSoft }]}
              >
                <Text style={styles.flag}>{flagFromCode(item.country.code)}</Text>
                <Text style={[styles.name, { color: colors.ivory }]}>{item.country.name[language]}</Text>
                <Text style={[styles.code, { color: colors.gold }]}>{item.country.code}</Text>
                {item.country.code === normalizedSelectedCode ? <Ionicons name="checkmark-circle" size={19} color={colors.gold} /> : null}
              </Pressable>
            )}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function sectionLetter(value: string, language: Language) {
  const letter = Array.from(value.trim())[0]?.toLocaleUpperCase(language) ?? "#";
  if (language === "ru" || (language === "tr" && "ÇĞİÖŞÜ".includes(letter))) return letter;
  return letter.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function flagFromCode(code: string) {
  return String.fromCodePoint(...Array.from(code.toUpperCase()).map((character) => 127397 + character.charCodeAt(0)));
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 16, backgroundColor: "rgba(3,7,20,0.72)" },
  panel: { height: "82%", maxHeight: 720, borderWidth: 1, borderRadius: 22, padding: 16, overflow: "hidden" },
  header: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  heading: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 9.5, lineHeight: 13, fontWeight: "800", letterSpacing: 1.3 },
  title: { fontSize: 21, lineHeight: 27, fontWeight: "800", marginTop: 1 },
  closeButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  search: { minHeight: 46, borderRadius: 13, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 10 },
  list: { paddingBottom: Platform.OS === "ios" ? 18 : 8 },
  viewport: { flex: 1, minHeight: 0 },
  section: { fontSize: 11, lineHeight: 18, fontWeight: "900", letterSpacing: 1.2, paddingTop: 12, paddingBottom: 5, borderBottomWidth: StyleSheet.hairlineWidth },
  row: { minHeight: 50, borderBottomWidth: StyleSheet.hairlineWidth, borderRadius: 8, paddingHorizontal: 7, flexDirection: "row", alignItems: "center", gap: 9 },
  flag: { width: 25, color: "#C5BFAF", fontSize: 18, textAlign: "center" },
  name: { flex: 1, minWidth: 0, paddingVertical: 8, fontSize: 13.5, lineHeight: 18, fontWeight: "700" },
  code: { width: 25, fontSize: 11, lineHeight: 15, fontWeight: "900", textAlign: "right", letterSpacing: 0.5 },
  empty: { paddingVertical: 42, fontSize: 13, lineHeight: 19, textAlign: "center" }
});
