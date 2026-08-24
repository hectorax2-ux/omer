import { Language } from "@/types/content";
import { LocalizedCopy, t } from "@/utils/localized-text";

/** Ortak UI metinleri — 4 dil (tr, en, ru, uz). */
export const commonCopy = {
  filterAll: { tr: "Tümü", en: "All", ru: "Все", uz: "Barchasi" },
  loading: { tr: "Yükleniyor...", en: "Loading...", ru: "Загрузка...", uz: "Yuklanmoqda..." },
  detailPreparing: { tr: "Hazırlanıyor...", en: "Preparing...", ru: "Загрузка...", uz: "Tayyorlanmoqda..." },
  artworkUnavailable: { tr: "Eser bilgisi yüklenemedi.", en: "Artwork details could not be loaded.", ru: "Не удалось загрузить данные о произведении.", uz: "Asar ma'lumotlarini yuklab bo'lmadi." },
  artistUnavailable: { tr: "Sanatçı bilgisi yüklenemedi.", en: "Artist details could not be loaded.", ru: "Не удалось загрузить данные о художнике.", uz: "San'atkor ma'lumotlarini yuklab bo'lmadi." },
  museumUnavailable: { tr: "Müze bilgisi yüklenemedi.", en: "Museum details could not be loaded.", ru: "Не удалось загрузить данные о музее.", uz: "Muzey ma'lumotlarini yuklab bo'lmadi." },
  storyUnavailable: { tr: "Yazı yüklenemedi.", en: "The article could not be loaded.", ru: "Не удалось загрузить статью.", uz: "Yozuvni yuklab bo'lmadi." },
  showMore: { tr: "Daha fazla gör", en: "Show more", ru: "Показать еще", uz: "Ko'proq ko'rish" },
  share: { tr: "Paylaş", en: "Share", ru: "Поделиться", uz: "Ulashish" },
  edit: { tr: "Düzenle", en: "Edit", ru: "Редактировать", uz: "Tahrirlash" },
  delete: { tr: "Sil", en: "Delete", ru: "Удалить", uz: "O'chirish" },
  hide: { tr: "Gizle", en: "Hide", ru: "Скрыть", uz: "Yashirish" },
  favorite: { tr: "Favori", en: "Favorite", ru: "Избранное", uz: "Sevimli" },
  likersChip: { tr: "beğenenler", en: "likes", ru: "лайки", uz: "yoqtirganlar" },
  report: { tr: "Bildir", en: "Report", ru: "Пожаловаться", uz: "Shikoyat qilish" },
  blockUser: { tr: "Kullanıcıyı engelle", en: "Block user", ru: "Заблокировать пользователя", uz: "Foydalanuvchini bloklash" },
  unblockUser: { tr: "Engeli kaldır", en: "Unblock user", ru: "Разблокировать пользователя", uz: "Blokdan chiqarish" },
  blockUserTitle: { tr: "Kullanıcı engellensin mi?", en: "Block this user?", ru: "Заблокировать пользователя?", uz: "Foydalanuvchi bloklansinmi?" },
  blockUserBody: {
    tr: "Bu kullanıcının profili, gönderileri, görselleri, yorumları ve yeni içerikleri artık size gösterilmeyecek. İşlem güvenlik ekibine de bildirilecek.",
    en: "This user's profile, posts, images, comments, and new content will no longer be shown to you. The action will also be reported to the safety team.",
    ru: "Профиль, публикации, изображения, комментарии и новый контент этого пользователя больше не будут вам показываться. Действие также будет передано команде безопасности.",
    uz: "Bu foydalanuvchining profili, postlari, rasmlari, izohlari va yangi kontenti sizga boshqa ko'rsatilmaydi. Amal xavfsizlik jamoasiga ham yuboriladi."
  },
  blockUserSuccess: {
    tr: "Kullanıcı engellendi ve içerikleri gizlendi.",
    en: "The user was blocked and their content was hidden.",
    ru: "Пользователь заблокирован, его контент скрыт.",
    uz: "Foydalanuvchi bloklandi va uning kontenti yashirildi."
  },
  unblockUserSuccess: {
    tr: "Kullanıcının engeli kaldırıldı.",
    en: "The user was unblocked.",
    ru: "Пользователь разблокирован.",
    uz: "Foydalanuvchi blokdan chiqarildi."
  },
  blockUserFailed: {
    tr: "Engelleme işlemi tamamlanamadı. Lütfen tekrar deneyin.",
    en: "The blocking action could not be completed. Please try again.",
    ru: "Не удалось выполнить блокировку. Попробуйте еще раз.",
    uz: "Bloklash amali bajarilmadi. Qayta urinib ko'ring."
  },
  blockedProfileNotice: {
    tr: "Bu kullanıcıyı engellediniz. İçerikleri gizlendi. Profil menüsünden engeli kaldırabilirsiniz.",
    en: "You blocked this user. Their content is hidden. You can unblock them from the profile menu.",
    ru: "Вы заблокировали этого пользователя. Его контент скрыт. Разблокировать можно в меню профиля.",
    uz: "Siz bu foydalanuvchini bloklagansiz. Uning kontenti yashirilgan. Profil menyusidan blokni olib tashlashingiz mumkin."
  },
  blockedMuseumNotice: {
    tr: "Engellediğiniz kullanıcının müzesi gizlendi.",
    en: "The blocked user's museum is hidden.",
    ru: "Музей заблокированного пользователя скрыт.",
    uz: "Siz bloklagan foydalanuvchining muzeyi yashirildi."
  },
  blockedFollowUnavailable: {
    tr: "Engellediğiniz bir kullanıcıyı takip edemezsiniz.",
    en: "You cannot follow a user you have blocked.",
    ru: "Нельзя подписаться на заблокированного пользователя.",
    uz: "Siz bloklagan foydalanuvchini kuzata olmaysiz."
  },
  ok: { tr: "Tamam", en: "OK", ru: "ОК", uz: "OK" },
  cancel: { tr: "Vazgeç", en: "Cancel", ru: "Отмена", uz: "Bekor qilish" },
  update: { tr: "Güncelle", en: "Update", ru: "Обновить", uz: "Yangilash" },
  copied: { tr: "Kopyalandı", en: "Copied", ru: "Скопировано", uz: "Nusxalandi" },
  readMore: { tr: "Devamını oku", en: "Read more", ru: "Читать далее", uz: "Davomini o'qish" },
  collapse: { tr: "Yazıyı daralt", en: "Collapse", ru: "Свернуть", uz: "Yig'ish" },
  adSpace: { tr: "Sanat Atlas'tan", en: "From Art Atlas", ru: "От Art Atlas", uz: "Art Atlas'dan" },
  today: { tr: "Bugün", en: "Today", ru: "Сегодня", uz: "Bugun" },
  week: { tr: "Hafta", en: "Week", ru: "Неделя", uz: "Hafta" },
  month: { tr: "Ay", en: "Month", ru: "Месяц", uz: "Oy" },
  allTime: { tr: "Tüm zamanlar", en: "All time", ru: "Все время", uz: "Barcha vaqt" },
  allShort: { tr: "Tüm", en: "All", ru: "Все", uz: "Barchasi" },
  oneMonth: { tr: "Son 1 ay", en: "1 month", ru: "1 месяц", uz: "1 oy" },
  threeMonths: { tr: "Son 3 ay", en: "3 months", ru: "3 месяца", uz: "3 oy" },
  zoomIn: { tr: "Yakınlaştır", en: "Zoom in", ru: "Приблизить", uz: "Kattalashtirish" },
  zoomOut: { tr: "Uzaklaştır", en: "Zoom out", ru: "Отдалить", uz: "Kichiklashtirish" },
  comment: { tr: "Yorum", en: "Comment", ru: "Комментарий", uz: "Izoh" },
  commentAction: { tr: "Yorum yap", en: "Comment", ru: "Комментировать", uz: "Izoh yozish" },
  addCommentSection: { tr: "Yorum yap", en: "Add comment", ru: "Добавить комментарий", uz: "Izoh qo'shish" },
  activeCompetitionBadge: {
    tr: "Aktif resim yarışması görseli — beğeniler yarışma sıralamasına yansır.",
    en: "Active contest image — likes count toward the weekly ranking.",
    ru: "Активная работа конкурса — лайки учитываются в рейтинге недели.",
    uz: "Faol tanlov rasmi — yoqtirishlar haftalik reytingga ta'sir qiladi."
  },
  reportImage: { tr: "Görseli bildir", en: "Report image", ru: "Пожаловаться на изображение", uz: "Rasmni shikoyat qilish" },
  commentImage: { tr: "Görsele yorum yap", en: "Comment on image", ru: "Комментировать изображение", uz: "Rasmga izoh yozish" },
  commentPremiumRequired: {
    tr: "Yorum yapmak için Premium üyelik gerekir.",
    en: "Premium membership is required to comment.",
    ru: "Для комментариев нужен Premium.",
    uz: "Izoh yozish uchun Premium kerak."
  },
  commentPlaceholder: {
    tr: "Yorumunu yaz...",
    en: "Write your comment...",
    ru: "Напишите комментарий...",
    uz: "Izohingizni yozing..."
  },
  commentEmpty: {
    tr: "Henüz yorum yok. İlk yorumu sen yaz.",
    en: "No comments yet. Be the first to comment.",
    ru: "Пока нет комментариев. Напишите первым.",
    uz: "Hali izoh yo'q. Birinchi bo'lib yozing."
  },
  commentSent: {
    tr: "Yorumunuz yayınlandı.",
    en: "Your comment was published.",
    ru: "Ваш комментарий опубликован.",
    uz: "Izohingiz e'lon qilindi."
  },
  commentImageHint: {
    tr: "Yorumlar anında yayınlanır. Premium üyeler dakikada bir yorum yazabilir.",
    en: "Comments are published instantly. Premium members can post one comment per minute.",
    ru: "Комментарии публикуются сразу. Premium — один комментарий в минуту.",
    uz: "Izohlar darhol e'lon qilinadi. Premium a'zolar daqiqada bitta izoh yozishi mumkin."
  },
  commentDiscoverHint: {
    tr: "Yorum yazmak yalnızca Premium kullanıcılara açıktır. Her Premium üye 1 dakikada bir yorum yazabilir.",
    en: "Only Premium members can write comments. One comment every minute.",
    ru: "Писать комментарии могут только Premium-пользователи. Один комментарий в минуту.",
    uz: "Izoh yozish faqat Premium foydalanuvchilar uchun. Har 1 daqiqada bitta izoh."
  },
  commentNoPermission: {
    tr: "Bu gönderiye yorum yazma yetkin yok.",
    en: "You do not have comment permission.",
    ru: "У вас нет права комментировать эту запись.",
    uz: "Bu postga izoh yozish huquqingiz yo'q."
  },
  commentAdded: {
    tr: "Yorum eklendi.",
    en: "Comment added.",
    ru: "Комментарий добавлен.",
    uz: "Izoh qo'shildi."
  },
  commentUpdated: {
    tr: "Yorum güncellendi.",
    en: "Comment updated.",
    ru: "Комментарий обновлён.",
    uz: "Izoh yangilandi."
  },
  commentsTitle: { tr: "Yorumlar", en: "Comments", ru: "Комментарии", uz: "Izohlar" },
  commentEmptyShort: {
    tr: "Henüz yorum yok.",
    en: "No comments yet.",
    ru: "Пока нет комментариев.",
    uz: "Hali izoh yo'q."
  },
  sendComment: { tr: "Yorumu gönder", en: "Send comment", ru: "Отправить комментарий", uz: "Izohni yuborish" },
  editCommentTitle: { tr: "Yorumu düzenle", en: "Edit comment", ru: "Редактировать комментарий", uz: "Izohni tahrirlash" },
  editCommentHint: {
    tr: "Yorumu düzenleyip kaydedin. Her yorum yalnızca bir kez düzenlenebilir.",
    en: "Edit and save. Each comment can be edited once.",
    ru: "Отредактируйте и сохраните. Каждый комментарий можно изменить один раз.",
    uz: "Izohni tahrirlang va saqlang. Har bir izoh faqat bir marta tahrirlanadi."
  },
  editCommentPlaceholder: {
    tr: "Yorum metni...",
    en: "Comment text...",
    ru: "Текст комментария...",
    uz: "Izoh matni..."
  },
  save: { tr: "Kaydet", en: "Save", ru: "Сохранить", uz: "Saqlash" },
  reportCommentTitle: { tr: "Yorumu bildir", en: "Report comment", ru: "Пожаловаться на комментарий", uz: "Izohni shikoyat qilish" },
  reportCommentHint: {
    tr: "Nedenini kısaca yazın.",
    en: "Briefly describe the issue.",
    ru: "Кратко опишите проблему.",
    uz: "Muammoni qisqacha yozing."
  },
  reportCommentSubject: {
    tr: "Keşfet yorumu şikayeti",
    en: "Discover comment report",
    ru: "Жалоба на комментарий в ленте",
    uz: "Keşfet izohi shikoyati"
  },
  reportCommentReceivedBody: {
    tr: "Ekibimiz yorumu inceleyecek.",
    en: "Our team will review the comment.",
    ru: "Наша команда рассмотрит комментарий.",
    uz: "Jamoamiz izohni ko'rib chiqadi."
  }
} satisfies Record<string, LocalizedCopy>;

