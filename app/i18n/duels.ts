import type { Language } from "@/types/content";

type DuelCopy = {
  screenTitle: string;
  chooseChallenge: string;
  menuHint: string;
  artworkDuel: string;
  artworkDuelText: string;
  artistDuel: string;
  artistDuelText: string;
  prophecyDuel: string;
  prophecyDuelText: string;
  leaderboard: string;
  leaderboardText: string;
  duelPreparing: string;
  inspectArtwork: string;
  inspectArtist: string;
  inspectShort: string;
  backToList: string;
  prophecyArtwork: string;
  prophecyArtworkText: string;
  prophecyArtist: string;
  prophecyArtistText: string;
  duelRule: string;
  confirmVoteTitle: string;
  confirmVoteBody: string;
  confirmVoteCancel: string;
  confirmVoteOk: string;
  confirmPredictionTitle: string;
  confirmPredictionBodyNormal: string;
  confirmPredictionBodyPremium: string;
  confirmPredictionCancel: string;
  confirmPredictionOk: string;
  confirmPredictionChangeOk: string;
  noActiveProphecy: string;
  noActiveProphecyHint: string;
  prophecyArtworkTitle: string;
  prophecyArtistTitle: string;
  prophecyIntroNormal: string;
  prophecyIntroPremium: string;
  prophecyWindowClosed: string;
  prophecyLocked: string;
  prophecyLockedPremium: string;
  prophecyPick: string;
  prophecyPickAgain: string;
  prophecyNewWeek: string;
  prophecyWeekCountdown: string;
  prophecyWindowCountdown: string;
  prophecyChangeCountdown: string;
  prophecyChangeBlocked: string;
  weeklyChampion: string;
  weeklyChampionCorrect: string;
  weeklyChampionWrong: string;
  pick: string;
  picked: string;
  confirmVote: string;
  voteSaved: string;
  voteUpdated: string;
  duelStatusPick: string;
  duelStatusPremiumChange: string;
  duelStatusLocked: string;
};

