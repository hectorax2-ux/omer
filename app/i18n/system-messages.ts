import { Language } from "@/types/content";
import { LocalizedCopy, t, tFormat } from "@/utils/localized-text";

const chanceCard = {
  signInRequired: {
    tr: "Şans kartı için giriş yapmalısın.",
    en: "Sign in to open your chance card.",
    ru: "Войдите, чтобы открыть карту удачи.",
    uz: "Omad kartasini ochish uchun tizimga kiring."
  },
  loadingDraws: {
    tr: "Şans kartı kayıtların yükleniyor. Birkaç saniye sonra tekrar dene.",
    en: "Loading your chance card records. Try again in a few seconds.",
    ru: "Загружаются записи карты удачи. Попробуйте через несколько секунд.",
    uz: "Omad kartasi yozuvlari yuklanmoqda. Bir necha soniyadan keyin qayta urinib ko'ring."
  },
  openFailed: {
    tr: "Şans kartı şu anda açılamadı. Bağlantını kontrol edip tekrar dene.",
    en: "The chance card could not be opened. Check your connection and try again.",
    ru: "Не удалось открыть карту удачи. Проверьте подключение и повторите попытку.",
    uz: "Omad kartasini ochib bo'lmadi. Internetni tekshirib, qayta urinib ko'ring."
  },
  premiumSecondUsed: {
    tr: "Premium ikinci şans hakkını bugün kullandın.",
    en: "You already used your Premium second chance today.",
    ru: "Вы уже использовали второй Premium-шанс сегодня.",
    uz: "Bugun Premium ikkinchi imkoniyatingizdan foydalandingiz."
  },
  dailyLimit: {
    tr: "Şans kartı günde 1 kez açılabilir. Premium kullanıcılar ikinci şansını deneyebilir.",
    en: "The chance card opens once per day. Premium members can try a second chance.",
    ru: "Карту удачи можно открыть один раз в день. Premium-пользователи могут попробовать второй шанс.",
    uz: "Omad kartasi kuniga 1 marta ochiladi. Premium foydalanuvchilar ikkinchi imkoniyatni sinab ko'rishlari mumkin."
  },
  openedUpdated: {
    tr: "Şans kartı açıldı. Bugünkü aktif puanın güncellendi.",
    en: "Chance card opened. Your active score for today was updated.",
    ru: "Карта удачи открыта. Ваш активный результат за сегодня обновлен.",
    uz: "Omad kartasi ochildi. Bugungi faol ballingiz yangilandi."
  },
  openedKeptBest: {
    tr: "Şans kartı açıldı. Bugünkü yüksek puanın korundu.",
    en: "Chance card opened. Your best score for today was kept.",
    ru: "Карта удачи открыта. Ваш лучший результат за сегодня сохранен.",
    uz: "Omad kartasi ochildi. Bugungi eng yuqori ballingiz saqlandi."
  }
} satisfies Record<string, LocalizedCopy>;

const duel = {
  voteAlreadySame: {
    tr: "Bu seçenek için oyun zaten kayıtlı.",
    en: "Your vote for this option is already saved.",
    ru: "Ваш голос за этот вариант уже сохранен.",
    uz: "Bu variant uchun ovozingiz allaqachon saqlangan."
  },
  voteAlreadyCast: {
    tr: "Bu eşleşmeye daha önce oy verdin.",
    en: "You already voted in this match.",
    ru: "Вы уже голосовали в этом поединке.",
    uz: "Bu duelda avval ovoz bergansiz."
  },
  premiumVoteChangeUsed: {
    tr: "Premium oy değiştirme hakkını kullandın.",
    en: "You already used your Premium vote change.",
    ru: "Вы уже использовали Premium-смену голоса.",
    uz: "Premium ovozni o'zgartirish huquqidan foydalandingiz."
  },
  signInToVote: {
    tr: "Oy kullanmak için giriş yapmalısın.",
    en: "Sign in to vote.",
    ru: "Войдите, чтобы проголосовать.",
    uz: "Ovoz berish uchun tizimga kiring."
  },
  voteUpdated: {
    tr: "Oyun güncellendi.",
    en: "Your vote was updated.",
    ru: "Ваш голос обновлен.",
    uz: "Ovozingiz yangilandi."
  },
  voteSaved: {
    tr: "Oyun kaydedildi.",
    en: "Your vote was saved.",
    ru: "Ваш голос сохранен.",
    uz: "Ovozingiz saqlandi."
  },
  signInToPredict: {
    tr: "Tahmin yapmak için giriş yapmalısın.",
    en: "Sign in to make a prediction.",
    ru: "Войдите, чтобы сделать прогноз.",
    uz: "Bashorat qilish uchun tizimga kiring."
  }
} satisfies Record<string, LocalizedCopy>;

