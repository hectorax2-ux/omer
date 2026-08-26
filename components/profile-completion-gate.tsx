import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import {
  DISPLAY_NAME_MAX_LENGTH,
  DISPLAY_NAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
  isValidDisplayName,
  isValidUsername,
  normalizeDisplayName,
  normalizeUsername
} from "@/constants/account-limits";
import { getThemeColors } from "@/constants/theme";
import { ThemePickerModal } from "@/components/theme-picker-modal";
import { artists, countryCommunities } from "@/data/content";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { useLegal } from "@/hooks/use-legal";
import { Language } from "@/types/content";
import { compressProfileImage } from "@/utils/image-compression";
import { uploadFormatHint, validatePickedImageAsset } from "@/utils/image-upload-validation";

const THEME_ONBOARDING_VERSION = "1";

const texts: Record<Language, {
  eyebrow: string;
  step: string;
  title: string;
  intro: string;
  required: string;
  optional: string;
  photo: string;
  photoAction: string;
  removePhoto: string;
  artistAction: string;
  artistTitle: string;
  artistHint: string;
  username: string;
  usernameHint: string;
  name: string;
  country: string;
  countryPlaceholder: string;
  countryRequired: string;
  save: string;
  saving: string;
  usernameInvalid: string;
  usernameCharacters: string;
  nameInvalid: string;
  photoPermission: string;
}> = {
  tr: {
    eyebrow: "İlk kurulum", step: "2 / 2", title: "Seni biraz tanıyalım",
    intro: "Toplulukta görünecek temel bilgilerini tamamla. Profil fotoğrafı isteğe bağlıdır ve daha sonra değiştirilebilir.",
    required: "Zorunlu", optional: "İsteğe bağlı", photo: "Profil fotoğrafı", photoAction: "Galeriden seç",
    removePhoto: "Fotoğrafı sil", artistAction: "Sanatçılardan seç", artistTitle: "Bir sanatçı seç",
    artistHint: "Sevdiğin sanatçının görselini profil fotoğrafın yapabilirsin.", username: "Kullanıcı adı",
    usernameHint: "Harf, rakam, nokta, alt çizgi veya kısa çizgi", name: "Gerçek isim", country: "Ülke",
    countryPlaceholder: "Ülkeni seç", countryRequired: "Devam etmek için listeden ülkeni seç.", save: "Profili tamamla",
    saving: "Profil kaydediliyor...", usernameInvalid: `Kullanıcı adı ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} karakter olmalı.`,
    usernameCharacters: "Kullanıcı adında yalnızca harf, rakam, nokta, alt çizgi ve kısa çizgi kullanılabilir.",
    nameInvalid: `Gerçek isim ${DISPLAY_NAME_MIN_LENGTH}-${DISPLAY_NAME_MAX_LENGTH} karakter olmalı.`,
    photoPermission: "Profil fotoğrafı seçmek için galeri izni gerekir."
  },
  en: {
    eyebrow: "First setup", step: "2 / 2", title: "Let us get to know you",
    intro: "Complete the essential details shown to the community. Your profile photo is optional and can be changed later.",
    required: "Required", optional: "Optional", photo: "Profile photo", photoAction: "Choose from gallery",
    removePhoto: "Remove photo", artistAction: "Choose an artist", artistTitle: "Choose an artist",
    artistHint: "You can use the image of an artist you love as your profile photo.", username: "Username",
    usernameHint: "Letters, numbers, dots, underscores, or hyphens", name: "Real name", country: "Country",
    countryPlaceholder: "Choose your country", countryRequired: "Choose your country from the list to continue.", save: "Complete profile",
    saving: "Saving profile...", usernameInvalid: `Username must be ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} characters.`,
    usernameCharacters: "Use only letters, numbers, dots, underscores, and hyphens in your username.",
    nameInvalid: `Real name must be ${DISPLAY_NAME_MIN_LENGTH}-${DISPLAY_NAME_MAX_LENGTH} characters.`,
    photoPermission: "Gallery permission is required to choose a profile photo."
  },
  ru: {
    eyebrow: "Первичная настройка", step: "2 / 2", title: "Давайте познакомимся",
    intro: "Заполните основные данные, которые увидит сообщество. Фото профиля необязательно, его можно изменить позже.",
    required: "Обязательно", optional: "Необязательно", photo: "Фото профиля", photoAction: "Выбрать из галереи",
    removePhoto: "Удалить фото", artistAction: "Выбрать художника", artistTitle: "Выберите художника",
    artistHint: "Изображение любимого художника можно использовать как фото профиля.", username: "Имя пользователя",
    usernameHint: "Буквы, цифры, точки, подчёркивания или дефисы", name: "Настоящее имя", country: "Страна",
    countryPlaceholder: "Выберите страну", countryRequired: "Чтобы продолжить, выберите страну из списка.", save: "Завершить профиль",
    saving: "Профиль сохраняется...", usernameInvalid: `Имя пользователя должно содержать ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} символов.`,
    usernameCharacters: "Используйте только буквы, цифры, точки, подчёркивания и дефисы.",
    nameInvalid: `Настоящее имя должно содержать ${DISPLAY_NAME_MIN_LENGTH}-${DISPLAY_NAME_MAX_LENGTH} символов.`,
    photoPermission: "Для выбора фото профиля нужен доступ к галерее."
  },
  uz: {
    eyebrow: "Birinchi sozlash", step: "2 / 2", title: "Keling, tanishamiz",
    intro: "Hamjamiyatga ko‘rinadigan asosiy ma’lumotlarni kiriting. Profil rasmi ixtiyoriy va keyin o‘zgartirilishi mumkin.",
    required: "Majburiy", optional: "Ixtiyoriy", photo: "Profil rasmi", photoAction: "Galereyadan tanlash",
    removePhoto: "Rasmni o‘chirish", artistAction: "Rassomlardan tanlash", artistTitle: "Rassomni tanlang",
    artistHint: "Sevimli rassomingiz tasvirini profil rasmi sifatida ishlatishingiz mumkin.", username: "Foydalanuvchi nomi",
    usernameHint: "Harflar, raqamlar, nuqta, pastki chiziq yoki tire", name: "Haqiqiy ism", country: "Mamlakat",
    countryPlaceholder: "Mamlakatingizni tanlang", countryRequired: "Davom etish uchun ro‘yxatdan mamlakatingizni tanlang.", save: "Profilni yakunlash",
    saving: "Profil saqlanmoqda...", usernameInvalid: `Foydalanuvchi nomi ${USERNAME_MIN_LENGTH}-${USERNAME_MAX_LENGTH} belgidan iborat bo‘lishi kerak.`,
    usernameCharacters: "Faqat harf, raqam, nuqta, pastki chiziq va tire ishlating.",
    nameInvalid: `Haqiqiy ism ${DISPLAY_NAME_MIN_LENGTH}-${DISPLAY_NAME_MAX_LENGTH} belgidan iborat bo‘lishi kerak.`,
    photoPermission: "Profil rasmini tanlash uchun galereyaga ruxsat kerak."
  }
};