export const homeCopy = {
  welcome: { tr: "Hoş geldin,", en: "Welcome,", ru: "Добро пожаловать,", uz: "Xush kelibsiz," },
  dailyArtwork: { tr: "Günün Eseri", en: "Artwork of the Day", ru: "Произведение дня", uz: "Kun asari" },
  artJourney: { tr: "Sanat Yolculuğun", en: "Your Art Journey", ru: "Ваш путь в искусстве", uz: "San'at sayohatingiz" },
  journeyShort: { tr: "Yolculuk", en: "Journey", ru: "Путь", uz: "Sayohat" },
  continueJourney: { tr: "Kaldığın Yerden", en: "Continue Your Journey", ru: "Продолжить путь", uz: "Davom eting" },
  forYou: { tr: "Senin İçin", en: "For You", ru: "Для вас", uz: "Siz uchun" },
  curatorSelection: { tr: "Özel küratör seçimi", en: "Private curator selection", ru: "Выбор личного куратора", uz: "Shaxsiy kurator tanlovi" },
  quickDiscovery: { tr: "Hızlı Keşif", en: "Quick Discovery", ru: "Быстрое открытие", uz: "Tezkor kashfiyot" },
  dailyMission: { tr: "Günün Mini Görevi", en: "Daily Mini Challenge", ru: "Задание дня", uz: "Kunlik mini vazifa" },
  artistDiscovery: { tr: "Günün Sanatçısı", en: "Artist of the Day", ru: "Художник дня", uz: "Kun rassomi" },
  readingToday: { tr: "Bugünün Okuması", en: "Today's Reading", ru: "Чтение дня", uz: "Bugungi mutolaa" },
  popularNew: { tr: "Yeni ve Yeniden Keşfedilen", en: "New & Rediscovered", ru: "Новое и вновь открытое", uz: "Yangi va qayta kashf etilgan" },
  achievements: { tr: "Başarıların", en: "Your Achievements", ru: "Ваши достижения", uz: "Yutuqlaringiz" },
  openArtwork: { tr: "Eseri keşfet", en: "Explore artwork", ru: "Открыть произведение", uz: "Asarni kashf etish" },
  openArtist: { tr: "Sanatçıyı keşfet", en: "Explore artist", ru: "Открыть художника", uz: "Rassomni kashf etish" },
  startReading: { tr: "Okumaya başla", en: "Start reading", ru: "Начать чтение", uz: "O'qishni boshlash" },
  seeAll: { tr: "Tümünü gör", en: "See all", ru: "Смотреть все", uz: "Barchasini ko'rish" },
  seeJourney: { tr: "Yolculuğu aç", en: "Open journey", ru: "Открыть путь", uz: "Sayohatni ochish" },
  continueAction: { tr: "Devam et", en: "Continue", ru: "Продолжить", uz: "Davom etish" },
  stageComplete: { tr: "Tamamlandı", en: "Completed", ru: "Завершено", uz: "Tugallandi" },
  stageCurrent: { tr: "Şu an buradasın", en: "You are here", ru: "Вы здесь", uz: "Siz shu yerdasiz" },
  stageAvailable: { tr: "Hazır", en: "Available", ru: "Доступно", uz: "Tayyor" },
  stageLocked: { tr: "Kilitli", en: "Locked", ru: "Заблокировано", uz: "Qulflangan" },
  journeyEmpty: { tr: "Yolculuk, yayınlanmış içerikler eklendikçe otomatik oluşacak.", en: "Your journey will grow automatically as published content is added.", ru: "Путь будет автоматически расширяться по мере публикации материалов.", uz: "Nashr etilgan kontent qo'shilgan sari sayohat avtomatik kengayadi." },
  journeySyncHint: { tr: "Oturum açtığında ilerlemen cihazlar arasında korunur.", en: "Sign in to keep your progress across devices.", ru: "Войдите, чтобы сохранить прогресс на всех устройствах.", uz: "Jarayonni qurilmalar orasida saqlash uchun tizimga kiring." },
  journeyProgress: { tr: "yolculuk tamamlandı", en: "journey completed", ru: "пути завершено", uz: "sayohat tugallandi" },
  chapterLabel: { tr: "{n}. Bölüm", en: "Chapter {n}", ru: "Глава {n}", uz: "{n}-bo'lim" },
  openActivity: { tr: "Etkinliği aç", en: "Open activity", ru: "Открыть задание", uz: "Faoliyatni ochish" },
  openActivityShort: { tr: "Aç", en: "Open", ru: "Открыть", uz: "Ochish" },
  confirmActivity: { tr: "İncelemeyi tamamla", en: "Complete this discovery", ru: "Завершить знакомство", uz: "Kashfiyotni tugallash" },
  confirmActivityShort: { tr: "Tamamla", en: "Complete", ru: "Завершить", uz: "Tugatish" },
  completeHint: { tr: "Önce etkinliği açıp incele, sonra tamamla.", en: "Open and explore the activity before completing it.", ru: "Сначала откройте и изучите материал, затем завершите этап.", uz: "Avval faoliyatni ochib o'rganing, keyin tugallang." },
  difficultyBeginner: { tr: "Başlangıç", en: "Beginner", ru: "Начальный", uz: "Boshlang'ich" },
  difficultyIntermediate: { tr: "Orta", en: "Intermediate", ru: "Средний", uz: "O'rta" },
  difficultyAdvanced: { tr: "İleri", en: "Advanced", ru: "Продвинутый", uz: "Yuqori" },
  reasonDaily: { tr: "Bugünün seçkisi", en: "Today's selection", ru: "Выбор дня", uz: "Bugungi tanlov" },
  reasonMuseum: { tr: "Müzendeki seçimlere göre", en: "Based on your museum", ru: "По мотивам вашего музея", uz: "Muzeyingiz asosida" },
  reasonFavorite: { tr: "Favorilerine göre", en: "Based on your favorites", ru: "На основе избранного", uz: "Sevimlilaringiz asosida" },
  reasonInterest: { tr: "İlgi alanlarına göre", en: "Matches your interests", ru: "По вашим интересам", uz: "Qiziqishlaringizga mos" },
  reasonUnseen: { tr: "Henüz keşfetmedin", en: "New to you", ru: "Новое для вас", uz: "Siz uchun yangi" },
  reasonFresh: { tr: "Yeni seçki", en: "Fresh selection", ru: "Новая подборка", uz: "Yangi tanlov" },
  reasonExplore: { tr: "Yeni bir yön keşfet", en: "Explore something different", ru: "Откройте новое направление", uz: "Yangi yo'nalishni kashf eting" },
  greetingMorningNew: { tr: "Güne bir eserle başla", en: "Start the day with art", ru: "Начните день с искусства", uz: "Kunni san'at bilan boshlang" },
  greetingMorningReturning: { tr: "Yeni bir ayrıntı seni bekliyor", en: "A new detail is waiting", ru: "Вас ждёт новая деталь", uz: "Yangi bir tafsilot sizni kutmoqda" },
  greetingAfternoon: { tr: "Bugün ne keşfedeceksin?", en: "What will you discover today?", ru: "Что вы откроете сегодня?", uz: "Bugun nimani kashf etasiz?" },
  greetingEvening: { tr: "Akşamı sanatla yavaşlat", en: "Slow down with art", ru: "Завершите день с искусством", uz: "Kechani san'at bilan sokinlashtiring" },
  greetingJourney: { tr: "Yolculuğun seni bekliyor", en: "Your journey is waiting", ru: "Ваш путь продолжается", uz: "Sayohatingiz sizni kutmoqda" },
  greetingMuseum: { tr: "Müzenden yeni bir iz sür", en: "Follow a new trail from your museum", ru: "Продолжите путь из своего музея", uz: "Muzeyingizdan yangi iz toping" },
  challengeDetective: { tr: "Sanat Dedektifi", en: "Art Detective", ru: "Арт-детектив", uz: "San'at detektivi" },
  challengeArtworkTimeline: { tr: "Eserleri Zamanla", en: "Artwork Timeline", ru: "Хронология произведений", uz: "Asarlar xronologiyasi" },
  challengeArtistTimeline: { tr: "Sanatçıları Zamanla", en: "Artist Timeline", ru: "Хронология художников", uz: "Rassomlar xronologiyasi" },
  challengeSubtitle: { tr: "Günlük hakkını kullan ve sanat bilgisini sınayarak ilerle.", en: "Use your daily play and test your art knowledge.", ru: "Используйте ежедневную попытку и проверьте знания об искусстве.", uz: "Kunlik imkoniyatingizdan foydalanib san'at bilimingizni sinang." },
  startChallenge: { tr: "Göreve başla", en: "Start challenge", ru: "Начать задание", uz: "Vazifani boshlash" },
  museumCount: { tr: "Müze seçkisi", en: "Museum picks", ru: "В музее", uz: "Muzey tanlovi" },
  readCount: { tr: "Keşfedilen eser", en: "Artworks explored", ru: "Изучено работ", uz: "Kashf etilgan asar" },
  scoreCount: { tr: "Toplam puan", en: "Total score", ru: "Общий счёт", uz: "Umumiy ball" },
  journeyCount: { tr: "Yolculuk adımı", en: "Journey stages", ru: "Этапов пути", uz: "Sayohat bosqichi" },
  contentUnavailable: { tr: "Bu bölüm için yayınlanmış içerik henüz hazır değil.", en: "Published content for this section is not ready yet.", ru: "Опубликованные материалы для этого раздела пока недоступны.", uz: "Bu bo'lim uchun nashr etilgan kontent hali tayyor emas." },
  retry: { tr: "Yeniden dene", en: "Try again", ru: "Повторить", uz: "Qayta urinish" },
  premiumSubtitle: { tr: "Ayrıcalıklı deneyim", en: "Privileged experience", ru: "Премиум-возможности", uz: "Maxsus tajriba" },
  feedSubtitle: { tr: "Yazılar ve alıntılar", en: "Posts and quotes", ru: "Записи и цитаты", uz: "Yozuvlar va iqtiboslar" },
  gallerySubtitle: { tr: "Okuma koleksiyonu", en: "Reading collection", ru: "Коллекция для чтения", uz: "O'qish to'plami" },
  eventsSubtitle: { tr: "Kitap ve film önerileri", en: "Books and films", ru: "Книги и фильмы", uz: "Kitob va film tavsiyalari" },
  articlesSubtitle: { tr: "Kısa okumalar", en: "Short reads", ru: "Короткие материалы", uz: "Qisqa maqolalar" },
  myMuseum: { tr: "Benim Müzem", en: "My Museum", ru: "Мой музей", uz: "Mening muzeyim" },
  museumSubtitle: { tr: "Kendi seçkin", en: "Your collection", ru: "Ваша коллекция", uz: "Shaxsiy to'plamingiz" },
  gamesSubtitle: { tr: "Sanat Dedektifi ve haftalık yarışma", en: "Art Detective and weekly challenge", ru: "Арт-детектив и недельный конкурс", uz: "San'at detektivi va haftalik tanlov" },
  seerDuel: { tr: "Kahin Düellosu", en: "Seer Duel", ru: "Дуэль провидцев", uz: "Kohin dueli" },
  duelSubtitle: { tr: "Düello ve kehanetler", en: "Duels and predictions", ru: "Дуэли и предсказания", uz: "Duellar va bashoratlar" },
  chanceCard: { tr: "Şans Kartı", en: "Chance Card", ru: "Карта удачи", uz: "Omad kartasi" },
  chanceSubtitle: { tr: "Günlük tek hak", en: "One daily draw", ru: "Одна попытка в день", uz: "Kunlik bir urinish" },
  rankingSubtitle: { tr: "Yarışma ve oyun listeleri", en: "Contest and game lists", ru: "Рейтинги конкурсов и игр", uz: "Tanlov va o'yin reytinglari" },
  rewardsSubtitle: { tr: "Yarışma ödülleri", en: "Challenge awards", ru: "Награды конкурсов", uz: "Tanlov mukofotlari" },
  featuredArtwork: { tr: "Öne çıkan eser", en: "Featured work", ru: "Избранная работа", uz: "Tanlangan asar" },
  exploreNavigate: { tr: "Keşif ve hızlı geçiş", en: "Explore & navigate", ru: "Поиск и быстрый переход", uz: "Kashfiyot va tez o'tish" },
  challengesGames: { tr: "Yarışmalar ve oyunlar", en: "Challenges & games", ru: "Конкурсы и игры", uz: "Tanlovlar va o'yinlar" },
  atlasClub: { tr: "Atlas Club", en: "Atlas Club", ru: "Atlas Club", uz: "Atlas Club" },
  atlasClubHint: { tr: "Yarışmalar ve oyunları keşfet", en: "Explore competitions and games", ru: "Открыть конкурсы и игры", uz: "Tanlovlar va o'yinlarni kashf et" },
  following: { tr: "Takip ettiklerim", en: "Following", ru: "Мои подписки", uz: "Kuzatayotganlarim" },
  followingEmpty: {
    tr: "Takip ettiklerinden yeni içerik yok. Keşfet bölümünden yeni profiller bulabilirsin.",
    en: "No new content from people you follow. Discover new profiles below.",
    ru: "У пользователей, на которых вы подписаны, пока нет новых материалов. Найдите новые профили ниже.",
    uz: "Kuzatayotganlaringizdan yangi kontent yo'q. Quyida yangi profillarni topishingiz mumkin."
  },
  discover: { tr: "Keşfet", en: "Discover", ru: "Найти", uz: "Kashf etish" },
  suggestedUsers: { tr: "Önerilen kullanıcılar", en: "Suggested users", ru: "Рекомендуемые пользователи", uz: "Tavsiya etilgan foydalanuvchilar" },
  follow: { tr: "Takip et", en: "Follow", ru: "Подписаться", uz: "Kuzatish" },
  showMore: { tr: "Daha fazla göster", en: "Show more", ru: "Показать ещё", uz: "Ko'proq ko'rsatish" },
  images: { tr: "Görseller", en: "Images", ru: "Изображения", uz: "Rasmlar" },
  posts: { tr: "Yazılar", en: "Posts", ru: "Записи", uz: "Yozuvlar" },
  themeLineDark: { tr: "Koyu Tema", en: "Dark Theme", ru: "Тёмная тема", uz: "Qorong'i mavzu" },
  themeLineLight: { tr: "Açık Tema", en: "Light Theme", ru: "Светлая тема", uz: "Yorug' mavzu" },
  themeLineVanGogh: { tr: "Van Gogh Teması", en: "Van Gogh Theme", ru: "Тема Van Gogh", uz: "Van Gogh mavzusi" },
  themeLineMonet: { tr: "Monet Teması", en: "Monet Theme", ru: "Тема Monet", uz: "Monet mavzusi" },
  themeLineDali: { tr: "Dalí Teması", en: "Dalí Theme", ru: "Тема Dalí", uz: "Dalí mavzusi" },
  themeLinePicasso: { tr: "Picasso Teması", en: "Picasso Theme", ru: "Тема Picasso", uz: "Picasso mavzusi" }
} satisfies Record<string, LocalizedCopy>;

