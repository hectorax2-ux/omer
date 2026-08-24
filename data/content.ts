import { AppNotification, ArtEvent, Artist, Artwork, ArtStory, CountryCommunity, Language, LocalizedText, Museum, QuizQuestion } from "@/types/content";

export const languages: { code: Language; label: string; nativeName: string }[] = [
  { code: "tr", label: "TR", nativeName: "Türkçe" },
  { code: "en", label: "EN", nativeName: "English" },
  { code: "ru", label: "RU", nativeName: "Русский" },
  { code: "uz", label: "UZ", nativeName: "O'zbekcha" }
];

export const copy = {
  appTagline: {
    tr: "Sadece Sanat",
    en: "Only Art",
    ru: "Только искусство",
    uz: "Faqat san'at"
  },
  chooseLanguage: {
    tr: "Dilini seç",
    en: "Choose your language",
    ru: "Выберите язык",
    uz: "Tilni tanlang"
  },
  begin: {
    tr: "Başla",
    en: "Begin",
    ru: "Начать",
    uz: "Boshlash"
  },
  featured: {
    tr: "Öne çıkan koleksiyon",
    en: "Featured collection",
    ru: "Избранная коллекция",
    uz: "Tanlangan kolleksiya"
  },
  gallery: {
    tr: "Eserler",
    en: "Artworks",
    ru: "Произведения",
    uz: "Asarlar"
  },
  quiz: {
    tr: "Quiz",
    en: "Quiz",
    ru: "Викторина",
    uz: "Viktorina"
  },
  events: {
    tr: "Kitaplar ve Filmler",
    en: "Books and Films",
    ru: "Книги и фильмы",
    uz: "Kitoblar va filmlar"
  },
  game: {
    tr: "Oyun",
    en: "Game",
    ru: "Игра",
    uz: "O'yin"
  },
  ranking: {
    tr: "Sıralamalar",
    en: "Ranking",
    ru: "Рейтинг",
    uz: "Reyting"
  },
  correct: {
    tr: "Doğru",
    en: "Correct",
    ru: "Верно",
    uz: "To'g'ri"
  },
  wrong: {
    tr: "Tekrar dene",
    en: "Try again",
    ru: "Попробуйте еще раз",
    uz: "Qayta urinib ko'ring"
  },
  next: {
    tr: "Sonraki soru",
    en: "Next question",
    ru: "Следующий вопрос",
    uz: "Keyingi savol"
  },
  adSlot: {
    tr: "Sponsorlu içerik",
    en: "Sponsored content",
    ru: "Рекламный контент",
    uz: "Homiy kontent"
  },
  readMore: {
    tr: "Detayı aç",
    en: "Open detail",
    ru: "Открыть детали",
    uz: "Batafsil ochish"
  },
  dailyQuiz: {
    tr: "Haftalık sanat yarışması",
    en: "Daily art challenge",
    ru: "Ежедневный арт-челлендж",
    uz: "Kunlik san'at bellashuvi"
  },
  points: {
    tr: "Puan",
    en: "Points",
    ru: "Очки",
    uz: "Ball"
  },
  finished: {
    tr: "Yarışma tamamlandı",
    en: "Challenge completed",
    ru: "Челлендж завершен",
    uz: "Bellashuv yakunlandi"
  },
  restart: {
    tr: "Yeniden başla",
    en: "Restart",
    ru: "Начать заново",
    uz: "Qayta boshlash"
  },
  account: {
    tr: "Üyelik",
    en: "Account",
    ru: "Аккаунт",
    uz: "Hisob"
  },
  recommendations: {
    tr: "Öneriler",
    en: "Picks",
    ru: "Подборка",
    uz: "Tavsiyalar"
  },
  profileInfo: {
    tr: "Hesap bilgileri",
    en: "Account details",
    ru: "Данные аккаунта",
    uz: "Hisob ma'lumotlari"
  },
  username: {
    tr: "Kullanıcı adı",
    en: "Username",
    ru: "Имя пользователя",
    uz: "Foydalanuvchi nomi"
  },
  password: {
    tr: "Şifre",
    en: "Password",
    ru: "Пароль",
    uz: "Parol"
  },
  email: {
    tr: "E-posta",
    en: "Email",
    ru: "Эл. почта",
    uz: "E-pochta"
  },
  phone: {
    tr: "Telefon",
    en: "Phone",
    ru: "Телефон",
    uz: "Telefon"
  },
  membershipType: {
    tr: "Üyelik türü",
    en: "Membership type",
    ru: "Тип подписки",
    uz: "A'zolik turi"
  },
  memberRole: {
    tr: "Kimlik",
    en: "Identity",
    ru: "Статус",
    uz: "Maqom"
  },
  save: {
    tr: "Kaydet",
    en: "Save",
    ru: "Сохранить",
    uz: "Saqlash"
  },
  alreadyJoined: {
    tr: "Bu haftaki yarışmaya katıldın. Aynı teste tekrar katılamazsın.",
    en: "You joined this week's challenge. You cannot enter the same test again.",
    ru: "Вы уже участвовали в челлендже этой недели. Повторно пройти этот тест нельзя.",
    uz: "Siz bu haftalik bellashuvda qatnashdingiz. Shu testga qayta kira olmaysiz."
  },
  buyPremium: {
    tr: "Premium üyelik satın al",
    en: "Buy premium membership",
    ru: "Купить премиум-подписку",
    uz: "Premium a'zolik sotib olish"
  },
  logout: {
    tr: "Çıkış yap",
    en: "Log out",
    ru: "Выйти",
    uz: "Chiqish"
  },
  rankingPremiumOnly: {
    tr: "Sıralamaları yalnızca premium üyeler görebilir.",
    en: "Rankings are visible only to premium members.",
    ru: "Рейтинг доступен только премиум-участникам.",
    uz: "Reyting faqat premium a'zolar uchun ochiq."
  },
  communityArt: {
    tr: "Resim Yarışması",
    en: "Painting Contest",
    ru: "Конкурс рисунков",
    uz: "Rasm tanlovi"
  },
  uploadArtwork: {
    tr: "Resim yükle",
    en: "Upload image",
    ru: "Загрузить рисунок",
    uz: "Rasm yuklash"
  },
  newArtworks: {
    tr: "Yeni resimler",
    en: "New artworks",
    ru: "Новые работы",
    uz: "Yangi rasmlar"
  },
  mostLiked: {
    tr: "Haftanın Sıralaması",
    en: "Weekly Ranking",
    ru: "Рейтинг недели",
    uz: "Hafta reytingi"
  },
  approvalQueue: {
    tr: "Onay bekleyenler",
    en: "Pending approval",
    ru: "На утверждении",
    uz: "Tasdiq kutmoqda"
  },
  previousWinners: {
    tr: "Önceki haftanın kazananları",
    en: "Previous week's winners",
    ru: "Победители прошлой недели",
    uz: "Oldingi hafta g'oliblari"
  }
} satisfies Record<string, LocalizedText>;

