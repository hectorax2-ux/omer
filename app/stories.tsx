import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { AuthRequired, EmailVerificationRequired } from "@/components/auth-required";
import { getThemeColors } from "@/constants/theme";
import { radii, v2Colors } from "@/constants/design";
import { uiCopy } from "@/data/content";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useArtStories } from "@/hooks/use-art-stories";
import { useArtStoryEngagement } from "@/hooks/use-art-story-engagement";
import { useLanguage } from "@/hooks/use-language";
import { deleteArtStoryDocument, listUserArtStorySubmissions, submitMemberArtStory } from "@/src/services/firebase/art-story-service";
import { artStoryImagePath, uploadImage } from "@/src/services/firebase/storage-service";
import { ArtStoryDocument } from "@/src/types/firestore";
import { Language } from "@/types/content";
import { storyAuthorLabel } from "@/utils/story-author-label";

const MAX_BODY_LENGTH = 5000;
const MIN_BODY_LENGTH = 80;
const PAGE_SIZE = 20;

type StoryCategoryFilter = "all" | "art_atlas" | "authors" | "favorites";
type StoryReadFilter = "all" | "read" | "unread";

const categoryIcons: Record<StoryCategoryFilter, keyof typeof Ionicons.glyphMap> = {
  all: "layers-outline",
  art_atlas: "library-outline",
  authors: "people-outline",
  favorites: "heart-outline"
};

const categoryLabels: Record<StoryCategoryFilter, Record<Language, string>> = {
  all: { tr: "Tümü", en: "All", ru: "Все", uz: "Hammasi" },
  art_atlas: { tr: "Atlas", en: "Atlas", ru: "Atlas", uz: "Atlas" },
  authors: { tr: "Yazarlar", en: "Writers", ru: "Авторы", uz: "Mualliflar" },
  favorites: { tr: "Favori", en: "Saved", ru: "Избр.", uz: "Sevimli" }
};

const readFilterLabels: Record<StoryReadFilter, Record<Language, string>> = {
  all: { tr: "Tümü", en: "All", ru: "Все", uz: "Hammasi" },
  read: { tr: "Okunan", en: "Read", ru: "Прочитанные", uz: "O'qilgan" },
  unread: { tr: "Okunmayan", en: "Unread", ru: "Непрочитанные", uz: "O'qilmagan" }
};

const storyStatusLabels: Record<string, Record<Language, string>> = {
  pending: { tr: "Onay bekliyor", en: "Pending approval", ru: "На модерации", uz: "Tasdiq kutilmoqda" },
  published: { tr: "Yayında", en: "Published", ru: "Опубликовано", uz: "Nashr etilgan" },
  rejected: { tr: "Reddedildi", en: "Rejected", ru: "Отклонено", uz: "Rad etildi" },
  scheduled: { tr: "Planlandı", en: "Scheduled", ru: "Запланировано", uz: "Rejalashtirilgan" },
  hidden: { tr: "Gizli", en: "Hidden", ru: "Скрыто", uz: "Yashirin" },
  archived: { tr: "Arşivlendi", en: "Archived", ru: "В архиве", uz: "Arxivlandi" }
};

function storyStatusLabel(status: string | undefined, language: Language) {
  return storyStatusLabels[status ?? "pending"]?.[language] ?? storyStatusLabels.pending[language];
}

function storySortTime(story: object) {
  const datedStory = story as { publishedAt?: { toMillis?: () => number } | null; createdAt?: { toMillis?: () => number } | null };
  return datedStory.publishedAt?.toMillis?.() ?? datedStory.createdAt?.toMillis?.() ?? 0;
}

type StoryForm = {
  firstName: string;
  lastName: string;
  title: string;
  body: string;
  image: string;
};

const emptyForm: StoryForm = {
  firstName: "",
  lastName: "",
  title: "",
  body: "",
  image: ""
};

