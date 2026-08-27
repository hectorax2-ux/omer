import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";
import type { LocalizedCopy } from "@/utils/localized-text";

type PremiumIcon = ComponentProps<typeof Ionicons>["name"];

export type PremiumQuickBenefit = {
  id: string;
  icon: PremiumIcon;
  title: LocalizedCopy;
  body: LocalizedCopy;
  tag: LocalizedCopy;
};

export type PremiumFeatureSection = {
  id: string;
  icon: PremiumIcon;
  eyebrow: LocalizedCopy;
  title: LocalizedCopy;
  description: LocalizedCopy;
  features: readonly LocalizedCopy[];
  highlight?: LocalizedCopy;
  note?: LocalizedCopy;
  comparison?: {
    standard: readonly LocalizedCopy[];
    premium: readonly LocalizedCopy[];
  };
};

export const premiumExperienceCopy = {
  pageTitle: { tr: "Premium", en: "Premium", ru: "Premium", uz: "Premium" },
  pageEyebrow: { tr: "Özel galeri", en: "Private gallery", ru: "Закрытая галерея", uz: "Maxsus galereya" },
  heroEyebrow: { tr: "ART ATLAS PREMIUM", en: "ART ATLAS PREMIUM", ru: "ART ATLAS PREMIUM", uz: "ART ATLAS PREMIUM" },
  heroTitle: {
    tr: "Sanatı daha özgür keşfet",
    en: "Explore art more freely",
    ru: "Открывайте искусство свободнее",
    uz: "San'atni yanada erkin kashf eting"
  },
  heroBody: {
    tr: "Art Atlas deneyimini reklamsız yaşa, daha özgür iletişim kur, koleksiyonunu büyüt ve oyunlarda daha fazla hak kazan.",
    en: "Enjoy Art Atlas without ads, communicate more freely, grow your collection, and unlock more play opportunities.",
    ru: "Пользуйтесь Art Atlas без рекламы, общайтесь свободнее, расширяйте коллекцию и получайте больше игровых возможностей.",
    uz: "Art Atlas'dan reklamasiz foydalaning, erkinroq muloqot qiling, kolleksiyangizni kengaytiring va o'yinlarda ko'proq imkoniyat oling."
  },
  heroPromise: {
    tr: "Tek üyelik. Tüm Premium ayrıcalıkları.",
    en: "One membership. Every Premium benefit.",
    ru: "Одна подписка. Все преимущества Premium.",
    uz: "Bitta a'zolik. Barcha Premium imtiyozlari."
  },
  upgrade: { tr: "Premium’a Geç", en: "Go Premium", ru: "Перейти на Premium", uz: "Premium'ga o'tish" },
  activeTitle: { tr: "Premium’un aktif", en: "Your Premium is active", ru: "Premium активен", uz: "Premium faol" },
  activeBody: {
    tr: "Tüm Premium ayrıcalıkların şu anda hesabında aktif.",
    en: "All Premium benefits are active on your account.",
    ru: "Все преимущества Premium сейчас активны в вашем аккаунте.",
    uz: "Barcha Premium imtiyozlari hozir hisobingizda faol."
  },
  activeBadge: { tr: "PREMIUM AKTİF", en: "PREMIUM ACTIVE", ru: "PREMIUM АКТИВЕН", uz: "PREMIUM FAOL" },
  activeUntil: {
    tr: "Premium üyeliğin {date} tarihine kadar aktif.",
    en: "Your Premium membership is active until {date}.",
    ru: "Ваша подписка Premium активна до {date}.",
    uz: "Premium a'zoligingiz {date} gacha faol."
  },
  quickTitle: {
    tr: "Premium ile neler değişiyor?",
    en: "What changes with Premium?",
    ru: "Что меняется с Premium?",
    uz: "Premium bilan nimalar o'zgaradi?"
  },
  quickEyebrow: { tr: "01 — PREMIUM", en: "01 — PREMIUM", ru: "01 — PREMIUM", uz: "01 — PREMIUM" },
  quickBody: {
    tr: "Art Atlas’ı daha özgür, daha sosyal ve daha kişisel kullan.",
    en: "Make Art Atlas freer, more social, and more personal.",
    ru: "Пользуйтесь Art Atlas свободнее, общайтесь больше и настройте опыт под себя.",
    uz: "Art Atlas'dan erkinroq, ijtimoiyroq va shaxsiyroq foydalaning."
  },
  plansEyebrow: { tr: "PREMIUM’A KATIL", en: "JOIN PREMIUM", ru: "ПРИСОЕДИНИТЬСЯ К PREMIUM", uz: "PREMIUM'GA QO'SHILING" },
  purchaseTitle: { tr: "Premium’a sahip ol", en: "Get Premium", ru: "Получите Premium", uz: "Premium'ga ega bo'ling" },
  purchaseBody: {
    tr: "Tüm ayrıcalıkları hemen açmak için sana uygun Premium planını seç.",
    en: "Choose the Premium plan that suits you and unlock every benefit.",
    ru: "Выберите подходящий план Premium и откройте все преимущества.",
    uz: "Barcha imtiyozlarni ochish uchun o'zingizga mos Premium rejasini tanlang."
  },
  plansTitle: { tr: "Sana uygun süreyi seç", en: "Choose the duration that suits you", ru: "Выберите подходящий срок", uz: "O'zingizga mos muddatni tanlang" },
  plansBody: {
    tr: "Hangi planı seçersen seç, tüm Premium ayrıcalıklarına sahip olursun.",
    en: "Whichever plan you choose, you receive every Premium benefit.",
    ru: "Какой бы план вы ни выбрали, все преимущества Premium будут доступны.",
    uz: "Qaysi rejani tanlamang, barcha Premium imtiyozlariga ega bo'lasiz."
  },
  numbersEyebrow: { tr: "SAYILARLA PREMIUM", en: "PREMIUM IN NUMBERS", ru: "PREMIUM В ЦИФРАХ", uz: "PREMIUM RAQAMLARDA" },
  numbersTitle: { tr: "Daha fazlasına yer aç", en: "Make room for more", ru: "Больше пространства для важного", uz: "Ko'proq imkoniyatga joy oching" },
  allBenefits: { tr: "Tüm 23 ayrıcalığı keşfet", en: "Explore all 23 benefits", ru: "Открыть все 23 преимущества", uz: "Barcha 23 imtiyozni ko'rish" },
  hideBenefits: { tr: "Ayrıntıları daralt", en: "Collapse details", ru: "Свернуть подробности", uz: "Tafsilotlarni yopish" },
  standard: { tr: "STANDART", en: "STANDARD", ru: "СТАНДАРТ", uz: "STANDART" },
  premium: { tr: "PREMIUM", en: "PREMIUM", ru: "PREMIUM", uz: "PREMIUM" },
  identityEyebrow: { tr: "PREMIUM KİMLİĞİN", en: "YOUR PREMIUM IDENTITY", ru: "ВАШ PREMIUM-СТАТУС", uz: "PREMIUM SHAXSIYATINGIZ" },
  identityTitle: { tr: "Art Atlas’ta kendini belli et", en: "Stand out across Art Atlas", ru: "Ваш статус заметен в Art Atlas", uz: "Art Atlas'da ajralib turing" },
  identityBody: {
    tr: "Premium kimliğin profilinden yorumlarına kadar Art Atlas topluluğunda sana eşlik eder.",
    en: "Your Premium identity follows you across the Art Atlas community, from your profile to your comments.",
    ru: "Premium-статус сопровождает вас во всём сообществе Art Atlas — от профиля до комментариев.",
    uz: "Premium shaxsiyatingiz profilingizdan izohlaringizgacha Art Atlas hamjamiyatida sizga hamroh bo'ladi."
  },
  finalTitle: { tr: "Art Atlas’ı daha fazlasıyla keşfet", en: "Discover more with Art Atlas", ru: "Откройте больше с Art Atlas", uz: "Art Atlas bilan ko'proq kashf eting" },
  finalBody: {
    tr: "Reklamsız keşiften 100 eserlik kişisel müzene, daha fazla oyun hakkından gelişmiş sosyal özelliklere kadar tüm Premium ayrıcalıklarını tek üyelikle aç.",
    en: "Unlock ad-free discovery, a 100-work personal museum, more play opportunities, and richer social features with one membership.",
    ru: "Одна подписка открывает просмотр без рекламы, личный музей на 100 работ, больше игр и расширенные социальные функции.",
    uz: "Bitta a'zolik bilan reklamasiz kashfiyot, 100 asarlik shaxsiy muzey, ko'proq o'yin va rivojlangan ijtimoiy imkoniyatlarni oching."
  },
  sameBenefits: {
    tr: "Tüm Premium planlar aynı ayrıcalıkları içerir.",
    en: "All Premium plans include the same benefits.",
    ru: "Все планы Premium включают одинаковые преимущества.",
    uz: "Barcha Premium rejalar bir xil imtiyozlarni o'z ichiga oladi."
  }
} satisfies Record<string, LocalizedCopy>;