export const uiCopy = {
  filterAll: { tr: "Tümü", en: "All", ru: "Все", uz: "Barchasi" },
  discover: { tr: "Profil Keşfet", en: "Explore Profiles", ru: "Поиск профилей", uz: "Profil kashf etish" },
  discoverSubtitle: { tr: "Önerilen Profiller", en: "Suggested Profiles", ru: "Рекомендуемые профили", uz: "Tavsiya etilgan profillar" },
  feedDiscover: { tr: "Keşfet", en: "Discover", ru: "Лента", uz: "Kashf etish" },
  rewards: { tr: "Ödüller", en: "Awards", ru: "Награды", uz: "Mukofotlar" },
  artArticles: { tr: "Sanat Yazıları", en: "Art Essays", ru: "Тексты об искусстве", uz: "San'at yozuvlari" },
  museums: { tr: "Müzeler", en: "Museums", ru: "Музеи", uz: "Muzeylar" },
  games: { tr: "Oyunlar", en: "Games", ru: "Игры", uz: "O'yinlar" },
  inviteFriend: { tr: "Arkadaşını davet et", en: "Invite a friend", ru: "Пригласить друга", uz: "Do'stni taklif qilish" },
  about: { tr: "Hakkında", en: "About", ru: "О приложении", uz: "Haqida" },
  support: { tr: "Destek", en: "Support", ru: "Поддержка", uz: "Yordam" },
  settings: { tr: "Ayarlar", en: "Settings", ru: "Настройки", uz: "Sozlamalar" },
  lightDarkTheme: { tr: "Tema modu", en: "Theme mode", ru: "Режим темы", uz: "Mavzu rejimi" },
  dark: { tr: "Koyu", en: "Dark", ru: "Темная", uz: "Qorong'i" },
  light: { tr: "Açık", en: "Light", ru: "Светлая", uz: "Yorug'" },
  vanGogh: { tr: "Van Gogh modu", en: "Van Gogh mode", ru: "Режим Ван Гога", uz: "Van Gogh rejimi" },
  monet: { tr: "Claude Monet modu", en: "Claude Monet mode", ru: "Режим Клода Моне", uz: "Claude Monet rejimi" },
  dali: { tr: "Salvador Dalí modu", en: "Salvador Dalí mode", ru: "Режим Сальвадора Дали", uz: "Salvador Dali rejimi" },
  picasso: { tr: "Pablo Picasso modu", en: "Pablo Picasso mode", ru: "Режим Пабло Пикассо", uz: "Pablo Picasso rejimi" },
  changeLanguage: { tr: "Dil değiştir", en: "Change language", ru: "Изменить язык", uz: "Tilni o'zgartirish" },
  theme: { tr: "Tema", en: "Theme", ru: "Тема", uz: "Mavzu" },
  notificationPreferences: { tr: "Bildirim tercihleri", en: "Notification preferences", ru: "Настройки уведомлений", uz: "Bildirishnoma sozlamalari" },
  receiveNotifications: { tr: "Bildirimleri al", en: "Receive notifications", ru: "Получать уведомления", uz: "Bildirishnomalarni olish" },
  countryDiscovery: { tr: "Ülke keşfinde görün", en: "Show in country discovery", ru: "Показываться в странах", uz: "Davlatlar bo'limida ko'rinish" },
  countryDiscoveryTitle: { tr: "Ülke keşfi", en: "Country discovery", ru: "Поиск по странам", uz: "Davlatlar bo'yicha kashfiyot" },
  accountLegal: { tr: "Hesap ve yasal", en: "Account and legal", ru: "Аккаунт и правила", uz: "Hisob va huquqiy ma'lumotlar" },
  accountSettings: { tr: "Hesap ayarları", en: "Account settings", ru: "Настройки аккаунта", uz: "Hisob sozlamalari" },
  terms: { tr: "Kullanım şartları", en: "Terms of use", ru: "Условия использования", uz: "Foydalanish shartlari" },
  privacy: { tr: "Gizlilik politikası", en: "Privacy policy", ru: "Политика конфиденциальности", uz: "Maxfiylik siyosati" },
  permissions: { tr: "Kullanıcı izinleri", en: "User permissions", ru: "Разрешения пользователя", uz: "Foydalanuvchi ruxsatlari" },
  openInBrowser: { tr: "Web'de aç", en: "Open in browser", ru: "Открыть в браузере", uz: "Brauzerda ochish" },
  dataDeletion: { tr: "Veri silme", en: "Data deletion", ru: "Удаление данных", uz: "Ma'lumotlarni o'chirish" },
  legalDocuments: { tr: "Yasal belgeler", en: "Legal documents", ru: "Юридические документы", uz: "Huquqiy hujjatlar" },
  premiumComingSoon: { tr: "Mağaza satın alması yakında", en: "Store purchase coming soon", ru: "Покупка в магазине скоро", uz: "Do'kon xaridi tez orada" },
  myProfile: { tr: "Profilim", en: "My profile", ru: "Мой профиль", uz: "Mening profilim" },
  editProfile: { tr: "Profili düzenle", en: "Edit profile", ru: "Редактировать профиль", uz: "Profilni tahrirlash" },
  myImages: { tr: "Paylaştığım resimler", en: "My images", ru: "Мои изображения", uz: "Mening rasmlarim" },
  noApprovedImages: { tr: "Henüz paylaştığın görsel yok.", en: "You have not shared any visuals yet.", ru: "Вы пока не поделились изображениями.", uz: "Hali hech qanday vizual ulashmadingiz." },
  addProfileImage: { tr: "Profile görsel ekle", en: "Add profile image", ru: "Добавить изображение в профиль", uz: "Profilga rasm qo'shish" },
  profileImageNote: { tr: "Bu görsel yalnızca profilinde ve takip akışında görünür; haftalık yarışmaya katılmaz.", en: "This image appears only on your profile and following feed; it does not enter the weekly challenge.", ru: "Это изображение видно только в профиле и ленте подписок; оно не участвует в недельном конкурсе.", uz: "Bu rasm faqat profilingizda va kuzatuv oqimida ko'rinadi; haftalik tanlovga kirmaydi." },
  chooseProfileImage: { tr: "Görsel seç", en: "Choose image", ru: "Выбрать изображение", uz: "Rasm tanlash" },
  imageTitle: { tr: "Görsel başlığı", en: "Image title", ru: "Название изображения", uz: "Rasm nomi" },
  add: { tr: "Ekle", en: "Add", ru: "Добавить", uz: "Qo'shish" },
  appleContinue: { tr: "Apple ile devam et", en: "Continue with Apple", ru: "Продолжить с Apple", uz: "Apple bilan davom etish" },
  googleContinue: { tr: "Google ile devam et", en: "Continue with Google", ru: "Продолжить с Google", uz: "Google bilan davom etish" },
  loginRegister: { tr: "Giriş / Üye ol", en: "Login / Register", ru: "Вход / Регистрация", uz: "Kirish / Ro'yxatdan o'tish" },
  validCountry: { tr: "Lütfen doğru bir ülke adı girin.", en: "Please enter a valid country name.", ru: "Пожалуйста, введите правильное название страны.", uz: "Iltimos, to'g'ri davlat nomini kiriting." },
  backToProfile: { tr: "Profilime dön", en: "Back to profile", ru: "Вернуться в профиль", uz: "Profilga qaytish" },
  images: { tr: "Resimler", en: "Images", ru: "Изображения", uz: "Rasmlar" },
  fullName: { tr: "İsim soyisim", en: "Full name", ru: "Имя и фамилия", uz: "Ism familiya" },
  biography: { tr: "Biyografi", en: "Biography", ru: "Биография", uz: "Biografiya" },
  country: { tr: "Ülke", en: "Country", ru: "Страна", uz: "Davlat" },
  city: { tr: "Şehir", en: "City", ru: "Город", uz: "Shahar" },
  interests: { tr: "İlgi alanları", en: "Interests", ru: "Интересы", uz: "Qiziqishlar" },
  socialLinks: { tr: "Sosyal medya bağlantıları", en: "Social links", ru: "Социальные ссылки", uz: "Ijtimoiy havolalar" },
  secureAccess: { tr: "Güvenli giriş", en: "Secure access", ru: "Безопасный вход", uz: "Xavfsiz kirish" },
  artGoAccount: { tr: "Art Atlas üyeliği", en: "Art Atlas account", ru: "Аккаунт Art Atlas", uz: "Art Atlas hisobi" },
  guestAccessText: {
    tr: "Misafir olarak ana sayfa, etkinlikler ve eserleri gezebilirsin. Profil, quiz, oy verme ve yükleme için üyelik gerekir.",
    en: "Guests can browse home, events, and artworks. Profiles, quiz, voting, and uploads require an account.",
    ru: "Гости могут смотреть главную, события и произведения. Для профиля, квизов, голосования и загрузки нужна регистрация.",
    uz: "Mehmonlar bosh sahifa, tadbirlar va asarlarni ko'ra oladi. Profil, quiz, ovoz berish va yuklash uchun a'zolik kerak."
  },
  login: { tr: "Giriş", en: "Login", ru: "Вход", uz: "Kirish" },
  register: { tr: "Üye ol", en: "Register", ru: "Регистрация", uz: "Ro'yxatdan o'tish" },
  emailVerification: { tr: "E-posta onayı", en: "Email verification", ru: "Подтверждение e-mail", uz: "E-pochta tasdig'i" },
  verificationCode: { tr: "Onay kodu", en: "Verification code", ru: "Код подтверждения", uz: "Tasdiq kodi" },
  completeAccount: { tr: "Üyeliği tamamla", en: "Complete account", ru: "Завершить регистрацию", uz: "Hisobni yakunlash" },
  forgotPassword: { tr: "Şifremi unuttum", en: "Forgot password", ru: "Забыли пароль", uz: "Parolni unutdim" },
  recoverPassword: { tr: "Şifreyi hatırlat", en: "Recover password", ru: "Восстановить пароль", uz: "Parolni tiklash" },
  backToLogin: { tr: "Girişe dön", en: "Back to login", ru: "Вернуться ко входу", uz: "Kirishga qaytish" },
  memberLogin: { tr: "Üye girişi", en: "Member login", ru: "Вход участника", uz: "A'zo kirishi" },
  newAccount: { tr: "Yeni üyelik", en: "New account", ru: "Новый аккаунт", uz: "Yangi a'zolik" },
  acceptPolicy: {
    tr: "Kullanım Koşulları'nı (EULA) ve Gizlilik Politikası'nı okudum ve kabul ediyorum.",
    en: "I have read and accept the Terms of Use (EULA) and Privacy Policy.",
    ru: "Я прочитал(а) и принимаю Условия использования (EULA) и Политику конфиденциальности.",
    uz: "Foydalanish shartlari (EULA) va Maxfiylik siyosatini o'qidim hamda qabul qilaman."
  },
  policyRequired: {
    tr: "Devam etmek için Kullanım Koşulları'nı (EULA) ve Gizlilik Politikası'nı kabul edin.",
    en: "Accept the Terms of Use (EULA) and Privacy Policy to continue.",
    ru: "Чтобы продолжить, примите Условия использования (EULA) и Политику конфиденциальности.",
    uz: "Davom etish uchun Foydalanish shartlari (EULA) va Maxfiylik siyosatini qabul qiling."
  },
  readTerms: { tr: "Kullanım Koşulları (EULA)", en: "Terms of Use (EULA)", ru: "Условия использования (EULA)", uz: "Foydalanish shartlari (EULA)" },
  readPrivacy: { tr: "Gizlilik politikasını oku", en: "Read privacy policy", ru: "Читать политику", uz: "Maxfiylik siyosatini o'qish" },
  logIn: { tr: "Giriş yap", en: "Log in", ru: "Войти", uz: "Kirish" },
  sendCode: { tr: "Doğrulama gönder", en: "Send verification", ru: "Отправить подтверждение", uz: "Tasdiqlashni yuborish" },
  or: { tr: "veya", en: "or", ru: "или", uz: "yoki" }
} satisfies Record<string, LocalizedText>;

