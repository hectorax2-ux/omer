import { Ionicons } from "@expo/vector-icons";
import { Language, LocalizedText } from "@/types/content";

export type UserRoleId =
  | "art_lover"
  | "artist"
  | "museum"
  | "collector"
  | "critic"
  | "researcher"
  | "educator"
  | "curator"
  | "art_patron"
  | "verified_gallery";
export type BadgeId =
  | "premium"
  | "weekly_winner"
  | "quiz_master"
  | "museum_explorer"
  | "editor_pick"
  | "trusted_member"
  | "top_writer"
  | "duel_champion"
  | "lucky_one";

export type TaxonomyItem<T extends string> = {
  id: T;
  icon: keyof typeof Ionicons.glyphMap;
  label: LocalizedText;
  description: LocalizedText;
};

export const roleItems: TaxonomyItem<UserRoleId>[] = [
  {
    id: "art_lover",
    icon: "heart",
    label: { tr: "Sanatsever", en: "Art lover", ru: "Любитель искусства", uz: "San'atsevar" },
    description: {
      tr: "Uygulamaya katılan herkesin başlangıç rolüdür. Eserleri, yazıları ve topluluk içeriklerini takip eder.",
      en: "The starting role for every member. It follows artworks, posts, and community content.",
      ru: "Начальная роль каждого участника: просмотр работ, текстов и сообщества.",
      uz: "Har bir foydalanuvchining boshlang'ich roli; asarlar, yozuvlar va hamjamiyatni kuzatadi."
    }
  },
  {
    id: "artist",
    icon: "brush",
    label: { tr: "Sanatçı", en: "Artist", ru: "Художник", uz: "San'atkor" },
    description: {
      tr: "Sanat üretimi ve paylaşımıyla öne çıkan profillere verilir.",
      en: "Awarded to profiles known for creative work and sharing.",
      ru: "Присваивается профилям с заметным творчеством и публикациями.",
      uz: "Ijodiy ish va ulashuv bilan ajralgan profillarga beriladi."
    }
  },
  {
    id: "museum",
    icon: "business",
    label: { tr: "Müze", en: "Museum", ru: "Музей", uz: "Muzey" },
    description: {
      tr: "Müze, koleksiyon veya kültür kurumu kimliğiyle doğrulanan hesaplar için kullanılır.",
      en: "Used for verified museum, collection, or cultural institution accounts.",
      ru: "Для подтвержденных музеев, коллекций и культурных институций.",
      uz: "Tasdiqlangan muzey, kolleksiya yoki madaniyat muassasalari uchun."
    }
  },
  {
    id: "collector",
    icon: "albums",
    label: { tr: "Koleksiyoner", en: "Collector", ru: "Коллекционер", uz: "Kolleksioner" },
    description: {
      tr: "Sanat koleksiyonu, seçki ve arşiv ilgisiyle öne çıkan hesaplar için atanır.",
      en: "Assigned to accounts focused on art collections, selections, and archives.",
      ru: "Для аккаунтов, связанных с коллекциями и архивами искусства.",
      uz: "San'at kolleksiyasi, tanlov va arxivga qiziqqan profillar uchun."
    }
  },
  {
    id: "critic",
    icon: "create",
    label: { tr: "Eleştirmen", en: "Critic", ru: "Критик", uz: "Tanqidchi" },
    description: {
      tr: "Sanat eleştirisi ve yorum kültüründe nitelikli katkı sağlayan profillere verilir.",
      en: "For profiles contributing qualified art criticism and commentary.",
      ru: "Для качественного вклада в художественную критику.",
      uz: "San'at tanqidi va sharhlariga sifatli hissa qo'shuvchilar uchun."
    }
  },
  {
    id: "researcher",
    icon: "search-circle",
    label: { tr: "Araştırmacı", en: "Researcher", ru: "Исследователь", uz: "Tadqiqotchi" },
    description: {
      tr: "Sanat tarihi araştırması, kaynak ve içerik üretiminde güvenilir profiller için atanır.",
      en: "For trusted profiles in art history research, references, and content production.",
      ru: "Для надежных профилей в исследовании истории искусства.",
      uz: "San'at tarixi tadqiqoti va manbalar bilan ishlaydigan profillar uchun."
    }
  },
  {
    id: "educator",
    icon: "school",
    label: { tr: "Eğitmen", en: "Educator", ru: "Преподаватель", uz: "O'qituvchi" },
    description: {
      tr: "Sanat eğitimi, atölye veya öğretici içeriklerle katkı sağlayan profillere verilir.",
      en: "For profiles contributing art education, workshops, or instructive content.",
      ru: "Для образовательных профилей, мастерских и обучающего контента.",
      uz: "San'at ta'limi, ustaxona yoki o'quv kontenti yaratuvchilari uchun."
    }
  },
  {
    id: "curator",
    icon: "library",
    label: { tr: "Küratör", en: "Curator", ru: "Куратор", uz: "Kurator" },
    description: {
      tr: "Seçki, öneri ve sanat içeriklerinde güvenilir katkı sağlayan profillere verilir.",
      en: "For trusted profiles contributing to selections, recommendations, and art content.",
      ru: "Для надежных профилей в подборках, рекомендациях и арт-контенте.",
      uz: "Tanlov, tavsiya va san'at kontentida ishonchli hissa qo'shuvchi profillarga beriladi."
    }
  },
  {
    id: "art_patron",
    icon: "medal",
    label: { tr: "Sanat Hamisi", en: "Art Patron", ru: "Меценат искусства", uz: "San'at homiysi" },
    description: {
      tr: "Sanat üretimini, etkinlikleri veya topluluk gelişimini destekleyen profiller için atanır.",
      en: "Assigned to profiles supporting art production, events, or community growth.",
      ru: "Для профилей, поддерживающих искусство и развитие сообщества.",
      uz: "San'at, tadbirlar yoki hamjamiyat rivojini qo'llab-quvvatlovchilar uchun."
    }
  },
  {
    id: "verified_gallery",
    icon: "storefront",
    label: { tr: "Onaylı Galeri", en: "Verified Gallery", ru: "Подтвержденная галерея", uz: "Tasdiqlangan galereya" },
    description: {
      tr: "Kimliği doğrulanmış galeri ve kurumsal sanat profilleri için kullanılır.",
      en: "Used for verified gallery and institutional art profiles.",
      ru: "Для подтвержденных галерей и институциональных арт-профилей.",
      uz: "Tasdiqlangan galereya va institutsional san'at profillari uchun."
    }
  }
];