export const postCopy = {
  title: { tr: "Gönderi", en: "Post", ru: "Запись", uz: "Post" },
  notFound: {
    tr: "Gönderi bulunamadı.",
    en: "Post not found.",
    ru: "Запись не найдена.",
    uz: "Post topilmadi."
  }
} satisfies Record<string, LocalizedCopy>;

export const notificationCopy = {
  markAllRead: {
    tr: "Tümünü okundu işaretle",
    en: "Mark all as read",
    ru: "Отметить все прочитанными",
    uz: "Hammasini o'qilgan deb belgilash"
  },
  countLabel: {
    tr: "bildirim",
    en: "notifications",
    ru: "уведомлений",
    uz: "bildirishnoma"
  }
} satisfies Record<string, LocalizedCopy>;

export const feedCopy = {
  addPost: { tr: "Gönderi ekle", en: "Add post", ru: "Добавить запись", uz: "Post qo'shish" },
  addPostHint: {
    tr: "Yazılar uygulamayı kullandığınız dile göre Keşfet'te görünür.",
    en: "Posts appear in Discover based on your app language.",
    ru: "Записи отображаются в ленте по выбранному языку приложения.",
    uz: "Yozuvlar ilova tanlangan tiliga ko'ra ko'rinadi."
  },
  newPosts: { tr: "Yeni gönderiler", en: "New posts", ru: "Новые записи", uz: "Yangi postlar" },
  premium: { tr: "Premium", en: "Premium", ru: "Premium", uz: "Premium" },
  popular: { tr: "Popüler", en: "Popular", ru: "Популярное", uz: "Ommabop" },
  contributors: { tr: "Haftanın üretkenleri", en: "Top contributors", ru: "Авторы недели", uz: "Hafta faollari" },
  activePosts: { tr: "aktif yazı", en: "active posts", ru: "записей", uz: "faol yozuv" },
  editPost: { tr: "Gönderiyi düzenle", en: "Edit post", ru: "Редактировать запись", uz: "Postni tahrirlash" },
  publishPost: { tr: "Paylaş", en: "Share", ru: "Опубликовать", uz: "Ulashish" },
  postPlaceholder: {
    tr: "Bir bilgi, cümle, söz veya kendi notunu yaz...",
    en: "Write a thought, quote, or note...",
    ru: "Напишите мысль, цитату или заметку...",
    uz: "Fikr, iqtibos yoki izoh yozing..."
  },
  hiddenPost: {
    tr: "Gizli gönderi - yalnızca sen görüyorsun.",
    en: "Hidden post - only you can see it.",
    ru: "Скрытая запись — видна только вам.",
    uz: "Yashirin post — faqat siz ko'rasiz."
  },
  reportPost: { tr: "Gönderiyi bildir", en: "Report post", ru: "Пожаловаться на запись", uz: "Postni shikoyat qilish" },
  reportHint: {
    tr: "Bildiriminiz ekibimize iletilecek.",
    en: "Your report will be sent to our team.",
    ru: "Жалоба будет передана нашей команде.",
    uz: "Shikoyatingiz jamoamizga yuboriladi."
  },
  reportReasonPlaceholder: {
    tr: "Kısa sebep yaz",
    en: "Write a short reason",
    ru: "Кратко укажите причину",
    uz: "Qisqa sabab yozing"
  },
  reportSignInRequired: {
    tr: "Gönderi bildirmek için oturum açmanız gerekir.",
    en: "Sign in to report a post.",
    ru: "Войдите, чтобы пожаловаться на запись.",
    uz: "Postni shikoyat qilish uchun tizimga kiring."
  },
  reportMissingTitle: { tr: "Eksik bilgi", en: "Missing details", ru: "Недостаточно данных", uz: "Ma'lumot yetarli emas" },
  reportMissingBody: {
    tr: "Lütfen kısa bir sebep yazın.",
    en: "Please write a short reason.",
    ru: "Пожалуйста, укажите краткую причину.",
    uz: "Iltimos, qisqa sabab yozing."
  },
  reportReceivedTitle: { tr: "Bildirim alındı", en: "Report received", ru: "Жалоба получена", uz: "Shikoyat qabul qilindi" },
  reportReceivedBody: {
    tr: "Bildiriminiz alındı. Ekibimiz en kısa sürede inceleyecek.",
    en: "Your report was received. Our team will review it shortly.",
    ru: "Жалоба получена. Наша команда скоро её рассмотрит.",
    uz: "Shikoyatingiz qabul qilindi. Jamoamiz tez orada ko'rib chiqadi."
  },
  reportFailedTitle: { tr: "Gönderilemedi", en: "Could not submit", ru: "Не удалось отправить", uz: "Yuborib bo'lmadi" },
  reportFailedBody: {
    tr: "Bildirim gönderilemedi. Lütfen tekrar deneyin.",
    en: "Could not submit the report. Please try again.",
    ru: "Не удалось отправить жалобу. Попробуйте еще раз.",
    uz: "Shikoyat yuborilmadi. Qayta urinib ko'ring."
  },
  reportSubject: {
    tr: "Keşfet yazısı bildirimi",
    en: "Discover post report",
    ru: "Жалоба на запись в ленте",
    uz: "Keşfet posti shikoyati"
  }
} satisfies Record<string, LocalizedCopy>;

export type FeedLanguageFilter = Language | "all";

export function feedLanguageFilterItems(language: Language) {
  return [
    { id: "all" as const, label: t(commonCopy.filterAll, language) },
    { id: "tr" as const, label: "TR" },
    { id: "uz" as const, label: "UZ" },
    { id: "ru" as const, label: "RU" },
    { id: "en" as const, label: "EN" }
  ];
}