const imageBase = "https://images.unsplash.com";

export const communityArtworks: {
  id: string;
  language: Language;
  image: string;
  artistName: string;
  uploaderUsername?: string;
  title: string;
  story: string;
  age: string;
  likes: number;
  dislikes: number;
  approved: boolean;
  approvedAt?: number;
}[] = [
  {
    id: "approved-1",
    language: "tr",
    image: `${imageBase}/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=900&q=80`,
    artistName: "Aylin Demir",
    uploaderUsername: "aylin.demir",
    title: "Sessiz Salon",
    story: "Müze sessizliğinden esinlenen dijital çalışma.",
    age: "24",
    likes: 42,
    dislikes: 3,
    approved: true
  },
  {
    id: "approved-2",
    language: "tr",
    image: `${imageBase}/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=80`,
    artistName: "Mert Kaya",
    uploaderUsername: "mert.kaya",
    title: "Altın Işık",
    story: "Klasik portre ışığını modern renkle birleştiren deneme.",
    age: "31",
    likes: 31,
    dislikes: 5,
    approved: true
  },
  {
    id: "approved-3",
    language: "tr",
    image: `${imageBase}/photo-1578926375605-eaf7559b1458?auto=format&fit=crop&w=900&q=80`,
    artistName: "Aylin Demir",
    uploaderUsername: "aylin.demir",
    title: "Kırmızı Koridor",
    story: "Modern müze duvarlarında renk ve sessizlik arayışı.",
    age: "24",
    likes: 28,
    dislikes: 2,
    approved: true
  },
  {
    id: "approved-4",
    language: "en",
    image: `${imageBase}/photo-1552083974-186346191183?auto=format&fit=crop&w=900&q=80`,
    artistName: "Zeynep Arslan",
    uploaderUsername: "zeynep.arslan",
    title: "Mavi Katman",
    story: "Soyut renk alanlarıyla derinlik denemesi.",
    age: "27",
    likes: 24,
    dislikes: 4,
    approved: true
  },
  {
    id: "approved-5",
    language: "uz",
    image: `${imageBase}/photo-1549490349-8643362247b5?auto=format&fit=crop&w=900&q=80`,
    artistName: "Timur Yıldız",
    uploaderUsername: "timur.yildiz",
    title: "Taş ve Işık",
    story: "Klasik mimariden esinlenen atmosfer çalışması.",
    age: "35",
    likes: 35,
    dislikes: 6,
    approved: true
  },
  {
    id: "approved-6",
    language: "uz",
    image: `${imageBase}/photo-1578301978693-85fa9c0320b9?auto=format&fit=crop&w=900&q=80`,
    artistName: "Madina Karim",
    uploaderUsername: "madina.karim",
    title: "Altın Fırça",
    story: "Figür ve altın tonlar arasında zarif bir kompozisyon.",
    age: "22",
    likes: 22,
    dislikes: 1,
    approved: true
  },
  {
    id: "approved-7",
    language: "tr",
    image: `${imageBase}/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=900&q=80`,
    artistName: "Efe Sönmez",
    uploaderUsername: "efe.sonmez",
    title: "Kesik Form",
    story: "Parçalı yüzeylerle hareket hissi veren çalışma.",
    age: "29",
    likes: 19,
    dislikes: 3,
    approved: true
  },
  {
    id: "approved-8",
    language: "ru",
    image: `${imageBase}/photo-1536924940846-227afb31e2a5?auto=format&fit=crop&w=900&q=80`,
    artistName: "Daria Volkova",
    uploaderUsername: "daria.volkova",
    title: "Sessiz Vadi",
    story: "Doğa, gölge ve renk geçişlerini birleştiren manzara.",
    age: "26",
    likes: 27,
    dislikes: 2,
    approved: true
  },
  {
    id: "approved-9",
    language: "uz",
    image: `${imageBase}/photo-1547826039-bfc35e0f1ea8?auto=format&fit=crop&w=900&q=80`,
    artistName: "Aziz Rahim",
    uploaderUsername: "aziz.rahim",
    title: "Kırık Portre",
    story: "Portre geleneğine modern bir yüzey yorumu.",
    age: "33",
    likes: 33,
    dislikes: 7,
    approved: true
  },
  {
    id: "approved-10",
    language: "tr",
    image: `${imageBase}/photo-1579762715118-a6f1d4b934f1?auto=format&fit=crop&w=900&q=80`,
    artistName: "Elif Moran",
    uploaderUsername: "elif.moran",
    title: "Gece Atölyesi",
    story: "Atölye ışığında üretilmiş dingin bir renk etüdü.",
    age: "21",
    likes: 21,
    dislikes: 4,
    approved: true
  }
];

export const weeklyWinnerArchive = [
  {
    id: "week-1",
    title: { tr: "1. Hafta", en: "Week 1", ru: "1 неделя", uz: "1-hafta" },
    winners: communityArtworks.slice(0, 2)
  },
  {
    id: "week-2",
    title: { tr: "2. Hafta", en: "Week 2", ru: "2 неделя", uz: "2-hafta" },
    winners: communityArtworks.slice(0, 1)
  },
  {
    id: "week-3",
    title: { tr: "3. Hafta", en: "Week 3", ru: "3 неделя", uz: "3-hafta" },
    winners: communityArtworks.slice(1, 2)
  },
  {
    id: "week-4",
    title: { tr: "4. Hafta", en: "Week 4", ru: "4 неделя", uz: "4-hafta" },
    winners: communityArtworks
  }
];

export const weeklyQuizMeta = {
  weekId: "2026-W22",
  questionCount: 10
};