export const premiumQuickBenefits: readonly PremiumQuickBenefit[] = [
  {
    id: "ad-free",
    icon: "eye-off-outline",
    title: { tr: "Reklamsız Art Atlas", en: "Ad-free Art Atlas", ru: "Art Atlas без рекламы", uz: "Reklamasiz Art Atlas" },
    body: { tr: "Sanata odaklan; uygun reklam geçişleri aradan çekilsin.", en: "Focus on art while eligible ad steps move out of the way.", ru: "Сосредоточьтесь на искусстве — без лишних рекламных шагов.", uz: "San'atga e'tibor qarating, mos reklama bosqichlari yo'qolsin." },
    tag: { tr: "Reklamsız deneyim", en: "Ad-free experience", ru: "Без рекламы", uz: "Reklamasiz tajriba" }
  },
  {
    id: "messaging",
    icon: "chatbubbles-outline",
    title: { tr: "Daha özgür mesajlaşma", en: "Freer messaging", ru: "Больше свободы в общении", uz: "Erkinroq xabar almashish" },
    body: { tr: "Daha uzun mesajlar yaz, daha fazla sohbet sabitle ve doğrudan sohbet başlat.", en: "Write longer messages, pin more chats, and start conversations directly.", ru: "Пишите длиннее, закрепляйте больше чатов и начинайте диалог напрямую.", uz: "Uzunroq xabar yozing, ko'proq suhbatni mahkamlang va bevosita suhbat boshlang." },
    tag: { tr: "3.000 karakter", en: "3,000 characters", ru: "3 000 знаков", uz: "3 000 belgi" }
  },
  {
    id: "museum",
    icon: "business-outline",
    title: { tr: "100 eserlik müzen", en: "Your 100-work museum", ru: "Ваш музей на 100 работ", uz: "100 asarlik muzeyingiz" },
    body: { tr: "Benim Müzem’de sevdiğin 100 eseri kişisel koleksiyonunda buluştur.", en: "Bring 100 works you love together in My Museum.", ru: "Соберите 100 любимых работ в личном музее.", uz: "Benim Müzem'da sevimli 100 asarni shaxsiy kolleksiyangizga jamlang." },
    tag: { tr: "100 eser", en: "100 works", ru: "100 работ", uz: "100 asar" }
  },
  {
    id: "chance",
    icon: "sparkles-outline",
    title: { tr: "Günün ikinci şansı", en: "A second chance each day", ru: "Второй шанс дня", uz: "Kunning ikkinchi imkoniyati" },
    body: { tr: "Her gün 2 Şans Kartı aç; günün yüksek puanını koru.", en: "Open 2 Chance Cards daily while keeping your highest score.", ru: "Открывайте 2 карты удачи в день, сохраняя лучший результат.", uz: "Har kuni 2 Omad kartini oching va eng yuqori ballni saqlang." },
    tag: { tr: "2 kart / gün", en: "2 cards / day", ru: "2 карты / день", uz: "2 karta / kun" }
  },
  {
    id: "timeline",
    icon: "hourglass-outline",
    title: { tr: "Daha fazla oyun hakkı", en: "More play opportunities", ru: "Больше игровых попыток", uz: "Ko'proq o'yin imkoniyati" },
    body: { tr: "Eser ve Sanatçı Zaman Çizgisi’nde ayrı ayrı günde 5 puanlı tur oyna.", en: "Play 5 scored rounds daily in each Artwork and Artist Timeline.", ru: "Играйте по 5 рейтинговых раундов в день в каждой временной линии.", uz: "Asar va Rassom vaqt chizig'ida alohida 5 tadan balli tur o'ynang." },
    tag: { tr: "5 + 5 puanlı tur", en: "5 + 5 scored rounds", ru: "5 + 5 раундов", uz: "5 + 5 balli tur" }
  },
  {
    id: "visitors",
    icon: "eye-outline",
    title: { tr: "Profil Ziyaretleri", en: "Profile Visits", ru: "Посещения профиля", uz: "Profil tashriflari" },
    body: { tr: "Yalnızca Premium ile son 7 gündeki ziyaretçilerini, zamanlarını ve tekrar ziyaretlerini görüntüle.", en: "Exclusively with Premium, see visitors from the last 7 days, visit times, and returning visits.", ru: "Только с Premium: посетители за 7 дней, время и повторные визиты.", uz: "Faqat Premium bilan so'nggi 7 kundagi tashrifchilar, vaqt va qayta tashriflarni ko'ring." },
    tag: { tr: "Yalnızca Premium", en: "Premium exclusive", ru: "Только Premium", uz: "Faqat Premium" }
  }
] as const;

