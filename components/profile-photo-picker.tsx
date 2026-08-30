import { useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useArtists } from "@/hooks/use-artists";
import { useLanguage } from "@/hooks/use-language";
import type { Language } from "@/types/content";
import { normalizeCountryInput } from "@/utils/country-utils";
import { validatePickedImageAsset } from "@/utils/image-upload-validation";
import { imageSource } from "@/utils/image-source";

export type ProfilePhotoSelection = {
  uri?: string;
  type: "uploaded" | "artist" | "default";
  artistId?: string;
};

type SelectionResult = {
  ok: boolean;
  message?: string;
};

const copy: Record<Language, {
  title: string;
  gallery: string;
  galleryHint: string;
  artist: string;
  artistHint: string;
  remove: string;
  removeHint: string;
  cancel: string;
  artistTitle: string;
  search: string;
  noResults: string;
  unavailable: string;
  retry: string;
  usePhoto: string;
  removeTitle: string;
  removeConfirm: string;
  removing: string;
  permission: string;
}> = {
  tr: {
    title: "Profil fotoğrafı", gallery: "Galeriden seç", galleryHint: "Kendi fotoğrafını yükle",
    artist: "Sanatçılardan seç", artistHint: "Art Atlas sanatçı arşivinden bir portre kullan",
    remove: "Fotoğrafı kaldır", removeHint: "Varsayılan avatara dön", cancel: "Vazgeç",
    artistTitle: "Sanatçılardan birini seç", search: "Sanatçı ara...", noResults: "Sanatçı bulunamadı.",
    unavailable: "Sanatçılar şu anda yüklenemedi.", retry: "Tekrar dene", usePhoto: "Profil fotoğrafı olarak kullan",
    removeTitle: "Profil fotoğrafını kaldırmak istiyor musun?", removeConfirm: "Kaldır", removing: "Kaldırılıyor...",
    permission: "Profil fotoğrafı seçmek için galeri izni gerekir."
  },
  en: {
    title: "Profile photo", gallery: "Choose from gallery", galleryHint: "Upload your own photo",
    artist: "Choose an artist", artistHint: "Use a portrait from the Art Atlas artist archive",
    remove: "Remove photo", removeHint: "Return to the default avatar", cancel: "Cancel",
    artistTitle: "Choose an artist", search: "Search artists...", noResults: "No artists found.",
    unavailable: "Artists could not be loaded right now.", retry: "Try again", usePhoto: "Use as profile photo",
    removeTitle: "Do you want to remove your profile photo?", removeConfirm: "Remove", removing: "Removing...",
    permission: "Gallery permission is required to choose a profile photo."
  },
  ru: {
    title: "Фото профиля", gallery: "Выбрать из галереи", galleryHint: "Загрузить своё фото",
    artist: "Выбрать художника", artistHint: "Использовать портрет из архива художников Art Atlas",
    remove: "Удалить фото", removeHint: "Вернуться к стандартному аватару", cancel: "Отмена",
    artistTitle: "Выберите художника", search: "Поиск художника...", noResults: "Художники не найдены.",
    unavailable: "Не удалось загрузить художников.", retry: "Повторить", usePhoto: "Использовать как фото профиля",
    removeTitle: "Удалить фото профиля?", removeConfirm: "Удалить", removing: "Удаление...",
    permission: "Для выбора фото профиля нужен доступ к галерее."
  },
  uz: {
    title: "Profil rasmi", gallery: "Galereyadan tanlash", galleryHint: "O‘z rasmingizni yuklang",
    artist: "Rassomlardan tanlash", artistHint: "Art Atlas rassomlar arxividagi portretdan foydalaning",
    remove: "Rasmni olib tashlash", removeHint: "Standart avatarga qaytish", cancel: "Bekor qilish",
    artistTitle: "Rassomni tanlang", search: "Rassom qidirish...", noResults: "Rassom topilmadi.",
    unavailable: "Rassomlarni hozir yuklab bo‘lmadi.", retry: "Qayta urinish", usePhoto: "Profil rasmi sifatida ishlatish",
    removeTitle: "Profil rasmini olib tashlamoqchimisiz?", removeConfirm: "Olib tashlash", removing: "Olib tashlanmoqda...",
    permission: "Profil rasmini tanlash uchun galereyaga ruxsat kerak."
  }
};