export const recommendedItems = [
  {
    id: "pin-1",
    pinned: true,
    type: { tr: "Kitap", en: "Book", ru: "Книга", uz: "Kitob" },
    title: { tr: "Sanatın Öyküsü", en: "The Story of Art", ru: "История искусства", uz: "San'at hikoyasi" },
    description: {
      tr: "Sanat tarihine giriş için güçlü bir başucu kitabı.",
      en: "A strong reference book for entering art history.",
      ru: "Сильная настольная книга для знакомства с историей искусства.",
      uz: "San'at tarixiga kirish uchun kuchli qo'llanma."
    }
  },
  {
    id: "pin-2",
    pinned: true,
    type: { tr: "Reklam", en: "Ad", ru: "Реклама", uz: "Reklama" },
    title: { tr: "Haftanın Atölyesi", en: "Workshop of the Week", ru: "Мастерская недели", uz: "Hafta ustaxonasi" },
    description: {
      tr: "Buraya sponsorlu kurs, müze bileti veya kendi duyurunu ekleyebilirsin.",
      en: "Add a sponsored course, museum ticket, or your own announcement here.",
      ru: "Здесь можно добавить спонсорский курс, билет в музей или объявление.",
      uz: "Bu yerga sponsor kurs, muzey bileti yoki e'lon qo'shishingiz mumkin."
    }
  },
  {
    id: "pin-3",
    pinned: true,
    type: { tr: "VIP", en: "VIP", ru: "VIP", uz: "VIP" },
    title: { tr: "Özel Okuma Listesi", en: "Curated Reading List", ru: "Избранный список чтения", uz: "Tanlangan o'qish ro'yxati" },
    description: {
      tr: "En üste sabitlenecek özel tavsiye alanı.",
      en: "A special recommendation slot pinned at the top.",
      ru: "Особый блок рекомендаций, закрепленный сверху.",
      uz: "Yuqorida mahkamlangan maxsus tavsiya joyi."
    }
  },
  {
    id: "item-1",
    pinned: false,
    type: { tr: "Kitap", en: "Book", ru: "Книга", uz: "Kitob" },
    title: { tr: "Rönesans Rehberi", en: "Renaissance Guide", ru: "Гид по Возрождению", uz: "Uyg'onish qo'llanmasi" },
    description: {
      tr: "Rönesans dönemini kısa notlarla anlatan standart öneri alanı.",
      en: "A standard recommendation block for concise Renaissance notes.",
      ru: "Стандартный блок рекомендаций с краткими заметками о Возрождении.",
      uz: "Uyg'onish davri haqida qisqa qaydlar uchun standart tavsiya bloki."
    }
  },
  {
    id: "item-2",
    pinned: false,
    type: { tr: "Manuel reklam", en: "Manual ad", ru: "Ручная реклама", uz: "Qo'lda reklama" },
    title: { tr: "Müze Bileti Duyurusu", en: "Museum Ticket Promo", ru: "Анонс билетов в музей", uz: "Muzey chiptasi e'loni" },
    description: {
      tr: "Satmak veya tanıtmak istediğin ürünü burada listeleyebilirsin.",
      en: "List the product or offer you want to promote here.",
      ru: "Здесь можно разместить продукт или предложение для продвижения.",
      uz: "Targ'ib qilmoqchi bo'lgan mahsulot yoki taklifni shu yerga joylang."
    }
  },
  {
    id: "item-3",
    pinned: false,
    type: { tr: "Kaynak", en: "Resource", ru: "Источник", uz: "Manba" },
    title: { tr: "Tablo Okuma Notları", en: "Painting Reading Notes", ru: "Заметки по чтению картин", uz: "Rasm tahlili qaydlari" },
    description: {
      tr: "Kullanıcıların sanat eserlerini daha iyi okuması için kısa kaynak alanı.",
      en: "A short resource area to help users read artworks better.",
      ru: "Короткий ресурс, помогающий лучше читать произведения.",
      uz: "Foydalanuvchilarga asarlarni yaxshiroq tushunishga yordam beruvchi qisqa manba."
    }
  }
];