export const premiumNumberStats = [
  { value: "100", label: { tr: "Müzendeki eser", en: "Works in your museum", ru: "Работ в музее", uz: "Muzeydagi asar" } },
  { value: "3.000", label: { tr: "Mesaj karakteri", en: "Message characters", ru: "Знаков в сообщении", uz: "Xabar belgisi" } },
  { value: "10", label: { tr: "Sabit sohbet", en: "Pinned chats", ru: "Закреплённых чатов", uz: "Mahkamlangan suhbat" } },
  { value: "2", label: { tr: "Günlük Şans Kartı", en: "Daily Chance Cards", ru: "Карты удачи в день", uz: "Kunlik Omad karti" } },
  { value: "5 + 5", label: { tr: "Timeline turu", en: "Timeline rounds", ru: "Раундов Timeline", uz: "Timeline turi" } },
  { value: "5", label: { tr: "Haftalık Super Like", en: "Weekly Super Likes", ru: "Super Like в неделю", uz: "Haftalik Super Like" } }
] as const;

export const premiumFeatureSections: readonly PremiumFeatureSection[] = [
  {
    id: "ad-free",
    icon: "eye-off-outline",
    eyebrow: { tr: "KESİNTİSİZ KEŞİF", en: "UNINTERRUPTED DISCOVERY", ru: "НЕПРЕРЫВНОЕ ОТКРЫТИЕ", uz: "UZLUKSIZ KASHFIYOT" },
    title: { tr: "Sanatın önüne hiçbir şey geçmesin", en: "Let nothing stand between you and art", ru: "Ничто не должно отвлекать от искусства", uz: "San'at yo'lingizni hech narsa to'smasin" },
    description: { tr: "Art Atlas’ı reklamsız kullan ve keşfine kesintisiz devam et.", en: "Use Art Atlas without ads and keep exploring without interruption.", ru: "Пользуйтесь Art Atlas без рекламы и продолжайте исследовать без пауз.", uz: "Art Atlas'dan reklamasiz foydalaning va kashfiyotni uzluksiz davom ettiring." },
    features: [
      { tr: "Uygulama genelinde reklamsız deneyim", en: "An ad-free experience throughout the app", ru: "Без рекламы во всём приложении", uz: "Ilova bo'ylab reklamasiz tajriba" },
      { tr: "Banner ve geçiş reklamları olmadan kullanım", en: "No banner or interstitial ads", ru: "Без баннеров и межстраничной рекламы", uz: "Banner va o'tish reklamalarisiz foydalanish" },
      { tr: "Uygun ödüllü reklam adımlarını beklemeden geçme", en: "Skip eligible rewarded-ad steps without waiting", ru: "Пропуск подходящих шагов с рекламой за награду", uz: "Mos mukofotli reklama bosqichlarini kutmasdan o'tish" }
    ],
    highlight: { tr: "Daha az bekle. Daha çok keşfet.", en: "Wait less. Discover more.", ru: "Меньше ожидания. Больше открытий.", uz: "Kamroq kuting. Ko'proq kashf eting." }
  },
  {
    id: "messaging",
    icon: "mail-open-outline",
    eyebrow: { tr: "PREMIUM MESAJLAŞMA", en: "PREMIUM MESSAGING", ru: "PREMIUM-ОБЩЕНИЕ", uz: "PREMIUM XABARLASHUV" },
    title: { tr: "Sohbetlerine daha fazla alan aç", en: "Give your conversations more room", ru: "Больше пространства для общения", uz: "Suhbatlaringizga ko'proq joy bering" },
    description: { tr: "Sanat üzerine konuşurken karakterlere ve küçük sınırlara takılma.", en: "Talk about art without running into short character limits.", ru: "Обсуждайте искусство, не упираясь в короткие лимиты.", uz: "San'at haqida gaplashganda kichik cheklovlarga duch kelmang." },
    features: [
      { tr: "Varsayılan Premium ayarında günlük mesaj ve yeni sohbet sınırı yok", en: "No daily message or new-chat cap in the default Premium setting", ru: "В стандартной настройке Premium нет дневного лимита сообщений и новых чатов", uz: "Standart Premium sozlamasida kunlik xabar va yangi suhbat limiti yo'q" },
      { tr: "Mesaj başına 3.000 karakter ve 10 sabit sohbet", en: "3,000 characters per message and 10 pinned chats", ru: "3 000 знаков в сообщении и 10 закреплённых чатов", uz: "Har xabarda 3 000 belgi va 10 mahkamlangan suhbat" },
      { tr: "Takipleşmeden doğrudan sohbet başlatma", en: "Start a direct chat without a follow connection", ru: "Начинайте диалог без взаимной подписки", uz: "O'zaro kuzatishsiz bevosita suhbat boshlash" },
      { tr: "Mesajların okundu bilgisini görme", en: "See when your messages are read", ru: "Просматривайте статус прочтения", uz: "Xabar o'qilganini ko'rish" }
    ],
    comparison: {
      standard: [
        { tr: "100 mesaj / gün", en: "100 messages / day", ru: "100 сообщений / день", uz: "100 xabar / kun" },
        { tr: "10 yeni sohbet / gün", en: "10 new chats / day", ru: "10 новых чатов / день", uz: "10 yangi suhbat / kun" },
        { tr: "750 karakter · 1 sabit sohbet", en: "750 characters · 1 pinned chat", ru: "750 знаков · 1 закреплённый чат", uz: "750 belgi · 1 mahkamlangan suhbat" }
      ],
      premium: [
        { tr: "Varsayılan günlük limit yok", en: "No default daily cap", ru: "Без стандартного дневного лимита", uz: "Standart kunlik limit yo'q" },
        { tr: "3.000 karakter · 10 sabit sohbet", en: "3,000 characters · 10 pinned chats", ru: "3 000 знаков · 10 закреплённых чатов", uz: "3 000 belgi · 10 mahkamlangan suhbat" }
      ]
    },
    note: { tr: "Topluluğu koruyan spam ve güvenlik kuralları tüm üyeler için geçerlidir.", en: "Spam and safety rules that protect the community apply to every member.", ru: "Правила защиты от спама и безопасности действуют для всех участников.", uz: "Hamjamiyatni himoya qiluvchi spam va xavfsizlik qoidalari barcha a'zolarga tegishli." }
  },
  {
    id: "community",
    icon: "people-outline",
    eyebrow: { tr: "DAHA FAZLA ETKİLEŞİM", en: "MORE INTERACTION", ru: "БОЛЬШЕ ОБЩЕНИЯ", uz: "KO'PROQ MULOQOT" },
    title: { tr: "Sadece keşfetme, sohbete katıl", en: "Do more than discover—join the conversation", ru: "Не только смотрите — участвуйте в обсуждении", uz: "Faqat kashf etmang, suhbatga qo'shiling" },
    description: { tr: "Premium ile Art Atlas topluluğunda düşüncelerini daha özgür paylaş.", en: "Share your thoughts more freely in the Art Atlas community.", ru: "Делитесь мыслями свободнее в сообществе Art Atlas.", uz: "Art Atlas hamjamiyatida fikrlaringizni erkinroq baham ko'ring." },
    features: [
      { tr: "Keşfet gönderilerine, Resim Yarışması eserlerine ve profil vitrinlerine yorum yap", en: "Comment on Discover posts, Painting Contest entries, and profile showcases", ru: "Комментируйте публикации, конкурсные работы и витрины профилей", uz: "Keşfet postlari, Rasm tanlovi va profil vitrinalariga izoh yozing" },
      { tr: "Keşfet paylaşımındaki standart bekleme ve paylaşım kotasını aş", en: "Move beyond standard Discover posting cooldowns and quotas", ru: "Публикуйте в Discover без стандартных пауз и квот", uz: "Keşfetdagi standart kutish va ulashish kvotasidan o'ting" },
      { tr: "Premium kimliğinle toplulukta görün", en: "Be recognized by your Premium identity", ru: "Показывайте свой Premium-статус", uz: "Premium shaxsiyatingiz bilan ko'rining" }
    ]
  },
  {
    id: "creation",
    icon: "create-outline",
    eyebrow: { tr: "KENDİ KALEMİNDEN", en: "IN YOUR OWN WORDS", ru: "ВАШИМИ СЛОВАМИ", uz: "O'Z QALAMINGIZDAN" },
    title: { tr: "Sanat üzerine sen de yaz", en: "Add your voice to art", ru: "Пишите об искусстве сами", uz: "San'at haqida siz ham yozing" },
    description: { tr: "Bir eser, sanatçı veya sanat tarihi üzerine düşüncelerini kaleme al ve Art Atlas’a gönder.", en: "Write about a work, artist, or art history and submit it to Art Atlas.", ru: "Напишите о произведении, художнике или истории искусства и отправьте текст в Art Atlas.", uz: "Asar, rassom yoki san'at tarixi haqidagi fikrlaringizni yozib, Art Atlas'ga yuboring." },
    features: [
      { tr: "5.000 karaktere kadar kendi sanat yazını hazırla", en: "Create your own art writing up to 5,000 characters", ru: "Создайте авторский текст объёмом до 5 000 знаков", uz: "5 000 belgigacha o'z san'at yozuvingizni tayyorlang" },
      { tr: "Görselin ve başlığınla yayın incelemesine gönder", en: "Add an image and title, then submit it for editorial review", ru: "Добавьте изображение и заголовок и отправьте на редакционную проверку", uz: "Rasm va sarlavha bilan nashr ko'rigiga yuboring" },
      { tr: "Günde 1 kez seçtiğin sanatçıya kendi mektubunu bırak", en: "Leave one letter each day for an artist you choose", ru: "Раз в день оставляйте письмо выбранному художнику", uz: "Har kuni tanlagan rassomingizga bitta maktub qoldiring" }
    ],
    highlight: { tr: "Okuyan olmanın ötesine geç. Kendi yorumunu bırak.", en: "Go beyond reading. Leave your own interpretation.", ru: "Не только читайте — оставьте собственный взгляд.", uz: "Faqat o'qib qolmang. O'z talqiningizni qoldiring." }
  },
  {
    id: "museum-visits",
    icon: "business-outline",
    eyebrow: { tr: "KİŞİSEL GALERİN", en: "YOUR PERSONAL GALLERY", ru: "ВАША ЛИЧНАЯ ГАЛЕРЕЯ", uz: "SHAXSIY GALEREYANGIZ" },
    title: { tr: "Koleksiyonunu büyüt, ziyaretçilerini tanı", en: "Grow your collection and know your visitors", ru: "Расширяйте коллекцию и узнавайте посетителей", uz: "Kolleksiyangizni kengaytiring, tashrifchilarni biling" },
    description: { tr: "Kendi dijital müzeni büyüt ve yalnızca Premium’a açık Profil Ziyaretleri ile galerine gösterilen ilgiyi keşfet.", en: "Expand your digital museum and understand its audience with Premium-exclusive Profile Visits.", ru: "Расширяйте цифровой музей и изучайте его аудиторию в разделе посещений, доступном только с Premium.", uz: "Raqamli muzeyingizni kengaytiring va faqat Premium uchun Profil tashriflari orqali qiziqishni kuzating." },
    features: [
      { tr: "Benim Müzem’de 8 yerine 100 eser biriktir", en: "Collect 100 works in My Museum instead of 8", ru: "Храните в личном музее 100 работ вместо 8", uz: "Benim Müzem'da 8 o'rniga 100 asar jamlang" },
      { tr: "Müzeni sildikten sonra aynı hafta beklemeden yeniden oluştur", en: "Recreate your museum in the same week after deleting it", ru: "Создавайте музей заново в ту же неделю после удаления", uz: "Muzeyni o'chirgach, shu haftaning o'zida kutmasdan qayta yarating" },
      { tr: "Yalnızca Premium’a açık Profil Ziyaretleri’nde son 7 günü, ziyaret zamanlarını ve tekrar ziyaret sayılarını gör", en: "Use Premium-exclusive Profile Visits to see 7-day visitors, visit times, and return counts", ru: "В Premium-разделе посещений смотрите данные за 7 дней, время и число повторных визитов", uz: "Faqat Premium Profil tashriflarida 7 kunlik tashrifchilar, vaqt va qayta tashriflar sonini ko'ring" }
    ],
    highlight: { tr: "8 eserden 100 esere.", en: "From 8 works to 100.", ru: "От 8 работ к 100.", uz: "8 asardan 100 asargacha." },
    note: { tr: "Gizli ziyaretçiler anonim kalmaya devam eder.", en: "Private visitors remain anonymous.", ru: "Скрытые посетители остаются анонимными.", uz: "Yashirin tashrifchilar anonim bo'lib qoladi." }
  },
  {
    id: "games",
    icon: "trophy-outline",
    eyebrow: { tr: "OYUNLAR VE ŞANS", en: "GAMES AND CHANCE", ru: "ИГРЫ И УДАЧА", uz: "O'YINLAR VA OMAD" },
    title: { tr: "Sanat tarihindeki yerini göster", en: "Show where you stand in art history", ru: "Покажите свои знания истории искусства", uz: "San'at tarixidagi o'rningizni ko'rsating" },
    description: { tr: "Daha fazla puanlı tur oyna, ikinci şansını dene ve sonuçlarını reklamsız kaydet.", en: "Play more scored rounds, take a second chance, and record results without ads.", ru: "Играйте больше рейтинговых раундов, используйте второй шанс и сохраняйте результат без рекламы.", uz: "Ko'proq balli tur o'ynang, ikkinchi imkoniyatni sinang va natijani reklamasiz saqlang." },
    features: [
      { tr: "Her gün 2 Şans Kartı aç; daha düşük ikinci sonuçta yüksek puanını koru", en: "Open 2 Chance Cards daily and keep the higher score", ru: "Открывайте 2 карты удачи и сохраняйте лучший результат", uz: "Har kuni 2 Omad kartini oching va yuqori natijani saqlang" },
      { tr: "Eser ve Sanatçı Zaman Çizgisi’nde ayrı ayrı 5 puanlı tur oyna", en: "Play 5 scored rounds in each Artwork and Artist Timeline", ru: "Играйте по 5 рейтинговых раундов в обеих временных линиях", uz: "Asar va Rassom vaqt chizig'ida alohida 5 tadan balli tur o'ynang" },
      { tr: "Haftalık Quiz ve Sanat Dedektifi puanlı turuna reklamsız katıl; puanın otomatik kaydedilsin", en: "Enter scored Weekly Quiz and Art Detective rounds without ads and save scores automatically", ru: "Проходите рейтинговые туры Quiz и Art Detective без рекламы с автосохранением результата", uz: "Haftalik Quiz va San'at Detektivi balli turiga reklamasiz kiring, ball avtomatik yozilsin" },
      { tr: "Normal Düello’daki oyunu toplam 1 kez değiştir", en: "Change a confirmed Normal Duel vote once", ru: "Один раз измените подтверждённый голос в обычной дуэли", uz: "Oddiy duelda tasdiqlangan ovozni bir marta o'zgartiring" },
      { tr: "Kehanet tahminini ilk 48 saatte 2 saatlik aralıklarla güncelle", en: "Update a Prophecy prediction every 2 hours during the first 48 hours", ru: "Обновляйте прогноз каждые 2 часа в первые 48 часов", uz: "Bashoratni dastlabki 48 soatda har 2 soatda yangilang" }
    ],
    highlight: { tr: "İki Timeline oyununda toplam 10 puanlı tura kadar.", en: "Up to 10 scored rounds across both Timeline games.", ru: "До 10 рейтинговых раундов в двух играх Timeline.", uz: "Ikki Timeline o'yinida jami 10 tagacha balli tur." }
  },
  {
    id: "competitions",
    icon: "flash-outline",
    eyebrow: { tr: "YARIŞMALAR", en: "COMPETITIONS", ru: "КОНКУРСЫ", uz: "TANLOVLAR" },
    title: { tr: "Eserine biraz daha görünürlük kazandır", en: "Give your work more visibility", ru: "Помогите своей работе стать заметнее", uz: "Asaringizga ko'proq ko'rinish bering" },
    description: { tr: "Yarışmadaki eserinin görünürlüğünü destekleyen Premium araçlardan yararlan.", en: "Use Premium tools that support the visibility of your competition entry.", ru: "Используйте Premium-инструменты для поддержки видимости конкурсной работы.", uz: "Tanlovdagi asaringiz ko'rinishini qo'llovchi Premium vositalardan foydalaning." },
    features: [
      { tr: "Haftada 5 Super Like ile seçtiğin eserlere daha güçlü destek bırak", en: "Give stronger support with 5 Super Likes each week", ru: "Поддерживайте работы 5 Super Like в неделю", uz: "Haftasiga 5 Super Like bilan asarlarni kuchliroq qo'llang" },
      { tr: "30 dakikalık bekleme korunarak ödüllü reklam izlemeden manuel boost kullan", en: "Use manual boost without a rewarded ad while keeping the 30-minute cooldown", ru: "Используйте ручной boost без рекламы при сохранении паузы 30 минут", uz: "30 daqiqalik kutish saqlangan holda reklamasiz qo'lda boost ishlating" },
      { tr: "Yarışma eserin yaklaşık her 4 saatte bir otomatik görünürlük desteği alsın", en: "Receive automatic visibility support roughly every 4 hours", ru: "Получайте автоматическую поддержку видимости примерно каждые 4 часа", uz: "Tanlov asaringiz taxminan har 4 soatda avtomatik ko'rinish yordamini olsin" }
    ],
    highlight: { tr: "Sen yarışmaya odaklan, Premium görünürlüğünü desteklesin.", en: "Focus on the competition while Premium supports visibility.", ru: "Сосредоточьтесь на конкурсе — Premium поддержит видимость.", uz: "Siz tanlovga e'tibor qarating, Premium ko'rinishni qo'llasin." }
  },
  {
    id: "identity",
    icon: "diamond-outline",
    eyebrow: { tr: "PREMIUM KİMLİĞİN", en: "YOUR PREMIUM IDENTITY", ru: "ВАШ PREMIUM-СТАТУС", uz: "PREMIUM SHAXSIYATINGIZ" },
    title: { tr: "Art Atlas’ta kendini belli et", en: "Stand out across Art Atlas", ru: "Ваш статус заметен в Art Atlas", uz: "Art Atlas'da ajralib turing" },
    description: { tr: "Premium kimliğin yalnızca üyelik sayfasında değil, topluluğun tamamında sana eşlik eder.", en: "Your Premium identity appears not only here, but throughout the community.", ru: "Ваш Premium-статус виден не только здесь, но и во всём сообществе.", uz: "Premium shaxsiyatingiz faqat bu sahifada emas, butun hamjamiyatda siz bilan." },
    features: [
      { tr: "Premium elmas rozeti ve profil çerçevesi", en: "Premium diamond badge and profile frame", ru: "Premium-бриллиант и рамка профиля", uz: "Premium olmos nishoni va profil ramkasi" },
      { tr: "Profil Keşfet’te ve Premium gönderilerde özel kimlik", en: "Premium identity in Profile Discover and Premium posts", ru: "Особый статус в поиске профилей и Premium-публикациях", uz: "Profil Keşfet va Premium postlarda maxsus shaxsiyat" },
      { tr: "Yorum, mesaj, beğeni ve katkı alanlarında Premium vurgusu", en: "Premium recognition in comments, messages, likes, and contributor areas", ru: "Premium-отметка в комментариях, сообщениях, лайках и списках участников", uz: "Izoh, xabar, yoqtirish va hissa maydonlarida Premium belgisi" }
    ],
    highlight: { tr: "Premium kimliğin profilinden yorumlarına kadar seninle.", en: "Your Premium identity stays with you from profile to comments.", ru: "Premium-статус с вами — от профиля до комментариев.", uz: "Premium shaxsiyatingiz profilingizdan izohlaringizgacha siz bilan." }
  }
] as const;
