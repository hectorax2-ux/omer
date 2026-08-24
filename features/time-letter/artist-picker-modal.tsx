import { useMemo, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { CoverImage } from "@/components/cover-image";
import { hexAlpha, radii } from "@/constants/design";
import { getThemeColors } from "@/constants/theme";
import { Artist, Language } from "@/types/content";

type ThemeColors = ReturnType<typeof getThemeColors>;

export function ArtistPickerModal({
  artists,
  colors,
  copy,
  language,
  loading,
  onClose,
  onSelect,
  visible
}: {
  artists: Artist[];
  colors: ThemeColors;
  copy: { search: string; empty: string; title: string };
  language: Language;
  loading: boolean;
  onClose: () => void;
  onSelect: (artist: Artist) => void;
  visible: boolean;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase("tr");
    const source = needle
      ? artists.filter((artist) => [artist.name.tr, artist.name.en, artist.name.ru, artist.name.uz].some((name) => name.toLocaleLowerCase("tr").includes(needle)))
      : artists;
    return source.slice(0, 24);
  }, [artists, query]);

  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.overlay}>
        <Pressable onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={[styles.sheet, { backgroundColor: colors.panel, borderColor: hexAlpha(colors.plum, 0.28) }]}>
          <View style={[styles.handle, { backgroundColor: hexAlpha(colors.ivory, 0.18) }]} />
          <Text style={[styles.title, { color: colors.ivory }]}>{copy.title}</Text>
          <View style={[styles.search, { borderColor: colors.line, backgroundColor: hexAlpha(colors.navy, 0.45) }]}>
            <Ionicons color={colors.muted} name="search" size={15} />
            <TextInput
              autoCapitalize="words"
              autoCorrect={false}
              autoFocus
              onChangeText={setQuery}
              placeholder={copy.search}
              placeholderTextColor={colors.muted}
              style={[styles.searchInput, { color: colors.ivory }]}
              value={query}
            />
            {loading ? <ActivityIndicator color={colors.plum} size="small" /> : null}
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" style={styles.list}>
            {matches.map((artist) => (
              <Pressable key={artist.id} onPress={() => { setQuery(""); onSelect(artist); }} style={styles.row}>
                {artist.image ? (
                  <CoverImage imageFocus={artist.imageFocus} source={{ uri: artist.image }} style={styles.image} />
                ) : (
                  <View style={[styles.image, { backgroundColor: hexAlpha(colors.plum, 0.2) }]} />
                )}
                <View style={styles.copy}>
                  <Text numberOfLines={1} style={[styles.name, { color: colors.ivory }]}>{artist.name[language]}</Text>
                  {artist.life ? <Text numberOfLines={1} style={[styles.life, { color: colors.muted }]}>{artist.life}</Text> : null}
                </View>
              </Pressable>
            ))}
            {!matches.length ? <Text style={[styles.empty, { color: colors.muted }]}>{copy.empty}</Text> : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(4, 6, 14, 0.72)", justifyContent: "flex-end" },
  sheet: { maxHeight: "72%", borderTopLeftRadius: radii.xl, borderTopRightRadius: radii.xl, borderWidth: 1, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 18 },
  handle: { alignSelf: "center", width: 36, height: 4, borderRadius: 2, marginBottom: 12 },
  title: { fontSize: 16, fontWeight: "800", marginBottom: 12 },
  search: { minHeight: 44, borderRadius: radii.sm, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 12, marginBottom: 8 },
  searchInput: { flex: 1, fontWeight: "600" },
  list: { maxHeight: 420 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 9 },
  image: { width: 40, height: 40, borderRadius: 20 },
  copy: { flex: 1, minWidth: 0 },
  name: { fontSize: 15, fontWeight: "700" },
  life: { fontSize: 12, fontWeight: "600" },
  empty: { fontSize: 13, fontWeight: "600", paddingVertical: 16 }
});