const artDna = {
  lengthInvalid: {
    tr: "Sanat DNA metni {min}-{max} karakter olmalı.",
    en: "Art DNA text must be {min}-{max} characters.",
    ru: "Текст Art DNA должен содержать {min}-{max} символов.",
    uz: "San'at DNA matni {min}-{max} belgidan iborat bo'lishi kerak."
  },
  alreadyCreatedToday: {
    tr: "Sanat DNA bugün zaten oluşturuldu.",
    en: "Art DNA was already created today.",
    ru: "Art DNA уже создан сегодня.",
    uz: "San'at DNA bugun allaqachon yaratilgan."
  },
  ready: {
    tr: "Sanat DNA hazır.",
    en: "Art DNA is ready.",
    ru: "Art DNA готов.",
    uz: "San'at DNA tayyor."
  }
} satisfies Record<string, LocalizedCopy>;

const museum = {
  nameLengthInvalid: {
    tr: "Müze adı {min}-{max} karakter olmalı.",
    en: "Museum name must be {min}-{max} characters.",
    ru: "Название музея должно содержать {min}-{max} символов.",
    uz: "Muzey nomi {min}-{max} belgidan iborat bo'lishi kerak."
  },
  onlyOneAllowed: {
    tr: "Her kullanıcı yalnızca 1 müze oluşturabilir.",
    en: "Each user can create only one museum.",
    ru: "Каждый пользователь может создать только один музей.",
    uz: "Har bir foydalanuvchi faqat 1 ta muzey yaratishi mumkin."
  },
  weeklyLimit: {
    tr: "Herkes haftada 1 müze oluşturabilir. Premium kullanıcılar beklemeden tekrar oluşturabilir.",
    en: "Everyone can create one museum per week. Premium members can recreate without waiting.",
    ru: "Каждый может создать один музей в неделю. Premium-пользователи могут создать снова без ожидания.",
    uz: "Har kim haftada 1 ta muzey yaratishi mumkin. Premium foydalanuvchilar kutmasdan qayta yaratishi mumkin."
  },
  created: {
    tr: "Müzen oluşturuldu.",
    en: "Your museum was created.",
    ru: "Ваш музей создан.",
    uz: "Muzeyingiz yaratildi."
  },
  notFound: {
    tr: "Müze bulunamadı.",
    en: "Museum not found.",
    ru: "Музей не найден.",
    uz: "Muzey topilmadi."
  },
  bioTooLong: {
    tr: "Müze biyografisi en fazla {max} karakter olmalı.",
    en: "Museum bio must be at most {max} characters.",
    ru: "Биография музея должна содержать не более {max} символов.",
    uz: "Muzey bio matni ko'pi bilan {max} belgidan iborat bo'lishi kerak."
  },
  updated: {
    tr: "Müze bilgileri güncellendi.",
    en: "Museum details were updated.",
    ru: "Данные музея обновлены.",
    uz: "Muzey ma'lumotlari yangilandi."
  },
  deleted: {
    tr: "Müzen silindi.",
    en: "Your museum was deleted.",
    ru: "Ваш музей удален.",
    uz: "Muzeyingiz o'chirildi."
  },
  createFirst: {
    tr: "Önce müzeni oluştur.",
    en: "Create your museum first.",
    ru: "Сначала создайте музей.",
    uz: "Avval muzeyingizni yarating."
  },
  signInRequired: {
    tr: "Müze oluşturmak için giriş yapmanız gerekir.",
    en: "Sign in to create a museum.",
    ru: "Войдите, чтобы создать музей.",
    uz: "Muzey yaratish uchun tizimga kiring."
  },
  artworkRemoved: {
    tr: "Eser müzenden kaldırıldı.",
    en: "Artwork removed from your museum.",
    ru: "Произведение удалено из вашего музея.",
    uz: "Asar muzeyingizdan olib tashlandi."
  },
  artworkLimit: {
    tr: "Bir müzede en fazla {limit} eser olabilir.",
    en: "A museum can contain at most {limit} artworks.",
    ru: "В музее может быть не более {limit} произведений.",
    uz: "Bir muzeyda ko'pi bilan {limit} ta asar bo'lishi mumkin."
  },
  artworkLimitPremium: {
    tr: "Normal üyeler en fazla 8 eser ekleyebilir. Premium ile 100 esere kadar yükseltebilirsin.",
    en: "Standard members can add up to 8 artworks. Upgrade to Premium for up to 100.",
    ru: "Обычные участники могут добавить до 8 работ. Premium — до 100.",
    uz: "Oddiy a'zolar ko'pi bilan 8 ta asar qo'sha oladi. Premium bilan 100 tagacha."
  },
  artworkAdded: {
    tr: "Eser müzene eklendi.",
    en: "Artwork added to your museum.",
    ru: "Произведение добавлено в ваш музей.",
    uz: "Asar muzeyingizga qo'shildi."
  }
} satisfies Record<string, LocalizedCopy>;