const copy: Record<Language, DuelCopy> = {
  tr: {
    screenTitle: "Kahin Düellosu",
    chooseChallenge: "Kahin Arenası",
    menuHint: "Seçimini yap. Sonucu sanat belirlesin.",
    artworkDuel: "Eser Düellosu",
    artworkDuelText: "İki sanat eseri arasında tek oy.",
    artistDuel: "Sanatçı Düellosu",
    artistDuelText: "İki sanatçı arasında topluluk tercihi.",
    prophecyDuel: "Kehanet Düellosu",
    prophecyDuelText: "Haftalık tahmin yap. Hafta sonu düello şampiyonunu bil, Kahin puanı kazan.",
    leaderboard: "Kahin Sıralaması",
    leaderboardText: "Dönemsel Kahin puanlarını ve sıralamanı görüntüle.",
    duelPreparing: "Yeni günlük eşleşme hazırlanıyor. Kısa süre içinde otomatik görünecek.",
    inspectArtwork: "Eseri incele",
    inspectArtist: "Sanatçıyı incele",
    inspectShort: "İncele",
    backToList: "Düello listesine dön",
    prophecyArtwork: "Kehanet Düellosu - Eser",
    prophecyArtworkText: "Bu hafta hangi eser kazanır?",
    prophecyArtist: "Kehanet Düellosu - Sanatçı",
    prophecyArtistText: "Bu hafta hangi sanatçı kazanır?",
    duelRule: "Günlük düello hafta boyunca devam eder. Oyunuzu onayladıktan sonra değiştiremezsiniz. Premium kullanıcılar bir kez daha değiştirebilir.",
    confirmVoteTitle: "Oyunu onaylıyor musun?",
    confirmVoteBody: "Seçiminiz kaydedildikten sonra sonuçlar açılır. Premium kullanıcılar gün bitmeden bir kez daha oyunu değiştirebilir.",
    confirmVoteCancel: "Vazgeç",
    confirmVoteOk: "Evet, oy ver",
    confirmPredictionTitle: "Kehanetini onayla",
    confirmPredictionBodyNormal: "Normal hesaplarda haftalık tahmin kilitlenir ve değiştirilemez. Doğru bilenlere hafta sonunda +1 Kahin puanı eklenir.",
    confirmPredictionBodyPremium: "Premium hesaplarda tahminini yalnızca ilk 48 saat içinde, en fazla 2 saatte bir değiştirebilirsin. Normal kullanıcılar tahminlerini değiştiremez.",
    confirmPredictionCancel: "Vazgeç",
    confirmPredictionOk: "Tahmini onayla",
    confirmPredictionChangeOk: "Tahmini güncelle",
    noActiveProphecy: "Aktif kehanet yok",
    noActiveProphecyHint: "Yeni kehanet haftası yakında burada görünecek.",
    prophecyArtworkTitle: "Kehanet Düellosu - Eser",
    prophecyArtistTitle: "Kehanet Düellosu - Sanatçı",
    prophecyIntroNormal: "Hafta boyunca günlük düello devam eder. Tahminini ilk 48 saatte kilitle. Hafta sonunda düello şampiyonunu bilenlere +1 Kahin puanı eklenir.",
    prophecyIntroPremium: "Hafta boyunca günlük düello devam eder. Tahminini ilk 48 saatte yap; Premium olarak bu süre içinde en fazla 2 saatte bir değiştirebilirsin.",
    prophecyWindowClosed: "Bu haftanın kehanet süresi kapandı.",
    prophecyLocked: "Haftalık tahminin kilitlendi.",
    prophecyLockedPremium: "Tahminin kayıtlı. Premium olarak ilk 48 saat içinde 2 saatte bir başka aday seçebilirsin.",
    prophecyPick: "Bir tahmin seç ve onayla.",
    prophecyPickAgain: "İlk 48 saat içinde, 2 saat arayla başka bir aday seçerek güncelleyebilirsin.",
    prophecyNewWeek: "Yeni hafta başladığında tekrar tahmin yapabilirsin.",
    prophecyWeekCountdown: "Hafta bitimine",
    prophecyWindowCountdown: "Tahmin süresi",
    prophecyChangeCountdown: "Sonraki değişiklik",
    prophecyChangeBlocked: "Yeni değişiklik için beklemen gerekiyor:",
    weeklyChampion: "Hafta şampiyonu",
    weeklyChampionCorrect: "Doğru bildin, +1 Kahin puanı!",
    weeklyChampionWrong: "Tahminin tutmadı.",
    pick: "Seç",
    picked: "Seçildi",
    confirmVote: "Oyumu onayla",
    voteSaved: "Oyun kaydedildi.",
    voteUpdated: "Oyun güncellendi.",
    duelStatusPick: "Bir seçim yapıp oyunuzu onaylayın.",
    duelStatusPremiumChange: "Bugünkü yarışmada oyunuzu kullandınız. Premium hakkınızla bir kez karşı seçeneğe geçebilirsiniz.",
    duelStatusLocked: "Bugünkü yarışmada oyunuzu kullandınız. Sonuçları buradan takip edebilirsiniz."
  },
  en: {
    screenTitle: "Seer Duel",
    chooseChallenge: "Oracle Arena",
    menuHint: "Make your choice. Let art decide.",
    artworkDuel: "Artwork Duel",
    artworkDuelText: "One vote between two artworks.",
    artistDuel: "Artist Duel",
    artistDuelText: "Community choice between two artists.",
    prophecyDuel: "Prophecy Duel",
    prophecyDuelText: "Make a weekly prediction. Guess the duel champion and earn Seer points.",
    leaderboard: "Seer Leaderboard",
    leaderboardText: "View period-based Seer points and your ranking.",
    duelPreparing: "The new daily matchup is being prepared and will appear automatically shortly.",
    inspectArtwork: "Explore artwork",
    inspectArtist: "Explore artist",
    inspectShort: "Explore",
    backToList: "Back to duel list",
    prophecyArtwork: "Prophecy Duel - Artwork",
    prophecyArtworkText: "Which artwork wins this week?",
    prophecyArtist: "Prophecy Duel - Artist",
    prophecyArtistText: "Which artist wins this week?",
    duelRule: "Daily duels continue through the week. After confirming your vote, you cannot change it. Premium members can change once.",
    confirmVoteTitle: "Confirm your vote?",
    confirmVoteBody: "Results unlock after your choice is saved. Premium members can change their vote once before the day ends.",
    confirmVoteCancel: "Cancel",
    confirmVoteOk: "Yes, vote",
    confirmPredictionTitle: "Confirm your prediction",
    confirmPredictionBodyNormal: "On standard accounts, your weekly prediction locks and cannot be changed. Correct picks earn +1 Seer point at week end.",
    confirmPredictionBodyPremium: "Premium accounts can change their prediction only during the first 48 hours, at most once every 2 hours. Standard users cannot change theirs.",
    confirmPredictionCancel: "Cancel",
    confirmPredictionOk: "Confirm prediction",
    confirmPredictionChangeOk: "Update prediction",
    noActiveProphecy: "No active prophecy",
    noActiveProphecyHint: "A new prophecy week will appear here soon.",
    prophecyArtworkTitle: "Prophecy Duel - Artwork",
    prophecyArtistTitle: "Prophecy Duel - Artist",
    prophecyIntroNormal: "Daily duels run all week. Lock your pick in the first 48 hours. Correct predictions earn +1 Seer point when the champion is known.",
    prophecyIntroPremium: "Daily duels run all week. Predict in the first 48 hours; as Premium you can change your pick during that window, at most once every 2 hours.",
    prophecyWindowClosed: "This week's prediction window is closed.",
    prophecyLocked: "Your weekly prediction is locked.",
    prophecyLockedPremium: "Your prediction is saved. As Premium, you can pick another candidate within the first 48 hours, once every 2 hours.",
    prophecyPick: "Choose and confirm one prediction.",
    prophecyPickAgain: "Within the first 48 hours, you can update your pick every 2 hours by choosing another candidate.",
    prophecyNewWeek: "You can predict again when the new week starts.",
    prophecyWeekCountdown: "Week ends in",
    prophecyWindowCountdown: "Prediction window",
    prophecyChangeCountdown: "Next change in",
    prophecyChangeBlocked: "You need to wait before changing again:",
    weeklyChampion: "Weekly champion",
    weeklyChampionCorrect: "Correct! +1 Seer point.",
    weeklyChampionWrong: "Your prediction did not match.",
    pick: "Pick",
    picked: "Selected",
    confirmVote: "Confirm vote",
    voteSaved: "Vote saved.",
    voteUpdated: "Vote updated.",
    duelStatusPick: "Pick an option and confirm your vote.",
    duelStatusPremiumChange: "Your vote is saved for today. Premium lets you switch once to the other option.",
    duelStatusLocked: "Your vote is saved for today. You can follow the results here."
  },
  ru: {
    screenTitle: "Дуэль провидцев",
    chooseChallenge: "Арена провидцев",
    menuHint: "Сделайте выбор. Пусть искусство решит.",
    artworkDuel: "Дуэль произведений",
    artworkDuelText: "Один голос между двумя произведениями.",
    artistDuel: "Дуэль художников",
    artistDuelText: "Выбор сообщества между двумя художниками.",
    prophecyDuel: "Дуэль пророчества",
    prophecyDuelText: "Сделайте недельный прогноз. Угадайте чемпиона дуэли и получите очки провидца.",
    leaderboard: "Рейтинг провидцев",
    leaderboardText: "Смотрите очки провидцев по периодам и своё место.",
    duelPreparing: "Новая ежедневная пара готовится и скоро появится автоматически.",
    inspectArtwork: "О произведении",
    inspectArtist: "О художнике",
    inspectShort: "Подробнее",
    backToList: "Назад к списку дуэлей",
    prophecyArtwork: "Пророчество - произведение",
    prophecyArtworkText: "Какое произведение победит на этой неделе?",
    prophecyArtist: "Пророчество - художник",
    prophecyArtistText: "Какой художник победит на этой неделе?",
    duelRule: "Ежедневные дуэли идут всю неделю. После подтверждения голос изменить нельзя. Premium может изменить его один раз.",
    confirmVoteTitle: "Подтвердить голос?",
    confirmVoteBody: "После сохранения выбора откроются результаты. Premium может изменить голос еще один раз до конца дня.",
    confirmVoteCancel: "Отмена",
    confirmVoteOk: "Да, голосовать",
    confirmPredictionTitle: "Подтвердить прогноз",
    confirmPredictionBodyNormal: "На обычном аккаунте недельный прогноз блокируется и не меняется. За верный ответ начисляется +1 очко провидца.",
    confirmPredictionBodyPremium: "Premium может менять прогноз только в первые 48 часов, не чаще одного раза в 2 часа. Обычные пользователи не могут менять свой выбор.",
    confirmPredictionCancel: "Отмена",
    confirmPredictionOk: "Подтвердить прогноз",
    confirmPredictionChangeOk: "Обновить прогноз",
    noActiveProphecy: "Нет активного пророчества",
    noActiveProphecyHint: "Новая неделя пророчества скоро появится здесь.",
    prophecyArtworkTitle: "Пророчество - произведение",
    prophecyArtistTitle: "Пророчество - художник",
    prophecyIntroNormal: "Ежедневные дуэли идут всю неделю. Сделайте прогноз в первые 48 часов. За верный ответ начисляется +1 очко провидца.",
    prophecyIntroPremium: "Ежедневные дуэли идут всю неделю. Сделайте прогноз в первые 48 часов; Premium может менять его в этот период не чаще одного раза в 2 часа.",
    prophecyWindowClosed: "Окно прогноза на эту неделю закрыто.",
    prophecyLocked: "Ваш недельный прогноз заблокирован.",
    prophecyLockedPremium: "Прогноз сохранен. Premium может выбрать другого кандидата в первые 48 часов, один раз в 2 часа.",
    prophecyPick: "Выберите и подтвердите один прогноз.",
    prophecyPickAgain: "В первые 48 часов можно обновлять прогноз каждые 2 часа, выбрав другого кандидата.",
    prophecyNewWeek: "Новый прогноз будет доступен с началом новой недели.",
    prophecyWeekCountdown: "До конца недели",
    prophecyWindowCountdown: "Окно прогноза",
    prophecyChangeCountdown: "Следующее изменение",
    prophecyChangeBlocked: "Подождите перед следующим изменением:",
    weeklyChampion: "Чемпион недели",
    weeklyChampionCorrect: "Верно! +1 очко провидца.",
    weeklyChampionWrong: "Ваш прогноз не совпал.",
    pick: "Выбрать",
    picked: "Выбрано",
    confirmVote: "Подтвердить голос",
    voteSaved: "Голос сохранен.",
    voteUpdated: "Голос обновлен.",
    duelStatusPick: "Выберите вариант и подтвердите голос.",
    duelStatusPremiumChange: "Вы уже проголосовали сегодня. Premium дает один переход на другой вариант.",
    duelStatusLocked: "Ваш голос на сегодня сохранен. Результаты можно отслеживать здесь."
  },
  uz: {
    screenTitle: "Kohin dueli",
    chooseChallenge: "Kohinlar maydoni",
    menuHint: "Tanlovingizni qiling. Natijani san'at belgilasin.",
    artworkDuel: "Asar dueli",
    artworkDuelText: "Ikki asar o'rtasida bitta ovoz.",
    artistDuel: "San'atkor dueli",
    artistDuelText: "Ikki san'atkor orasida jamoa tanlovi.",
    prophecyDuel: "Kehanet dueli",
    prophecyDuelText: "Haftalik bashorat qiling. Duel chempionini toping va Kohin balli oling.",
    leaderboard: "Kohinlar reytingi",
    leaderboardText: "Davriy Kohin ballari va o'z o'rningizni ko'ring.",
    duelPreparing: "Yangi kunlik juftlik tayyorlanmoqda va tez orada avtomatik ko'rinadi.",
    inspectArtwork: "Asarni ko'rish",
    inspectArtist: "San'atkorni ko'rish",
    inspectShort: "Ko'rish",
    backToList: "Duel ro'yxatiga qaytish",
    prophecyArtwork: "Kehanet dueli - Asar",
    prophecyArtworkText: "Bu hafta qaysi asar g'olib bo'ladi?",
    prophecyArtist: "Kehanet dueli - San'atkor",
    prophecyArtistText: "Bu hafta qaysi san'atkor g'olib bo'ladi?",
    duelRule: "Kunlik duel butun hafta davom etadi. Ovozingizni tasdiqlaganingizdan keyin o'zgartira olmaysiz. Premium foydalanuvchi bir marta o'zgartira oladi.",
    confirmVoteTitle: "Ovozingizni tasdiqlaysizmi?",
    confirmVoteBody: "Tanlov saqlangandan keyin natijalar ochiladi. Premium foydalanuvchi kun tugaguncha ovozini yana bir marta o'zgartira oladi.",
    confirmVoteCancel: "Bekor qilish",
    confirmVoteOk: "Ha, ovoz berish",
    confirmPredictionTitle: "Bashoratingizni tasdiqlang",
    confirmPredictionBodyNormal: "Oddiy hisoblarda haftalik bashorat qulflanadi va o'zgartirilmaydi. To'g'ri topganlarga hafta oxirida +1 Kohin balli qo'shiladi.",
    confirmPredictionBodyPremium: "Premium hisobda bashoratingizni faqat dastlabki 48 soat ichida, kamida 2 soat oralig'ida o'zgartirishingiz mumkin. Oddiy foydalanuvchilar o'zgartira olmaydi.",
    confirmPredictionCancel: "Bekor qilish",
    confirmPredictionOk: "Bashoratni tasdiqlash",
    confirmPredictionChangeOk: "Bashoratni yangilash",
    noActiveProphecy: "Faol kehanet yo'q",
    noActiveProphecyHint: "Yangi kehanet haftasi tez orada bu yerda ko'rinadi.",
    prophecyArtworkTitle: "Kehanet dueli - Asar",
    prophecyArtistTitle: "Kehanet dueli - San'atkor",
    prophecyIntroNormal: "Kunlik duel butun hafta davom etadi. Bashoratingizni dastlabki 48 soat ichida qulflang. To'g'ri topganlarga +1 Kohin balli beriladi.",
    prophecyIntroPremium: "Kunlik duel butun hafta davom etadi. Bashoratingizni dastlabki 48 soat ichida qiling; Premium sifatida shu muddatda kamida 2 soat oralig'ida o'zgartirishingiz mumkin.",
    prophecyWindowClosed: "Bu haftaning kehanet muddati yopildi.",
    prophecyLocked: "Haftalik bashoratingiz qulflandi.",
    prophecyLockedPremium: "Bashoratingiz saqlandi. Premium sifatida dastlabki 48 soat ichida 2 soat oralig'ida boshqa nomzod tanlashingiz mumkin.",
    prophecyPick: "Bitta bashorat tanlang va tasdiqlang.",
    prophecyPickAgain: "Dastlabki 48 soat ichida, 2 soat oralig'ida boshqa nomzod tanlab yangilashingiz mumkin.",
    prophecyNewWeek: "Yangi hafta boshlanganda yana bashorat qilishingiz mumkin.",
    prophecyWeekCountdown: "Hafta tugashiga",
    prophecyWindowCountdown: "Bashorat muddati",
    prophecyChangeCountdown: "Keyingi o'zgartirish",
    prophecyChangeBlocked: "Yana o'zgartirish uchun kutishingiz kerak:",
    weeklyChampion: "Hafta chempioni",
    weeklyChampionCorrect: "To'g'ri topdingiz, +1 Kohin balli!",
    weeklyChampionWrong: "Bashoratingiz mos kelmadi.",
    pick: "Tanlash",
    picked: "Tanlandi",
    confirmVote: "Ovozni tasdiqlash",
    voteSaved: "Ovoz saqlandi.",
    voteUpdated: "Ovoz yangilandi.",
    duelStatusPick: "Tanlov qiling va ovozingizni tasdiqlang.",
    duelStatusPremiumChange: "Bugungi duelda ovoz berdingiz. Premium huquqi bilan bir marta boshqa variantga o'tishingiz mumkin.",
    duelStatusLocked: "Bugungi duelda ovozingiz saqlandi. Natijalarni shu yerdan kuzatishingiz mumkin."
  }
};

export function duelCopy(language: Language) {
  return copy[language] ?? copy.en;
}