export function ProfilePhotoPicker({
  visible,
  currentAvatar,
  currentArtistId,
  initialView = "actions",
  onClose,
  onSelect
}: {
  visible: boolean;
  currentAvatar?: string;
  currentArtistId?: string;
  initialView?: "actions" | "artists";
  onClose: () => void;
  onSelect: (selection: ProfilePhotoSelection) => SelectionResult | Promise<SelectionResult>;
}) {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const { width } = useWindowDimensions();
  const colors = getThemeColors(theme);
  const text = copy[language];
  const [view, setView] = useState<"actions" | "artists" | "remove">("actions");
  const [query, setQuery] = useState("");
  const [selectedArtistId, setSelectedArtistId] = useState(currentArtistId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const wasVisibleRef = useRef(false);
  const { artists, loading, error: artistsError, retry } = useArtists(300, visible && view === "artists");
  const normalizedQuery = normalizeCountryInput(query);
  const filteredArtists = useMemo(() => artists.filter((artist) => artist.image && (!normalizedQuery || Object.values(artist.name)
    .some((value) => normalizeCountryInput(value).includes(normalizedQuery)))), [artists, normalizedQuery]);
  const columns = width >= 500 ? 4 : 3;
  const panelWidth = Math.min(width - 32, 520);
  const cellWidth = (panelWidth - 32 - (columns - 1) * 8) / columns;
  const selectedArtist = artists.find((artist) => artist.id === selectedArtistId);

  useEffect(() => {
    if (!visible) {
      wasVisibleRef.current = false;
      return;
    }
    if (wasVisibleRef.current) return;
    wasVisibleRef.current = true;
    setView(initialView === "artists" ? "artists" : "actions");
    setQuery("");
    setSelectedArtistId(currentArtistId);
    setError("");
  }, [currentArtistId, initialView, visible]);

  useEffect(() => {
    if (!visible || view !== "artists" || selectedArtistId || currentArtistId || !currentAvatar) return;
    const legacyMatch = artists.find((artist) => artist.image === currentAvatar);
    if (legacyMatch) setSelectedArtistId(legacyMatch.id);
  }, [artists, currentArtistId, currentAvatar, selectedArtistId, view, visible]);

  async function commit(selection: ProfilePhotoSelection) {
    if (submitting) return;
    setSubmitting(true);
    setError("");
    const result = await onSelect(selection);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message ?? "Art Atlas");
      return;
    }
    onClose();
  }

  async function pickFromGallery() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(text.permission);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1]
    });
    if (result.canceled) return;
    const validation = validatePickedImageAsset(result.assets[0], language);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }
    await commit({ uri: result.assets[0].uri, type: "uploaded" });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => { if (!submitting) onClose(); }}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={submitting ? undefined : onClose} />
        <View style={[styles.sheet, view === "artists" && styles.artistSheet, { width: panelWidth, backgroundColor: colors.panel, borderColor: colors.line }]}>
          <View style={styles.header}>
            <View style={styles.headingCopy}>
              <Text style={[styles.eyebrow, { color: colors.gold }]}>ART ATLAS</Text>
              <Text style={[styles.title, { color: colors.ivory }]}>{view === "artists" ? text.artistTitle : text.title}</Text>
              {view === "artists" ? <Text style={[styles.subtitle, { color: colors.muted }]}>{text.artistHint}</Text> : null}
            </View>
            <Pressable onPress={submitting ? undefined : onClose} style={[styles.closeButton, { backgroundColor: colors.panelSoft, borderColor: colors.line }]} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.ivory} />
            </Pressable>
          </View>

          {view === "actions" ? (
            <View style={styles.actions}>
              <PickerAction icon="images-outline" title={text.gallery} hint={text.galleryHint} colors={colors} disabled={submitting} onPress={() => void pickFromGallery()} />
              <PickerAction icon="color-palette-outline" title={text.artist} hint={text.artistHint} colors={colors} disabled={submitting} onPress={() => { setError(""); setView("artists"); }} />
              {currentAvatar ? <PickerAction icon="trash-outline" title={text.remove} hint={text.removeHint} colors={colors} destructive disabled={submitting} onPress={() => { setError(""); setView("remove"); }} /> : null}
              <Pressable onPress={onClose} disabled={submitting} style={styles.cancelButton}>
                <Text style={[styles.cancelText, { color: colors.muted }]}>{text.cancel}</Text>
              </Pressable>
            </View>
          ) : null}

          {view === "remove" ? (
            <View style={styles.removePanel}>
              <View style={[styles.removeIcon, { backgroundColor: colors.panelSoft, borderColor: colors.line }]}>
                <Ionicons name="trash-outline" size={24} color="#e38b73" />
              </View>
              <Text style={[styles.removeTitle, { color: colors.ivory }]}>{text.removeTitle}</Text>
              <View style={styles.removeActions}>
                <Pressable onPress={() => setView("actions")} disabled={submitting} style={[styles.secondaryButton, { borderColor: colors.line }]}>
                  <Text style={[styles.secondaryButtonText, { color: colors.ivory }]}>{text.cancel}</Text>
                </Pressable>
                <Pressable onPress={() => void commit({ type: "default" })} disabled={submitting} style={styles.dangerButton}>
                  {submitting ? <ActivityIndicator size="small" color="#fff4eb" /> : null}
                  <Text style={styles.dangerButtonText}>{submitting ? text.removing : text.removeConfirm}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {view === "artists" ? (
            <>
              <View style={[styles.search, { backgroundColor: colors.panelSoft, borderColor: colors.line }]}>
                <Ionicons name="search" size={18} color={colors.gold} />
                <TextInput value={query} onChangeText={setQuery} placeholder={text.search} placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} style={[styles.searchInput, { color: colors.ivory }]} />
                {query ? <Pressable onPress={() => setQuery("")} hitSlop={8}><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
              </View>
              <FlatList
                key={`artist-avatar-grid-${columns}`}
                data={filteredArtists}
                numColumns={columns}
                keyExtractor={(item) => item.id}
                keyboardShouldPersistTaps="handled"
                style={styles.artistGrid}
                initialNumToRender={columns * 3}
                maxToRenderPerBatch={columns * 3}
                updateCellsBatchingPeriod={40}
                windowSize={5}
                removeClippedSubviews={Platform.OS === "android"}
                columnWrapperStyle={styles.artistRow}
                contentContainerStyle={styles.artistList}
                ListEmptyComponent={loading
                  ? <ActivityIndicator color={colors.gold} style={styles.emptyState} />
                  : artistsError && !normalizedQuery
                    ? <View style={styles.emptyState}><Text style={[styles.emptyText, { color: colors.muted }]}>{text.unavailable}</Text><Pressable onPress={retry} style={[styles.retryButton, { borderColor: colors.gold }]}><Text style={[styles.retryText, { color: colors.gold }]}>{text.retry}</Text></Pressable></View>
                    : <Text style={[styles.emptyText, styles.emptyState, { color: colors.muted }]}>{text.noResults}</Text>}
                renderItem={({ item }) => {
                  const selected = item.id === selectedArtistId;
                  return (
                    <Pressable onPress={() => setSelectedArtistId(item.id)} disabled={submitting} style={[styles.artistOption, { width: cellWidth, borderColor: selected ? colors.gold : colors.line, backgroundColor: colors.panelSoft }]}>
                      <Image source={imageSource(item.image, "avatar")} style={styles.artistImage} contentFit="cover" contentPosition="center" cachePolicy="memory-disk" allowDownscaling recyclingKey={`${item.id}:profile-avatar-picker`} />
                      <Text style={[styles.artistName, { color: colors.ivory }]} numberOfLines={2}>{item.name[language]}</Text>
                      {selected ? <View style={[styles.artistCheck, { backgroundColor: colors.gold }]}><Ionicons name="checkmark" size={13} color={colors.ink} /></View> : null}
                    </Pressable>
                  );
                }}
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              <View style={styles.artistFooter}>
                <Pressable onPress={() => setView("actions")} disabled={submitting} style={[styles.secondaryButton, { borderColor: colors.line }]}>
                  <Text style={[styles.secondaryButtonText, { color: colors.ivory }]}>{text.cancel}</Text>
                </Pressable>
                <Pressable onPress={() => selectedArtist && void commit({ uri: selectedArtist.image, type: "artist", artistId: selectedArtist.id })} disabled={!selectedArtist || submitting} style={[styles.confirmButton, { backgroundColor: colors.gold }, (!selectedArtist || submitting) && styles.disabled]}>
                  {submitting ? <ActivityIndicator size="small" color={colors.ink} /> : <Ionicons name="checkmark-circle-outline" size={18} color={colors.ink} />}
                  <Text style={[styles.confirmText, { color: colors.ink }]} numberOfLines={2}>{text.usePhoto}</Text>
                </Pressable>
              </View>
            </>
          ) : null}
          {view !== "artists" && error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      </View>
    </Modal>
  );
}

function PickerAction({ icon, title, hint, colors, destructive = false, disabled, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  colors: ReturnType<typeof getThemeColors>;
  destructive?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[styles.action, { backgroundColor: colors.panelSoft, borderColor: colors.line }, disabled && styles.disabled]}>
      <View style={[styles.actionIcon, { borderColor: destructive ? "rgba(227,139,115,0.35)" : colors.line }]}>
        <Ionicons name={icon} size={20} color={destructive ? "#e38b73" : colors.gold} />
      </View>
      <View style={styles.actionCopy}>
        <Text style={[styles.actionTitle, { color: destructive ? "#f2b3a2" : colors.ivory }]}>{title}</Text>
        <Text style={[styles.actionHint, { color: colors.muted }]}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.muted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "flex-end", alignItems: "center", backgroundColor: "rgba(3,7,20,0.72)", paddingHorizontal: 16 },
  sheet: { borderWidth: 1, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: Platform.OS === "ios" ? 30 : 20, maxHeight: "86%" },
  artistSheet: { height: "82%" },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 14 },
  headingCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontSize: 10, lineHeight: 14, fontWeight: "800", letterSpacing: 1.4 },
  title: { fontSize: 21, lineHeight: 27, fontWeight: "800", marginTop: 2 },
  subtitle: { fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  closeButton: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  actions: { gap: 9 },
  action: { minHeight: 66, borderRadius: 15, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 11 },
  actionIcon: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  actionCopy: { flex: 1, minWidth: 0 },
  actionTitle: { fontSize: 14, lineHeight: 18, fontWeight: "700" },
  actionHint: { fontSize: 11.5, lineHeight: 16, marginTop: 2 },
  cancelButton: { minHeight: 44, alignItems: "center", justifyContent: "center" },
  cancelText: { fontSize: 13, fontWeight: "700" },
  search: { minHeight: 46, borderRadius: 13, borderWidth: 1, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  searchInput: { flex: 1, minWidth: 0, fontSize: 14, paddingVertical: 10 },
  artistList: { paddingBottom: 8 },
  artistGrid: { flex: 1 },
  artistRow: { gap: 8, marginBottom: 8 },
  artistOption: { minHeight: 124, borderWidth: 1, borderRadius: 14, padding: 7, overflow: "hidden" },
  artistImage: { width: "100%", aspectRatio: 1, borderRadius: 999 },
  artistName: { fontSize: 10.5, lineHeight: 14, fontWeight: "700", marginTop: 6, textAlign: "center" },
  artistCheck: { position: "absolute", top: 9, right: 9, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  artistFooter: { flexDirection: "row", gap: 9, paddingTop: 10 },
  secondaryButton: { minHeight: 48, minWidth: 94, borderRadius: 13, borderWidth: 1, paddingHorizontal: 14, alignItems: "center", justifyContent: "center" },
  secondaryButtonText: { fontSize: 13, fontWeight: "700" },
  confirmButton: { minHeight: 48, flex: 1, borderRadius: 13, paddingHorizontal: 12, flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center" },
  confirmText: { flexShrink: 1, fontSize: 12.5, lineHeight: 16, fontWeight: "800", textAlign: "center" },
  removePanel: { alignItems: "center", paddingVertical: 10, gap: 14 },
  removeIcon: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  removeTitle: { fontSize: 16, lineHeight: 22, fontWeight: "700", textAlign: "center" },
  removeActions: { width: "100%", flexDirection: "row", gap: 9 },
  dangerButton: { minHeight: 48, flex: 1, borderRadius: 13, backgroundColor: "#8c3f3f", flexDirection: "row", gap: 7, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
  dangerButtonText: { color: "#fff4eb", fontSize: 13, fontWeight: "800" },
  emptyState: { paddingVertical: 36, alignItems: "center", gap: 12 },
  emptyText: { fontSize: 13, lineHeight: 19, textAlign: "center" },
  retryButton: { minHeight: 42, borderRadius: 12, borderWidth: 1, paddingHorizontal: 18, alignItems: "center", justifyContent: "center" },
  retryText: { fontSize: 13, fontWeight: "800" },
  errorText: { color: "#e38b73", fontSize: 12, lineHeight: 17, textAlign: "center", marginTop: 9 },
  disabled: { opacity: 0.55 }
});