const timeCapsule = {
  signInRequired: {
    tr: "Sanatçıya mektup yazmak için giriş yapmalısın.",
    en: "Sign in to write a letter to the artist.",
    ru: "Войдите, чтобы написать письмо художнику.",
    uz: "Rassomga maktub yozish uchun tizimga kiring."
  },
  premiumOnly: {
    tr: "Sanatçıya mektup yalnızca Premium kullanıcılar içindir.",
    en: "Letter to the Artist is only for Premium members.",
    ru: "Письмо художнику доступно только Premium-пользователям.",
    uz: "Rassomga maktub faqat Premium foydalanuvchilar uchun."
  },
  lengthInvalid: {
    tr: "Mektup {min}-{max} karakter olmalı.",
    en: "The letter must be {min}-{max} characters.",
    ru: "Письмо должно содержать {min}-{max} символов.",
    uz: "Maktub {min}-{max} belgidan iborat bo'lishi kerak."
  },
  titleInvalid: {
    tr: "Başlık {min}-{max} karakter olmalı.",
    en: "The title must be {min}-{max} characters.",
    ru: "Заголовок должен содержать {min}-{max} символов.",
    uz: "Sarlavha {min}-{max} belgidan iborat bo'lishi kerak."
  },
  artistRequired: {
    tr: "Sanatçılar listesinden bir sanatçı seçmelisin.",
    en: "Choose an artist from the Artists list.",
    ru: "Выберите художника из списка «Художники».",
    uz: "San'atkorlar ro'yxatidan rassom tanlang."
  },
  dailyLimit: {
    tr: "Günde 1 mektup gönderme hakkın var.",
    en: "You can send 1 letter per day.",
    ru: "Можно отправить 1 письмо в день.",
    uz: "Kuniga 1 ta maktub yuborish huquqingiz bor."
  },
  scheduled: {
    tr: "Mektubun teslim alındı. Sanatçıya ulaştırılmak üzere alındı.",
    en: "Your letter was received to be delivered to the artist.",
    ru: "Письмо принято для передачи художнику.",
    uz: "Maktubingiz qabul qilindi. Rassomga yetkazilishi uchun olindi."
  },
  sendFailed: {
    tr: "Mektup şu anda gönderilemedi. Bağlantını kontrol edip tekrar dene.",
    en: "The letter could not be sent. Check your connection and try again.",
    ru: "Не удалось отправить письмо. Проверьте подключение и попробуйте снова.",
    uz: "Maktub yuborilmadi. Internetni tekshirib, qayta urinib ko'ring."
  }
} satisfies Record<string, LocalizedCopy>;

const verification = {
  emailRequired: {
    tr: "Bu işlem için e-posta adresinizi doğrulayın.",
    en: "Verify your email address for this action.",
    ru: "Подтвердите e-mail для этого действия.",
    uz: "Bu amal uchun e-pochta manzilingizni tasdiqlang."
  },
  commentTooShort: {
    tr: "Yorum çok kısa.",
    en: "Comment is too short.",
    ru: "Комментарий слишком короткий.",
    uz: "Izoh juda qisqa."
  },
  discoverPostRequired: {
    tr: "Keşfet paylaşımı için e-posta adresinizi doğrulayın.",
    en: "Verify your email to post in Discover.",
    ru: "Подтвердите e-mail, чтобы публиковать в Discover.",
    uz: "Keşfda ulashish uchun e-pochta manzilingizni tasdiqlang."
  },
  discoverEditRequired: {
    tr: "Gönderi düzenlemek için e-posta adresinizi doğrulayın.",
    en: "Verify your email to edit posts.",
    ru: "Подтвердите e-mail, чтобы редактировать записи.",
    uz: "Postni tahrirlash uchun e-pochta manzilingizni tasdiqlang."
  },
  uploadImageRequired: {
    tr: "Resim yüklemek için e-posta adresinizi doğrulayın.",
    en: "Verify your email to upload images.",
    ru: "Подтвердите e-mail, чтобы загружать изображения.",
    uz: "Rasm yuklash uchun e-pochta manzilingizni tasdiqlang."
  },
  uploadProfileRequired: {
    tr: "Profil görseli yüklemek için e-posta adresinizi doğrulayın.",
    en: "Verify your email to upload a profile image.",
    ru: "Подтвердите e-mail, чтобы загрузить фото профиля.",
    uz: "Profil rasmini yuklash uchun e-pochta manzilingizni tasdiqlang."
  },
  boostEmailRequired: {
    tr: "Öne taşıma hakkı için e-posta adresinizi doğrulayın.",
    en: "Verify your email to use boosting.",
    ru: "Подтвердите e-mail для продвижения.",
    uz: "Oldinga ko'tarish uchun e-pochta manzilingizni tasdiqlang."
  }
} satisfies Record<string, LocalizedCopy>;