export const artworks: Artwork[] = [
  {
    id: "mona-lisa",
    year: "1503-1519",
    origin: "Louvre",
    image: `${imageBase}/photo-1541961017774-22349e4a1262?auto=format&fit=crop&w=900&q=80`,
    title: { tr: "Mona Lisa", en: "Mona Lisa", ru: "Мона Лиза", uz: "Mona Liza" },
    artist: { tr: "Leonardo da Vinci", en: "Leonardo da Vinci", ru: "Леонардо да Винчи", uz: "Leonardo da Vinchi" },
    period: { tr: "Yüksek Rönesans", en: "High Renaissance", ru: "Высокое Возрождение", uz: "Yuksak Uyg'onish" },
    description: {
      tr: "Portre, gizemli bakışı ve yumuşak geçişleriyle Rönesans insan anlayışını simgeler.",
      en: "The portrait reflects Renaissance humanism through its calm gaze and soft tonal transitions.",
      ru: "Портрет выражает гуманизм Возрождения спокойным взглядом и мягкими тональными переходами.",
      uz: "Portret sokin nigoh va yumshoq rang o'tishlari orqali Uyg'onish davri gumanizmini ifodalaydi."
    }
  },
  {
    id: "starry-night",
    year: "1889",
    origin: "MoMA",
    image: `${imageBase}/photo-1579783901586-d88db74b4fe4?auto=format&fit=crop&w=900&q=80`,
    title: { tr: "Yıldızlı Gece", en: "The Starry Night", ru: "Звездная ночь", uz: "Yulduzli tun" },
    artist: { tr: "Vincent van Gogh", en: "Vincent van Gogh", ru: "Винсент ван Гог", uz: "Vinsent van Gog" },
    period: { tr: "Post-Empresyonizm", en: "Post-Impressionism", ru: "Постимпрессионизм", uz: "Postimpressionizm" },
    description: {
      tr: "Dalgalı gökyüzü, sanatçının iç dünyasını hareketli fırça darbeleriyle görünür kılar.",
      en: "The swirling sky turns the artist's inner world into a vivid field of brushwork.",
      ru: "Закрученное небо превращает внутренний мир художника в живое поле мазков.",
      uz: "Aylanma osmon rassom ichki olamini jonli mo'yqalam izlariga aylantiradi."
    }
  },
  {
    id: "girl-pearl",
    year: "1665",
    origin: "Mauritshuis",
    image: `${imageBase}/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=900&q=80`,
    title: { tr: "İnci Küpeli Kız", en: "Girl with a Pearl Earring", ru: "Девушка с жемчужной сережкой", uz: "Marvarid sirg'ali qiz" },
    artist: { tr: "Johannes Vermeer", en: "Johannes Vermeer", ru: "Ян Вермеер", uz: "Yohannes Vermeer" },
    period: { tr: "Hollanda Altın Çağı", en: "Dutch Golden Age", ru: "Золотой век Голландии", uz: "Gollandiya oltin davri" },
    description: {
      tr: "Işık, bakış ve sadelik eseri sessiz ama unutulmaz bir sahneye dönüştürür.",
      en: "Light, gaze, and restraint make the painting quiet yet unforgettable.",
      ru: "Свет, взгляд и сдержанность делают картину тихой, но незабываемой.",
      uz: "Yorug'lik, nigoh va soddalik asarni sokin, ammo unutilmas qiladi."
    }
  },
  {
    id: "guernica",
    year: "1937",
    origin: "Museo Reina Sofia",
    image: `${imageBase}/photo-1561214115-f2f134cc4912?auto=format&fit=crop&w=900&q=80`,
    title: { tr: "Guernica", en: "Guernica", ru: "Герника", uz: "Gernika" },
    artist: { tr: "Pablo Picasso", en: "Pablo Picasso", ru: "Пабло Пикассо", uz: "Pablo Pikasso" },
    period: { tr: "Modernizm", en: "Modernism", ru: "Модернизм", uz: "Modernizm" },
    description: {
      tr: "Savaşın yıkımını siyah, beyaz ve keskin biçimlerle evrensel bir çığlığa çevirir.",
      en: "The work transforms the trauma of war into a universal cry through stark forms.",
      ru: "Картина превращает травму войны во всеобщий крик через резкие формы.",
      uz: "Asar urush fojeasini keskin shakllar orqali umuminsoniy faryodga aylantiradi."
    }
  },
  {
    id: "venus",
    year: "1485",
    origin: "Uffizi",
    image: `${imageBase}/photo-1578926288207-a90a5366759d?auto=format&fit=crop&w=900&q=80`,
    title: { tr: "Venüs'ün Doğuşu", en: "The Birth of Venus", ru: "Рождение Венеры", uz: "Veneraning tug'ilishi" },
    artist: { tr: "Sandro Botticelli", en: "Sandro Botticelli", ru: "Сандро Боттичелли", uz: "Sandro Bottichelli" },
    period: { tr: "Erken Rönesans", en: "Early Renaissance", ru: "Раннее Возрождение", uz: "Ilk Uyg'onish" },
    description: {
      tr: "Mitoloji, zarif çizgi ve ideal güzellik Rönesans düşüncesiyle buluşur.",
      en: "Myth, elegant line, and ideal beauty meet Renaissance thought.",
      ru: "Миф, изящная линия и идеальная красота соединяются с мыслью Возрождения.",
      uz: "Afsona, nafis chiziq va ideal go'zallik Uyg'onish tafakkuri bilan uyg'unlashadi."
    }
  },
  {
    id: "scream",
    year: "1893",
    origin: "National Museum Oslo",
    image: `${imageBase}/photo-1580136579312-94651dfd596d?auto=format&fit=crop&w=900&q=80`,
    title: { tr: "Çığlık", en: "The Scream", ru: "Крик", uz: "Qichqiriq" },
    artist: { tr: "Edvard Munch", en: "Edvard Munch", ru: "Эдвард Мунк", uz: "Edvard Munk" },
    period: { tr: "Ekspresyonizm", en: "Expressionism", ru: "Экспрессионизм", uz: "Ekspressionizm" },
    description: {
      tr: "Figür ve manzara, modern insanın kaygısını tek bir dalgalı ritimde toplar.",
      en: "Figure and landscape gather modern anxiety into one vibrating rhythm.",
      ru: "Фигура и пейзаж собирают тревогу современного человека в один ритм.",
      uz: "Figura va manzara zamonaviy inson xavotirini bitta tebranuvchi ritmga jamlaydi."
    }
  },
  {
    id: "persistence",
    year: "1931",
    origin: "MoMA",
    image: `${imageBase}/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=900&q=80`,
    title: { tr: "Bellegin Azmi", en: "The Persistence of Memory", ru: "Постоянство памяти", uz: "Xotiraning qat'iyati" },
    artist: { tr: "Salvador Dali", en: "Salvador Dali", ru: "Сальвадор Дали", uz: "Salvador Dali" },
    period: { tr: "Surrealizm", en: "Surrealism", ru: "Сюрреализм", uz: "Syurrealizm" },
    description: {
      tr: "Eriyen saatler, zamanın katılığını rüyamsı bir sahnede sorgular.",
      en: "Melting clocks question the rigidity of time inside a dreamlike scene.",
      ru: "Текущие часы ставят под вопрос жесткость времени в мире сна.",
      uz: "Eriyotgan soatlar tushsimon sahnada vaqt qat'iyligini savolga tutadi."
    }
  },
  {
    id: "las-meninas",
    year: "1656",
    origin: "Prado",
    image: `${imageBase}/photo-1578926375605-eaf7559b1458?auto=format&fit=crop&w=900&q=80`,
    title: { tr: "Las Meninas", en: "Las Meninas", ru: "Менины", uz: "Las Meninas" },
    artist: { tr: "Diego Velazquez", en: "Diego Velazquez", ru: "Диего Веласкес", uz: "Diego Velaskes" },
    period: { tr: "Barok", en: "Baroque", ru: "Барокко", uz: "Barokko" },
    description: {
      tr: "Bakış açıları ve ayna oyunu, izleyiciyi saray sahnesinin içine çeker.",
      en: "Perspective and reflection pull the viewer into the royal studio scene.",
      ru: "Перспектива и отражение втягивают зрителя в придворную сцену.",
      uz: "Rakurs va aks tomoshabinni qirollik ustaxonasi sahnasiga tortadi."
    }
  },
  {
    id: "night-watch",
    year: "1642",
    origin: "Rijksmuseum",
    image: `${imageBase}/photo-1564399579883-451a5d44ec08?auto=format&fit=crop&w=900&q=80`,
    title: { tr: "Gece Devriyesi", en: "The Night Watch", ru: "Ночной дозор", uz: "Tungi kuzatuv" },
    artist: { tr: "Rembrandt", en: "Rembrandt", ru: "Рембрандт", uz: "Rembrandt" },
    period: { tr: "Barok", en: "Baroque", ru: "Барокко", uz: "Barokko" },
    description: {
      tr: "Grup portresi, dramatik isik ve hareketle neredeyse tiyatro sahnesine donusur.",
      en: "The group portrait becomes theatrical through dramatic light and movement.",
      ru: "Групповой портрет становится театральным благодаря свету и движению.",
      uz: "Guruh portreti dramatik nur va harakat orqali sahnaviy tus oladi."
    }
  },
  {
    id: "water-lilies",
    year: "1916",
    origin: "Musee de l'Orangerie",
    image: `${imageBase}/photo-1554907984-15263bfd63bd?auto=format&fit=crop&w=900&q=80`,
    title: { tr: "Nilüferler", en: "Water Lilies", ru: "Кувшинки", uz: "Nilufarlar" },
    artist: { tr: "Claude Monet", en: "Claude Monet", ru: "Клод Моне", uz: "Klod Mone" },
    period: { tr: "Empresyonizm", en: "Impressionism", ru: "Импрессионизм", uz: "Impressionizm" },
    description: {
      tr: "Yuzey, isik ve renk, dogayi anlik bir algi deneyimine donusturur.",
      en: "Surface, light, and color turn nature into an experience of perception.",
      ru: "Поверхность, свет и цвет превращают природу в опыт восприятия.",
      uz: "Sirt, yorug'lik va rang tabiatni idrok tajribasiga aylantiradi."
    }
  }
];