export function ProfileCompletionGate() {
  const { account, isAuthenticated, needsProfileCompletion, profileHydrated, saveAccountProfile } = useAccount();
  const { language, hasChosenLanguage, isLanguageReady } = useLanguage();
  const { hasAcceptedLegal, isLegalReady } = useLegal();
  const { theme, isThemeReady } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(), []);
  const copy = texts[language];
  const eligible = isAuthenticated && profileHydrated && needsProfileCompletion && isThemeReady
    && isLanguageReady && hasChosenLanguage && isLegalReady && hasAcceptedLegal;
  const [themeStepReady, setThemeStepReady] = useState(false);
  const [themeSelected, setThemeSelected] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState("");
  const [avatar, setAvatar] = useState<string | undefined>();
  const [avatarRemoved, setAvatarRemoved] = useState(false);
  const [selectedArtistId, setSelectedArtistId] = useState<string>();
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [artistPickerOpen, setArtistPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const selectedCountry = countryCommunities.find((item) => item.name.tr === country);
  const profileVisible = eligible && themeStepReady && themeSelected;

  useEffect(() => {
    if (!eligible || !account.uid) {
      setThemeStepReady(false);
      setThemeSelected(false);
      return;
    }
    let active = true;
    setThemeStepReady(false);
    void AsyncStorage.getItem(`art_atlas_theme_onboarding:${account.uid}`)
      .then((value) => {
        if (active) setThemeSelected(value === THEME_ONBOARDING_VERSION);
      })
      .catch(() => {
        if (active) setThemeSelected(false);
      })
      .finally(() => {
        if (active) setThemeStepReady(true);
      });
    return () => {
      active = false;
    };
  }, [account.uid, eligible]);

  useEffect(() => {
    if (!profileVisible) return;
    setUsername(account.username);
    setDisplayName(account.displayName);
    setCountry(account.country);
    setAvatar(account.avatar);
    setAvatarRemoved(false);
    setSelectedArtistId(artists.find((artist) => artist.image === account.avatar)?.id);
    setCountryPickerOpen(false);
    setArtistPickerOpen(false);
    setError("");
  }, [account.avatar, account.country, account.displayName, account.uid, account.username, profileVisible]);

  function completeThemeStep() {
    setThemeSelected(true);
    void AsyncStorage.setItem(`art_atlas_theme_onboarding:${account.uid}`, THEME_ONBOARDING_VERSION);
  }

  async function pickAvatar() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(copy.photoPermission);
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
    setAvatar(await compressProfileImage(result.assets[0].uri));
    setAvatarRemoved(false);
    setSelectedArtistId(undefined);
    setError("");
  }

  function removeAvatar() {
    setAvatar(undefined);
    setAvatarRemoved(Boolean(account.avatar));
    setSelectedArtistId(undefined);
    setError("");
  }

  function chooseArtist(artistId: string) {
    const artist = artists.find((item) => item.id === artistId);
    if (!artist) return;
    setAvatar(artist.image);
    setAvatarRemoved(false);
    setSelectedArtistId(artist.id);
    setArtistPickerOpen(false);
    setError("");
  }

  async function save() {
    const normalizedUsername = normalizeUsername(username);
    const normalizedName = normalizeDisplayName(displayName);
    setError("");
    if (!isValidUsername(normalizedUsername)) {
      setError(copy.usernameInvalid);
      return;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(normalizedUsername)) {
      setError(copy.usernameCharacters);
      return;
    }
    if (!isValidDisplayName(normalizedName)) {
      setError(copy.nameInvalid);
      return;
    }
    if (!countryCommunities.some((item) => item.name.tr === country)) {
      setError(copy.countryRequired);
      return;
    }
    setSaving(true);
    const result = await saveAccountProfile({
      username: normalizedUsername,
      displayName: normalizedName,
      country,
      avatarUri: avatar,
      removeAvatar: avatarRemoved,
      completeOnboarding: true
    });
    setSaving(false);
    if (!result.ok) setError(result.message);
  }

  return (
    <>
      <ThemePickerModal visible={eligible && themeStepReady && !themeSelected} required onThemeSelected={completeThemeStep} onClose={() => undefined} />
      <Modal visible={profileVisible} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => undefined}>
        <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.ink }]} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <View style={[styles.panel, { backgroundColor: colors.panel, borderColor: colors.line }]}>
              <View style={styles.headingRow}>
                <View style={styles.headingText}>
                  <Text style={[styles.eyebrow, { color: colors.gold }]}>{copy.eyebrow}</Text>
                  <Text style={[styles.title, { color: colors.ivory }]}>{copy.title}</Text>
                </View>
                <View style={[styles.stepBadge, { backgroundColor: colors.panelSoft, borderColor: colors.line }]}>
                  <Text style={[styles.stepText, { color: colors.gold }]}>{copy.step}</Text>
                </View>
              </View>
              <Text style={[styles.intro, { color: colors.muted }]}>{copy.intro}</Text>

              <View style={styles.photoSection}>
                <View style={[styles.avatarHalo, { borderColor: colors.line, backgroundColor: colors.panelSoft }]}>
                  <View style={[styles.avatar, { borderColor: colors.gold, backgroundColor: colors.panelSoft }]}>
                    {avatar ? (
                      <Image source={{ uri: avatar }} style={styles.avatarImage} contentFit="cover" contentPosition="center" cachePolicy="memory-disk" transition={140} />
                    ) : <Ionicons name="person" size={48} color={colors.gold} />}
                  </View>
                </View>
                <Text style={[styles.photoTitle, { color: colors.ivory }]}>{copy.photo} · {copy.optional}</Text>
                <Text style={[styles.photoHint, { color: colors.muted }]}>{uploadFormatHint[language]}</Text>
                <View style={styles.photoActions}>
                  <Pressable onPress={pickAvatar} disabled={saving} style={[styles.photoButton, { borderColor: colors.line, backgroundColor: colors.panelSoft }]}>
                    <Ionicons name="images-outline" size={17} color={colors.gold} />
                    <Text style={[styles.photoButtonText, { color: colors.ivory }]}>{copy.photoAction}</Text>
                  </Pressable>
                  <Pressable onPress={() => setArtistPickerOpen(true)} disabled={saving} style={[styles.artistButton, { borderColor: colors.gold }]}>
                    <Ionicons name="color-palette-outline" size={17} color={colors.gold} />
                    <Text style={[styles.artistButtonText, { color: colors.gold }]}>{copy.artistAction}</Text>
                  </Pressable>
                </View>
                {avatar ? (
                  <Pressable onPress={removeAvatar} disabled={saving} style={styles.removePhotoButton}>
                    <Ionicons name="trash-outline" size={15} color="#e38b73" />
                    <Text style={styles.removePhotoText}>{copy.removePhoto}</Text>
                  </Pressable>
                ) : null}
              </View>

              <ProfileField label={`${copy.username} · ${copy.required}`} value={username} onChangeText={setUsername} placeholder={copy.usernameHint} maxLength={USERNAME_MAX_LENGTH} autoCapitalize="none" colors={colors} />
              <ProfileField label={`${copy.name} · ${copy.required}`} value={displayName} onChangeText={setDisplayName} maxLength={DISPLAY_NAME_MAX_LENGTH} autoCapitalize="words" colors={colors} />
              <View style={fieldStyles.field}>
                <Text style={[fieldStyles.fieldLabel, { color: colors.muted }]}>{copy.country} · {copy.required}</Text>
                <Pressable onPress={() => setCountryPickerOpen(true)} style={[styles.countrySelect, { borderColor: colors.line, backgroundColor: colors.panelSoft }]}>
                  <View style={styles.countryValue}>
                    <Ionicons name="earth-outline" size={18} color={colors.gold} />
                    <Text style={[styles.countryText, { color: selectedCountry ? colors.ivory : colors.muted }]} numberOfLines={1}>
                      {selectedCountry?.name[language] ?? copy.countryPlaceholder}
                    </Text>
                  </View>
                  <Ionicons name="chevron-down" size={18} color={colors.gold} />
                </Pressable>
              </View>

              {error ? <View style={styles.errorRow}><Ionicons name="alert-circle" size={18} color="#e38b73" /><Text style={styles.errorText}>{error}</Text></View> : null}
              <Pressable onPress={save} disabled={saving} style={[styles.saveButton, { backgroundColor: colors.gold }, saving && styles.disabled]}>
                <Text style={[styles.saveButtonText, { color: colors.ink }]}>{saving ? copy.saving : copy.save}</Text>
                {!saving ? <Ionicons name="arrow-forward" size={19} color={colors.ink} /> : null}
              </Pressable>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>

      <PickerModal visible={countryPickerOpen && profileVisible} title={copy.country} onClose={() => setCountryPickerOpen(false)} colors={colors}>
        {countryCommunities.map((item) => (
          <Pressable key={item.id} onPress={() => { setCountry(item.name.tr); setCountryPickerOpen(false); setError(""); }} style={[styles.countryOption, { borderColor: colors.line }, item.name.tr === country && { backgroundColor: colors.panelSoft }]}>
            <View style={[styles.countryCodeBadge, { backgroundColor: colors.panelSoft }]}><Text style={[styles.countryCode, { color: colors.gold }]}>{item.code}</Text></View>
            <Text style={[styles.countryOptionText, { color: colors.ivory }]}>{item.name[language]}</Text>
            {item.name.tr === country ? <Ionicons name="checkmark-circle" size={20} color={colors.gold} /> : null}
          </Pressable>
        ))}
      </PickerModal>

      <PickerModal visible={artistPickerOpen && profileVisible} title={copy.artistTitle} subtitle={copy.artistHint} onClose={() => setArtistPickerOpen(false)} colors={colors}>
        <View style={styles.artistGrid}>
          {artists.filter((artist) => artist.image).map((artist) => (
            <Pressable key={artist.id} onPress={() => chooseArtist(artist.id)} style={[styles.artistOption, { borderColor: selectedArtistId === artist.id ? colors.gold : colors.line, backgroundColor: colors.panelSoft }]}>
              <Image source={{ uri: artist.image }} style={styles.artistImage} contentFit="cover" contentPosition="center" cachePolicy="memory-disk" transition={120} recyclingKey={artist.id} />
              <Text style={[styles.artistName, { color: colors.ivory }]} numberOfLines={2}>{artist.name[language]}</Text>
              {selectedArtistId === artist.id ? <View style={[styles.artistCheck, { backgroundColor: colors.gold }]}><Ionicons name="checkmark" size={13} color={colors.ink} /></View> : null}
            </Pressable>
          ))}
        </View>
      </PickerModal>
    </>
  );
}

