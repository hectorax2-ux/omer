import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppChrome } from "@/components/app-chrome";
import { getThemeColors } from "@/constants/theme";
import { useAccount } from "@/hooks/use-account";
import { useArtworks } from "@/hooks/use-artworks";
import { useArtSystems } from "@/hooks/use-art-systems";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { isOwnedMuseum } from "@/utils/user-identity";
import { fieldLimits } from "@/types/art-systems";
import { Language } from "@/types/content";
import { uploadMuseumCover } from "@/src/services/firebase";

const MUSEUM_COVER_COOLDOWN_MS = 6 * 60 * 60 * 1000;

const museumCopy = {
  tr: {
    screenTitle: "Benim Müzem", createTitle: "Kendi müzeni oluştur", createDescription: "Müze adı sınırlı uzunlukta olmalı; sistem sonuna otomatik olarak “Müzesi” ekler.", create: "Müze oluştur", namePlaceholder: "Müze ismini gir", permission: "Görsel seçmek için izin gerekli.", uploadFailed: "Kapak görseli yüklenemedi.", coverRemoved: "Kapak görseli kaldırıldı.", artworks: "eser", edit: "Müze bilgilerini düzenle", removeCover: "Kapak görselini kaldır", removeCoverTitle: "Kapak görselini silmek istiyor musun?", removeCoverBody: "Silindikten sonra müze kapak alanı boş görünür.", cancel: "Vazgeç", yesRemove: "Evet, sil", changeCover: "Kapak görselini değiştir", selectCover: "Kapak görseli seç", bioPlaceholder: "Kısa müze biyografisi", update: "Müzeyi güncelle", delete: "Müzeyi sil", deleteTitle: "Müzeyi silmek istiyor musun?", deleteBody: "Herkes haftada bir müze oluşturabilir. Premium kullanıcılar müzeyi silip beklemeden tekrar oluşturabilir.", yesDelete: "Evet, sil", empty: "Eser detaylarından “Müzeme Ekle” ile koleksiyonunu başlat."
  },
  en: {
    screenTitle: "My Museum", createTitle: "Create your museum", createDescription: "The museum name has a length limit; the system appends the museum suffix automatically.", create: "Create museum", namePlaceholder: "Enter museum name", permission: "Permission is required to choose an image.", uploadFailed: "Cover image upload failed.", coverRemoved: "Cover image removed.", artworks: "artworks", edit: "Edit museum details", removeCover: "Remove cover image", removeCoverTitle: "Remove the cover image?", removeCoverBody: "The museum cover area will appear empty after removal.", cancel: "Cancel", yesRemove: "Yes, remove", changeCover: "Change cover image", selectCover: "Select cover image", bioPlaceholder: "Short museum bio", update: "Update museum", delete: "Delete museum", deleteTitle: "Delete this museum?", deleteBody: "Each member can create one museum per week. Premium members can recreate without waiting.", yesDelete: "Yes, delete", empty: "Start your collection with “Add to My Museum” on artwork detail pages."
  },
  ru: {
    screenTitle: "Мой музей", createTitle: "Создайте свой музей", createDescription: "Название музея имеет ограничение по длине; система автоматически добавит окончание.", create: "Создать музей", namePlaceholder: "Введите название музея", permission: "Для выбора изображения нужен доступ к галерее.", uploadFailed: "Не удалось загрузить обложку.", coverRemoved: "Обложка удалена.", artworks: "произведений", edit: "Изменить данные музея", removeCover: "Удалить обложку", removeCoverTitle: "Удалить обложку музея?", removeCoverBody: "После удаления область обложки музея останется пустой.", cancel: "Отмена", yesRemove: "Да, удалить", changeCover: "Сменить обложку", selectCover: "Выбрать обложку", bioPlaceholder: "Краткое описание музея", update: "Обновить музей", delete: "Удалить музей", deleteTitle: "Удалить этот музей?", deleteBody: "Каждый участник может создать один музей в неделю. Премиум-участники могут создать музей заново без ожидания.", yesDelete: "Да, удалить", empty: "Начните коллекцию через «Добавить в мой музей» на странице произведения."
  },
  uz: {
    screenTitle: "Mening muzeyim", createTitle: "O'z muzeyingizni yarating", createDescription: "Muzey nomi uzunligi cheklangan; tizim muzey qo'shimchasini avtomatik qo'shadi.", create: "Muzey yaratish", namePlaceholder: "Muzey nomini kiriting", permission: "Rasm tanlash uchun galereyaga ruxsat kerak.", uploadFailed: "Muqova rasmini yuklab bo'lmadi.", coverRemoved: "Muqova rasmi olib tashlandi.", artworks: "asar", edit: "Muzey ma'lumotlarini tahrirlash", removeCover: "Muqova rasmini olib tashlash", removeCoverTitle: "Muqova rasmini o'chirmoqchimisiz?", removeCoverBody: "O'chirilgandan keyin muzey muqovasi maydoni bo'sh qoladi.", cancel: "Bekor qilish", yesRemove: "Ha, o'chirish", changeCover: "Muqova rasmini almashtirish", selectCover: "Muqova rasmini tanlash", bioPlaceholder: "Muzey haqida qisqacha", update: "Muzeyni yangilash", delete: "Muzeyni o'chirish", deleteTitle: "Muzeyni o'chirmoqchimisiz?", deleteBody: "Har bir a'zo haftada bir muzey yarata oladi. Premium a'zolar kutmasdan qayta yaratishi mumkin.", yesDelete: "Ha, o'chirish", empty: "Asar sahifasidagi “Muzeyimga qo'shish” orqali kolleksiyangizni boshlang."
  }
};