export const badgeItems: TaxonomyItem<BadgeId>[] = [
  {
    id: "premium",
    icon: "diamond",
    label: { tr: "Premium", en: "Premium", ru: "Премиум", uz: "Premium" },
    description: {
      tr: "Reklamsız kullanım, özel görünüm ve ileride eklenecek ayrıcalıklar için planlanan üyelik rozetidir.",
      en: "A membership badge for ad-free use, special styling, and future privileges.",
      ru: "Значок для премиум-доступа, оформления и будущих привилегий.",
      uz: "Reklamasiz foydalanish, maxsus ko'rinish va kelajak imtiyozlari uchun."
    }
  },
  {
    id: "weekly_winner",
    icon: "trophy",
    label: { tr: "Haftanın Kazananı", en: "Weekly Winner", ru: "Победитель недели", uz: "Hafta g'olibi" },
    description: {
      tr: "Resim Yarışması'nda net puanla öne çıkan kullanıcıya verilebilir.",
      en: "May be awarded to the member leading the image contest by net score.",
      ru: "За лидерство в недельной подборке по чистому баллу.",
      uz: "Haftalik tanlovda net ball bo'yicha yetakchiga beriladi."
    }
  },
  {
    id: "quiz_master",
    icon: "school",
    label: { tr: "Quiz Ustası", en: "Quiz Master", ru: "Мастер квиза", uz: "Quiz ustasi" },
    description: {
      tr: "Quiz ve yarışmalarda yüksek performans gösteren kullanıcılara atanabilir.",
      en: "Can be assigned to members with high quiz performance.",
      ru: "Для участников с высоким результатом в квизах.",
      uz: "Quizlarda yuqori natija ko'rsatgan foydalanuvchilar uchun."
    }
  },
  {
    id: "museum_explorer",
    icon: "business",
    label: { tr: "Müze Gezgini", en: "Museum Explorer", ru: "Исследователь музеев", uz: "Muzey sayyohi" },
    description: {
      tr: "Müze kültürüyle ilgili aktif keşif ve katkıları temsil eder.",
      en: "Represents active museum-culture discovery and contribution.",
      ru: "Отражает активность в музейной культуре.",
      uz: "Muzey madaniyatidagi faol kashfiyot va hissa uchun."
    }
  },
  {
    id: "editor_pick",
    icon: "star",
    label: { tr: "Editör Seçimi", en: "Editor's Pick", ru: "Выбор редакции", uz: "Muharrir tanlovi" },
    description: {
      tr: "Art Atlas ekibinin öne çıkardığı nitelikli profiller için kullanılır.",
      en: "Used for qualified profiles highlighted by the Art Atlas team.",
      ru: "Для профилей, отмеченных командой Art Atlas.",
      uz: "Art Atlas jamoasi ajratgan sifatli profillar uchun."
    }
  },
  {
    id: "trusted_member",
    icon: "shield-checkmark",
    label: { tr: "Güvenilir Üye", en: "Trusted Member", ru: "Надежный участник", uz: "Ishonchli a'zo" },
    description: {
      tr: "Düzenli, güvenilir ve topluluk kurallarına uygun katkı sağlayan üyelere verilir.",
      en: "For members with consistent, trusted, guideline-friendly contributions.",
      ru: "Для регулярного и надежного вклада по правилам сообщества.",
      uz: "Doimiy, ishonchli va qoidalarga mos hissa qo'shuvchilar uchun."
    }
  },
  {
    id: "top_writer",
    icon: "reader",
    label: { tr: "Haftanın Yazarı", en: "Writer of the Week", ru: "Автор недели", uz: "Hafta yozuvchisi" },
    description: {
      tr: "Keşfet yazılarında üretkenlik ve kaliteyle öne çıkan kullanıcılara verilebilir.",
      en: "May be awarded to users standing out in Discover posts for quality and productivity.",
      ru: "Для авторов, выделившихся качеством и активностью.",
      uz: "Keşfet yozuvlarida sifat va faollik bilan ajralganlar uchun."
    }
  },
  {
    id: "duel_champion",
    icon: "flash",
    label: { tr: "Düello Şampiyonu", en: "Duel Champion", ru: "Чемпион дуэлей", uz: "Duel chempioni" },
    description: {
      tr: "Düello yarışmalarında haftalık veya dönemsel olarak öne çıkan kullanıcılara verilebilir.",
      en: "May be awarded to members standing out in duel contests weekly or seasonally.",
      ru: "Для участников, выделившихся в дуэлях за неделю или сезон.",
      uz: "Duel bellashuvlarida haftalik yoki mavsumiy ajralgan foydalanuvchilar uchun."
    }
  },
  {
    id: "lucky_one",
    icon: "gift",
    label: { tr: "Şanslı Üye", en: "Lucky Member", ru: "Удачливый участник", uz: "Omadli a'zo" },
    description: {
      tr: "Şans Kartı sıralamalarında öne çıkan kullanıcılara verilecek eğlenceli başarı rozetidir.",
      en: "A playful achievement badge for members leading Chance Card rankings.",
      ru: "Игровой значок для лидеров рейтинга карты удачи.",
      uz: "Omad karti reytingida ajralgan foydalanuvchilar uchun nishon."
    }
  }
];

export function getRoleItem(role: UserRoleId) {
  return roleItems.find((item) => item.id === role) ?? roleItems[0];
}

export function getBadgeItem(badge: BadgeId) {
  return badgeItems.find((item) => item.id === badge);
}

export function getRoleLabel(role: UserRoleId, language: Language) {
  return getRoleItem(role).label[language];
}

export function getRoleIcon(role: UserRoleId) {
  return getRoleItem(role).icon;
}