export const quizQuestions: QuizQuestion[] = [
  {
    id: "q1",
    image: artworks[1].image,
    question: {
      tr: "Yildizli Gece hangi sanat akimiyla iliskilidir?",
      en: "Which movement is The Starry Night associated with?",
      ru: "С каким направлением связана Звездная ночь?",
      uz: "Yulduzli tun qaysi oqim bilan bog'liq?"
    },
    options: {
      tr: ["Post-Empresyonizm", "Kubizm", "Barok", "Neoklasizm"],
      en: ["Post-Impressionism", "Cubism", "Baroque", "Neoclassicism"],
      ru: ["Постимпрессионизм", "Кубизм", "Барокко", "Неоклассицизм"],
      uz: ["Postimpressionizm", "Kubizm", "Barokko", "Neoklassitsizm"]
    },
    answerIndex: 0
  },
  {
    id: "q2",
    image: artworks[4].image,
    question: {
      tr: "Venüs'ün Doğuşu eserinin sanatçısı kimdir?",
      en: "Who painted The Birth of Venus?",
      ru: "Кто написал Рождение Венеры?",
      uz: "Veneraning tug'ilishi asarini kim chizgan?"
    },
    options: {
      tr: ["Botticelli", "Vermeer", "Munch", "Monet"],
      en: ["Botticelli", "Vermeer", "Munch", "Monet"],
      ru: ["Боттичелли", "Вермеер", "Мунк", "Моне"],
      uz: ["Bottichelli", "Vermeer", "Munk", "Mone"]
    },
    answerIndex: 0
  },
  {
    id: "q3",
    image: artworks[3].image,
    question: {
      tr: "Guernica hangi tarihsel aciya tepki olarak dogdu?",
      en: "Guernica responds to what kind of historical trauma?",
      ru: "На какую историческую травму откликается Герника?",
      uz: "Gernika qanday tarixiy fojeaga javob beradi?"
    },
    options: {
      tr: ["Savaş ve bombardıman", "Deniz ticareti", "Kraliyet düğünü", "Tarım şenliği"],
      en: ["War and bombing", "Sea trade", "Royal wedding", "Harvest festival"],
      ru: ["Война и бомбардировка", "Морская торговля", "Королевская свадьба", "Праздник урожая"],
      uz: ["Urush va bombardimon", "Dengiz savdosi", "Qirollik to'yi", "Hosil bayrami"]
    },
    answerIndex: 0
  },
  {
    id: "q4",
    image: artworks[2].image,
    question: {
      tr: "İnci Küpeli Kız hangi sanatçıya aittir?",
      en: "Which artist painted Girl with a Pearl Earring?",
      ru: "Кто написал Девушку с жемчужной сережкой?",
      uz: "Marvarid sirg'ali qiz asari kimga tegishli?"
    },
    options: {
      tr: ["Johannes Vermeer", "Claude Monet", "Rembrandt", "Pablo Picasso"],
      en: ["Johannes Vermeer", "Claude Monet", "Rembrandt", "Pablo Picasso"],
      ru: ["Ян Вермеер", "Клод Моне", "Рембрандт", "Пабло Пикассо"],
      uz: ["Yohannes Vermeer", "Klod Mone", "Rembrandt", "Pablo Pikasso"]
    },
    answerIndex: 0
  },
  {
    id: "q5",
    image: artworks[5].image,
    question: {
      tr: "Çığlık eseri hangi duyguyu güçlü biçimde yansıtır?",
      en: "Which feeling does The Scream strongly express?",
      ru: "Какое чувство особенно выражает Крик?",
      uz: "Qichqiriq asari qaysi tuyg'uni kuchli ifodalaydi?"
    },
    options: {
      tr: ["Kaygı", "Zafer", "Neşe", "Sakinlik"],
      en: ["Anxiety", "Victory", "Joy", "Calm"],
      ru: ["Тревогу", "Победу", "Радость", "Спокойствие"],
      uz: ["Xavotir", "G'alaba", "Quvonch", "Sokinlik"]
    },
    answerIndex: 0
  },
  {
    id: "q6",
    image: artworks[6].image,
    question: {
      tr: "Eriyen saatlerle tanınan sanat akımı hangisidir?",
      en: "Which movement is known for melting clocks?",
      ru: "Какое направление связано с текучими часами?",
      uz: "Eriyotgan soatlar qaysi oqim bilan bog'liq?"
    },
    options: {
      tr: ["Sürrealizm", "Barok", "Fovizm", "Gotik"],
      en: ["Surrealism", "Baroque", "Fauvism", "Gothic"],
      ru: ["Сюрреализм", "Барокко", "Фовизм", "Готика"],
      uz: ["Syurrealizm", "Barokko", "Fovizm", "Gotika"]
    },
    answerIndex: 0
  },
  {
    id: "q7",
    image: artworks[7].image,
    question: {
      tr: "Las Meninas hangi dönemin önemli örneklerinden biridir?",
      en: "Las Meninas is an important example of which period?",
      ru: "Менины являются важным примером какого периода?",
      uz: "Las Meninas qaysi davrning muhim namunasi?"
    },
    options: {
      tr: ["Barok", "Rokoko", "Dada", "Pop Art"],
      en: ["Baroque", "Rococo", "Dada", "Pop Art"],
      ru: ["Барокко", "Рококо", "Дада", "Поп-арт"],
      uz: ["Barokko", "Rokoko", "Dada", "Pop-art"]
    },
    answerIndex: 0
  },
  {
    id: "q8",
    image: artworks[8].image,
    question: {
      tr: "Rembrandt hangi özelliğiyle özellikle bilinir?",
      en: "What is Rembrandt especially known for?",
      ru: "Чем особенно известен Рембрандт?",
      uz: "Rembrandt ayniqsa nima bilan mashhur?"
    },
    options: {
      tr: ["Dramatik ışık", "Düz renk alanları", "Dijital kolaj", "Mermer heykel"],
      en: ["Dramatic light", "Flat color fields", "Digital collage", "Marble sculpture"],
      ru: ["Драматический свет", "Плоские цветовые поля", "Цифровой коллаж", "Мраморная скульптура"],
      uz: ["Dramatik yorug'lik", "Yassi rang maydonlari", "Raqamli kollaj", "Marmar haykal"]
    },
    answerIndex: 0
  },
  {
    id: "q9",
    image: artworks[9].image,
    question: {
      tr: "Monet'nin Nilüferler dizisi hangi akımla ilişkilidir?",
      en: "Monet's Water Lilies series is associated with which movement?",
      ru: "С каким направлением связана серия Кувшинки Моне?",
      uz: "Monening Nilufarlar turkumi qaysi oqimga tegishli?"
    },
    options: {
      tr: ["Empresyonizm", "Kübizm", "Sürrealizm", "Minimalizm"],
      en: ["Impressionism", "Cubism", "Surrealism", "Minimalism"],
      ru: ["Импрессионизм", "Кубизм", "Сюрреализм", "Минимализм"],
      uz: ["Impressionizm", "Kubizm", "Syurrealizm", "Minimalizm"]
    },
    answerIndex: 0
  },
  {
    id: "q10",
    image: artworks[0].image,
    question: {
      tr: "Mona Lisa hangi müzede sergilenir?",
      en: "Which museum displays the Mona Lisa?",
      ru: "В каком музее выставлена Мона Лиза?",
      uz: "Mona Liza qaysi muzeyda namoyish etiladi?"
    },
    options: {
      tr: ["Louvre", "Prado", "Uffizi", "Rijksmuseum"],
      en: ["Louvre", "Prado", "Uffizi", "Rijksmuseum"],
      ru: ["Лувр", "Прадо", "Уффици", "Рейксмюсеум"],
      uz: ["Luvr", "Prado", "Uffizi", "Rijksmuseum"]
    },
    answerIndex: 0
  }
];

export const events: ArtEvent[] = [
  {
    id: "event-1",
    language: "tr",
    date: "12 Jun",
    type: { tr: "Canlı anlatım", en: "Live talk", ru: "Живая лекция", uz: "Jonli suhbat" },
    title: { tr: "Rönesans portresinde güç", en: "Power in Renaissance portraiture", ru: "Власть в портрете Возрождения", uz: "Uyg'onish portretida kuch" },
    location: { tr: "Dijital salon", en: "Digital hall", ru: "Цифровой зал", uz: "Raqamli zal" }
  },
  {
    id: "event-2",
    language: "en",
    date: "18 Jun",
    type: { tr: "Atölye", en: "Workshop", ru: "Мастерская", uz: "Ustaxona" },
    title: { tr: "Bir tablo nasıl okunur?", en: "How to read a painting", ru: "Как читать картину", uz: "Rasmni qanday o'qish kerak" },
    location: { tr: "Uygulama içi", en: "In app", ru: "В приложении", uz: "Ilova ichida" }
  },
  {
    id: "event-3",
    language: "uz",
    date: "25 Jun",
    type: { tr: "Mini tur", en: "Mini tour", ru: "Мини-тур", uz: "Mini tur" },
    title: { tr: "Modernizme hızlı bakış", en: "A quick look at modernism", ru: "Краткий взгляд на модернизм", uz: "Modernizmga qisqa nazar" },
    location: { tr: "Sesli rehber", en: "Audio guide", ru: "Аудиогид", uz: "Audio gid" }
  },
  {
    id: "event-4",
    language: "ru",
    date: "30 Jun",
    type: { tr: "Çevrim içi söyleşi", en: "Online talk", ru: "Онлайн-встреча", uz: "Onlayn suhbat" },
    title: { tr: "Avangart sanatın kısa tarihi", en: "A short history of avant-garde art", ru: "Краткая история авангарда", uz: "Avangard san'atning qisqa tarixi" },
    location: { tr: "Canlı yayın", en: "Live stream", ru: "Прямой эфир", uz: "Jonli efir" }
  }
];