function coverCooldownRemainingMs(updatedAt?: string) {
  if (!updatedAt) return 0;
  return Math.max(0, MUSEUM_COVER_COOLDOWN_MS - (Date.now() - new Date(updatedAt).getTime()));
}

function formatCoverCooldown(ms: number, language: Language) {
  const hours = Math.floor(ms / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  if (language === "tr") return `${hours} sa ${minutes} dk`;
  if (language === "ru") return `${hours} ч ${minutes} мин`;
  if (language === "uz") return `${hours} soat ${minutes} daq`;
  return `${hours}h ${minutes}m`;
}

function coverCooldownMessage(remainingMs: number, language: Language) {
  const countdown = formatCoverCooldown(remainingMs, language);
  if (language === "tr") return `Kapak görselini ${countdown} sonra tekrar değiştirebilirsin.`;
  if (language === "ru") return `Обложку можно сменить через ${countdown}.`;
  if (language === "uz") return `Muqova rasmini ${countdown} dan keyin yana o'zgartira olasiz.`;
  return `You can change the cover again in ${countdown}.`;
}

export default function MyMuseumScreen() {
  const { language } = useLanguage();
  const copy = museumCopy[language];
  const { account } = useAccount();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { artworks } = useArtworks();
  const { createMuseum, deleteMuseum, personalMuseums, updateMuseum } = useArtSystems();
  const [name, setName] = useState("");
  const [editName, setEditName] = useState("");
  const [editBio, setEditBio] = useState("");
  const [editCover, setEditCover] = useState("");
  const [message, setMessage] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [coverDeleteConfirmOpen, setCoverDeleteConfirmOpen] = useState(false);
  const [, setCooldownTick] = useState(0);
  const museum = personalMuseums.find((item) => isOwnedMuseum(item, account) && item.active);
  const museumArtworks = museum ? artworks.filter((artwork) => museum.artworkIds.includes(artwork.id)) : [];
  const coverCooldownMs = coverCooldownRemainingMs(museum?.coverImageUpdatedAt);

  useEffect(() => {
    if (!editOpen || !coverCooldownMs) return;
    const timer = setInterval(() => setCooldownTick((value) => value + 1), 30000);
    return () => clearInterval(timer);
  }, [coverCooldownMs, editOpen]);

  function assertCoverChangeAllowed() {
    if (!coverCooldownMs) return true;
    setMessage(coverCooldownMessage(coverCooldownMs, language));
    return false;
  }

  useEffect(() => {
    if (!museum) return;
    setEditName(stripMuseumSuffix(museum.name));
    setEditBio(museum.bio ?? "");
    setEditCover(museum.coverImage ?? "");
  }, [museum]);

  function create() {
    const result = createMuseum(name);
    setMessage(result.message);
  }

  async function pickCover() {
    if (!assertCoverChangeAllowed()) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setMessage(copy.permission);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.76,
      allowsEditing: true,
      aspect: [16, 9]
    });
    if (!result.canceled) {
      setEditCover(result.assets[0].uri);
    }
  }

  async function saveMuseum() {
    if (!museum) return;
    setMessage("");
    const coverTouched = (editCover || "") !== (museum.coverImage || "");
    if (coverTouched && !assertCoverChangeAllowed()) return;
    try {
      const coverImage = editCover && account.uid && !/^https?:\/\//i.test(editCover)
        ? await uploadMuseumCover(account.uid, editCover)
        : editCover;
      const result = updateMuseum(museum.id, { name: editName, bio: editBio, coverImage: coverImage || "" });
      setMessage(result.message);
      if (result.ok) {
        setEditCover(coverImage);
        setEditOpen(false);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : copy.uploadFailed);
    }
  }

  function removeCoverImage() {
    if (!museum) return;
    if (!assertCoverChangeAllowed()) {
      setCoverDeleteConfirmOpen(false);
      return;
    }
    setEditCover("");
    setCoverDeleteConfirmOpen(false);
    const result = updateMuseum(museum.id, { name: editName, bio: editBio, coverImage: "" });
    setMessage(result.ok
      ? copy.coverRemoved
      : result.message);
  }

  function confirmDeleteMuseum() {
    if (!museum) return;
    const result = deleteMuseum(museum.id);
    setMessage(result.message);
    setDeleteConfirmOpen(false);
    setEditOpen(false);
  }

  return (
    <AppChrome title={copy.screenTitle} eyebrow="Art Atlas" showBackButton backToHome>
      {!museum ? (
        <View style={styles.panel}>
          <Ionicons name="business" size={34} color={colors.gold} />
          <Text style={styles.title}>{copy.createTitle}</Text>
          <Text style={styles.text}>{copy.createDescription}</Text>
          <TextInput
            value={name}
            onChangeText={(value) => setName(value.slice(0, fieldLimits.museumName.max))}
            maxLength={fieldLimits.museumName.max}
            placeholder={copy.namePlaceholder}
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Pressable onPress={create} style={styles.button}><Text style={styles.buttonText}>{copy.create}</Text></Pressable>
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      ) : (
        <>
          <View style={[styles.hero, !museum.coverImage && styles.heroEmpty]}>
            {museum.coverImage ? <Image source={{ uri: museum.coverImage }} style={styles.heroImage} contentFit="cover" /> : null}
            <View style={styles.heroOverlay}>
              <Text style={styles.heroTitle}>{museum.name}</Text>
              <Text style={styles.heroText}>{museum.artworkIds.length} / {account.isPremium ? 100 : 8} {copy.artworks}</Text>
              {museum.bio ? <Text style={styles.heroBio} numberOfLines={2}>{museum.bio}</Text> : null}
            </View>
          </View>
          <Pressable onPress={() => setEditOpen((value) => !value)} style={styles.editToggle}>
            <View style={styles.editHead}>
              <Ionicons name="create-outline" size={18} color={colors.gold} />
              <Text style={styles.editTitle}>{copy.edit}</Text>
            </View>
            <Ionicons name={editOpen ? "chevron-up" : "chevron-down"} size={18} color={colors.gold} />
          </Pressable>
          {editOpen ? (
            <View style={styles.editPanel}>
              {editCover ? (
                <Pressable onPress={() => setCoverDeleteConfirmOpen(true)} style={styles.coverRemoveLink}>
                  <Ionicons name="close-circle" size={17} color={colors.wine} />
                  <Text style={styles.coverRemoveLinkText}>
                    {copy.removeCover}
                  </Text>
                </Pressable>
              ) : null}
              {coverCooldownMs ? (
                <Text style={styles.cooldownText}>{coverCooldownMessage(coverCooldownMs, language)}</Text>
              ) : null}
              {coverDeleteConfirmOpen ? (
                <View style={styles.confirmPanel}>
                  <Text style={styles.confirmTitle}>
                    {copy.removeCoverTitle}
                  </Text>
                  <Text style={styles.confirmText}>
                    {copy.removeCoverBody}
                  </Text>
                  <View style={styles.confirmRow}>
                    <Pressable onPress={() => setCoverDeleteConfirmOpen(false)} style={styles.cancelButton}>
                      <Text style={styles.cancelText}>{copy.cancel}</Text>
                    </Pressable>
                    <Pressable onPress={removeCoverImage} style={styles.confirmDeleteButton}>
                      <Text style={styles.confirmDeleteText}>{copy.yesRemove}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
              <Pressable onPress={pickCover} style={[styles.coverPicker, coverCooldownMs > 0 && styles.coverPickerLocked]}>
                {editCover ? <Image source={{ uri: editCover }} style={styles.coverPreview} contentFit="cover" /> : null}
                <View style={styles.coverOverlay} pointerEvents="none">
                  <Ionicons name="image-outline" size={20} color={colors.gold} />
                  <Text style={styles.coverText}>
                    {editCover ? copy.changeCover : copy.selectCover}
                  </Text>
                </View>
              </Pressable>
              <TextInput value={editName} onChangeText={(value) => setEditName(value.slice(0, fieldLimits.museumName.max))} maxLength={fieldLimits.museumName.max} placeholder={copy.namePlaceholder} placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={editBio} onChangeText={(value) => setEditBio(value.slice(0, fieldLimits.museumBio.max))} multiline maxLength={fieldLimits.museumBio.max} placeholder={`${copy.bioPlaceholder} (${fieldLimits.museumBio.max})`} placeholderTextColor={colors.muted} style={styles.bioInput} />
              <Text style={styles.counter}>{editBio.length} / {fieldLimits.museumBio.max}</Text>
              <Pressable onPress={saveMuseum} style={styles.button}><Text style={styles.buttonText}>{copy.update}</Text></Pressable>
              <Pressable onPress={() => setDeleteConfirmOpen(true)} style={styles.deleteButton}>
                <Ionicons name="trash-outline" size={17} color={colors.wine} />
                <Text style={styles.deleteText}>{copy.delete}</Text>
              </Pressable>
              {deleteConfirmOpen ? (
                <View style={styles.confirmPanel}>
                  <Text style={styles.confirmTitle}>{copy.deleteTitle}</Text>
                  <Text style={styles.confirmText}>
                    {copy.deleteBody}
                  </Text>
                  <View style={styles.confirmRow}>
                    <Pressable onPress={() => setDeleteConfirmOpen(false)} style={styles.cancelButton}>
                      <Text style={styles.cancelText}>{copy.cancel}</Text>
                    </Pressable>
                    <Pressable onPress={confirmDeleteMuseum} style={styles.confirmDeleteButton}>
                      <Text style={styles.confirmDeleteText}>{copy.yesDelete}</Text>
                    </Pressable>
                  </View>
                </View>
              ) : null}
            </View>
          ) : null}
          <Text style={styles.message}>{message}</Text>
          <View style={styles.grid}>
            {museumArtworks.map((artwork) => (
              <Pressable key={artwork.id} onPress={() => router.push({ pathname: "/artwork/[id]", params: { id: artwork.id } })} style={styles.artCard}>
                <Image source={{ uri: artwork.image }} style={styles.artImage} contentFit="cover" />
                <Text style={styles.artTitle} numberOfLines={1}>{artwork.title[language]}</Text>
              </Pressable>
            ))}
          </View>
          {!museumArtworks.length ? <Text style={styles.text}>{copy.empty}</Text> : null}
        </>
      )}
    </AppChrome>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    panel: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 16, gap: 12 },
    title: { color: colors.ivory, fontSize: 22, fontWeight: "900" },
    text: { color: colors.muted, fontSize: 13, lineHeight: 20, fontWeight: "800" },
    input: { minHeight: 46, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, color: colors.ivory, paddingHorizontal: 12, fontWeight: "900" },
    button: { minHeight: 46, borderRadius: 8, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
    buttonText: { color: colors.ink, fontWeight: "900" },
    message: { color: colors.gold, fontWeight: "900", textAlign: "center", marginVertical: 8 },
    hero: { height: 220, borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, marginBottom: 12 },
    heroEmpty: { backgroundColor: colors.panelSoft },
    heroImage: { ...StyleSheet.absoluteFillObject },
    heroOverlay: { marginTop: "auto", padding: 16, backgroundColor: "rgba(0,0,0,0.42)" },
    heroTitle: { color: colors.ivory, fontSize: 26, fontWeight: "900" },
    heroText: { color: colors.gold, fontWeight: "900", marginTop: 3 },
    heroBio: { color: colors.ivory, fontSize: 12, lineHeight: 17, fontWeight: "700", marginTop: 6 },
    editToggle: { minHeight: 46, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, paddingHorizontal: 13, flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
    editPanel: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 12, gap: 10, marginBottom: 12 },
    editHead: { flexDirection: "row", alignItems: "center", gap: 8 },
    editTitle: { color: colors.ivory, fontSize: 16, fontWeight: "900" },
    coverPicker: { height: 136, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, overflow: "hidden" },
    coverPickerLocked: { opacity: 0.72 },
    coverPreview: { ...StyleSheet.absoluteFillObject },
    coverRemoveLink: {
      minHeight: 40,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: colors.wine,
      backgroundColor: "rgba(183,76,76,0.18)",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 7,
      paddingHorizontal: 12
    },
    coverRemoveLinkText: { color: colors.ivory, fontSize: 13, fontWeight: "900" },
    cooldownText: { color: colors.gold, fontSize: 12, lineHeight: 17, fontWeight: "800", textAlign: "center" },
    coverOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.34)", alignItems: "center", justifyContent: "center", gap: 7 },
    coverText: { color: colors.ivory, fontSize: 12, fontWeight: "900" },
    bioInput: { minHeight: 76, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, color: colors.ivory, padding: 12, textAlignVertical: "top", fontWeight: "800" },
    counter: { color: colors.muted, fontSize: 11, fontWeight: "800", textAlign: "right" },
    deleteButton: { minHeight: 42, borderRadius: 8, borderWidth: 1, borderColor: "rgba(183,76,76,0.36)", backgroundColor: "rgba(183,76,76,0.08)", alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 7 },
    deleteText: { color: colors.wine, fontWeight: "900" },
    confirmPanel: { borderRadius: 8, borderWidth: 1, borderColor: "rgba(183,76,76,0.36)", backgroundColor: colors.panelSoft, padding: 10, gap: 8 },
    confirmTitle: { color: colors.ivory, fontWeight: "900", fontSize: 14 },
    confirmText: { color: colors.muted, fontWeight: "800", fontSize: 12, lineHeight: 17 },
    confirmRow: { flexDirection: "row", gap: 8 },
    cancelButton: { flex: 1, minHeight: 38, borderRadius: 8, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
    cancelText: { color: colors.ivory, fontWeight: "900" },
    confirmDeleteButton: { flex: 1, minHeight: 38, borderRadius: 8, backgroundColor: colors.wine, alignItems: "center", justifyContent: "center" },
    confirmDeleteText: { color: colors.ivory, fontWeight: "900" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
    artCard: { width: "48.5%", borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel },
    artImage: { width: "100%", aspectRatio: 1 },
    artTitle: { color: colors.ivory, fontWeight: "900", padding: 8 }
  });
}

function stripMuseumSuffix(name: string) {
  return name.endsWith(" Müzesi") ? name.slice(0, -" Müzesi".length) : name.endsWith("Müzesi") ? name.slice(0, -"Müzesi".length).trim() : name;
}