function ProfileField({ label, colors, ...inputProps }: {
  label: string;
  colors: ReturnType<typeof getThemeColors>;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
}) {
  return (
    <View style={fieldStyles.field}>
      <Text style={[fieldStyles.fieldLabel, { color: colors.muted }]}>{label}</Text>
      <TextInput {...inputProps} placeholderTextColor={colors.muted} style={[fieldStyles.input, { color: colors.ivory, borderColor: colors.line, backgroundColor: colors.panelSoft }]} />
    </View>
  );
}

function PickerModal({ visible, title, subtitle, onClose, colors, children }: {
  visible: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  colors: ReturnType<typeof getThemeColors>;
  children: ReactNode;
}) {
  const styles = useMemo(() => createStyles(), []);
  if (!visible) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.pickerBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.pickerPanel, { backgroundColor: colors.panel, borderColor: colors.line }]}>
          <View style={styles.pickerHeader}>
            <View style={styles.pickerHeadingText}>
              <Text style={[styles.pickerTitle, { color: colors.ivory }]}>{title}</Text>
              {subtitle ? <Text style={[styles.pickerSubtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} style={[styles.closeButton, { backgroundColor: colors.panelSoft, borderColor: colors.line }]}>
              <Ionicons name="close" size={21} color={colors.ivory} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.pickerContent} showsVerticalScrollIndicator={false}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const fieldStyles = StyleSheet.create({
  field: { marginBottom: 14 },
  fieldLabel: { fontSize: 11, fontWeight: "900", marginBottom: 7 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 14, fontWeight: "700" }
});

function createStyles() {
  return StyleSheet.create({
    screen: { flex: 1 },
    content: { flexGrow: 1, justifyContent: "center", padding: 18, paddingVertical: 30 },
    panel: { width: "100%", maxWidth: 540, alignSelf: "center", borderWidth: 1, borderRadius: 20, padding: 20 },
    headingRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
    headingText: { flex: 1, minWidth: 0 },
    eyebrow: { fontSize: 11, fontWeight: "900", letterSpacing: 1.4, textTransform: "uppercase" },
    title: { fontSize: 27, lineHeight: 33, fontWeight: "900", marginTop: 5 },
    stepBadge: { minWidth: 48, minHeight: 30, borderRadius: 15, borderWidth: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 9 },
    stepText: { fontSize: 11, fontWeight: "900" },
    intro: { fontSize: 13, lineHeight: 19, marginTop: 8, marginBottom: 17 },
    photoSection: { alignItems: "center", marginBottom: 20 },
    avatarHalo: { width: 116, height: 116, borderRadius: 58, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    avatar: { width: 102, height: 102, borderRadius: 51, borderWidth: 2, alignItems: "center", justifyContent: "center", overflow: "hidden" },
    avatarImage: { width: "100%", height: "100%" },
    photoTitle: { fontSize: 13, fontWeight: "900", marginTop: 10 },
    photoHint: { fontSize: 10, lineHeight: 15, textAlign: "center", marginTop: 3 },
    photoActions: { width: "100%", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8, marginTop: 10 },
    photoButton: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
    photoButtonText: { fontSize: 12, fontWeight: "900" },
    artistButton: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
    artistButtonText: { fontSize: 12, fontWeight: "900" },
    removePhotoButton: { minHeight: 34, flexDirection: "row", alignItems: "center", gap: 6, marginTop: 5, paddingHorizontal: 10 },
    removePhotoText: { color: "#e38b73", fontSize: 11, fontWeight: "900" },
    countrySelect: { minHeight: 50, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
    countryValue: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 9 },
    countryText: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "800" },
    errorRow: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginTop: 2 },
    errorText: { flex: 1, color: "#e38b73", fontSize: 12, lineHeight: 17, fontWeight: "800" },
    saveButton: { minHeight: 54, borderRadius: 13, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 15 },
    saveButtonText: { fontSize: 15, fontWeight: "900" },
    disabled: { opacity: 0.58 },
    pickerBackdrop: { flex: 1, justifyContent: "center", padding: 18, backgroundColor: "rgba(0,0,0,0.74)" },
    pickerPanel: { width: "100%", maxWidth: 500, maxHeight: "82%", alignSelf: "center", borderWidth: 1, borderRadius: 20, padding: 16 },
    pickerHeader: { flexDirection: "row", alignItems: "flex-start", gap: 12, marginBottom: 12 },
    pickerHeadingText: { flex: 1, minWidth: 0 },
    pickerTitle: { fontSize: 21, lineHeight: 27, fontWeight: "900" },
    pickerSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 4 },
    closeButton: { width: 36, height: 36, borderRadius: 11, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    pickerContent: { paddingBottom: 3 },
    countryOption: { minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 8 },
    countryCodeBadge: { width: 38, height: 28, borderRadius: 9, alignItems: "center", justifyContent: "center" },
    countryCode: { fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
    countryOptionText: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: "800" },
    artistGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    artistOption: { width: "48%", minHeight: 150, borderWidth: 1, borderRadius: 14, padding: 8, overflow: "hidden" },
    artistImage: { width: "100%", height: 104, borderRadius: 10 },
    artistName: { fontSize: 12, lineHeight: 16, fontWeight: "900", marginTop: 7 },
    artistCheck: { position: "absolute", top: 14, right: 14, width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" }
  });
}