export default function StoriesScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const { account, isAuthenticated, canUseMemberFeatures } = useAccount();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { stories } = useArtStories();
  const { favoriteIds, readIds } = useArtStoryEngagement(account.uid);
  const [categoryFilter, setCategoryFilter] = useState<StoryCategoryFilter>("all");
  const [readFilter, setReadFilter] = useState<StoryReadFilter>("all");
  const [submissions, setSubmissions] = useState<ArtStoryDocument[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [loadingSubmit, setLoadingSubmit] = useState(false);
  const [form, setForm] = useState<StoryForm>(emptyForm);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  useFocusEffect(
    useCallback(() => {
      if (!account.uid) return;
      listUserArtStorySubmissions(account.uid).then(setSubmissions).catch(() => setSubmissions([]));
    }, [account.uid])
  );

  function openAddModal() {
    if (!account.isPremium) {
      Alert.alert(
        language === "tr" ? "Premium gerekli" : language === "ru" ? "Нужен Premium" : language === "uz" ? "Premium kerak" : "Premium required",
        language === "tr"
          ? "Sanat yazısı göndermek için Premium üyelik gerekir."
          : language === "ru"
            ? "Отправка статей доступна только Premium-пользователям."
            : language === "uz"
              ? "San'at yozuvi yuborish uchun Premium a'zolik kerak."
              : "Premium membership is required to submit art writings."
      );
      return;
    }
    setModalOpen(true);
  }

  const visibleStories = useMemo(() => {
    const filtered = stories.filter((story) => {
      if (categoryFilter === "art_atlas" && story.source === "member") return false;
      if (categoryFilter === "authors" && story.source !== "member") return false;
      if (categoryFilter === "favorites" && !favoriteIds.includes(story.id)) return false;
      if (categoryFilter !== "favorites" && readFilter === "read" && !readIds.includes(story.id)) return false;
      if (categoryFilter !== "favorites" && readFilter === "unread" && readIds.includes(story.id)) return false;
      return true;
    });
    const query = searchQuery.trim().toLowerCase();
    const searched = !query
      ? filtered
      : filtered.filter((story) => {
          const title = story.title[language].toLowerCase();
          const excerpt = story.excerpt[language].toLowerCase();
          return title.includes(query) || excerpt.includes(query);
        });
    return [...searched].sort((left, right) => storySortTime(right) - storySortTime(left));
  }, [stories, categoryFilter, readFilter, favoriteIds, readIds, searchQuery, language]);

  const pagedStories = visibleStories.slice(0, visibleCount);
  const featuredStory = pagedStories[0];
  const listStories = pagedStories.slice(1);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [categoryFilter, readFilter, searchQuery]);

  const searchPlaceholder =
    language === "tr" ? "Yazı ara..." : language === "ru" ? "Поиск статей..." : language === "uz" ? "Yozuv qidirish..." : "Search writings...";

  const trimmedBody = form.body.trim();
  const canSubmit = Boolean(
    form.image &&
    form.firstName.trim() &&
    form.lastName.trim() &&
    form.title.trim() &&
    trimmedBody.length >= MIN_BODY_LENGTH &&
    trimmedBody.length <= MAX_BODY_LENGTH
  );

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("İzin gerekli", "Yazı görseli seçebilmek için galeri erişimi gerekir.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.82,
      allowsEditing: true
    });
    if (result.canceled || !result.assets[0]) return;
    setForm((current) => ({ ...current, image: result.assets[0].uri }));
  }

  function closeModal() {
    setModalOpen(false);
  }

  async function submitStory() {
    if (!account.isPremium) {
      Alert.alert("Premium gerekli", "Sanat yazısı göndermek için Premium üyelik gerekir.");
      return;
    }
    if (!canSubmit) {
      Alert.alert("Eksik bilgi", `Görsel, isim, soyisim, başlık ve en az ${MIN_BODY_LENGTH} karakterlik yazı gerekir.`);
      return;
    }
    setLoadingSubmit(true);
    try {
      const response = await fetch(form.image);
      const blob = await response.blob();
      const fileName = `${Date.now()}-${form.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}.jpg`;
      const imageURL = await uploadImage(artStoryImagePath(account.uid, fileName), blob, {
        mimeType: blob.type || "image/jpeg",
        sizeBytes: blob.size
      });
      await submitMemberArtStory({
        authorId: account.uid,
        authorUsername: account.username,
        authorDisplayName: `${form.firstName.trim()} ${form.lastName.trim()}`,
        title: form.title.trim(),
        excerpt: trimmedBody.slice(0, 160),
        body: trimmedBody,
        imageURL
      });
      const nextSubmissions = await listUserArtStorySubmissions(account.uid);
      setSubmissions(nextSubmissions);
      setForm(emptyForm);
      setModalOpen(false);
      Alert.alert(language === "tr" ? "Alındı" : "Received", language === "tr" ? "Yazınız alındı; kısa süre içinde Sanat Yazıları sayfasında görünecek." : language === "ru" ? "Статья принята и скоро появится в разделе «Художественные тексты»." : language === "uz" ? "Yozuv qabul qilindi; tez orada San'at yozuvlari bo'limida ko'rinadi." : "Your writing was received and will appear in Art Writings shortly.");
    } catch (error) {
      Alert.alert("Gönderilemedi", error instanceof Error ? error.message : "Lütfen tekrar deneyin.");
    } finally {
      setLoadingSubmit(false);
    }
  }

  async function removeSubmission(id: string) {
    await deleteArtStoryDocument(id);
    setSubmissions((current) => current.filter((item) => item.id !== id));
  }

  if (!isAuthenticated) {
    return <AuthRequired title={uiCopy.artArticles[language]} />;
  }

  if (!canUseMemberFeatures) {
    return <EmailVerificationRequired title={uiCopy.artArticles[language]} />;
  }

  return (
    <AppChrome title={uiCopy.artArticles[language]} eyebrow="Art Atlas" showBackButton backToHome>
      <View style={styles.toolbar}>
        <View style={styles.toolbarHeader}>
          <View style={styles.toolbarIntro}>
            <Text style={styles.toolbarTitle}>
              {language === "tr" ? "Yazı koleksiyonu" : language === "ru" ? "Коллекция статей" : language === "uz" ? "Yozuvlar to'plami" : "Writing collection"}
            </Text>
            <Text style={styles.toolbarHint}>
              {language === "tr" ? "Filtrele ve okumaya başla" : language === "ru" ? "Фильтруйте и читайте" : language === "uz" ? "Filtrlash va o'qish" : "Filter and start reading"}
            </Text>
          </View>
          <View style={styles.toolbarActions}>
            <Pressable
              onPress={() => {
                setSearchOpen((current) => {
                  if (current) setSearchQuery("");
                  return !current;
                });
              }}
              style={[styles.iconButton, searchOpen && styles.iconButtonActive]}
            >
              <Ionicons name="search-outline" size={18} color={searchOpen ? colors.ink : colors.gold} />
            </Pressable>
            <Pressable onPress={openAddModal} style={[styles.addButton, !account.isPremium && styles.addButtonLocked]}>
              <Ionicons name={account.isPremium ? "create-outline" : "diamond-outline"} size={15} color={account.isPremium ? colors.ink : colors.gold} />
              <Text style={[styles.addButtonText, !account.isPremium && styles.addButtonTextLocked]}>
                {language === "tr" ? "Yazı ekle" : language === "ru" ? "Добавить" : language === "uz" ? "Qo'shish" : "Add"}
              </Text>
            </Pressable>
          </View>
        </View>

        {searchOpen ? (
          <View style={styles.searchBox}>
            <Ionicons name="search-outline" size={16} color={colors.muted} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              autoFocus
              returnKeyType="search"
            />
            {searchQuery ? (
              <Pressable onPress={() => setSearchQuery("")} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <View style={styles.filterRow}>
          {(["all", "art_atlas", "authors", "favorites"] as StoryCategoryFilter[]).map((item) => {
            const active = categoryFilter === item;
            return (
              <Pressable
                key={item}
                onPress={() => {
                  setCategoryFilter(item);
                  if (item === "all") setReadFilter("all");
                }}
                style={[styles.filterChip, active && styles.filterChipActive]}
              >
                <Ionicons name={categoryIcons[item]} size={13} color={active ? colors.ink : colors.gold} />
                <Text
                  style={[styles.filterChipText, active && styles.filterChipTextActive]}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.72}
                >
                  {categoryLabels[item][language]}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {categoryFilter !== "favorites" ? (
        <View style={styles.readFilterRow}>
          {(["read", "unread"] as const).map((item) => {
            const active = readFilter === item;
            return (
              <Pressable
                key={item}
                onPress={() => setReadFilter((current) => current === item ? "all" : item)}
                style={[styles.readFilterChip, active && styles.readFilterChipActive]}
              >
                <Ionicons
                  name={item === "read" ? "checkmark-circle" : "radio-button-off"}
                  size={14}
                  color={active ? colors.ink : colors.gold}
                />
                <Text style={[styles.readFilterChipText, active && styles.readFilterChipTextActive]}>
                  {readFilterLabels[item][language]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        ) : null}

        {!account.isPremium ? (
          <Text style={styles.premiumHint}>
            {language === "tr" ? "Yazı göndermek için Premium gerekir." : language === "ru" ? "Для отправки нужен Premium." : language === "uz" ? "Yuborish uchun Premium kerak." : "Premium required to submit writings."}
          </Text>
        ) : null}
      </View>

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={closeModal}>
        <View style={styles.modalBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={closeModal} />
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{language === "tr" ? "Sanat yazısı ekle" : "Add art writing"}</Text>
              <Pressable onPress={closeModal} style={styles.modalClose}>
                <Ionicons name="close" size={22} color={colors.ivory} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <Text style={styles.modalHint}>
                {language === "tr"
                  ? "Premium üyeler sanat yazılarını toplulukla paylaşabilir."
                  : language === "ru"
                    ? "Premium-пользователи могут делиться художественными текстами с сообществом."
                    : language === "uz"
                      ? "Premium a'zolar san'at yozuvlarini jamiyat bilan ulashishi mumkin."
                      : "Premium members can share art writings with the community."}
              </Text>
              <Pressable onPress={pickImage} style={styles.imagePicker}>
                {form.image ? (
                  <Image source={{ uri: form.image }} style={styles.preview} contentFit="cover" />
                ) : (
                  <>
                    <Ionicons name="image-outline" size={22} color={colors.gold} />
                    <Text style={styles.imagePickerText}>{language === "tr" ? "Kapak görseli seç" : "Choose cover image"}</Text>
                  </>
                )}
              </Pressable>
              <View style={styles.twoInputs}>
                <TextInput placeholder={language === "tr" ? "İsim" : "First name"} placeholderTextColor={colors.muted} value={form.firstName} onChangeText={(firstName) => setForm((current) => ({ ...current, firstName }))} style={styles.input} />
                <TextInput placeholder={language === "tr" ? "Soyisim" : "Last name"} placeholderTextColor={colors.muted} value={form.lastName} onChangeText={(lastName) => setForm((current) => ({ ...current, lastName }))} style={styles.input} />
              </View>
              <TextInput placeholder={language === "tr" ? "Yazı başlığı" : "Title"} placeholderTextColor={colors.muted} value={form.title} onChangeText={(title) => setForm((current) => ({ ...current, title }))} style={styles.input} />
              <TextInput
                multiline
                contextMenuHidden={false}
                placeholder={language === "tr" ? "Yazı içeriği" : "Writing content"}
                placeholderTextColor={colors.muted}
                value={form.body}
                onChangeText={(body) => setForm((current) => ({ ...current, body: body.slice(0, MAX_BODY_LENGTH) }))}
                style={[styles.input, styles.textarea]}
              />
              <Text style={styles.counter}>{trimmedBody.length}/{MAX_BODY_LENGTH}</Text>
              <Pressable disabled={loadingSubmit || !canSubmit || !account.isPremium} onPress={submitStory} style={[styles.primaryButton, (loadingSubmit || !canSubmit || !account.isPremium) && styles.disabledButton]}>
                <Text style={styles.primaryText}>{loadingSubmit ? (language === "tr" ? "Gönderiliyor..." : "Sending...") : (language === "tr" ? "Onaya gönder" : "Submit for approval")}</Text>
              </Pressable>

              {submissions.length > 0 ? (
                <View style={styles.submissionBox}>
                  <Text style={styles.sectionTitle}>{language === "tr" ? "Gönderdiğin yazılar" : language === "ru" ? "Ваши отправки" : language === "uz" ? "Yuborilgan yozuvlar" : "Your submissions"}</Text>
                  {submissions.map((item) => (
                    <View key={item.id} style={styles.submissionRow}>
                      <Text style={styles.submissionTitle}>{item.title?.[language] || item.title?.tr || (language === "tr" ? "Başlıksız yazı" : "Untitled")}</Text>
                      <Text style={styles.submissionStatus}>{storyStatusLabel(item.status, language)}</Text>
                      {item.status === "pending" ? (
                        <Pressable onPress={() => removeSubmission(item.id)}>
                          <Text style={styles.deleteText}>{language === "tr" ? "Sil" : language === "ru" ? "Удалить" : language === "uz" ? "O'chirish" : "Delete"}</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {featuredStory ? (
        <Pressable onPress={() => router.push({ pathname: "/story/[id]", params: { id: featuredStory.id } })} style={styles.featured}>
          <Image source={{ uri: featuredStory.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={["rgba(7,10,18,0.08)", "rgba(7,10,18,0.62)", "rgba(7,10,18,0.96)"]} style={StyleSheet.absoluteFill} />
          <View style={styles.featuredGlow} pointerEvents="none" />
          <Text style={styles.featuredKicker}>{language === "tr" ? "ÖNE ÇIKAN YAZI" : language === "ru" ? "ГЛАВНЫЙ МАТЕРИАЛ" : language === "uz" ? "TANLANGAN MAQOLA" : "FEATURED STORY"}</Text>
          <Text style={styles.featuredTitle} numberOfLines={3}>{featuredStory.title[language]}</Text>
          <View style={styles.featuredMeta}><Ionicons name="time-outline" size={13} color={v2Colors.cyan} /><Text style={styles.featuredMetaText}>{featuredStory.readTime[language]}</Text>{storyAuthorLabel(featuredStory) ? <Text style={styles.featuredMetaText} numberOfLines={1}>· {storyAuthorLabel(featuredStory)}</Text> : null}</View>
        </Pressable>
      ) : null}

      <View style={styles.list}>
        {listStories.map((story) => {
          const authorLabel = storyAuthorLabel(story);
          return (
          <Pressable key={story.id} onPress={() => router.push({ pathname: "/story/[id]", params: { id: story.id } })} style={styles.row}>
            <Image source={{ uri: story.image }} style={styles.thumb} contentFit="cover" />
            <View style={styles.rowBody}>
              <View style={styles.rowTitleLine}>
                <Text style={styles.rowTitle} numberOfLines={2}>{story.title[language]}</Text>
                {readIds.includes(story.id) ? <Ionicons name="checkmark-circle" size={14} color={colors.gold} /> : null}
                {favoriteIds.includes(story.id) ? <Ionicons name="heart" size={13} color={colors.gold} /> : null}
              </View>
              <Text style={styles.rowExcerpt} numberOfLines={2}>{story.excerpt[language]}</Text>
              {authorLabel ? <Text style={styles.rowMeta}>{authorLabel}</Text> : null}
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
        );})}
        {!visibleStories.length ? (
          <View style={styles.emptyState}>
            <Ionicons name="document-text-outline" size={22} color={colors.gold} />
            <Text style={styles.emptyText}>
              {searchQuery.trim()
                ? language === "tr"
                  ? "Aramanızla eşleşen yazı bulunamadı."
                  : language === "ru"
                    ? "Статьи по запросу не найдены."
                    : language === "uz"
                      ? "Qidiruv bo'yicha yozuv topilmadi."
                      : "No writings matched your search."
                : language === "tr"
                  ? "Bu filtrede henüz yazı yok."
                  : language === "ru"
                    ? "В этом фильтре пока нет статей."
                    : language === "uz"
                      ? "Bu filtrda hali yozuv yo'q."
                      : "No writings in this filter yet."}
            </Text>
          </View>
        ) : null}
        {visibleCount < visibleStories.length ? (
          <Pressable onPress={() => setVisibleCount((current) => current + PAGE_SIZE)} style={styles.moreButton}>
            <Text style={styles.moreText}>
              {language === "tr" ? "Daha fazla gör" : language === "ru" ? "Показать еще" : language === "uz" ? "Yana ko'rsatish" : "Show more"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </AppChrome>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    toolbar: {
      borderRadius: radii.lg,
      backgroundColor: "transparent",
      paddingVertical: 8,
      gap: 10,
      marginBottom: 18
    },
    toolbarHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10
    },
    toolbarIntro: { flex: 1, minWidth: 0, gap: 2 },
    toolbarTitle: { color: colors.ivory, fontSize: 14, fontWeight: "900" },
    toolbarHint: { color: colors.muted, fontSize: 11, fontWeight: "800" },
    toolbarActions: { flexDirection: "row", alignItems: "center", gap: 6 },
    iconButton: {
      width: 36,
      height: 36,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panelSoft,
      alignItems: "center",
      justifyContent: "center"
    },
    iconButtonActive: { backgroundColor: colors.gold, borderColor: colors.gold },
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panelSoft,
      paddingHorizontal: 10,
      minHeight: 40
    },
    searchInput: { flex: 1, color: colors.ivory, fontSize: 13, fontWeight: "800", paddingVertical: 8 },
    addButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      minHeight: 36,
      borderRadius: 8,
      backgroundColor: colors.gold,
      paddingHorizontal: 12,
      paddingVertical: 8
    },
    addButtonLocked: {
      backgroundColor: colors.panelSoft,
      borderWidth: 1,
      borderColor: colors.line
    },
    addButtonText: { color: colors.ink, fontSize: 12, fontWeight: "900" },
    addButtonTextLocked: { color: colors.ivory },
    filterRow: { flexDirection: "row", alignItems: "stretch", flexWrap: "wrap", gap: 6 },
    filterChip: {
      flexGrow: 1,
      minWidth: "22%",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      minHeight: 40,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panelSoft,
      paddingHorizontal: 8,
      paddingVertical: 6
    },
    filterChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
    filterChipText: { color: colors.ivory, fontSize: 10, fontWeight: "900", textAlign: "center", flexShrink: 1 },
    filterChipTextActive: { color: colors.ink },
    readFilterRow: { flexDirection: "row", gap: 6 },
    readFilterChip: {
      flex: 1,
      minHeight: 32,
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.gold,
      backgroundColor: colors.panelSoft,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingHorizontal: 8
    },
    readFilterChipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
    readFilterChipText: { color: colors.gold, fontSize: 11, fontWeight: "900" },
    readFilterChipTextActive: { color: colors.ink },
    premiumHint: { color: colors.muted, fontSize: 11, fontWeight: "800", lineHeight: 16 },
    submissionBox: { gap: 8, marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: colors.line },
    sectionTitle: { color: colors.ivory, fontWeight: "900" },
    submissionRow: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: 10, gap: 3 },
    submissionTitle: { color: colors.ivory, fontWeight: "900" },
    submissionStatus: { color: colors.muted, fontSize: 12, fontWeight: "800" },
    deleteText: { color: colors.gold, fontWeight: "900" },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "center", padding: 16 },
    modalPanel: {
      maxHeight: "88%",
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      padding: 14,
      gap: 10
    },
    modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
    modalTitle: { color: colors.ivory, fontSize: 18, fontWeight: "900", flex: 1 },
    modalClose: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
    modalHint: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: "700", marginBottom: 8 },
    imagePicker: {
      height: 150,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      gap: 6,
      marginBottom: 10
    },
    imagePickerText: { color: colors.gold, fontWeight: "900" },
    preview: { width: "100%", height: "100%" },
    twoInputs: { flexDirection: "row", gap: 8, marginBottom: 10 },
    input: {
      flex: 1,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panelSoft,
      color: colors.ivory,
      paddingHorizontal: 12,
      paddingVertical: 11,
      fontWeight: "800",
      marginBottom: 10
    },
    textarea: { minHeight: 180, textAlignVertical: "top" },
    counter: { color: colors.muted, fontSize: 12, fontWeight: "800", textAlign: "right", marginBottom: 10 },
    primaryButton: { borderRadius: 8, backgroundColor: colors.gold, alignItems: "center", paddingVertical: 13 },
    disabledButton: { opacity: 0.45 },
    primaryText: { color: "#080808", fontWeight: "900" },
    featured: { minHeight: 218, borderRadius: radii.xl, overflow: "hidden", justifyContent: "flex-end", padding: 18, marginBottom: 22, borderWidth: 1, borderColor: "rgba(139,92,246,0.22)" },
    featuredGlow: { position: "absolute", right: -25, bottom: -38, width: 160, height: 160, borderRadius: 80, backgroundColor: "rgba(124,58,237,0.15)", shadowColor: v2Colors.magenta, shadowOpacity: 0.65, shadowRadius: 28, shadowOffset: { width: 0, height: 0 } },
    featuredKicker: { color: v2Colors.cyan, fontSize: 9.5, lineHeight: 13, fontWeight: "900", letterSpacing: 1.45 },
    featuredTitle: { maxWidth: "88%", color: v2Colors.text, fontSize: 25, lineHeight: 30, fontWeight: "800", letterSpacing: -0.55, marginTop: 5 },
    featuredMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 5, marginTop: 8 },
    featuredMetaText: { maxWidth: "63%", color: v2Colors.textSecondary, fontSize: 10.5, lineHeight: 14, fontWeight: "600" },
    list: { gap: 3 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      minHeight: 92,
      borderRadius: radii.lg,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.line,
      backgroundColor: "rgba(255,255,255,0.018)",
      paddingHorizontal: 8,
      paddingVertical: 11
    },
    thumb: { width: 68, height: 68, borderRadius: radii.md, backgroundColor: colors.panelSoft },
    rowBody: { flex: 1, minWidth: 0, gap: 3 },
    rowTitleLine: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
    rowTitle: { color: colors.ivory, fontSize: 15, fontWeight: "900", lineHeight: 19, flex: 1 },
    rowExcerpt: { color: colors.muted, fontSize: 11, lineHeight: 15, fontWeight: "700" },
    rowMeta: { color: colors.gold, fontSize: 10, fontWeight: "900", marginTop: 2 },
    emptyState: {
      borderRadius: radii.lg,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      alignItems: "center",
      gap: 8,
      padding: 18
    },
    emptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: "800", textAlign: "center" },
    moreButton: {
      borderRadius: radii.pill,
      borderWidth: 1,
      borderColor: colors.gold,
      backgroundColor: colors.panelSoft,
      alignItems: "center",
      paddingVertical: 12,
      marginTop: 4
    },
    moreText: { color: v2Colors.text, fontSize: 12, fontWeight: "900" }
  });
}
