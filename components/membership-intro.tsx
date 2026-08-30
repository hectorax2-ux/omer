import { memo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLanguage } from "@/hooks/use-language";

export const membershipCopy = {
  title: { tr: "Sanat yolculuğun burada devam ediyor", en: "Your art journey continues here", ru: "Ваше путешествие в мир искусства продолжается", uz: "San’at sayohatingiz shu yerda davom etadi" },
  subtitle: { tr: "Eserleri kaydet, koleksiyonunu oluştur, sanatla bağ kur.", en: "Save artworks, curate your collection, connect through art.", ru: "Сохраняйте работы, собирайте коллекцию и общайтесь об искусстве.", uz: "Asarlarni saqlang, kolleksiya yarating, san’at orqali bog‘laning." },
  gate: { tr: "Sanata bir adım daha yaklaş", en: "Step closer to art", ru: "Станьте ближе к искусству", uz: "San’atga bir qadam yaqinlashing" },
  gateHint: { tr: "Bu alan kişisel sanat yolculuğunun bir parçası. Devam etmek için giriş yap veya ücretsiz hesap oluştur.", en: "This space is part of your personal art journey. Sign in or create a free account to continue.", ru: "Этот раздел — часть вашего личного путешествия. Войдите или создайте бесплатный аккаунт.", uz: "Bu bo‘lim shaxsiy san’at sayohatingizning bir qismi. Davom etish uchun kiring yoki bepul hisob yarating." },
  guest: { tr: "Misafir olarak keşfetmeye devam et", en: "Continue exploring as a guest", ru: "Продолжить знакомство как гость", uz: "Mehmon sifatida kashf etishda davom etish" },
  support: { tr: "Yardıma mı ihtiyacın var?", en: "Need a hand?", ru: "Нужна помощь?", uz: "Yordam kerakmi?" },
  processing: { tr: "İşleniyor…", en: "Working…", ru: "Обработка…", uz: "Bajarilmoqda…" },
  verifyHint: { tr: "Gelen kutundaki doğrulama bağlantısını aç, ardından buradan kontrol et.", en: "Open the verification link in your inbox, then check here.", ru: "Откройте ссылку в письме, затем проверьте подтверждение здесь.", uz: "Pochtadagi tasdiqlash havolasini oching, so‘ng bu yerda tekshiring." },
  checkFields: { tr: "Alanları kontrol et. Geçerli e-posta ve en az 6 karakterli şifre kullan.", en: "Check the fields. Use a valid email and a password of at least 6 characters.", ru: "Проверьте поля. Укажите e-mail и пароль не короче 6 символов.", uz: "Maydonlarni tekshiring. To‘g‘ri e-pochta va kamida 6 belgili parol kiriting." },
  username: { tr: "Kullanıcı adının uzunluğunu ve izin verilen karakterlerini kontrol et.", en: "Check your username length and allowed characters.", ru: "Проверьте длину и допустимые символы имени пользователя.", uz: "Foydalanuvchi nomi uzunligi va belgilarini tekshiring." },
  showPassword: { tr: "Şifreyi göster", en: "Show password", ru: "Показать пароль", uz: "Parolni ko‘rsatish" },
  hidePassword: { tr: "Şifreyi gizle", en: "Hide password", ru: "Скрыть пароль", uz: "Parolni yashirish" }
};

/** Shared entrance artwork; decoration never gates the form or makes a query. */
export const MembershipIntro = memo(function MembershipIntro({ gated = false }: { gated?: boolean }) {
  const { language } = useLanguage();
  const [imageFailed, setImageFailed] = useState(false);
  return <View style={styles.surface}>
    {!imageFailed ? <Image source={require("@/assets/images/art-detective-cover-mobile.jpg")} style={StyleSheet.absoluteFill}
      contentFit="cover" contentPosition="center" cachePolicy="memory-disk" allowDownscaling transition={0}
      accessible={false} onError={() => setImageFailed(true)} /> : null}
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.scrim]} />
    <View style={styles.eyebrow}><Ionicons name="library-outline" size={17} color="#E6C985" /><Text style={styles.label}>ART ATLAS</Text></View>
    <Text accessibilityRole="header" style={styles.title}>{(gated ? membershipCopy.gate : membershipCopy.title)[language]}</Text>
    <Text style={styles.subtitle}>{(gated ? membershipCopy.gateHint : membershipCopy.subtitle)[language]}</Text>
  </View>;
});

const styles = StyleSheet.create({
  surface: { borderRadius: 20, overflow: "hidden", backgroundColor: "#11182A", borderColor: "rgba(217,184,101,0.22)", borderWidth: 1, padding: 20, gap: 10, marginBottom: 18 },
  scrim: { backgroundColor: "rgba(8,14,28,0.78)" },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 8 },
  label: { color: "#E6C985", fontSize: 10, fontWeight: "600", letterSpacing: 2.3 },
  title: { color: "#FFF9EE", fontSize: 24, lineHeight: 31, fontWeight: "700", flexShrink: 1 },
  subtitle: { color: "#DBDCE3", fontSize: 13, lineHeight: 20, flexShrink: 1 }
});