const community = {
  uploadQuotaFull: {
    tr: "Bu hafta iki resim gönderme hakkınız doldu. Reddedilen veya silinen işler hak iade eder.",
    en: "Your two weekly upload slots are used. Rejected or deleted works return a slot.",
    ru: "Два еженедельных слота загрузки использованы. Отклоненные или удаленные работы возвращают слот.",
    uz: "Bu hafta ikkita rasm yuborish huquqingiz tugadi. Rad etilgan yoki o'chirilgan ishlar huquqni qaytaradi."
  },
  ownerQuotaFull: {
    tr: "Bu kullanıcının haftalık iki eser paylaşım hakkı dolu.",
    en: "This user's two weekly artwork slots are full.",
    ru: "У этого пользователя заполнены два еженедельных слота для работ.",
    uz: "Bu foydalanuvchining haftalik ikkita asar joylash huquqi to'lgan."
  },
  boosted: {
    tr: "Eseriniz haftanın enleri sıralamasında öne taşındı.",
    en: "Your artwork was boosted in the weekly top list.",
    ru: "Ваше произведение поднято в недельном топе.",
    uz: "Asaringiz haftaning eng yaxshilari ro'yxatida oldinga ko'tarildi."
  },
  boostPremiumBlocked: {
    tr: "Premium hesaplarda sponsorlu öne taşıma kullanılmaz.",
    en: "Sponsored boosting is not available on Premium accounts.",
    ru: "Спонсорное продвижение недоступно для Premium-аккаунтов.",
    uz: "Premium akkauntlarda homiyli oldinga ko'tarish mavjud emas."
  },
  boostCooldown: {
    tr: "Yeni öne taşıma hakkı 30 dakikada bir açılır.",
    en: "A new boost unlocks every 30 minutes.",
    ru: "Новое продвижение доступно каждые 30 минут.",
    uz: "Yangi oldinga ko'tarish huquqi har 30 daqiqada ochiladi."
  },
  boostReady: {
    tr: "Sponsorlu içerik tamamlandı. Yukarı taşıma hakkınız hazır.",
    en: "Sponsored content completed. Your boost is ready.",
    ru: "Спонсорский контент просмотрен. Продвижение готово.",
    uz: "Homiy kontent yakunlandi. Ko'tarish huquqingiz tayyor."
  },
  boostWatchAd: {
    tr: "Yukarı taşıma hakkı kazanmak için sponsorlu içeriği izleyin.",
    en: "Watch sponsored content to earn a boost.",
    ru: "Посмотрите спонсорский контент, чтобы получить продвижение.",
    uz: "Ko'tarish huquqi olish uchun homiy kontentni tomosha qiling."
  },
  activeCompetitionDeleteBlocked: {
    tr: "Aktif haftanın yarışma görseli profilden silinemez. Hafta sonlandıktan sonra silebilirsiniz.",
    en: "Active weekly competition images cannot be deleted from your profile until the week ends.",
    ru: "Изображение активной недели нельзя удалить из профиля до завершения недели.",
    uz: "Faol hafta musobaqa rasmini hafta tugaguncha profildan o'chirib bo'lmaydi."
  },
  deleteArtworkConfirmTitle: {
    tr: "Görseli sil",
    en: "Delete image",
    ru: "Удалить изображение",
    uz: "Rasmni o'chirish"
  },
  deleteArtworkConfirmMessage: {
    tr: "Bu görseli silmek istediğinize emin misiniz? Silinen görsel profilinizden kaldırılır.",
    en: "Are you sure you want to delete this image? It will be removed from your profile.",
    ru: "Вы уверены, что хотите удалить это изображение? Оно будет удалено из вашего профиля.",
    uz: "Bu rasmni o'chirmoqchimisiz? U profilingizdan olib tashlanadi."
  },
  deleteCommentConfirmTitle: {
    tr: "Yorumu sil",
    en: "Delete comment",
    ru: "Удалить комментарий",
    uz: "Izohni o'chirish"
  },
  deleteCommentConfirmMessage: {
    tr: "Bu yorumu silmek istediğinize emin misiniz?",
    en: "Are you sure you want to delete this comment?",
    ru: "Вы уверены, что хотите удалить этот комментарий?",
    uz: "Bu izohni o'chirmoqchimisiz?"
  }
} satisfies Record<string, LocalizedCopy>;

export const systemMessages = {
  chanceCard,
  duel,
  artDna,
  museum,
  timeCapsule,
  verification,
  community
};

export { t, tFormat };

export function msg(copy: LocalizedCopy, language: Language) {
  return t(copy, language);
}

export function msgFormat(copy: LocalizedCopy, language: Language, values: Record<string, string | number>) {
  return tFormat(copy, language, values);
}
