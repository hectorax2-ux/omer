import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { getThemeColors } from "@/constants/theme";
import { copy, languages } from "@/data/content";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useCommunityArt } from "@/hooks/use-community-art";
import { useLanguage } from "@/hooks/use-language";
import { useAccount } from "@/hooks/use-account";
import { AuthRequired, EmailVerificationRequired } from "@/components/auth-required";
import { Language } from "@/types/content";
import { uploadFormatHint, validatePickedImageAsset } from "@/utils/image-upload-validation";
import { buildLimitStatusText, buildRateLimitMessage } from "@/utils/safety";
import { communityImagePath, uploadImage } from "@/src/services/firebase/storage-service";
import { ImagePreviewModal } from "@/components/image-preview-modal";

const uploadText = {
  notice: {
    tr: "Çizdiğiniz ve beğenileceğinden emin olduğunuz resminizi yükleyin. Resim yayınlandığında seçtiğiniz dil alanında görünecektir.",
    en: "Upload an image you created and believe people will appreciate. It will appear in the selected language area once published.",
    ru: "Загрузите рисунок, который вы создали и считаете достойным внимания. После публикации он появится в выбранном языковом разделе.",
    uz: "O'zingiz chizgan va yoqishiga ishongan rasmingizni yuklang. E'lon qilingach u tanlangan til bo'limida ko'rinadi."
  },
  imageName: { tr: "Resmin adı", en: "Image title", ru: "Название рисунка", uz: "Rasm nomi" },
  age: { tr: "Yaş", en: "Age", ru: "Возраст", uz: "Yosh" },
  language: { tr: "Dil / ülke", en: "Language / country", ru: "Язык / страна", uz: "Til / mamlakat" },
  name: { tr: "Ad", en: "Name", ru: "Имя", uz: "Ism" },
  surname: { tr: "Soyad", en: "Surname", ru: "Фамилия", uz: "Familiya" },
  story: { tr: "Resmin hikayesi", en: "Image story", ru: "История рисунка", uz: "Rasm hikoyasi" },
  chooseImage: { tr: "Galeriden resim seç", en: "Choose image from gallery", ru: "Выбрать рисунок из галереи", uz: "Galereyadan rasm tanlash" },
  changeImage: { tr: "Görseli değiştir", en: "Change image", ru: "Сменить изображение", uz: "Rasmni almashtirish" },
  submit: { tr: "Paylaş", en: "Share", ru: "Поделиться", uz: "Ulashish" },
  delete: { tr: "Resmi sil", en: "Delete image", ru: "Удалить изображение", uz: "Rasmni o'chirish" },
  deleted: { tr: "Silindi", en: "Deleted", ru: "Удалено", uz: "O'chirildi" }
};

const deleteConfirmText = {
  title: { tr: "Resim silinsin mi?", en: "Delete image?", ru: "Удалить изображение?", uz: "Rasm o'chirilsinmi?" },
  message: {
    tr: "Bu resmi silmek istediğinize emin misiniz? Silinen resim kullanıcı alanınızda görünmez.",
    en: "Are you sure you want to delete this image? Deleted images will no longer appear in your submissions.",
    ru: "Вы уверены, что хотите удалить это изображение? Удаленное изображение больше не будет видно в ваших отправках.",
    uz: "Bu rasmni o'chirishni xohlaysizmi? O'chirilgan rasm yuborilganlar ro'yxatida ko'rinmaydi."
  },
  cancel: { tr: "Vazgeç", en: "Cancel", ru: "Отмена", uz: "Bekor qilish" },
  confirm: { tr: "Sil", en: "Delete", ru: "Удалить", uz: "O'chirish" }
};

const validationText = {
  tr: "Lütfen görsel seçin; ad, resim adı, yaş ve hikaye alanlarını doğru doldurun. Yaş yalnızca sayı olmalı.",
  en: "Choose an image and fill name, image title, age, and story correctly. Age must be numeric.",
  ru: "Выберите изображение и корректно заполните имя, название, возраст и историю. Возраст должен быть числом.",
  uz: "Rasm tanlang; ism, rasm nomi, yosh va hikoya maydonlarini to'g'ri to'ldiring. Yosh faqat raqam bo'lishi kerak."
};