export const artists: Artist[] = [
  {
    id: "leonardo",
    image: `${imageBase}/photo-1547891654-e66ed7ebb968?auto=format&fit=crop&w=900&q=80`,
    name: { tr: "Leonardo da Vinci", en: "Leonardo da Vinci", ru: "Леонардо да Винчи", uz: "Leonardo da Vinchi" },
    life: "1452-1519",
    country: { tr: "İtalya", en: "Italy", ru: "Италия", uz: "Italiya" },
    movement: { tr: "Yüksek Rönesans", en: "High Renaissance", ru: "Высокое Возрождение", uz: "Yuksak Uyg'onish" },
    biography: {
      tr: "Ressam, mühendis ve düşünür kimliğiyle Rönesans'ın çok yönlü insan idealini temsil eder.",
      en: "A painter, engineer, and thinker who represents the Renaissance ideal of a many-sided mind.",
      ru: "Художник, инженер и мыслитель, воплощающий универсальный идеал Возрождения.",
      uz: "Rassom, muhandis va mutafakkir sifatida Uyg'onish davrining ko'p qirrali idealini ifodalaydi."
    },
    featuredArtworkIds: ["mona-lisa"]
  },
  {
    id: "vangogh",
    image: `${imageBase}/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=900&q=80`,
    name: { tr: "Vincent van Gogh", en: "Vincent van Gogh", ru: "Винсент ван Гог", uz: "Vinsent van Gog" },
    life: "1853-1890",
    country: { tr: "Hollanda", en: "Netherlands", ru: "Нидерланды", uz: "Niderlandiya" },
    movement: { tr: "Post-Empresyonizm", en: "Post-Impressionism", ru: "Постимпрессионизм", uz: "Postimpressionizm" },
    biography: {
      tr: "Yoğun renkleri ve hareketli fırçasıyla modern sanatın duygusal dilini güçlendirdi.",
      en: "His intense colors and restless brushwork shaped the emotional language of modern art.",
      ru: "Его насыщенные цвета и нервный мазок усилили эмоциональный язык современного искусства.",
      uz: "Kuchli ranglar va harakatchan mo'yqalam izlari zamonaviy san'at hissiy tilini kuchaytirdi."
    },
    featuredArtworkIds: ["starry-night"]
  },
  {
    id: "picasso",
    image: `${imageBase}/photo-1577720643272-265f09367456?auto=format&fit=crop&w=900&q=80`,
    name: { tr: "Pablo Picasso", en: "Pablo Picasso", ru: "Пабло Пикассо", uz: "Pablo Pikasso" },
    life: "1881-1973",
    country: { tr: "İspanya", en: "Spain", ru: "Испания", uz: "Ispaniya" },
    movement: { tr: "Kübizm / Modernizm", en: "Cubism / Modernism", ru: "Кубизм / модернизм", uz: "Kubizm / Modernizm" },
    biography: {
      tr: "Biçimi parçalayıp yeniden kurarak 20. yüzyıl sanatının yönünü değiştirdi.",
      en: "He changed twentieth-century art by breaking form apart and rebuilding it.",
      ru: "Он изменил искусство XX века, разбирая форму и собирая ее заново.",
      uz: "Shaklni parchalab qayta qurish orqali XX asr san'at yo'nalishini o'zgartirdi."
    },
    featuredArtworkIds: ["guernica"]
  },
  {
    id: "vermeer",
    image: `${imageBase}/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=900&q=80`,
    name: { tr: "Johannes Vermeer", en: "Johannes Vermeer", ru: "Ян Вермеер", uz: "Yohannes Vermeer" },
    life: "1632-1675",
    country: { tr: "Hollanda", en: "Netherlands", ru: "Нидерланды", uz: "Niderlandiya" },
    movement: { tr: "Hollanda Altın Çağı", en: "Dutch Golden Age", ru: "Золотой век Голландии", uz: "Gollandiya oltin davri" },
    biography: {
      tr: "Sessiz iç mekanları, ışığın inceliği ve gündelik hayatın şiirselliğiyle bilinir.",
      en: "Known for quiet interiors, delicate light, and the poetry of daily life.",
      ru: "Известен тихими интерьерами, тонким светом и поэзией повседневности.",
      uz: "Sokin interyerlar, nozik yorug'lik va kundalik hayot she'riyati bilan tanilgan."
    },
    featuredArtworkIds: ["girl-pearl"]
  }
];

export const artStories: ArtStory[] = [
  {
    id: "museum-silence",
    image: `${imageBase}/photo-1564399579883-451a5d44ec08?auto=format&fit=crop&w=900&q=80`,
    readTime: { tr: "3 dk", en: "3 min", ru: "3 мин", uz: "3 daq" },
    title: { tr: "Müze sessizliği neden etkiler?", en: "Why museum silence matters", ru: "Почему важна тишина музея", uz: "Muzey sukunati nega ta'sir qiladi?" },
    excerpt: {
      tr: "Bir eserin karşısında yavaşlamak, gözün ayrıntıları yakalamasını sağlar.",
      en: "Slowing down in front of an artwork lets the eye catch details.",
      ru: "Замедление перед произведением помогает глазу увидеть детали.",
      uz: "Asar qarshisida sekinlashish ko'zga tafsilotlarni ko'rishga yordam beradi."
    },
    body: {
      tr: "Müze deneyimi yalnızca görmek değil, ritim değiştirmektir. Sessizlik, izleyicinin kendi düşüncesini duymasına alan açar ve eserin biçim, renk, ışık gibi katmanlarını daha görünür kılar.",
      en: "A museum visit is not only about seeing, but changing rhythm. Silence gives viewers room to hear their own thoughts and notice form, color, and light.",
      ru: "Посещение музея - это не только зрение, но и смена ритма. Тишина помогает заметить форму, цвет и свет.",
      uz: "Muzey tajribasi faqat ko'rish emas, ritmni o'zgartirishdir. Sukunat shakl, rang va yorug'likni sezishga yordam beradi."
    }
  },
  {
    id: "reading-painting",
    image: `${imageBase}/photo-1536924940846-227afb31e2a5?auto=format&fit=crop&w=900&q=80`,
    readTime: { tr: "4 dk", en: "4 min", ru: "4 мин", uz: "4 daq" },
    title: { tr: "Bir tablo nasıl okunur?", en: "How to read a painting", ru: "Как читать картину", uz: "Rasmni qanday o'qish kerak?" },
    excerpt: {
      tr: "Önce kompozisyona, sonra ışığa, en son ayrıntılara bak.",
      en: "Look at composition first, then light, and finally details.",
      ru: "Сначала композиция, затем свет, потом детали.",
      uz: "Avval kompozitsiyaga, keyin yorug'likka, so'ng tafsilotlarga qarang."
    },
    body: {
      tr: "Tablo okumak bilgi ezberlemek değildir. Görsel hiyerarşiyi takip etmek, figürlerin yönünü izlemek ve renklerin duygusunu anlamaya çalışmak iyi bir başlangıçtır.",
      en: "Reading a painting is not memorizing facts. Start with visual hierarchy, follow the direction of figures, and sense the emotion of color.",
      ru: "Чтение картины - не заучивание фактов. Начните с визуальной иерархии, направления фигур и эмоции цвета.",
      uz: "Rasmni o'qish fakt yodlash emas. Vizual tartib, figuralar yo'nalishi va rang hissidan boshlang."
    }
  },
  {
    id: "color-memory",
    image: `${imageBase}/photo-1513364776144-60967b0f800f?auto=format&fit=crop&w=900&q=80`,
    readTime: { tr: "2 dk", en: "2 min", ru: "2 мин", uz: "2 daq" },
    title: { tr: "Renk hafızası", en: "Color memory", ru: "Память цвета", uz: "Rang xotirasi" },
    excerpt: {
      tr: "Bazı eserleri konusundan önce rengiyle hatırlarız.",
      en: "Some artworks are remembered by color before subject.",
      ru: "Некоторые картины мы помним прежде всего по цвету.",
      uz: "Ba'zi asarlar mavzusidan avval rangi bilan esda qoladi."
    },
    body: {
      tr: "Renk, izleyicinin belleğinde hızlı iz bırakır. Bu yüzden dönemler ve sanatçılar çoğu zaman kendilerine özgü renk atmosferleriyle tanınır.",
      en: "Color leaves a fast trace in memory. Periods and artists are often recognized by their own color atmospheres.",
      ru: "Цвет быстро остается в памяти. Поэтому эпохи и художников часто узнают по цветовой атмосфере.",
      uz: "Rang xotirada tez iz qoldiradi. Davrlar va rassomlar ko'pincha rang muhiti bilan taniladi."
    }
  }
];

