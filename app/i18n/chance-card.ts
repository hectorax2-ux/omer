import { Language } from "@/types/content";

type ChanceCardCopy = {
  screenTitle: string;
  heroTitle: string;
  heroDescription: string;
  openButton: string;
  openingButton: string;
  ready: string;
  nextCardIn: string;
  hours: string;
  minutes: string;
  seconds: string;
  dailyCard: string;
  todayScore: string;
  todayMessage: string;
  scoreScale: string;
  personalMessage: string;
  premiumSecondChance: string;
  latestScore: string;
  bestKept: string;
  bestKeptHint: string;
  scoreAddedHint: string;
  leaderboardTitle: string;
  today: string;
  week: string;
  month: string;
  allTime: string;
  threeMonths: string;
  showMore: string;
  nextChancePrefix: string;
  adTitle: string;
  adDescription: string;
  cancel: string;
  watchAd: string;
  adRequired: string;
  cardReadyAccessibility: string;
  cardScoreAccessibility: string;
};

const copy: Record<Language, ChanceCardCopy> = {
  tr: {
    screenTitle: "Şans Kartı",
    heroTitle: "Bugünün şansı seni bekliyor",
    heroDescription: "Sanat tarihinden ilham alan kartını aç, günün sürprizini öğren.",
    openButton: "Kartı Aç",
    openingButton: "Kart açılıyor",
    ready: "Günlük kartın hazır",
    nextCardIn: "Yeni kart hakkına",
    hours: "Saat",
    minutes: "Dakika",
    seconds: "Saniye",
    dailyCard: "Günlük Kart",
    todayScore: "Bugünün Şansı",
    todayMessage: "Günün Yorumu",
    scoreScale: "Günün puanı",
    personalMessage: "Her kart sana özel bir yorum getirir.",
    premiumSecondChance: "Premium · İkinci şans",
    latestScore: "Son çıkan şans puanın",
    bestKept: "Bugünkü yüksek puanın korundu: {score}",
    bestKeptHint: "Sıralamada bugünkü yüksek puanın kullanılıyor.",
    scoreAddedHint: "Puanın şanslılar sıralamasına eklendi.",
    leaderboardTitle: "Şanslılar sıralaması",
    today: "Bugün",
    week: "Hafta",
    month: "Ay",
    allTime: "Tüm zamanlar",
    threeMonths: "Son 3 ay",
    showMore: "Daha fazla gör",
    nextChancePrefix: "Sonraki hakkın:",
    adTitle: "Şans kartını aç",
    adDescription: "Kartını açmak ve puanını sıralamaya yazdırmak için kısa sponsorlu içeriği izlemen gerekir.",
    cancel: "Vazgeç",
    watchAd: "Reklamı izle",
    adRequired: "Kart açılmadı. Reklam tamamlanmalı.",
    cardReadyAccessibility: "Şans kartı, bugün açılabilir",
    cardScoreAccessibility: "Bugünün şans puanı {score}"
  },
  en: {
    screenTitle: "Chance Card",
    heroTitle: "Today's luck is waiting for you",
    heroDescription: "Open your art-history-inspired card and discover today's surprise.",
    openButton: "Open Card",
    openingButton: "Opening card",
    ready: "Your daily card is ready",
    nextCardIn: "Next card in",
    hours: "Hours",
    minutes: "Minutes",
    seconds: "Seconds",
    dailyCard: "Daily Card",
    todayScore: "Today's Luck",
    todayMessage: "Today's Message",
    scoreScale: "Daily score",
    personalMessage: "Every card brings a message made for you.",
    premiumSecondChance: "Premium · Second chance",
    latestScore: "Latest luck score",
    bestKept: "Today's best was kept: {score}",
    bestKeptHint: "Your best score today is used on the leaderboard.",
    scoreAddedHint: "Your score was added to the luck leaderboard.",
    leaderboardTitle: "Luck leaderboard",
    today: "Today",
    week: "Week",
    month: "Month",
    allTime: "All time",
    threeMonths: "3 months",
    showMore: "Show more",
    nextChancePrefix: "Next chance in:",
    adTitle: "Open your luck card",
    adDescription: "Watch a short sponsored clip to open your card and add your score to the leaderboard.",
    cancel: "Cancel",
    watchAd: "Watch ad",
    adRequired: "The card was not opened. Please complete the ad.",
    cardReadyAccessibility: "Luck card, available to open today",
    cardScoreAccessibility: "Today's luck score is {score}"
  },
  ru: {
    screenTitle: "Карта удачи",
    heroTitle: "Сегодняшняя удача ждёт вас",
    heroDescription: "Откройте карту, вдохновлённую историей искусства, и узнайте сюрприз дня.",
    openButton: "Открыть карту",
    openingButton: "Карта открывается",
    ready: "Ваша карта дня готова",
    nextCardIn: "До новой карты",
    hours: "Часы",
    minutes: "Минуты",
    seconds: "Секунды",
    dailyCard: "Карта дня",
    todayScore: "Удача дня",
    todayMessage: "Комментарий дня",
    scoreScale: "Баллы дня",
    personalMessage: "Каждая карта приносит личное послание.",
    premiumSecondChance: "Premium · Второй шанс",
    latestScore: "Последний результат удачи",
    bestKept: "Сохранен лучший результат дня: {score}",
    bestKeptHint: "В рейтинге используется ваш лучший результат за сегодня.",
    scoreAddedHint: "Ваш результат добавлен в рейтинг удачи.",
    leaderboardTitle: "Рейтинг удачи",
    today: "Сегодня",
    week: "Неделя",
    month: "Месяц",
    allTime: "Все время",
    threeMonths: "3 месяца",
    showMore: "Показать еще",
    nextChancePrefix: "Следующий шанс через:",
    adTitle: "Откройте карту удачи",
    adDescription: "Посмотрите короткий спонсорский ролик, чтобы открыть карту и добавить результат в рейтинг.",
    cancel: "Отмена",
    watchAd: "Смотреть",
    adRequired: "Карта не открыта. Необходимо досмотреть ролик.",
    cardReadyAccessibility: "Карту удачи можно открыть сегодня",
    cardScoreAccessibility: "Сегодняшний балл удачи: {score}"
  },
  uz: {
    screenTitle: "Omad kartasi",
    heroTitle: "Bugungi omadingiz sizni kutmoqda",
    heroDescription: "San'at tarixidan ilhomlangan kartani oching va kun syurprizini biling.",
    openButton: "Kartani och",
    openingButton: "Karta ochilmoqda",
    ready: "Kunlik kartangiz tayyor",
    nextCardIn: "Yangi karta imkonigacha",
    hours: "Soat",
    minutes: "Daqiqa",
    seconds: "Soniya",
    dailyCard: "Kunlik karta",
    todayScore: "Bugungi omad",
    todayMessage: "Bugungi izoh",
    scoreScale: "Kunlik ball",
    personalMessage: "Har bir karta sizga maxsus izoh olib keladi.",
    premiumSecondChance: "Premium · Ikkinchi imkoniyat",
    latestScore: "Oxirgi omad ballingiz",
    bestKept: "Bugungi eng yuqori ball saqlandi: {score}",
    bestKeptHint: "Reytingda bugungi eng yuqori ballingiz ishlatiladi.",
    scoreAddedHint: "Ballingiz omad reytingiga qo'shildi.",
    leaderboardTitle: "Omad reytingi",
    today: "Bugun",
    week: "Hafta",
    month: "Oy",
    allTime: "Barcha vaqt",
    threeMonths: "3 oy",
    showMore: "Ko'proq ko'rish",
    nextChancePrefix: "Keyingi imkoniyat:",
    adTitle: "Omad kartasini oching",
    adDescription: "Kartani ochish va ballni reytingga qo'shish uchun qisqa homiylik videosini tomosha qiling.",
    cancel: "Bekor qilish",
    watchAd: "Reklamani ko'rish",
    adRequired: "Karta ochilmadi. Reklamani oxirigacha ko'rish kerak.",
    cardReadyAccessibility: "Omad kartasini bugun ochish mumkin",
    cardScoreAccessibility: "Bugungi omad balli {score}"
  }
};

export function chanceCardCopy(language: Language) {
  return copy[language] ?? copy.en;
}

export const chanceCardBestKeptCopy = {
  tr: "Bugünkü yüksek puanın korundu: {score}",
  en: "Today's best was kept: {score}",
  ru: "Сохранен лучший результат дня: {score}",
  uz: "Bugungi eng yuqori ball saqlandi: {score}"
} satisfies Record<Language, string>;