export default function UploadArtworkScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { account, isAuthenticated, canUseMemberFeatures } = useAccount();
  const { width } = useWindowDimensions();
  const router = useRouter();
  const { items, deleteSubmittedArtwork, getArtworkLimitStatus, getWeeklyArtworkQuota, submitArtwork } = useCommunityArt();
  const [image, setImage] = useState<string | null>(null);
  const [artworkLanguage, setArtworkLanguage] = useState<Language>(language);
  const [title, setTitle] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [story, setStory] = useState("");
  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [, setClockTick] = useState(0);
  const imageHeight = Math.min(240, Math.max(178, width * 0.56));
  const artworkLimitStatus = getArtworkLimitStatus(account.username);
  const weeklyQuota = getWeeklyArtworkQuota(account.username);
  const submittedCompetitionItems = items.filter((item) => {
    const belongsToCurrentUser = item.ownerId === account.uid || item.uploaderUsername === account.username;
    return !item.deleted && belongsToCurrentUser && (item.source ?? "competition") === "competition";
  });

  useEffect(() => {
    const timer = setInterval(() => setClockTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  if (!isAuthenticated) {
    return <AuthRequired title={copy.uploadArtwork[language]} />;
  }

  if (!canUseMemberFeatures) {
    return <EmailVerificationRequired title={copy.uploadArtwork[language]} />;
  }

  async function pickImage() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      const validation = validatePickedImageAsset(asset, language);
      if (!validation.ok) {
        setError(validation.message);
        return;
      }
      setImage(asset.uri);
      setError("");
    }
  }

  function deleteSubmission(id: string) {
    const result = deleteSubmittedArtwork(id);
    if (!result.ok) {
      setError(language === "tr" ? "Bu resim silinemedi." : language === "ru" ? "Не удалось удалить изображение." : language === "uz" ? "Rasmni o'chirib bo'lmadi." : "This image could not be deleted.");
      return;
    }
    setError("");
  }

  function confirmDeleteSubmission(id: string) {
    Alert.alert(deleteConfirmText.title[language], deleteConfirmText.message[language], [
      { text: deleteConfirmText.cancel[language], style: "cancel" },
      { text: deleteConfirmText.confirm[language], style: "destructive", onPress: () => deleteSubmission(id) }
    ]);
  }

  async function uploadCompetitionImage(localUri: string) {
    if (/^https?:\/\//i.test(localUri)) return localUri;
    if (!account.uid) {
      throw new Error(language === "tr" ? "Görsel yüklemek için tekrar giriş yapın." : "Please sign in again to upload the image.");
    }

    const optimized = await ImageManipulator.manipulateAsync(
      localUri,
      [{ resize: { width: 1600 } }],
      { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG }
    );
    const response = await fetch(optimized.uri);
    const blob = await response.blob();
    if (blob.size > 4 * 1024 * 1024) {
      throw new Error(language === "tr" ? "Görsel 4 MB üstünde kaldı. Daha küçük bir görsel seçin." : "The image is still larger than 4 MB. Choose a smaller image.");
    }
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    return uploadImage(communityImagePath(account.uid, fileName), blob, {
      mimeType: "image/jpeg",
      sizeBytes: blob.size,
      width: optimized.width,
      height: optimized.height
    });
  }

  async function submit() {
    const normalizedAge = Number(age.trim());
    if (!image || !firstName.trim() || !title.trim() || !story.trim() || !Number.isInteger(normalizedAge) || normalizedAge < 1 || normalizedAge > 120) {
      setError(validationText[language]);
      return;
    }

    setUploading(true);
    let uploadedImage = image;
    try {
      uploadedImage = await uploadCompetitionImage(image);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : (language === "tr" ? "Görsel yüklenemedi. Lütfen tekrar deneyin." : "The image could not be uploaded. Please try again."));
      setUploading(false);
      return;
    }

    const result = submitArtwork({
      language: artworkLanguage,
      image: uploadedImage,
      artistName: `${firstName.trim()} ${lastName.trim()}`.trim(),
      title: title.trim(),
      story: story.trim(),
      age: String(normalizedAge),
      uploaderUsername: account.username
    }, language);
    if (!result.ok) {
      setError(result.reason === "rate_limit" ? buildRateLimitMessage(result.status, language) : result.message ?? "");
      setUploading(false);
      return;
    }

    setError("");
    setUploading(false);
    router.back();
  }

  return (
    <AppChrome title={copy.uploadArtwork[language]} eyebrow={copy.communityArt[language]} keyboardAvoiding>
      <ImagePreviewModal image={previewImage} onClose={() => setPreviewImage(null)} />
      <Modal visible={rulesOpen} transparent animationType="fade" onRequestClose={() => setRulesOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.rulesPanel}>
            <Pressable onPress={() => setRulesOpen(false)} style={styles.rulesCloseButton}>
              <Ionicons name="close" size={21} color={colors.ivory} />
            </Pressable>
            <Ionicons name="document-text-outline" size={30} color={colors.gold} />
            <Text style={styles.rulesTitle}>{language === "tr" ? "Resim Yarışması Kuralları" : language === "ru" ? "Правила конкурса рисунков" : language === "uz" ? "Rasm tanlovi qoidalari" : "Painting Contest Rules"}</Text>
            <Text style={styles.rulesText}>
              {language === "tr"
                ? `Her kullanıcı haftada en fazla iki görsel gönderebilir. Onayda bekleyen ve yayınlanan görseller hak kullanır; reddedilen veya silinen işler hak iade eder. ${uploadFormatHint.tr} Liste 15 dakikada bir yeniden hesaplanır. Normal kullanıcılar reklam izleyerek 30 dakikada bir yukarı taşıma hakkı kazanabilir. Premium kullanıcıların görseli 4 saatte bir otomatik öne taşınabilir ve reklam gösterilmez. Sıralama net puan, aktiflik ve keşif dengesiyle hesaplanır. Telif ve içerik sorumluluğu yükleyiciye aittir.`
                : language === "ru"
                  ? `Каждый пользователь может отправить до двух изображений в неделю. Ожидающие и опубликованные работы используют лимит; отклоненные или удаленные возвращают право. ${uploadFormatHint.ru} Список обновляется каждые 15 минут. Обычный пользователь может получить право поднять работу раз в 30 минут за рекламу. Premium-работы могут автоматически подниматься каждые 4 часа, реклама не показывается.`
                  : language === "uz"
                    ? `Har foydalanuvchi haftasiga ikki rasm yuborishi mumkin. Tekshiruvdagi va chop etilgan rasmlar limitdan foydalanadi; rad etilgan yoki o'chirilgan ishlar huquqni qaytaradi. ${uploadFormatHint.uz} Ro'yxat har 15 daqiqada yangilanadi. Oddiy foydalanuvchilar reklama orqali 30 daqiqada bir oldinga chiqarish huquqi oladi. Premium rasmlar har 4 soatda avtomatik oldinga chiqishi mumkin.`
                    : `Each user can submit up to two visuals per week. Pending and published submissions use the quota; rejected or deleted works return the right. ${uploadFormatHint.en} The list recalculates every 15 minutes. Regular members can earn one boost credit every 30 minutes by watching an ad. Premium works can be auto-boosted every 4 hours and do not see ads.`}
            </Text>
          </View>
        </View>
      </Modal>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Ionicons name="arrow-back" size={18} color={colors.gold} />
        <Text style={styles.backText}>{copy.communityArt[language]}</Text>
      </Pressable>

      <View style={styles.notice}>
        <Ionicons name="information-circle" size={24} color={colors.gold} />
        <Text style={styles.noticeText}>
          {uploadText.notice[language]}{"\n"}
          {uploadFormatHint[language]}{"\n"}
          {language === "tr"
            ? `Haftalık gönderim hakkı: ${weeklyQuota.remaining}/${weeklyQuota.limit}. Onayda: ${weeklyQuota.pending}, yayınlanan: ${weeklyQuota.approved}.`
            : language === "ru"
              ? `Осталось отправок на неделю: ${weeklyQuota.remaining}/${weeklyQuota.limit}. На проверке: ${weeklyQuota.pending}, опубликовано: ${weeklyQuota.approved}.`
              : language === "uz"
                ? `Haftalik yuborish huquqi: ${weeklyQuota.remaining}/${weeklyQuota.limit}. Tekshiruvda: ${weeklyQuota.pending}, chop etilgan: ${weeklyQuota.approved}.`
                : `Weekly submission quota: ${weeklyQuota.remaining}/${weeklyQuota.limit}. Pending: ${weeklyQuota.pending}, published: ${weeklyQuota.approved}.`}
        </Text>
      </View>

      <Pressable onPress={() => setRulesOpen(true)} style={styles.rulesButton}>
        <Ionicons name="document-text-outline" size={17} color={colors.gold} />
        <Text style={styles.rulesButtonText}>{language === "tr" ? "Kuralları oku" : language === "ru" ? "Читать правила" : language === "uz" ? "Qoidalarni o'qish" : "Read rules"}</Text>
      </Pressable>

      {error ? <Text style={styles.topErrorText}>{error}</Text> : null}
      {uploading ? (
        <View style={styles.uploadStatus}>
          <Ionicons name="cloud-upload-outline" size={17} color={colors.gold} />
          <Text style={styles.uploadStatusText}>
            {language === "tr" ? "Görsel sunucuya yükleniyor, lütfen bekleyin." : language === "ru" ? "Изображение загружается на сервер, подождите." : language === "uz" ? "Rasm serverga yuklanmoqda, iltimos kuting." : "Uploading the image to the server, please wait."}
          </Text>
        </View>
      ) : null}

      {submittedCompetitionItems.length ? (
        <View style={styles.submittedPanel}>
          <Text style={styles.submittedTitle}>{language === "tr" ? "Gönderdiğin resimler" : language === "ru" ? "Ваши отправленные работы" : language === "uz" ? "Yuborgan rasmlaringiz" : "Your submissions"}</Text>
          <View style={styles.submittedGrid}>
            {submittedCompetitionItems.slice(0, 2).map((item) => (
              <View key={item.id} style={styles.submittedCard}>
                <Pressable onPress={() => setPreviewImage(item.image)} accessibilityRole="button" accessibilityLabel={item.title}>
                  <Image source={{ uri: item.image }} style={styles.submittedImage} contentFit="cover" />
                </Pressable>
                <View style={styles.submittedInfo}>
                  <Text style={styles.submittedName} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.submittedStatus} numberOfLines={1}>
                    {item.deleted
                      ? uploadText.deleted[language]
                      : item.approved
                      ? language === "tr" ? "Yayında" : language === "ru" ? "Опубликовано" : language === "uz" ? "Chop etilgan" : "Published"
                      : language === "tr" ? "Onayda" : language === "ru" ? "На проверке" : language === "uz" ? "Tekshiruvda" : "Pending"}
                  </Text>
                  {!item.deleted ? (
                    <Pressable onPress={() => confirmDeleteSubmission(item.id)} style={styles.deleteSubmissionButton}>
                      <Ionicons name="trash-outline" size={13} color={colors.ivory} />
                      <Text style={styles.deleteSubmissionText}>{uploadText.delete[language]}</Text>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      <View style={styles.fieldBlock}>
        <Text style={styles.label}>{uploadText.language[language]}</Text>
        <View style={styles.languageRow}>
          {languages.map((item) => (
            <Pressable
              key={item.code}
              onPress={() => setArtworkLanguage(item.code)}
              style={[styles.languageChip, artworkLanguage === item.code && styles.languageChipActive]}
            >
              <Text style={[styles.languageChipText, artworkLanguage === item.code && styles.languageChipTextActive]}>
                {item.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable onPress={pickImage} style={[styles.imagePicker, { height: imageHeight }]}>
        {image ? (
          <>
            <Image source={{ uri: image }} style={styles.preview} contentFit="cover" />
            <View style={styles.imageOverlay}>
              <Ionicons name="images" size={18} color={colors.ink} />
              <Text style={styles.imageOverlayText}>{uploadText.changeImage[language]}</Text>
            </View>
          </>
        ) : (
          <View style={styles.emptyPicker}>
            <Ionicons name="add-circle" size={48} color={colors.gold} />
            <Text style={styles.emptyPickerText}>{uploadText.chooseImage[language]}</Text>
          </View>
        )}
      </Pressable>

      <View style={[styles.rowInputs, { flexDirection: width < 380 ? "column" : "row" }]}>
        <TextInput value={title} onChangeText={setTitle} placeholder={uploadText.imageName[language]} placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={age} onChangeText={setAge} placeholder={uploadText.age[language]} placeholderTextColor={colors.muted} style={styles.input} keyboardType="number-pad" maxLength={3} />
      </View>
      <View style={[styles.rowInputs, { flexDirection: width < 380 ? "column" : "row" }]}>
        <TextInput value={firstName} onChangeText={setFirstName} placeholder={uploadText.name[language]} placeholderTextColor={colors.muted} style={styles.input} />
        <TextInput value={lastName} onChangeText={setLastName} placeholder={uploadText.surname[language]} placeholderTextColor={colors.muted} style={styles.input} />
      </View>
      <TextInput
        value={story}
        onChangeText={setStory}
        placeholder={uploadText.story[language]}
        placeholderTextColor={colors.muted}
        style={[styles.input, styles.storyInput]}
        multiline
      />
      <Pressable disabled={uploading} onPress={submit} style={[styles.submitButton, uploading && { opacity: 0.55 }]}>
        <Text style={styles.submitText}>{uploading ? (language === "tr" ? "Görsel yükleniyor..." : language === "ru" ? "Изображение загружается..." : language === "uz" ? "Rasm yuklanmoqda..." : "Uploading image...") : uploadText.submit[language]}</Text>
      </Pressable>
      {artworkLimitStatus.showWarning ? <Text style={styles.limitText}>{buildLimitStatusText(artworkLimitStatus, language)}</Text> : null}
    </AppChrome>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
return StyleSheet.create({
  backButton: {
    alignSelf: "flex-start",
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 12
  },
  backText: {
    color: colors.ivory,
    fontWeight: "900"
  },
  notice: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(217, 184, 101, 0.3)",
    backgroundColor: colors.panel,
    padding: 14,
    flexDirection: "row",
    gap: 10,
    marginBottom: 14
  },
  noticeText: {
    flex: 1,
    color: colors.ivory,
    lineHeight: 22,
    fontWeight: "700"
  },
  rulesButton: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(217, 184, 101, 0.24)",
    backgroundColor: colors.panelSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 14
  },
  rulesButtonText: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "900"
  },
  submittedPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(217, 184, 101, 0.24)",
    backgroundColor: colors.panel,
    padding: 10,
    gap: 9,
    marginBottom: 14
  },
  submittedTitle: {
    color: colors.ivory,
    fontSize: 13,
    fontWeight: "900"
  },
  submittedGrid: {
    flexDirection: "row",
    gap: 8
  },
  submittedCard: {
    flex: 1,
    minWidth: 0,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.panelSoft,
    borderWidth: 1,
    borderColor: colors.line
  },
  submittedImage: {
    width: "100%",
    aspectRatio: 1.18
  },
  submittedInfo: {
    padding: 7
  },
  submittedName: {
    color: colors.ivory,
    fontSize: 11,
    fontWeight: "900"
  },
  submittedStatus: {
    color: colors.gold,
    fontSize: 10,
    fontWeight: "800",
    marginTop: 2
  },
  deleteSubmissionButton: {
    alignSelf: "flex-start",
    minHeight: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(160, 75, 73, 0.45)",
    backgroundColor: "rgba(160, 75, 73, 0.18)",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 8,
    marginTop: 7
  },
  deleteSubmissionText: {
    color: colors.ivory,
    fontSize: 10,
    fontWeight: "900"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 18
  },
  rulesPanel: {
    width: "100%",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(217, 184, 101, 0.34)",
    backgroundColor: colors.panel,
    padding: 18,
    gap: 10
  },
  rulesCloseButton: {
    position: "absolute",
    right: 12,
    top: 12,
    zIndex: 2,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panelSoft
  },
  rulesTitle: {
    color: colors.ivory,
    fontSize: 21,
    fontWeight: "900",
    paddingRight: 34
  },
  rulesText: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "700"
  },
  fieldBlock: {
    gap: 8,
    marginBottom: 12
  },
  label: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  languageRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  languageChip: {
    minHeight: 36,
    minWidth: 58,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  languageChipActive: {
    borderColor: colors.gold,
    backgroundColor: colors.gold
  },
  languageChipText: {
    color: colors.ivory,
    fontWeight: "900"
  },
  languageChipTextActive: {
    color: colors.ink
  },
  imagePicker: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel
  },
  emptyPicker: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10
  },
  emptyPickerText: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: "900",
    textAlign: "center"
  },
  preview: {
    ...StyleSheet.absoluteFillObject
  },
  imageOverlay: {
    position: "absolute",
    right: 12,
    bottom: 12,
    minHeight: 38,
    borderRadius: 8,
    backgroundColor: colors.gold,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10
  },
  imageOverlayText: {
    color: colors.ink,
    fontWeight: "900"
  },
  rowInputs: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14
  },
  input: {
    flex: 1,
    minHeight: 48,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    color: colors.ivory,
    paddingHorizontal: 12,
    fontWeight: "700"
  },
  storyInput: {
    minHeight: 110,
    paddingTop: 12,
    textAlignVertical: "top",
    marginTop: 10
  },
  submitButton: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14
  },
  submitText: {
    color: colors.ink,
    fontWeight: "900",
    fontSize: 16
  },
  errorText: {
    color: "#f3b0a6",
    fontSize: 13,
    fontWeight: "800",
    lineHeight: 18,
    marginTop: 10,
    textAlign: "center"
  },
  topErrorText: {
    color: "#f3b0a6",
    fontSize: 13,
    fontWeight: "900",
    lineHeight: 18,
    textAlign: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(243, 176, 166, 0.35)",
    backgroundColor: "rgba(120, 42, 42, 0.18)",
    padding: 9,
    marginBottom: 12
  },
  uploadStatus: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(217, 184, 101, 0.28)",
    backgroundColor: colors.panelSoft,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 10,
    marginBottom: 12
  },
  uploadStatusText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900",
    flexShrink: 1,
    textAlign: "center"
  },
  limitText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "900",
    lineHeight: 17,
    marginTop: 10,
    textAlign: "center"
  }
});
}