export const countryCommunities: CountryCommunity[] = [
  { id: "turkiye", code: "TR", members: 1280, name: { tr: "Türkiye", en: "Turkey", ru: "Турция", uz: "Turkiya" } },
  { id: "uzbekistan", code: "UZ", members: 940, name: { tr: "Özbekistan", en: "Uzbekistan", ru: "Узбекистан", uz: "O'zbekiston" } },
  { id: "russia", code: "RU", members: 870, name: { tr: "Rusya", en: "Russia", ru: "Россия", uz: "Rossiya" } },
  { id: "usa", code: "US", members: 1640, name: { tr: "ABD", en: "United States", ru: "США", uz: "AQSH" } },
  { id: "uk", code: "GB", members: 760, name: { tr: "İngiltere", en: "United Kingdom", ru: "Великобритания", uz: "Buyuk Britaniya" } },
  { id: "canada", code: "CA", members: 520, name: { tr: "Kanada", en: "Canada", ru: "Канада", uz: "Kanada" } },
  { id: "germany", code: "DE", members: 840, name: { tr: "Almanya", en: "Germany", ru: "Германия", uz: "Germaniya" } },
  { id: "kazakhstan", code: "KZ", members: 430, name: { tr: "Kazakistan", en: "Kazakhstan", ru: "Казахстан", uz: "Qozog'iston" } },
  { id: "france", code: "FR", members: 790, name: { tr: "Fransa", en: "France", ru: "Франция", uz: "Fransiya" } },
  { id: "italy", code: "IT", members: 720, name: { tr: "İtalya", en: "Italy", ru: "Италия", uz: "Italiya" } },
  { id: "spain", code: "ES", members: 610, name: { tr: "İspanya", en: "Spain", ru: "Испания", uz: "Ispaniya" } },
  { id: "brazil", code: "BR", members: 680, name: { tr: "Brezilya", en: "Brazil", ru: "Бразилия", uz: "Braziliya" } },
  { id: "mexico", code: "MX", members: 540, name: { tr: "Meksika", en: "Mexico", ru: "Мексика", uz: "Meksika" } },
  { id: "india", code: "IN", members: 920, name: { tr: "Hindistan", en: "India", ru: "Индия", uz: "Hindiston" } },
  { id: "china", code: "CN", members: 880, name: { tr: "Çin", en: "China", ru: "Китай", uz: "Xitoy" } },
  { id: "japan", code: "JP", members: 640, name: { tr: "Japonya", en: "Japan", ru: "Япония", uz: "Yaponiya" } },
  { id: "south-korea", code: "KR", members: 470, name: { tr: "Güney Kore", en: "South Korea", ru: "Южная Корея", uz: "Janubiy Koreya" } },
  { id: "indonesia", code: "ID", members: 510, name: { tr: "Endonezya", en: "Indonesia", ru: "Индонезия", uz: "Indoneziya" } },
  { id: "pakistan", code: "PK", members: 390, name: { tr: "Pakistan", en: "Pakistan", ru: "Пакистан", uz: "Pokiston" } },
  { id: "egypt", code: "EG", members: 350, name: { tr: "Mısır", en: "Egypt", ru: "Египет", uz: "Misr" } },
  { id: "iran", code: "IR", members: 330, name: { tr: "İran", en: "Iran", ru: "Иран", uz: "Eron" } },
  { id: "australia", code: "AU", members: 310, name: { tr: "Avustralya", en: "Australia", ru: "Австралия", uz: "Avstraliya" } },
  { id: "netherlands", code: "NL", members: 300, name: { tr: "Hollanda", en: "Netherlands", ru: "Нидерланды", uz: "Niderlandiya" } },
  { id: "poland", code: "PL", members: 280, name: { tr: "Polonya", en: "Poland", ru: "Польша", uz: "Polsha" } },
  { id: "ukraine", code: "UA", members: 260, name: { tr: "Ukrayna", en: "Ukraine", ru: "Украина", uz: "Ukraina" } },
  { id: "saudi-arabia", code: "SA", members: 240, name: { tr: "Suudi Arabistan", en: "Saudi Arabia", ru: "Саудовская Аравия", uz: "Saudiya Arabistoni" } },
  { id: "argentina", code: "AR", members: 230, name: { tr: "Arjantin", en: "Argentina", ru: "Аргентина", uz: "Argentina" } },
  { id: "south-africa", code: "ZA", members: 210, name: { tr: "Güney Afrika", en: "South Africa", ru: "ЮАР", uz: "Janubiy Afrika" } }
];

export const notifications: AppNotification[] = [
  {
    id: "notif-1",
    icon: "trophy",
    targetPath: "/(tabs)/ranking",
    date: "Bugün",
    title: { tr: "Resim Yarışması güncellendi", en: "Painting Contest updated", ru: "Конкурс рисунков обновлен", uz: "Rasm tanlovi yangilandi" },
    body: { tr: "Yeni resimler eklendi ve oylama başladı.", en: "New images were added and voting started.", ru: "Добавлены новые работы, голосование началось.", uz: "Yangi rasmlar qo'shildi va ovoz berish boshlandi." }
  },
  {
    id: "notif-2",
    icon: "calendar",
    targetPath: "/(tabs)/events",
    date: "Dün",
    title: { tr: "Yeni etkinlik eklendi", en: "New event added", ru: "Добавлено событие", uz: "Yangi tadbir qo'shildi" },
    body: { tr: "Dil filtresine göre etkinlikleri kontrol edebilirsin.", en: "Check events by language filter.", ru: "Проверьте события по языковому фильтру.", uz: "Tadbirlarni til filtri orqali ko'ring." }
  }
];

export const museums: Museum[] = [
  {
    id: "louvre",
    image: `${imageBase}/photo-1566127444979-b3d2b654e3d7?auto=format&fit=crop&w=900&q=80`,
    name: { tr: "Louvre Müzesi", en: "Louvre Museum", ru: "Лувр", uz: "Luvr muzeyi" },
    city: { tr: "Paris", en: "Paris", ru: "Париж", uz: "Parij" },
    country: { tr: "Fransa", en: "France", ru: "Франция", uz: "Fransiya" },
    description: {
      tr: "Klasik koleksiyonları ve ikonik başyapıtlarıyla dünyanın en çok ziyaret edilen müzelerinden biri.",
      en: "One of the world's most visited museums, known for classical collections and iconic masterpieces.",
      ru: "Один из самых посещаемых музеев мира с классическими коллекциями и шедеврами.",
      uz: "Klassik kolleksiyalar va mashhur durdonalar bilan tanilgan dunyoning eng ko'p tashrif buyuriladigan muzeylaridan biri."
    },
    artworkIds: ["mona-lisa", "venus"]
  },
  {
    id: "moma",
    image: `${imageBase}/photo-1554907984-15263bfd63bd?auto=format&fit=crop&w=900&q=80`,
    name: { tr: "MoMA", en: "MoMA", ru: "MoMA", uz: "MoMA" },
    city: { tr: "New York", en: "New York", ru: "Нью-Йорк", uz: "Nyu-York" },
    country: { tr: "ABD", en: "United States", ru: "США", uz: "AQSH" },
    description: {
      tr: "Modern ve çağdaş sanatın en etkili koleksiyonlarından birini barındırır.",
      en: "Home to one of the most influential modern and contemporary art collections.",
      ru: "Один из важнейших музеев современного искусства.",
      uz: "Zamonaviy san'atning eng muhim kolleksiyalaridan biriga ega."
    },
    artworkIds: ["starry-night"]
  },
  {
    id: "reina-sofia",
    image: `${imageBase}/photo-1582555172866-f73bb12a2ab3?auto=format&fit=crop&w=900&q=80`,
    name: { tr: "Reina Sofía Müzesi", en: "Reina Sofia Museum", ru: "Музей Рейна София", uz: "Reina Sofia muzeyi" },
    city: { tr: "Madrid", en: "Madrid", ru: "Мадрид", uz: "Madrid" },
    country: { tr: "İspanya", en: "Spain", ru: "Испания", uz: "Ispaniya" },
    description: {
      tr: "20. yüzyıl İspanyol sanatı ve modernizm odağında güçlü bir koleksiyon sunar.",
      en: "A strong collection focused on twentieth-century Spanish art and modernism.",
      ru: "Коллекция искусства Испании XX века и модернизма.",
      uz: "XX asr ispan san'ati va modernizmga oid kuchli kolleksiya."
    },
    artworkIds: ["guernica"]
  }
];

const memberNames = [
  "Aylin", "Madina", "Daria", "James", "Aziz", "Elif", "Timur", "Sofia", "Mert", "Nil",
  "Kamila", "Deniz", "Rustam", "Mila", "Otabek", "Leyla", "Arthur", "Zarina", "Efe", "Lola"
];

const cities = ["Istanbul", "Tashkent", "London", "Moscow", "Samarkand", "Ankara", "Bukhara", "New York"];

export const ranking = Array.from({ length: 100 }, (_, index) => ({
  name: `${memberNames[index % memberNames.length]} ${String(index + 1).padStart(2, "0")}`,
  score: Math.max(1200 - index * 9, 140),
  city: cities[index % cities.length]
}));
