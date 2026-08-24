import { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { copy } from "@/data/content";
import { getThemeColors } from "@/constants/theme";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { SupportCategory, SupportTicket } from "@/providers/support-provider";
import { useSupport } from "@/hooks/use-support";
import { fieldLimits } from "@/types/art-systems";
import { throttleAction, withinBurstLimit } from "@/utils/safety";

const supportCopy = {
  title: { tr: "Destek", en: "Support", ru: "Поддержка", uz: "Yordam" },
  intro: {
    tr: "Kategori seç, kısaca yaz, gönder.",
    en: "Pick a category, write briefly, and send.",
    ru: "Выберите категорию, кратко опишите и отправьте.",
    uz: "Kategoriya tanlang, qisqacha yozing va yuboring."
  },
  category: { tr: "Kategori", en: "Category", ru: "Категория", uz: "Kategoriya" },
  topicType: { tr: "Konu", en: "Topic", ru: "Тема", uz: "Mavzu" },
  contact: { tr: "İletişim", en: "Contact", ru: "Контакт", uz: "Aloqa" },
  subject: { tr: "Başlık", en: "Title", ru: "Заголовок", uz: "Sarlavha" },
  detail: { tr: "Talep detayı", en: "Request details", ru: "Детали обращения", uz: "So'rov tafsiloti" },
  firstName: { tr: "Ad", en: "First name", ru: "Имя", uz: "Ism" },
  lastName: { tr: "Soyad", en: "Last name", ru: "Фамилия", uz: "Familiya" },
  email: { tr: "E-posta", en: "Email", ru: "E-mail", uz: "Email" },
  send: { tr: "Gönder", en: "Send", ru: "Отправить", uz: "Yuborish" },
  pickTopic: {
    tr: "Devam etmek için kategori ve konu seç.",
    en: "Select a category and topic to continue.",
    ru: "Выберите категорию и тему, чтобы продолжить.",
    uz: "Davom etish uchun kategoriya va mavzuni tanlang."
  },
  mine: { tr: "Açık taleplerim", en: "My open requests", ru: "Мои открытые обращения", uz: "Ochiq so'rovlarim" },
  resolved: { tr: "Sonuçlanan taleplerim", en: "My resolved requests", ru: "Завершённые обращения", uz: "Yakunlangan so'rovlar" },
  admin: { tr: "Tüm açık talepler", en: "All open requests", ru: "Все открытые обращения", uz: "Barcha ochiq so'rovlar" },
  adminResolved: { tr: "Sonuçlanan talepler", en: "Resolved requests", ru: "Завершённые обращения", uz: "Yakunlangan so'rovlar" },
  reply: { tr: "Yanıt yaz", en: "Write reply", ru: "Ответить", uz: "Javob yozish" },
  close: { tr: "Kapat", en: "Close", ru: "Закрыть", uz: "Yopish" },
  closed: { tr: "Kapandı", en: "Closed", ru: "Закрыто", uz: "Yopilgan" },
  open: { tr: "Açık", en: "Open", ru: "Открыто", uz: "Ochiq" },
  errorMissing: {
    tr: "Kategori, konu ve tüm alanları doldur. Detay en az 10 karakter olmalı.",
    en: "Fill in category, topic, and all fields. Details must be at least 10 characters.",
    ru: "Заполните категорию, тему и все поля. Детали — минимум 10 символов.",
    uz: "Kategoriya, mavzu va barcha maydonlarni to'ldiring. Tafsilot kamida 10 belgi bo'lishi kerak."
  }
};

const supportCategories: {
  id: SupportCategory;
  icon: keyof typeof Ionicons.glyphMap;
  title: Record<"tr" | "en" | "ru" | "uz", string>;
  options: Record<"tr" | "en" | "ru" | "uz", string[]>;
}[] = [
  {
    id: "account",
    icon: "person-circle-outline",
    title: { tr: "Hesap", en: "Account", ru: "Аккаунт", uz: "Hisob" },
    options: {
      tr: ["Giriş sorunu", "Profil bilgileri", "Şifre / e-posta", "Hesap güvenliği", "Rol / rozet"],
      en: ["Login issue", "Profile details", "Password / email", "Account security", "Role / badge"],
      ru: ["Вход", "Профиль", "Пароль / почта", "Безопасность", "Роль / значок"],
      uz: ["Kirish", "Profil", "Parol / email", "Xavfsizlik", "Rol / nishon"]
    }
  },
  {
    id: "artwork",
    icon: "image-outline",
    title: { tr: "Eser", en: "Artwork", ru: "Произведение", uz: "Asar" },
    options: {
      tr: ["İçerik inceleme", "Bilgi hatası", "Görsel sorunu", "Kaynak / müze"],
      en: ["Content review", "Information issue", "Image issue", "Source / museum"],
      ru: ["Контент", "Ошибка данных", "Изображение", "Источник / музей"],
      uz: ["Kontent", "Ma'lumot xatosi", "Rasm", "Manba / muzey"]
    }
  },
  {
    id: "app",
    icon: "phone-portrait-outline",
    title: { tr: "Uygulama", en: "App", ru: "Приложение", uz: "Ilova" },
    options: {
      tr: ["Hata", "Performans", "Dil / çeviri", "Öneri"],
      en: ["Bug", "Performance", "Language", "Suggestion"],
      ru: ["Ошибка", "Скорость", "Язык", "Идея"],
      uz: ["Xato", "Tezlik", "Til", "Taklif"]
    }
  },
  {
    id: "user",
    icon: "flag-outline",
    title: { tr: "Kullanıcı", en: "User", ru: "Пользователь", uz: "Foydalanuvchi" },
    options: {
      tr: ["Profil bildirimi", "Uygunsuz davranış", "Yanlış bilgi", "Topluluk kuralı"],
      en: ["Report profile", "Inappropriate behavior", "False info", "Community rule"],
      ru: ["Жалоба", "Поведение", "Ложные данные", "Правила"],
      uz: ["Shikoyat", "Xatti-harakat", "Noto'g'ri ma'lumot", "Qoidalar"]
    }
  },
  {
    id: "copyright",
    icon: "document-lock-outline",
    title: { tr: "Telif", en: "Copyright", ru: "Авторские права", uz: "Mualliflik" },
    options: {
      tr: ["Telif bildirimi", "İzin talebi", "Kaldırma", "Kaynak düzeltme"],
      en: ["Copyright notice", "Permission", "Removal", "Source fix"],
      ru: ["Уведомление", "Разрешение", "Удаление", "Исправление"],
      uz: ["Bildirish", "Ruxsat", "O'chirish", "Tuzatish"]
    }
  }
];

type SupportLang = "tr" | "en" | "ru" | "uz";

type TopicExample = {
  subjectHint: Record<SupportLang, string>;
  subjectPlaceholder: Record<SupportLang, string>;
  detailHint: Record<SupportLang, string>;
  detailPlaceholder: Record<SupportLang, string>;
};

const supportTopicExamples: Record<string, TopicExample> = {
  "account:0": {
    subjectHint: { tr: "Girişte ne oluyor?", en: "What happens when you sign in?", ru: "Что происходит при входе?", uz: "Kirishda nima bo'lmoqda?" },
    subjectPlaceholder: { tr: "Giriş yapamıyorum", en: "I can't sign in", ru: "Не могу войти", uz: "Kira olmayapman" },
    detailHint: { tr: "Hangi adımda takıldığını yaz", en: "Describe where you get stuck", ru: "На каком шаге проблема", uz: "Qaysi bosqichda to'xtaysiz" },
    detailPlaceholder: { tr: "E-posta ve şifreyle giriş yapınca şu hatayı alıyorum…", en: "When I sign in with email and password I see…", ru: "При входе по почте и паролю вижу…", uz: "Email va parol bilan kirganda…" }
  },
  "account:1": {
    subjectHint: { tr: "Profilde neyi güncellemek istiyorsun?", en: "What profile detail needs updating?", ru: "Что обновить в профиле?", uz: "Profilda nima o'zgarishi kerak?" },
    subjectPlaceholder: { tr: "Profil fotoğrafım güncellenmiyor", en: "Profile photo won't update", ru: "Фото профиля не обновляется", uz: "Profil rasmi yangilanmayapti" },
    detailHint: { tr: "Ne değiştirmek istediğini belirt", en: "Say what you want to change", ru: "Укажите, что изменить", uz: "Nimani o'zgartirmoqchiligingizni yozing" },
    detailPlaceholder: { tr: "Kullanıcı adımı / biyografimi / fotoğrafımı değiştirmek istiyorum…", en: "I want to change my username / bio / photo…", ru: "Хочу изменить имя / био / фото…", uz: "Foydalanuvchi nomi / bio / rasmni o'zgartirmoqchiman…" }
  },
  "account:2": {
    subjectHint: { tr: "Şifre mi, e-posta mı?", en: "Password or email issue?", ru: "Пароль или почта?", uz: "Parol yoki email?" },
    subjectPlaceholder: { tr: "Şifre sıfırlama maili gelmiyor", en: "Password reset email not arriving", ru: "Письмо для сброса не приходит", uz: "Parol tiklash xati kelmayapti" },
    detailHint: { tr: "Son denediğin yöntemi yaz", en: "Describe what you tried", ru: "Что уже пробовали", uz: "Nima urinib ko'rdingiz" },
    detailPlaceholder: { tr: "Şifremi unuttum / e-postamı değiştirmek istiyorum…", en: "I forgot my password / want to change my email…", ru: "Забыл пароль / хочу сменить почту…", uz: "Parolni unutdim / emailni o'zgartirmoqchiman…" }
  },
  "account:3": {
    subjectHint: { tr: "Güvenlik endişeni kısaca özetle", en: "Briefly describe the security concern", ru: "Кратко опишите проблему", uz: "Xavfsizlik tashvishini qisqacha yozing" },
    subjectPlaceholder: { tr: "Hesabımda şüpheli giriş", en: "Suspicious sign-in on my account", ru: "Подозрительный вход", uz: "Hisobimga shubhali kirish" },
    detailHint: { tr: "Ne fark ettiğini anlat", en: "Explain what you noticed", ru: "Что заметили", uz: "Nima sezganingizni yozing" },
    detailPlaceholder: { tr: "Hesabıma ben girmedim ama bildirim aldım / profilim değişmiş…", en: "I got a notification but didn't sign in / my profile changed…", ru: "Пришло уведомление, но я не входил…", uz: "Kirmagan bo'lsam ham bildirishnoma keldi…" }
  },
  "account:4": {
    subjectHint: { tr: "Hangi rol veya rozet?", en: "Which role or badge?", ru: "Какая роль или значок?", uz: "Qaysi rol yoki nishon?" },
    subjectPlaceholder: { tr: "Küratör rozeti talebi", en: "Curator badge request", ru: "Запрос значка куратора", uz: "Kurator nishoni so'rovi" },
    detailHint: { tr: "Neden uygun olduğunu kısaca yaz", en: "Briefly say why you qualify", ru: "Кратко — почему подходите", uz: "Nima uchun mos ekaningizni yozing" },
    detailPlaceholder: { tr: "İstediğim rol/rozet: …\nKatkım / gerekçem: …", en: "Role/badge I want: …\nMy contribution / reason: …", ru: "Нужная роль/значок: …\nМой вклад / причина: …", uz: "Kerakli rol/nishon: …\nHissam / sabab: …" }
  },
  "artwork:0": {
    subjectHint: { tr: "Hangi eser?", en: "Which artwork?", ru: "Какое произведение?", uz: "Qaysi asar?" },
    subjectPlaceholder: { tr: "Guernica – içerik inceleme", en: "Guernica – content review", ru: "Guernica – проверка", uz: "Guernica – kontent tekshiruvi" },
    detailHint: { tr: "İnceleme isteğini kısaca yaz", en: "Briefly describe the review request", ru: "Кратко опишите запрос", uz: "Tekshiruv so'rovini qisqacha yozing" },
    detailPlaceholder: { tr: "Eser adı: …\nİncelemek istediğim konu: …", en: "Artwork: …\nWhat I'd like reviewed: …", ru: "Произведение: …\nЧто проверить: …", uz: "Asar: …\nTekshirilishi kerak: …" }
  },
  "artwork:1": {
    subjectHint: { tr: "Hangi bilgi yanlış?", en: "Which detail is wrong?", ru: "Какая информация неверна?", uz: "Qaysi ma'lumot noto'g'ri?" },
    subjectPlaceholder: { tr: "Yıldızlı Gece – yanlış yapım yılı", en: "Starry Night – wrong year", ru: "Звёздная ночь – неверный год", uz: "Yulduzli tun – noto'g'ri yil" },
    detailHint: { tr: "Yanlış bilgiyi ve doğrusunu yaz", en: "State what's wrong and what's correct", ru: "Что неверно и как правильно", uz: "Noto'g'ri va to'g'ri ma'lumotni yozing" },
    detailPlaceholder: { tr: "Eser: …\nUygulamada yazan: …\nDoğrusu: …", en: "Artwork: …\nApp shows: …\nCorrect info: …", ru: "Произведение: …\nВ приложении: …\nВерно: …", uz: "Asar: …\nIlovada: …\nTo'g'risi: …" }
  },
  "artwork:2": {
    subjectHint: { tr: "Görselde sorun ne?", en: "What's wrong with the image?", ru: "Что не так с изображением?", uz: "Rasmda nima muammo?" },
    subjectPlaceholder: { tr: "Eser görseli bulanık / kırpılmış", en: "Artwork image blurry / cropped wrong", ru: "Изображение размыто", uz: "Asar rasmi xira" },
    detailHint: { tr: "Gördüğün sorunu tarif et", en: "Describe the visual issue", ru: "Опишите проблему", uz: "Muammoni tasvirlang" },
    detailPlaceholder: { tr: "Eser: …\nSorun: görsel eksik / yanlış kırpım / düşük kalite…", en: "Artwork: …\nIssue: missing / wrong crop / low quality…", ru: "Произведение: …\nПроблема: …", uz: "Asar: …\nMuammo: …" }
  },
  "artwork:3": {
    subjectHint: { tr: "Kaynak veya müze bilgisi mi?", en: "Source or museum info?", ru: "Источник или музей?", uz: "Manba yoki muzey?" },
    subjectPlaceholder: { tr: "Müze adı hatalı", en: "Wrong museum name", ru: "Неверное название музея", uz: "Muzey nomi noto'g'ri" },
    detailHint: { tr: "Doğru kaynağı varsa ekle", en: "Add the correct source if you know it", ru: "Укажите верный источник", uz: "To'g'ri manbani qo'shing" },
    detailPlaceholder: { tr: "Eser: …\nUygulamada: …\nDoğru müze / kaynak: …", en: "Artwork: …\nIn app: …\nCorrect museum / source: …", ru: "Произведение: …\nВ приложении: …\nВерно: …", uz: "Asar: …\nIlovada: …\nTo'g'ri manba: …" }
  },
  "app:0": {
    subjectHint: { tr: "Hata ne zaman oluyor?", en: "When does the bug happen?", ru: "Когда возникает ошибка?", uz: "Xato qachon chiqadi?" },
    subjectPlaceholder: { tr: "Oyunlar sayfası çöküyor", en: "Games screen crashes", ru: "Экран игр вылетает", uz: "O'yinlar sahifasi yopiladi" },
    detailHint: { tr: "Adım adım ne yaptığını yaz", en: "Describe the steps you took", ru: "Опишите шаги", uz: "Qadamlaringizni yozing" },
    detailPlaceholder: { tr: "Şunu yapınca uygulama kapanıyor / hata veriyor…", en: "When I do this, the app closes / shows an error…", ru: "Когда я делаю это, приложение…", uz: "Buni qilganda ilova yopiladi…" }
  },
  "app:1": {
    subjectHint: { tr: "Nerede yavaşlıyor?", en: "Where is it slow?", ru: "Где тормозит?", uz: "Qayerda sekin?" },
    subjectPlaceholder: { tr: "Galeri geç açılıyor", en: "Gallery loads slowly", ru: "Галерея грузится медленно", uz: "Galereya sekin ochiladi" },
    detailHint: { tr: "Cihaz ve bağlantını belirt", en: "Mention device and connection", ru: "Укажите устройство и сеть", uz: "Qurilma va internetni yozing" },
    detailPlaceholder: { tr: "Hangi sayfada yavaş / donuyor, telefon modeli…", en: "Which screen is slow, phone model…", ru: "Какой экран тормозит, модель…", uz: "Qaysi sahifa sekin, telefon modeli…" }
  },
  "app:2": {
    subjectHint: { tr: "Hangi metin veya dil?", en: "Which text or language?", ru: "Какой текст или язык?", uz: "Qaysi matn yoki til?" },
    subjectPlaceholder: { tr: "Quiz sorusu yanlış çevrilmiş", en: "Quiz question mistranslated", ru: "Неверный перевод в квизе", uz: "Quiz savoli noto'g'ri tarjima" },
    detailHint: { tr: "Yanlış metni ve doğrusunu yaz", en: "Paste wrong text and correction", ru: "Неверный и верный текст", uz: "Noto'g'ri va to'g'ri matn" },
    detailPlaceholder: { tr: "Sayfa: …\nGördüğüm metin: …\nOlması gereken: …", en: "Screen: …\nText I see: …\nShould be: …", ru: "Экран: …\nВижу: …\nДолжно быть: …", uz: "Sahifa: …\nKo'rgan matn: …\nBo'lishi kerak: …" }
  },
  "app:3": {
    subjectHint: { tr: "Önerini kısaca yaz", en: "Briefly share your idea", ru: "Кратко опишите идею", uz: "G'oyangizni qisqacha yozing" },
    subjectPlaceholder: { tr: "Keşfet için filtre önerisi", en: "Filter idea for Discover", ru: "Идея фильтра для ленты", uz: "Kashfiyot uchun filtr taklifi" },
    detailHint: { tr: "Ne işe yarayacağını anlat", en: "Explain how it would help", ru: "Чем это поможет", uz: "Qanday foyda berishini yozing" },
    detailPlaceholder: { tr: "Şunu ekleseniz iyi olur çünkü…", en: "It would help if you added… because…", ru: "Было бы полезно добавить… потому что…", uz: "Buni qo'shsangiz yaxshi bo'lardi…" }
  },
  "user:0": {
    subjectHint: { tr: "Hangi profil?", en: "Which profile?", ru: "Какой профиль?", uz: "Qaysi profil?" },
    subjectPlaceholder: { tr: "@kullanici profili hakkında", en: "About @username profile", ru: "Профиль @username", uz: "@foydalanuvchi profili" },
    detailHint: { tr: "Bildirim nedenini yaz", en: "Explain why you're reporting", ru: "Причина жалобы", uz: "Shikoyat sababini yozing" },
    detailPlaceholder: { tr: "Kullanıcı adı: @…\nKonu: …", en: "Username: @…\nIssue: …", ru: "Имя: @…\nСуть: …", uz: "Foydalanuvchi: @…\nMavzu: …" }
  },
  "user:1": {
    subjectHint: { tr: "Ne yaşandı?", en: "What happened?", ru: "Что произошло?", uz: "Nima bo'ldi?" },
    subjectPlaceholder: { tr: "Yorumlarda uygunsuz içerik", en: "Inappropriate comments", ru: "Неподобающие комментарии", uz: "Noo'rin izohlar" },
    detailHint: { tr: "Mümkünse örnek veya tarih ekle", en: "Add example or date if possible", ru: "Пример или дата", uz: "Misol yoki sana qo'shing" },
    detailPlaceholder: { tr: "Kullanıcı: @…\nNe yaptı: …\nNe zaman: …", en: "User: @…\nWhat they did: …\nWhen: …", ru: "Пользователь: @…\nЧто сделал: …", uz: "Foydalanuvchi: @…\nNima qildi: …" }
  },
  "user:2": {
    subjectHint: { tr: "Hangi bilgi yanlış?", en: "Which info is false?", ru: "Какие данные ложные?", uz: "Qaysi ma'lumot yolg'on?" },
    subjectPlaceholder: { tr: "Profilde sahte sanatçı bilgisi", en: "Fake artist info on profile", ru: "Ложные данные художника", uz: "Profilda soxta ma'lumot" },
    detailHint: { tr: "Yanlış olanı açıkla", en: "Explain what's incorrect", ru: "Что именно неверно", uz: "Noto'g'ri qismini yozing" },
    detailPlaceholder: { tr: "Kullanıcı: @…\nYanlış bilgi: …", en: "User: @…\nFalse info: …", ru: "Пользователь: @…\nЛожь: …", uz: "Foydalanuvchi: @…\nNoto'g'ri: …" }
  },
  "user:3": {
    subjectHint: { tr: "Hangi kural ihlali?", en: "Which rule was broken?", ru: "Какое правило нарушено?", uz: "Qaysi qoida buzildi?" },
    subjectPlaceholder: { tr: "Topluluk kuralları ihlali", en: "Community rules violation", ru: "Нарушение правил", uz: "Hamjamiyat qoidalarini buzish" },
    detailHint: { tr: "Kısaca olayı anlat", en: "Briefly describe the incident", ru: "Кратко опишите", uz: "Hodisani qisqacha yozing" },
    detailPlaceholder: { tr: "Kullanıcı: @…\nİhlal: …\nDetay: …", en: "User: @…\nViolation: …\nDetails: …", ru: "Пользователь: @…\nНарушение: …", uz: "Foydalanuvchi: @…\nBuzilish: …" }
  },
  "copyright:0": {
    subjectHint: { tr: "Hangi içerik?", en: "Which content?", ru: "Какой контент?", uz: "Qaysi kontent?" },
    subjectPlaceholder: { tr: "Telif hakkı bildirimi – eser", en: "Copyright notice – artwork", ru: "Уведомление о правах", uz: "Mualliflik huquqi – asar" },
    detailHint: { tr: "Hak sahibi bilgini ekle", en: "Include rights holder info", ru: "Данные правообладателя", uz: "Huquq egasi ma'lumotini qo'shing" },
    detailPlaceholder: { tr: "İçerik: …\nHak sahibi: …\nİletişim: …", en: "Content: …\nRights holder: …\nContact: …", ru: "Контент: …\nПравообладатель: …", uz: "Kontent: …\nHuquq egasi: …" }
  },
  "copyright:1": {
    subjectHint: { tr: "Ne için izin istiyorsun?", en: "Permission for what use?", ru: "Разрешение на что?", uz: "Qanday ruxsat?" },
    subjectPlaceholder: { tr: "Eser görseli kullanım izni", en: "Permission to use artwork image", ru: "Разрешение на изображение", uz: "Asar rasmi uchun ruxsat" },
    detailHint: { tr: "Kullanım amacını yaz", en: "State intended use", ru: "Цель использования", uz: "Foydalanish maqsadini yozing" },
    detailPlaceholder: { tr: "Eser: …\nKullanım amacı: …", en: "Artwork: …\nIntended use: …", ru: "Произведение: …\nЦель: …", uz: "Asar: …\nMaqsad: …" }
  },
  "copyright:2": {
    subjectHint: { tr: "Kaldırılmasını istediğin içerik?", en: "Content to remove?", ru: "Что удалить?", uz: "Nima o'chirilsin?" },
    subjectPlaceholder: { tr: "İçerik kaldırma talebi", en: "Content removal request", ru: "Запрос на удаление", uz: "Kontentni o'chirish so'rovi" },
    detailHint: { tr: "Neden kaldırılması gerektiğini yaz", en: "Why it should be removed", ru: "Почему удалить", uz: "Nima uchun o'chirilishi kerak" },
    detailPlaceholder: { tr: "İçerik / link: …\nGerekçe: …", en: "Content / link: …\nReason: …", ru: "Контент / ссылка: …\nПричина: …", uz: "Kontent / havola: …\nSabab: …" }
  },
  "copyright:3": {
    subjectHint: { tr: "Hangi kaynak düzeltilecek?", en: "Which source to fix?", ru: "Какой источник?", uz: "Qaysi manba?" },
    subjectPlaceholder: { tr: "Eser kaynağı düzeltme", en: "Artwork source correction", ru: "Исправление источника", uz: "Asar manbasini tuzatish" },
    detailHint: { tr: "Doğru kaynağı paylaş", en: "Share the correct source", ru: "Укажите верный источник", uz: "To'g'ri manbani yozing" },
    detailPlaceholder: { tr: "Eser: …\nYanlış kaynak: …\nDoğru kaynak: …", en: "Artwork: …\nWrong source: …\nCorrect source: …", ru: "Произведение: …\nНеверно: …\nВерно: …", uz: "Asar: …\nNoto'g'ri: …\nTo'g'ri: …" }
  }
};

function supportTopicExample(category: SupportCategory | null, subcategory: string, language: SupportLang) {
  if (!category || !subcategory) return null;
  const item = supportCategories.find((entry) => entry.id === category);
  const index = item?.options[language].indexOf(subcategory) ?? -1;
  if (index < 0) return null;
  return supportTopicExamples[`${category}:${index}`] ?? null;
}

const supportMessageMin = fieldLimits.supportMessage.min ?? 10;
const supportMessageMax = fieldLimits.supportMessage.max;

export default function SupportScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ category?: SupportCategory; subcategory?: string; subject?: string; topic?: string }>();
  const { account, isAuthenticated } = useAccount();
  const { tickets, createTicket, addUserMessage, addAdminMessage, closeTicket, syncError } = useSupport();
  const [category, setCategory] = useState<SupportCategory | null>(null);
  const [subcategory, setSubcategory] = useState("");
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const myTickets = useMemo(
    () => account.isAdmin ? tickets.filter((ticket) => ticket.userId === account.uid) : tickets,
    [account.isAdmin, account.uid, tickets]
  );
  const myOpenTickets = useMemo(() => myTickets.filter((ticket) => ticket.status === "open"), [myTickets]);
  const myResolvedTickets = useMemo(() => myTickets.filter((ticket) => ticket.status === "closed"), [myTickets]);
  const allOpenTickets = useMemo(() => tickets.filter((ticket) => ticket.status === "open"), [tickets]);
  const allResolvedTickets = useMemo(() => tickets.filter((ticket) => ticket.status === "closed"), [tickets]);
  const activeCategory = supportCategories.find((item) => item.id === category);
  const formReady = Boolean(category && subcategory);
  const topicExample = useMemo(
    () => supportTopicExample(category, subcategory, language),
    [category, language, subcategory]
  );

  function resetDraftFields() {
    setSubject("");
    setTopic("");
  }

  function selectCategory(nextCategory: SupportCategory) {
    setCategory(nextCategory);
    setSubcategory("");
    resetDraftFields();
  }

  function selectSubcategory(option: string) {
    setSubcategory(option);
    resetDraftFields();
  }

  useEffect(() => {
    if (!isAuthenticated) return;
    if (!email && account.email) setEmail(account.email);
    if (!firstName && !lastName && account.displayName) {
      const parts = account.displayName.trim().split(/\s+/);
      setFirstName(parts[0] ?? "");
      setLastName(parts.slice(1).join(" "));
    }
  }, [account.displayName, account.email, email, firstName, isAuthenticated, lastName]);

  const paramsAppliedRef = useRef(false);

  useEffect(() => {
    if (paramsAppliedRef.current) return;
    if (!params.category && !params.subcategory && !params.subject && !params.topic) return;
    paramsAppliedRef.current = true;
    if (params.category) setCategory(params.category);
    if (params.subcategory) {
      setSubcategory(params.subcategory === "content"
        ? supportCategories.find((item) => item.id === "artwork")?.options[language][0] ?? params.subcategory
        : params.subcategory);
    }
    if (params.subject) setSubject(params.subject);
    if (params.topic) setTopic(params.topic);
  }, [language, params.category, params.subcategory, params.subject, params.topic]);

  async function submitTicket() {
    const cleanTopic = topic.trim();
    if (!category || !subcategory || !subject.trim() || cleanTopic.length < supportMessageMin || !firstName.trim() || !lastName.trim() || !email.includes("@")) {
      setError(supportCopy.errorMissing[language]);
      return;
    }
    if (!isAuthenticated) {
      setError(supportCopy.errorMissing[language]);
      return;
    }
    if (!throttleAction("support_ticket", 4000) || !withinBurstLimit("support_ticket_burst", 5, 30 * 60 * 1000)) {
      setError(language === "tr"
        ? "Çok sık talep gönderiyorsun. Lütfen biraz bekleyip tekrar dene."
        : language === "ru"
          ? "Слишком частые обращения. Подождите немного и повторите."
          : language === "uz"
            ? "Juda tez-tez so'rov yuboryapsiz. Biroz kuting va qayta urinib ko'ring."
            : "You are sending requests too often. Please wait a moment and try again.");
      return;
    }

    setSubmitting(true);
    setError("");
    const result = await createTicket({
      category,
      subcategory,
      subject: subject.trim(),
      topic: cleanTopic.slice(0, supportMessageMax),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim()
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.message ?? (language === "tr" ? "Destek talebi kaydedilemedi. Bağlantınızı kontrol edip tekrar deneyin." : "Support request could not be saved. Check your connection and try again."));
      return;
    }
    setSubject("");
    setTopic("");
    setCategory(null);
    setSubcategory("");
  }

  return (
    <AppChrome title={supportCopy.title[language]} eyebrow="Art Atlas" showBackButton backToHome>
      <View style={styles.panel}>
        <Text style={styles.intro}>{supportCopy.intro[language]}</Text>

        <Text style={styles.fieldLabel}>{supportCopy.category[language]}</Text>
        <View style={styles.categoryRow}>
          {supportCategories.map((item) => (
            <Pressable
              key={item.id}
              onPress={() => selectCategory(item.id)}
              style={[styles.categoryChip, category === item.id && styles.categoryChipActive]}
            >
              <Ionicons name={item.icon} size={16} color={category === item.id ? colors.ink : colors.gold} />
              <Text style={[styles.categoryChipText, category === item.id && styles.categoryChipTextActive]}>{item.title[language]}</Text>
            </Pressable>
          ))}
        </View>

        {activeCategory ? (
          <>
            <Text style={styles.fieldLabel}>{supportCopy.topicType[language]}</Text>
            <View style={styles.subcategoryRow}>
              {activeCategory.options[language].map((option) => (
                <Pressable
                  key={option}
                  onPress={() => selectSubcategory(option)}
                  style={[styles.subcategoryChip, subcategory === option && styles.subcategoryChipActive]}
                >
                  <Text style={[styles.subcategoryText, subcategory === option && styles.subcategoryTextActive]}>{option}</Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : null}

        {formReady ? (
          <>
            <View style={styles.divider} />
            <Text style={styles.fieldLabel}>{supportCopy.contact[language]}</Text>
            <View style={styles.row}>
              <View style={styles.fieldBlock}>
                <Text style={styles.inputLabel}>{supportCopy.firstName[language]}</Text>
                <TextInput value={firstName} onChangeText={setFirstName} placeholderTextColor={colors.muted} style={styles.input} />
              </View>
              <View style={styles.fieldBlock}>
                <Text style={styles.inputLabel}>{supportCopy.lastName[language]}</Text>
                <TextInput value={lastName} onChangeText={setLastName} placeholderTextColor={colors.muted} style={styles.input} />
              </View>
            </View>
            <View style={styles.fieldBlock}>
              <Text style={styles.inputLabel}>{supportCopy.email[language]}</Text>
              <TextInput value={email} onChangeText={setEmail} placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" style={styles.input} />
            </View>
            <View style={styles.fieldBlock}>
              <Text style={styles.inputLabel}>{supportCopy.subject[language]}</Text>
              {topicExample ? <Text style={styles.inputHint}>{topicExample.subjectHint[language]}</Text> : null}
              <TextInput
                value={subject}
                onChangeText={setSubject}
                placeholder={topicExample?.subjectPlaceholder[language]}
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
            </View>
            <View style={styles.fieldBlock}>
              <Text style={styles.inputLabel}>{supportCopy.detail[language]}</Text>
              {topicExample ? <Text style={styles.inputHint}>{topicExample.detailHint[language]}</Text> : null}
              <TextInput
                value={topic}
                onChangeText={(text) => setTopic(text.slice(0, supportMessageMax))}
                placeholder={topicExample?.detailPlaceholder[language]}
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.topicInput]}
                multiline
                maxLength={supportMessageMax}
                textAlignVertical="top"
              />
            </View>
            <Pressable onPress={() => void submitTicket()} disabled={submitting} style={styles.primaryButton}>
              <Text style={styles.primaryText}>{submitting ? "..." : supportCopy.send[language]}</Text>
            </Pressable>
            {error || syncError ? <Text style={styles.errorText}>{error || syncError}</Text> : null}
          </>
        ) : (
          <Text style={styles.pickHint}>{supportCopy.pickTopic[language]}</Text>
        )}
      </View>

      <TicketList
        title={supportCopy.mine[language]}
        tickets={myOpenTickets}
        emptyText={language === "tr" ? "Açık talep yok." : language === "ru" ? "Открытых обращений нет." : language === "uz" ? "Ochiq so'rov yo'q." : "No open requests."}
        replyLabel={supportCopy.reply[language]}
        closedLabel={supportCopy.closed[language]}
        openLabel={supportCopy.open[language]}
        onReply={addUserMessage}
        canClose={false}
      />

      <TicketList
        title={supportCopy.resolved[language]}
        tickets={myResolvedTickets}
        emptyText={language === "tr" ? "Sonuçlanan talep yok." : language === "ru" ? "Завершённых обращений нет." : language === "uz" ? "Yakunlangan so'rov yo'q." : "No resolved requests."}
        replyLabel={supportCopy.reply[language]}
        closedLabel={supportCopy.closed[language]}
        openLabel={supportCopy.open[language]}
        onReply={addUserMessage}
        canClose={false}
      />

      {isAuthenticated && account.isAdmin ? (
        <>
        <TicketList
          title={supportCopy.admin[language]}
          tickets={allOpenTickets}
          emptyText={language === "tr" ? "Açık talep yok." : "No open requests."}
          replyLabel={supportCopy.reply[language]}
          closedLabel={supportCopy.closed[language]}
          openLabel={supportCopy.open[language]}
          closeLabel={supportCopy.close[language]}
          onReply={addAdminMessage}
          onCloseTicket={closeTicket}
          canClose
        />
        <TicketList
          title={supportCopy.adminResolved[language]}
          tickets={allResolvedTickets}
          emptyText={language === "tr" ? "Sonuçlanan talep yok." : "No resolved requests."}
          replyLabel={supportCopy.reply[language]}
          closedLabel={supportCopy.closed[language]}
          openLabel={supportCopy.open[language]}
          closeLabel={supportCopy.close[language]}
          onReply={addAdminMessage}
          onCloseTicket={closeTicket}
          canClose
        />
        </>
      ) : null}
    </AppChrome>
  );
}

type TicketListProps = {
  title: string;
  tickets: SupportTicket[];
  emptyText: string;
  replyLabel: string;
  closedLabel: string;
  openLabel: string;
  closeLabel?: string;
  canClose: boolean;
  onReply: (ticketId: string, text: string) => void;
  onCloseTicket?: (ticketId: string) => void;
};

function TicketList({ title, tickets, emptyText, replyLabel, closedLabel, openLabel, closeLabel, canClose, onReply, onCloseTicket }: TicketListProps) {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  function submitReply(ticket: SupportTicket) {
    const text = drafts[ticket.id]?.trim();
    if (!text || ticket.status === "closed") return;
    onReply(ticket.id, text);
    setDrafts((current) => ({ ...current, [ticket.id]: "" }));
  }

  return (
    <View style={styles.panel}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {tickets.length ? tickets.map((ticket) => (
        <View key={ticket.id} style={styles.ticketCard}>
          <View style={styles.ticketTop}>
            <View style={styles.ticketTitleBlock}>
              <Text style={styles.ticketSubject} numberOfLines={2}>{ticket.subject}</Text>
              <Text style={styles.ticketMeta}>{ticket.subcategory} · {ticket.firstName} {ticket.lastName}</Text>
            </View>
            <View style={[styles.statusPill, ticket.status === "closed" && styles.statusPillClosed]}>
              <Text style={[styles.statusText, ticket.status === "closed" && styles.statusTextClosed]}>
                {ticket.status === "closed" ? closedLabel : openLabel}
              </Text>
            </View>
          </View>
          <View style={styles.messages}>
            {ticket.messages.map((message) => (
              <View key={message.id} style={[styles.messageBubble, message.author === "admin" && styles.adminBubble]}>
                <Text style={styles.messageAuthor}>{message.author === "admin" ? (language === "tr" ? "Art Atlas Destek" : language === "ru" ? "Поддержка Art Atlas" : language === "uz" ? "Art Atlas Yordam" : "Art Atlas Support") : `${ticket.firstName} ${ticket.lastName}`}</Text>
                <Text style={styles.messageText}>{message.text}</Text>
                <Text style={styles.messageTime}>{message.createdAt}</Text>
              </View>
            ))}
          </View>
          {ticket.status === "open" ? (
            <>
              <TextInput
                value={drafts[ticket.id] ?? ""}
                onChangeText={(text) => setDrafts((current) => ({ ...current, [ticket.id]: text }))}
                placeholder={replyLabel}
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <View style={styles.ticketActions}>
                <Pressable onPress={() => submitReply(ticket)} style={styles.secondaryButton}>
                  <Ionicons name="send" size={16} color={colors.ink} />
                  <Text style={styles.secondaryText}>{replyLabel}</Text>
                </Pressable>
                {canClose && onCloseTicket ? (
                  <Pressable onPress={() => onCloseTicket(ticket.id)} style={styles.closeButton}>
                    <Ionicons name="checkmark-done" size={16} color={colors.ivory} />
                    <Text style={styles.closeText}>{closeLabel}</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : (
            <Text style={styles.closedNote}>{closedLabel}</Text>
          )}
        </View>
      )) : (
        <Text style={styles.emptyText}>{emptyText}</Text>
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    panel: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      padding: 12,
      gap: 10,
      marginBottom: 14
    },
    intro: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "700"
    },
    fieldLabel: {
      color: colors.ivory,
      fontSize: 12,
      fontWeight: "900",
      marginTop: 2
    },
    inputLabel: {
      color: colors.ivory,
      fontSize: 12,
      fontWeight: "800",
      marginBottom: 4
    },
    inputHint: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "700",
      marginBottom: 6
    },
    fieldBlock: {
      flex: 1,
      gap: 0
    },
    row: {
      flexDirection: "row",
      gap: 8
    },
    categoryRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6
    },
    categoryChip: {
      minWidth: "30%",
      flexGrow: 1,
      minHeight: 38,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panelSoft,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingHorizontal: 8
    },
    categoryChipActive: {
      backgroundColor: colors.gold,
      borderColor: colors.gold
    },
    categoryChipText: {
      color: colors.ivory,
      fontSize: 11,
      fontWeight: "900"
    },
    categoryChipTextActive: {
      color: colors.ink
    },
    subcategoryRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6
    },
    subcategoryChip: {
      minHeight: 32,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panelSoft,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10
    },
    subcategoryChipActive: {
      backgroundColor: colors.gold,
      borderColor: colors.gold
    },
    subcategoryText: {
      color: colors.ivory,
      fontSize: 11,
      fontWeight: "800"
    },
    subcategoryTextActive: {
      color: colors.ink
    },
    divider: {
      height: 1,
      backgroundColor: colors.line,
      marginVertical: 2
    },
    pickHint: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "700",
      textAlign: "center",
      paddingVertical: 8
    },
    input: {
      minHeight: 44,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panelSoft,
      color: colors.ivory,
      paddingHorizontal: 12,
      fontWeight: "700"
    },
    topicInput: {
      minHeight: 110,
      paddingTop: 12
    },
    primaryButton: {
      minHeight: 46,
      borderRadius: 8,
      backgroundColor: colors.gold,
      alignItems: "center",
      justifyContent: "center",
      marginTop: 4
    },
    primaryText: {
      color: colors.ink,
      fontWeight: "900"
    },
    errorText: {
      color: "#f3b0a6",
      fontWeight: "800",
      textAlign: "center",
      fontSize: 12
    },
    sectionTitle: {
      color: colors.ivory,
      fontSize: 15,
      fontWeight: "900"
    },
    ticketCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panelSoft,
      padding: 10,
      gap: 10
    },
    ticketTop: {
      flexDirection: "row",
      gap: 8,
      alignItems: "flex-start"
    },
    ticketTitleBlock: {
      flex: 1
    },
    ticketSubject: {
      color: colors.ivory,
      fontSize: 14,
      fontWeight: "900"
    },
    ticketMeta: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "700",
      marginTop: 3
    },
    statusPill: {
      borderRadius: 8,
      backgroundColor: "rgba(217, 184, 101, 0.16)",
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.26)",
      paddingHorizontal: 8,
      paddingVertical: 4
    },
    statusPillClosed: {
      backgroundColor: "rgba(255,255,255,0.08)",
      borderColor: colors.line
    },
    statusText: {
      color: colors.gold,
      fontSize: 10,
      fontWeight: "900"
    },
    statusTextClosed: {
      color: colors.muted
    },
    messages: {
      gap: 8
    },
    messageBubble: {
      alignSelf: "flex-start",
      maxWidth: "92%",
      borderRadius: 8,
      backgroundColor: "rgba(255,255,255,0.06)",
      padding: 9
    },
    adminBubble: {
      alignSelf: "flex-end",
      backgroundColor: "rgba(217, 184, 101, 0.16)"
    },
    messageAuthor: {
      color: colors.gold,
      fontSize: 11,
      fontWeight: "900"
    },
    messageText: {
      color: colors.ivory,
      fontSize: 13,
      lineHeight: 18,
      marginTop: 3
    },
    messageTime: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: "700",
      marginTop: 5
    },
    ticketActions: {
      flexDirection: "row",
      gap: 8
    },
    secondaryButton: {
      flex: 1,
      minHeight: 40,
      borderRadius: 8,
      backgroundColor: colors.gold,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 8
    },
    secondaryText: {
      color: colors.ink,
      fontSize: 12,
      fontWeight: "900"
    },
    closeButton: {
      flex: 1,
      minHeight: 40,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 8
    },
    closeText: {
      color: colors.ivory,
      fontSize: 12,
      fontWeight: "900",
      textAlign: "center"
    },
    closedNote: {
      color: colors.muted,
      fontWeight: "800",
      textAlign: "center",
      fontSize: 12
    },
    emptyText: {
      color: colors.muted,
      fontWeight: "700",
      textAlign: "center",
      paddingVertical: 8,
      fontSize: 12
    }
  });
}
