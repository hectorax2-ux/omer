import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View, type DimensionValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { EqualHeightHeaderSlot } from "@/components/ui/equal-height-header-slot";
import { AppChrome } from "@/components/app-chrome";
import { AuthRequired } from "@/components/auth-required";
import { RewardedScoreGate } from "@/components/rewarded-score-gate";
import { getThemeColors } from "@/constants/theme";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useRegisterRefresh } from "@/providers/refresh-provider";
import {
  activateDailyJigsawGame,
  completeDailyJigsawGame,
  prepareDailyJigsawGame,
  type JigsawPuzzle,
  type PreparedJigsawGame
} from "@/src/services/firebase/jigsaw-service";
import { getUserJigsawAttempt, type JigsawAttemptRecord } from "@/src/services/firebase/jigsaw-attempt-service";
import { JIGSAW_GRID_SIZE, JIGSAW_MAX_TIME_PENALTY, JIGSAW_TILE_COUNT, formatDailyGameResetNotice, formatNextDailyGameResetNotice, nextIstanbulMidnight, scoreForJigsawGuess } from "@/firebase/shared/jigsaw";
import { todayJigsawDayKey } from "@/firebase/shared/jigsaw-attempts";
import { visibleQuizOptionsForLanguage } from "@/firebase/shared/quiz-week";
import { getCompetitionWeekBounds, getCompetitionWeekId } from "@/firebase/shared/competition-week";
import { timelineGameCopy } from "@/app/i18n/timeline-game";
import { fetchTimelineGameState, peekTimelineGameState, prepareTimelineGameQueue, type TimelineGameState } from "@/src/services/firebase/timeline-game-service";
import { getActiveWeeklyQuizPack, getUserQuizAttempt, resolveQuizWeekIdFromPack, type QuizAttemptRecord } from "@/src/services/firebase/quiz-week-service";
import type { TimelineGameType } from "@/firebase/shared/timeline-game";
import { prefetchImageUrls } from "@/utils/image-prefetch";
import { useRuntimePerformanceMode } from "@/hooks/use-runtime-performance-mode";
import { useRouteFirstRouter } from "@/hooks/use-route-first-router";
import { useIsFocused } from "@react-navigation/native";

type Lang = "tr" | "en" | "ru" | "uz";
type GameKey = "jigsaw";

const ART_DETECTIVE_COVER = require("../assets/images/art-detective-cover-mobile.jpg");

const labels = {
  games: { tr: "Oyunlar", en: "Games", ru: "Игры", uz: "O'yinlar" },
  returnToGames: { tr: "Oyunlara dönülsün mü?", en: "Return to games?", ru: "Вернуться к играм?", uz: "O'yinlarga qaytilsinmi?" },
  leaveGame: { tr: "Bu oyundan çıkıp oyun seçenekleri ekranına dönmek istiyor musun?", en: "Return to the games list?", ru: "Вернуться к списку игр?", uz: "O'yinlar ro'yxatiga qaytasizmi?" },
  jigsawExitRanked: {
    tr: "Günün puanlı hakkın sona erer. Cevap vermeden çıkarsan bugünkü puanın 0 olarak kesinleşir ve bugün tekrar puanlı oynayamazsın.",
    en: "Your daily ranked attempt will end. If you leave without answering, today's score is locked at 0 and you cannot play for points again today.",
    ru: "Ваш дневной зачётный заход закончится. Если выйти без ответа, счёт за сегодня будет 0 и повторно за очки сегодня играть нельзя.",
    uz: "Kunlik ballli urinish tugaydi. Javobsiz chiqsangiz, bugungi ballingiz 0 qilib belgilanadi va bugun yana ball uchun o'ynay olmaysiz."
  },
  jigsawExitRankedAnswered: {
    tr: "Günün puanlı hakkın sona erer. Çıkarsan şu ana kadarki puanın kaydedilir.",
    en: "Your daily ranked attempt will end. If you leave now, your current score will be saved.",
    ru: "Ваш дневной зачётный заход закончится. При выходе текущий счёт будет сохранён.",
    uz: "Kunlik ballli urinish tugaydi. Chiqsangiz, hozirgi ballingiz saqlanadi."
  },
  jigsawExitPractice: {
    tr: "Deneme modundasın. Çıkarsan sıralamaya yansımaz.",
    en: "You are in practice mode. Leaving will not affect the leaderboard.",
    ru: "Это тренировочный режим. Выход не повлияет на рейтинг.",
    uz: "Mashq rejimidasiz. Chiqish reytingga ta'sir qilmaydi."
  },
  continue: { tr: "Devam et", en: "Continue", ru: "Продолжить", uz: "Davom etish" },
  goBack: { tr: "Geri dön", en: "Go back", ru: "Назад", uz: "Orqaga" },
  jigsawTitle: { tr: "Sanat Dedektifi", en: "Art Detective", ru: "Арт-детектив", uz: "San'at detektivi" },
  jigsawText: { tr: "Kareleri tek tek aç, eseri en az ipucuyla tahmin et.", en: "Reveal tiles one by one and guess with the fewest clues.", ru: "Открывайте плитки по одной и угадайте с минимумом подсказок.", uz: "Kataklarni birma-bir oching va kamroq ishora bilan toping." },
  weeklyQuiz: { tr: "Haftalık Quiz Yarışması", en: "Weekly Quiz Challenge", ru: "Еженедельная викторина", uz: "Haftalik quiz tanlovi" },
  weeklyQuizText: { tr: "Haftanın sanat sorularını çöz ve sıralamaya katıl.", en: "Answer this week's art questions and join the leaderboard.", ru: "Ответьте на вопросы недели об искусстве и войдите в рейтинг.", uz: "Haftalik san'at savollariga javob bering va reytingga qo'shiling." },
  ranking: { tr: "Sıralamalar", en: "Leaderboards", ru: "Рейтинги", uz: "Reytinglar" },
  matchPeriod: { tr: "Renk ve dönem eşleştir", en: "Match color and period", ru: "Сопоставь цвет и эпоху", uz: "Rang va davrni moslang" },
  matchPeriodText: { tr: "Sanat akımlarını görsel ipuçlarıyla eşleştir.", en: "Match movements with visual clues.", ru: "Сопоставляйте направления по визуальным подсказкам.", uz: "San'at oqimlarini vizual belgilar bilan moslang." },
  start: { tr: "Başla", en: "Start", ru: "Начать", uz: "Boshlash" },
  score: { tr: "Puan", en: "Score", ru: "Счёт", uz: "Ball" },
  loading: { tr: "Yükleniyor...", en: "Loading...", ru: "Загрузка...", uz: "Yuklanmoqda..." },
  preparingDailyArtwork: { tr: "Günün eseri hazırlanıyor...", en: "Preparing today's artwork...", ru: "Готовим произведение дня...", uz: "Bugungi asar tayyorlanmoqda..." },
  noPuzzle: { tr: "Bu oyun için henüz yayınlanmış yapboz yok.", en: "No published jigsaw is available yet.", ru: "Пока нет опубликованного пазла.", uz: "Hali e'lon qilingan yapboz yo'q." },
  openTile: { tr: "Kareyi aç", en: "Open tile", ru: "Открыть плитку", uz: "Katakni ochish" },
  openTileQuestion: { tr: "Bu kareyi açmak istediğine emin misin? Puanın 10 azalacak.", en: "Are you sure you want to open this tile? You will lose 10 points.", ru: "Открыть эту плитку? Вы потеряете 10 очков.", uz: "Bu katakni ochmoqchimisiz? 10 ball yo'qotasiz." },
  yesOpen: { tr: "Evet, aç", en: "Yes, open", ru: "Да, открыть", uz: "Ha, ochish" },
  cancel: { tr: "Vazgeç", en: "Cancel", ru: "Отмена", uz: "Bekor qilish" },
  correct: { tr: "Doğru bildin!", en: "Correct!", ru: "Верно!", uz: "To'g'ri!" },
  wrong: { tr: "Maalesef yanlış.", en: "Unfortunately wrong.", ru: "К сожалению, неверно.", uz: "Afsuski, noto'g'ri." },
  earned: { tr: "Kazanılan puan", en: "Points earned", ru: "Заработано очков", uz: "Olingan ball" },
  correctAnswer: { tr: "Doğru cevap", en: "Correct answer", ru: "Правильный ответ", uz: "To'g'ri javob" },
  nextPuzzle: { tr: "Sonraki yapboz", en: "Next jigsaw", ru: "Следующий пазл", uz: "Keyingi yapboz" },
  tilesOpened: { tr: "Açılan kare", en: "Tiles opened", ru: "Открыто плиток", uz: "Ochilgan katak" },
  startGame: { tr: "Oyuna başla", en: "Start game", ru: "Начать игру", uz: "O'yinni boshlash" },
  todayScore: { tr: "Bugün bu oyundan aldığın puan", en: "Today's score from this game", ru: "Сегодняшний счёт в этой игре", uz: "Bugun bu o'yindan olgan ball" },
  todayScoreSet: { tr: "Bugünkü puanın netleşti", en: "Today's score is locked in", ru: "Сегодняшний счёт зафиксирован", uz: "Bugungi ballingiz belgilandi" },
  practiceMode: { tr: "Bu tur deneme modundasın. Sıralamaya yansımaz.", en: "This run is practice mode. It won't affect rankings.", ru: "Это тренировочный режим. Рейтинг не изменится.", uz: "Bu safar mashq rejimi. Reytingga ta'sir qilmaydi." },
  gameRules: { tr: "Oyun Kuralları", en: "Game Rules", ru: "Правила игры", uz: "O'yin qoidalari" },
  elapsed: { tr: "Süre", en: "Time", ru: "Время", uz: "Vaqt" },
  openTileFirst: { tr: "Cevap vermek için en az 1 kare açmalısın.", en: "Open at least 1 tile before answering.", ru: "Откройте минимум 1 плитку перед ответом.", uz: "Javob berish uchun kamida 1 katak oching." },
  noPuzzleToday: { tr: "Bugün için planlanmış Sanat Dedektifi bölümü yok.", en: "No Art Detective puzzle is scheduled for today.", ru: "На сегодня пазл не запланирован.", uz: "Bugun uchun San'at detektivi rejasi yo'q." },
  rankedMode: { tr: "Günde bir puanlı tur sıralamaya yazılır. Sonraki girişler deneme modudur.", en: "One ranked run per day. Later runs are practice.", ru: "Один зачётный заход в день.", uz: "Kuniga bir marta reytingga yoziladi." },
  scoredGamesRemaining: { tr: "puanlı oyun kaldı", en: "ranked game remaining", ru: "рейтинговая игра осталась", uz: "reytingli o'yin qoldi" },
  newRights: { tr: "Yeni haklar", en: "New attempt", ru: "Новая попытка", uz: "Yangi urinish" },
  dailyBest: { tr: "Günlük en iyi", en: "Daily best", ru: "Лучший за день", uz: "Kunlik eng yaxshi" },
  weeklyBest: { tr: "Haftalık en iyi", en: "Weekly best", ru: "Лучший за неделю", uz: "Haftalik eng yaxshi" },
  rules: { tr: "Kurallar", en: "Rules", ru: "Правила", uz: "Qoidalar" },
  practiceAvailable: { tr: "Puanlı hak bitti · Pratik açık", en: "Ranked attempt used · Practice available", ru: "Зачётная попытка использована · Доступна тренировка", uz: "Reytingli urinish tugadi · Mashq ochiq" },
  quizUnavailable: { tr: "Bu hafta yayınlanmış quiz yok", en: "No quiz published this week", ru: "На этой неделе квиз не опубликован", uz: "Bu hafta quiz e'lon qilinmagan" },
  comingSoon: { tr: "Yakında", en: "Coming soon", ru: "Скоро", uz: "Tez orada" },
  heroMessage: { tr: "Bilgini yarıştır, skorunu yükselt.", en: "Test your knowledge. Raise your score.", ru: "Проверьте знания и улучшите свой результат.", uz: "Bilimingizni sinang, ballingizni oshiring." },
  arenaLabel: { tr: "SANAT TARİHİ OYUN ARENASI", en: "ART HISTORY GAME ARENA", ru: "АРЕНА ИГР ПО ИСТОРИИ ИСКУССТВА", uz: "SAN'AT TARIXI O'YIN MAYDONI" },
  featuredGames: { tr: "Öne çıkan oyunlar", en: "Featured games", ru: "Главные игры", uz: "Asosiy o'yinlar" },
  featuredHint: { tr: "Bugünün meydan okumaları", en: "Today's challenges", ru: "Задания на сегодня", uz: "Bugungi sinovlar" },
  otherGames: { tr: "Yakında", en: "Coming soon", ru: "Скоро", uz: "Tez orada" },
  ready: { tr: "HAZIR", en: "READY", ru: "ГОТОВО", uz: "TAYYOR" },
  openGame: { tr: "oyunu aç", en: "open game", ru: "открыть игру", uz: "o'yinni ochish" },
  playsReady: { tr: "oyun hakkı hazır", en: "plays ready", ru: "игр доступно", uz: "o'yin huquqi tayyor" },
  weeklyResult: { tr: "Haftalık sonuç", en: "Weekly result", ru: "Результат недели", uz: "Haftalik natija" },
  allRankings: { tr: "Tüm sıralamalar", en: "All leaderboards", ru: "Все рейтинги", uz: "Barcha reytinglar" },
  rankingHint: { tr: "En iyi oyuncuları ve oyun skorlarını gör", en: "See top players and game scores", ru: "Лучшие игроки и результаты", uz: "Eng yaxshi o'yinchilar va ballarni ko'ring" },
  museumGames: { tr: "Müze oyunları", en: "Museum games", ru: "Музейные игры", uz: "Muzey o'yinlari" }
};

export default function GamesScreen() {
  const { language } = useLanguage();
  const { isAuthenticated, canBrowsePublicContent, account, canJoinWeeklyQuiz } = useAccount();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const width = useWindowDimensions().width;
  const reducedMotion = useReducedMotion();
  const router = useRouteFirstRouter();
  const [selectedGame, setSelectedGame] = useState<GameKey | null>(null);
  const [exitPromptVisible, setExitPromptVisible] = useState(false);
  const [infoGameOpen, setInfoGameOpen] = useState<GameKey | null>(null);

  const [jigsawPuzzles, setJigsawPuzzles] = useState<JigsawPuzzle[]>([]);
  const [jigsawLoading, setJigsawLoading] = useState(true);
  const [jigsawIndex, setJigsawIndex] = useState(0);
  const [jigsawElapsed, setJigsawElapsed] = useState(0);
  const jigsawRoundStartedAtRef = useRef<number | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [pendingTile, setPendingTile] = useState<number | null>(null);
  const [jigsawResult, setJigsawResult] = useState<"won" | "lost" | null>(null);
  const [jigsawEarned, setJigsawEarned] = useState(0);
  const [jigsawRulesOpen, setJigsawRulesOpen] = useState(false);
  const [sessionScore, setSessionScore] = useState(0);
  const [dailyAttempt, setDailyAttempt] = useState<JigsawAttemptRecord | null>(null);
  const [preparedJigsaw, setPreparedJigsaw] = useState<PreparedJigsawGame | null>(null);
  const sessionSavedRef = useRef(false);
  const practiceMode = (Boolean(dailyAttempt) || preparedJigsaw?.practice === true) && !account.isAdmin;

  const [jigsawRankSaved, setJigsawRankSaved] = useState(false);
  const [jigsawSelectedOption, setJigsawSelectedOption] = useState(-1);
  const [jigsawFrozenElapsed, setJigsawFrozenElapsed] = useState(0);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [timelineState, setTimelineState] = useState<TimelineGameState | null>(() => peekTimelineGameState());
  const [timelineError, setTimelineError] = useState(false);
  const [timelineNow, setTimelineNow] = useState(performance.now());
  const [weeklyQuizLoading, setWeeklyQuizLoading] = useState(true);
  const [weeklyQuizWeekId, setWeeklyQuizWeekId] = useState("");
  const [weeklyQuizAvailable, setWeeklyQuizAvailable] = useState(false);
  const [weeklyQuizAttempt, setWeeklyQuizAttempt] = useState<QuizAttemptRecord | null>(null);
  const timelineResetReloadRef = useRef(0);
  const calendarKeysRef = useRef({ day: todayJigsawDayKey(), week: getCompetitionWeekId() });
  const timelineClockAnchorRef = useRef({ serverNowMs: timelineState?.serverNowMs ?? 0, monotonicMs: performance.now() });
  useRegisterRefresh(() => setRefreshCounter((value) => value + 1));

  const currentPuzzle = jigsawPuzzles[jigsawIndex];
  const wallClockNowMs = Date.now();
  const jigsawResetAtMs = nextIstanbulMidnight(new Date(wallClockNowMs)).getTime();
  const weeklyResetAtMs = getCompetitionWeekBounds(new Date(wallClockNowMs)).endsAt.getTime() + 1;
  const jigsawRemaining = dailyAttempt ? 0 : 1;
  const weeklyCanJoin = weeklyQuizAvailable && !weeklyQuizAttempt && canJoinWeeklyQuiz(weeklyQuizWeekId);
  const weeklyRemaining = weeklyCanJoin ? 1 : 0;
  const horizontalPadding = width < 360 ? 16 : width > 720 ? 24 : 18;
  const gameColumns = width < 350 ? 1 : width >= 1000 ? 4 : width >= 720 ? 3 : 2;
  const gameGridGap = width < 390 ? 9 : 11;
  const hubWidth = Math.min(width - horizontalPadding * 2, 960);
  const gameCardWidth = Math.floor((hubWidth - gameGridGap * (gameColumns - 1)) / gameColumns);
  const timelineUnlimited = Boolean(timelineState?.games.artwork.unlimited || timelineState?.games.artist.unlimited || account.isAdmin);
  const totalReadyGames = (timelineState?.games.artwork.remaining ?? 0) + (timelineState?.games.artist.remaining ?? 0) + jigsawRemaining + weeklyRemaining;
  const gridSize = JIGSAW_GRID_SIZE;
  const tileCount = currentPuzzle?.tileCount && currentPuzzle.tileCount > 0 ? currentPuzzle.tileCount : JIGSAW_TILE_COUNT;
  const canGuessJigsaw = revealed.size > 0;
  const potentialScore = currentPuzzle
    ? scoreForJigsawGuess({
        startScore: currentPuzzle.startScore,
        revealedCount: revealed.size,
        revealPenalty: currentPuzzle.revealPenalty,
        elapsedSeconds: jigsawElapsed
      })
    : 0;

  useEffect(() => {
    if (!isAuthenticated || !canBrowsePublicContent) {
      setTimelineState(null);
      setTimelineError(false);
      return;
    }
    let mounted = true;
    const cached = peekTimelineGameState();
    if (cached) {
      setTimelineState(cached);
      timelineClockAnchorRef.current = { serverNowMs: cached.serverNowMs, monotonicMs: performance.now() };
      timelineResetReloadRef.current = cached.resetAtMs;
    }
    setTimelineError(false);
    fetchTimelineGameState()
      .then((state) => {
        if (!mounted) return;
        setTimelineState(state);
        timelineClockAnchorRef.current = { serverNowMs: state.serverNowMs, monotonicMs: performance.now() };
        timelineResetReloadRef.current = state.resetAtMs;
      })
      .catch(() => {
        if (mounted) setTimelineError(true);
      });
    return () => { mounted = false; };
  }, [canBrowsePublicContent, isAuthenticated, refreshCounter]);

  useEffect(() => {
    const timer = setInterval(() => setTimelineNow(performance.now()), 30_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const day = todayJigsawDayKey(new Date());
    const week = getCompetitionWeekId(new Date());
    if (calendarKeysRef.current.day === day && calendarKeysRef.current.week === week) return;
    calendarKeysRef.current = { day, week };
    setRefreshCounter((value) => value + 1);
  }, [timelineNow]);

  useEffect(() => {
    const serverNowMs = timelineClockAnchorRef.current.serverNowMs + timelineNow - timelineClockAnchorRef.current.monotonicMs;
    if (!timelineState || serverNowMs < timelineState.resetAtMs || timelineResetReloadRef.current !== timelineState.resetAtMs) return;
    timelineResetReloadRef.current = 0;
    fetchTimelineGameState().then((state) => {
      setTimelineState(state);
      timelineClockAnchorRef.current = { serverNowMs: state.serverNowMs, monotonicMs: performance.now() };
      timelineResetReloadRef.current = state.resetAtMs;
    }).catch(() => undefined);
  }, [timelineNow, timelineState]);

  useEffect(() => {
    if (selectedGame !== "jigsaw" || jigsawResult) return;
    const timer = setInterval(() => {
      if (!jigsawRoundStartedAtRef.current) return;
      setJigsawElapsed(Math.max(0, Math.floor((Date.now() - jigsawRoundStartedAtRef.current) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [jigsawResult, selectedGame]);

  useEffect(() => {
    if (!isAuthenticated || !canBrowsePublicContent) return;
    void prepareTimelineGameQueue("artwork").catch(() => undefined);
    void prepareTimelineGameQueue("artist").catch(() => undefined);
  }, [canBrowsePublicContent, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !canBrowsePublicContent) return;
    let mounted = true;
    setJigsawLoading(true);
    prepareDailyJigsawGame()
      .then((prepared) => {
        if (mounted) {
          setPreparedJigsaw(prepared);
          setJigsawPuzzles([prepared.puzzle]);
          setJigsawLoading(false);
        }
        void prefetchImageUrls([prepared.puzzle.image], 1);
      })
      .catch(() => {
        if (mounted) {
          setPreparedJigsaw(null);
          setJigsawPuzzles([]);
        }
      })
      .finally(() => {
        if (mounted) setJigsawLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [isAuthenticated, canBrowsePublicContent, refreshCounter]);

  async function reloadJigsawPuzzles() {
    setJigsawLoading(true);
    try {
      const prepared = await prepareDailyJigsawGame();
      setPreparedJigsaw(prepared);
      setJigsawPuzzles([prepared.puzzle]);
      void prefetchImageUrls([prepared.puzzle.image], 1);
      return prepared;
    } catch {
      setPreparedJigsaw(null);
      setJigsawPuzzles([]);
      return null;
    } finally {
      setJigsawLoading(false);
    }
  }

  useEffect(() => {
    let mounted = true;
    if (!account.uid) {
      setDailyAttempt(null);
      return () => {
        mounted = false;
      };
    }
    getUserJigsawAttempt(account.uid)
      .then((attempt) => {
        if (mounted) setDailyAttempt(attempt);
      })
      .catch(() => {
        if (mounted) setDailyAttempt(null);
      });
    return () => {
      mounted = false;
    };
  }, [account.uid, refreshCounter]);

  useEffect(() => {
    let mounted = true;
    setWeeklyQuizLoading(true);
    getActiveWeeklyQuizPack(refreshCounter > 0)
      .then(async (quiz) => {
        if (!mounted) return;
        const weekId = resolveQuizWeekIdFromPack(quiz);
        setWeeklyQuizWeekId(weekId);
        setWeeklyQuizAvailable(Boolean(quiz?.questions?.length));
        if (quiz) void prefetchImageUrls(quiz.questions.map((item) => item.image || item.imageURL));
        const attempt = account.uid && quiz ? await getUserQuizAttempt(account.uid, weekId).catch(() => null) : null;
        if (mounted) setWeeklyQuizAttempt(attempt);
      })
      .catch(() => {
        if (!mounted) return;
        setWeeklyQuizWeekId(getCompetitionWeekId());
        setWeeklyQuizAvailable(false);
        setWeeklyQuizAttempt(null);
      })
      .finally(() => {
        if (mounted) setWeeklyQuizLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [account.uid, refreshCounter]);

  if (!isAuthenticated) {
    return <AuthRequired title={labels.games[language]} />;
  }

  async function startJigsaw() {
    setSelectedGame("jigsaw");
    setJigsawIndex(0);
    setSessionScore(0);
    sessionSavedRef.current = false;
    setJigsawRankSaved(false);
    resetJigsawRound();
    setJigsawLoading(true);
    const prepared = preparedJigsaw ?? await reloadJigsawPuzzles();
    if (!prepared) {
      setJigsawLoading(false);
      return;
    }
    void prefetchImageUrls([prepared.puzzle.image], 1);
    if (prepared.ranked && prepared.sessionId) {
      try {
        const active = await activateDailyJigsawGame(prepared.sessionId);
        jigsawRoundStartedAtRef.current = Date.now() - Math.max(0, active.serverNowMs - active.startedAtMs);
      } catch {
        setJigsawPuzzles([]);
        setJigsawLoading(false);
        return;
      }
    } else {
      jigsawRoundStartedAtRef.current = Date.now();
    }
    setJigsawElapsed(jigsawElapsedAtGuess());
    setJigsawLoading(false);
  }

  async function finishJigsawSession(options?: { forceZero?: boolean }) {
    if (practiceMode || account.isAdmin || !account.uid || sessionSavedRef.current) return;
    if (!preparedJigsaw?.sessionId) return;
    sessionSavedRef.current = true;
    try {
      const result = await completeDailyJigsawGame({
        sessionId: preparedJigsaw.sessionId,
        selectedOptionIndex: options?.forceZero ? -1 : jigsawSelectedOption,
        revealedIndices: options?.forceZero ? [] : [...revealed],
        elapsedSeconds: options?.forceZero ? jigsawElapsedAtGuess() : jigsawFrozenElapsed,
        forcedZero: options?.forceZero
      });
      setSessionScore(result.score);
      setDailyAttempt({
        id: result.attemptId,
        uid: account.uid,
        username: account.username || account.uid,
        displayName: account.displayName || account.username || "Art Atlas Üyesi",
        score: result.score,
        dayKey: result.dayKey || todayJigsawDayKey(),
        completedAtMs: Date.now()
      });
    } catch {
      sessionSavedRef.current = false;
    }
  }

  function resetJigsawRound() {
    setRevealed(new Set());
    setPendingTile(null);
    setJigsawResult(null);
    setJigsawEarned(0);
    setJigsawSelectedOption(-1);
    setJigsawFrozenElapsed(0);
    setJigsawElapsed(0);
    jigsawRoundStartedAtRef.current = null;
  }

  function jigsawElapsedAtGuess() {
    if (!jigsawRoundStartedAtRef.current) return 0;
    return Math.max(1, Math.ceil((Date.now() - jigsawRoundStartedAtRef.current) / 1000));
  }

  function confirmOpenTile() {
    if (pendingTile === null) return;
    setRevealed((current) => {
      const next = new Set(current);
      next.add(pendingTile);
      return next;
    });
    setPendingTile(null);
  }

  function guessJigsaw(optionIndex: number) {
    if (!currentPuzzle || jigsawResult || !canGuessJigsaw) return;
    const elapsedSeconds = jigsawElapsedAtGuess();
    jigsawRoundStartedAtRef.current = null;
    setJigsawElapsed(elapsedSeconds);
    setJigsawSelectedOption(optionIndex);
    setJigsawFrozenElapsed(elapsedSeconds);
    if (optionIndex === currentPuzzle.answerIndex) {
      const earned = scoreForJigsawGuess({
        startScore: currentPuzzle.startScore,
        revealedCount: revealed.size,
        revealPenalty: currentPuzzle.revealPenalty,
        elapsedSeconds
      });
      setJigsawEarned(earned);
      setSessionScore((current) => current + earned);
      setJigsawResult("won");
      return;
    }
    setJigsawEarned(0);
    setJigsawResult("lost");
  }

  function nextJigsaw() {
    if (jigsawIndex + 1 >= jigsawPuzzles.length) {
      if (account.isAdmin || practiceMode || sessionSavedRef.current) {
        setSelectedGame(null);
      }
      return;
    }
    setJigsawIndex((current) => current + 1);
    resetJigsawRound();
  }

  function exitToGamesList() {
    if (selectedGame === "jigsaw" && !practiceMode) {
      const unanswered = jigsawResult === null && sessionScore === 0;
      void finishJigsawSession(unanswered ? { forceZero: true } : undefined);
    }
    setExitPromptVisible(false);
    setSelectedGame(null);
  }

  return (
    <AppChrome title={labels.games[language]} eyebrow="Art Atlas" showBackButton backToHome showFloatingShortcuts={false}>
      <ExitModal
        visible={exitPromptVisible}
        game={selectedGame}
        practiceMode={practiceMode}
        jigsawUnanswered={jigsawResult === null && sessionScore === 0}
        onClose={() => setExitPromptVisible(false)}
        onConfirm={exitToGamesList}
        colors={colors}
        styles={styles}
        language={language}
      />
      <TileConfirmModal visible={pendingTile !== null} onClose={() => setPendingTile(null)} onConfirm={confirmOpenTile} colors={colors} styles={styles} language={language} />
      <InfoModal
        visible={infoGameOpen !== null}
        practiceMode={practiceMode}
        dailyScore={dailyAttempt?.score ?? 0}
        colors={colors}
        styles={styles}
        language={language}
        onClose={() => setInfoGameOpen(null)}
        onConfirm={() => {
          setInfoGameOpen(null);
          startJigsaw();
        }}
      />

      {!selectedGame ? (
        <View style={[styles.list, { maxWidth: hubWidth }]}>
          <GameOrbitHero language={language} reducedMotion={reducedMotion} colors={colors} styles={styles} />
          <View style={styles.statusStrip} accessibilityRole="summary">
            <View style={styles.statusSegment}>
              <Ionicons name={timelineUnlimited ? "infinite" : "sparkles"} size={16} color={colors.electric} />
              <Text style={styles.statusValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
                {timelineUnlimited ? timelineGameCopy.unlimitedGames[language] : `${totalReadyGames} ${labels.playsReady[language]}`}
              </Text>
            </View>
            {width >= 350 ? <>
              <View style={styles.statusDivider} />
              <View style={styles.statusSegment}>
                <Ionicons name="ribbon-outline" size={16} color={colors.gold} />
                <Text style={styles.statusValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                  {weeklyQuizAttempt ? `${labels.weeklyResult[language]}: ${weeklyQuizAttempt.score}` : `${labels.newRights[language]}: ${formatCountdown(jigsawResetAtMs - wallClockNowMs)}`}
                </Text>
              </View>
            </> : null}
            <View style={styles.statusDivider} />
            <Pressable accessibilityRole="button" accessibilityLabel={labels.allRankings[language]} hitSlop={7} onPress={() => router.push("/leaderboards")} style={styles.statusRanking}>
              <Ionicons name="podium-outline" size={17} color={colors.gold} />
            </Pressable>
          </View>
          {timelineError ? (
            <View style={styles.timelineStatus}>
              <Ionicons name="cloud-offline-outline" size={25} color={colors.gold} />
              <Text style={styles.timelineStatusError}>{timelineGameCopy.networkError[language]}</Text>
              <Pressable onPress={() => setRefreshCounter((value) => value + 1)} style={styles.timelineRetry}>
                <Text style={styles.timelineRetryText}>{timelineGameCopy.retry[language]}</Text>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.sectionHeading}>
            <View>
              <Text style={styles.sectionTitle}>{labels.featuredGames[language]}</Text>
              <Text style={styles.sectionHint}>{labels.featuredHint[language]}</Text>
            </View>
            <View style={styles.sectionSpark}><Ionicons name="sparkles" size={14} color={colors.gold} /></View>
          </View>
          <View pointerEvents="none" style={styles.lightPath}>
            <View style={[styles.lightPathLine, styles.lightPathLineOne]} />
            <View style={[styles.lightPathLine, styles.lightPathLineTwo]} />
            <View style={[styles.lightNode, styles.lightNodeOne]} />
            <View style={[styles.lightNode, styles.lightNodeTwo]} />
          </View>
          <View style={[styles.gameGrid, { gap: gameGridGap }]}>
          {(["artwork", "artist"] as TimelineGameType[]).map((type) => (
              <TimelineGameOption
                key={type}
                gameType={type}
                state={timelineState?.games[type] ?? null}
                resetAtMs={timelineState?.resetAtMs ?? 0}
                nowMs={timelineClockAnchorRef.current.serverNowMs + timelineNow - timelineClockAnchorRef.current.monotonicMs}
                language={language}
                onPlay={() => router.push({ pathname: "/timeline-game", params: { type } })}
                onHistory={() => router.push({ pathname: "/timeline-history", params: { type } })}
                onLeaderboard={() => router.push({ pathname: "/timeline-leaderboard", params: { type } })}
                cardWidth={gameCardWidth}
                accent={type === "artwork" ? colors.electric : colors.plum}
                reducedMotion={reducedMotion}
                readyLabel={labels.ready[language]}
                openLabel={labels.openGame[language]}
                colors={colors}
                styles={styles}
              />
            ))}
          <GameOverviewOption
            icon="extension-puzzle"
            title={labels.jigsawTitle[language]}
            text={labels.jigsawText[language]}
            status={jigsawLoading ? timelineGameCopy.preparing[language] : !jigsawPuzzles.length ? labels.noPuzzleToday[language] : account.isAdmin ? timelineGameCopy.unlimitedGames[language] : `${jigsawRemaining} / 1 ${labels.scoredGamesRemaining[language]}`}
            detail={!account.isAdmin && !jigsawLoading && jigsawPuzzles.length ? `${jigsawRemaining === 0 ? `${labels.practiceAvailable[language]} · ` : ""}${labels.newRights[language]}: ${formatCountdown(jigsawResetAtMs - wallClockNowMs)}` : undefined}
            best={dailyAttempt ? `${labels.dailyBest[language]}: ${dailyAttempt.score}` : undefined}
            disabled={jigsawLoading || !jigsawPuzzles.length}
            onPress={() => setInfoGameOpen("jigsaw")}
            onInfo={() => setInfoGameOpen("jigsaw")}
            onLeaderboard={() => router.push({ pathname: "/leaderboards", params: { board: "games" } })}
            infoLabel={labels.rules[language]}
            leaderboardLabel={timelineGameCopy.leaderboard[language]}
            cardWidth={gameCardWidth}
            accent={colors.magenta}
            reducedMotion={reducedMotion}
            readyLabel={labels.ready[language]}
            openLabel={labels.openGame[language]}
            colors={colors}
            styles={styles}
          />
          <GameOverviewOption
            icon="trophy"
            title={labels.weeklyQuiz[language]}
            text={labels.weeklyQuizText[language]}
            status={account.isAdmin && weeklyQuizAvailable ? timelineGameCopy.unlimitedGames[language] : weeklyQuizLoading ? timelineGameCopy.preparing[language] : weeklyQuizAvailable ? `${weeklyRemaining} / 1 ${labels.scoredGamesRemaining[language]}` : labels.quizUnavailable[language]}
            detail={!account.isAdmin && weeklyQuizAvailable && !weeklyQuizLoading ? `${weeklyRemaining === 0 ? `${labels.practiceAvailable[language]} · ` : ""}${labels.newRights[language]}: ${formatCountdown(weeklyResetAtMs - wallClockNowMs)}` : undefined}
            best={weeklyQuizAttempt ? `${labels.weeklyBest[language]}: ${weeklyQuizAttempt.score}` : undefined}
            disabled={weeklyQuizLoading || !weeklyQuizAvailable}
            onPress={() => router.push("/weekly-quiz")}
            onInfo={() => router.push({ pathname: "/weekly-quiz", params: { info: "1" } })}
            onLeaderboard={() => router.push({ pathname: "/leaderboards", params: { board: "quiz" } })}
            infoLabel={labels.rules[language]}
            leaderboardLabel={timelineGameCopy.leaderboard[language]}
            cardWidth={gameCardWidth}
            accent={colors.gold}
            reducedMotion={reducedMotion}
            readyLabel={labels.ready[language]}
            openLabel={labels.openGame[language]}
            colors={colors}
            styles={styles}
          />
          </View>
          <View style={styles.sectionHeadingCompact}>
            <Text style={styles.sectionTitle}>{labels.otherGames[language]}</Text>
            <Text style={styles.sectionHint}>{labels.museumGames[language]}</Text>
          </View>
          <LockedGame icon="color-palette" title={labels.matchPeriod[language]} text={labels.matchPeriodText[language]} status={labels.comingSoon[language]} colors={colors} styles={styles} />
          <Pressable accessibilityRole="button" accessibilityLabel={`${labels.allRankings[language]}. ${labels.rankingHint[language]}`} onPress={() => router.push("/leaderboards")} style={({ pressed }) => [styles.rankingPortal, pressed && styles.rankingPortalPressed]}>
            <View style={styles.rankingMedallion}><Ionicons name="podium" size={20} color={colors.gold} /></View>
            <View style={styles.rankingPortalText}>
              <Text style={styles.rankingPortalTitle}>{labels.allRankings[language]}</Text>
              <Text style={styles.rankingPortalHint} numberOfLines={1}>{labels.rankingHint[language]}</Text>
            </View>
            <Ionicons name="arrow-forward" size={18} color={colors.gold} />
          </Pressable>
        </View>
      ) : (
        renderJigsawGame()
      )}
    </AppChrome>
  );

  function renderJigsawGame() {
    if (jigsawLoading) {
      return (
        <View style={styles.card}>
          <Ionicons name="hourglass-outline" size={40} color={colors.gold} />
          <Text style={styles.text}>{labels.preparingDailyArtwork[language]}</Text>
        </View>
      );
    }

    if (!currentPuzzle) {
      return (
        <View style={styles.card}>
          <Ionicons name="cloud-outline" size={40} color={colors.gold} />
          <Text style={styles.title}>{labels.jigsawTitle[language]}</Text>
          <Text style={styles.text}>{labels.noPuzzleToday[language]}</Text>
          <Pressable onPress={() => setSelectedGame(null)} style={styles.secondary}><Text style={styles.secondaryText}>{labels.goBack[language]}</Text></Pressable>
        </View>
      );
    }

    const options = visibleQuizOptionsForLanguage(currentPuzzle.options, language);

    return (
      <View style={styles.card}>
        <Pressable onPress={() => setExitPromptVisible(true)} style={styles.exitButton}>
          <Ionicons name="arrow-back" size={17} color={colors.gold} />
          <Text style={styles.exitButtonText}>{labels.games[language]}</Text>
        </Pressable>
        <View style={styles.guessScoreBar}>
          <Text style={styles.counter}>{labels.score[language]}: {potentialScore}</Text>
          <Text style={styles.counter}>{labels.elapsed[language]}: {jigsawElapsed}s · {labels.tilesOpened[language]}: {revealed.size}</Text>
        </View>
        <View style={styles.dailyScoreBar}>
          <Text style={styles.dailyScoreLabel}>
            {practiceMode
              ? `${labels.todayScoreSet[language]}: ${dailyAttempt?.score ?? 0}`
              : `${labels.todayScore[language]}: ${sessionScore}`}
          </Text>
          {practiceMode ? (
            <>
              <Text style={styles.dailyScoreHint}>{labels.practiceMode[language]}</Text>
              <Text style={styles.dailyResetHint}>{formatNextDailyGameResetNotice(language)}</Text>
              <Pressable onPress={() => setJigsawRulesOpen((value) => !value)} style={styles.rulesToggle}>
                <Text style={styles.rulesToggleText}>{labels.gameRules[language]}</Text>
                <Ionicons name={jigsawRulesOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.gold} />
              </Pressable>
              {jigsawRulesOpen ? <Text style={styles.rulesBody}>{jigsawRulesText(language)}</Text> : null}
            </>
          ) : (
            <Text style={styles.dailyResetHint}>{formatDailyGameResetNotice(language)}</Text>
          )}
        </View>

        <JigsawBoard
          image={currentPuzzle.image}
          gridSize={gridSize}
          tileCount={tileCount}
          revealed={revealed}
          locked={jigsawResult !== null}
          onTilePress={(index) => setPendingTile(index)}
          colors={colors}
          styles={styles}
        />

        {jigsawResult ? (
          <View style={styles.resultBlock}>
            <Ionicons name={jigsawResult === "won" ? "trophy" : "close-circle"} size={34} color={jigsawResult === "won" ? colors.gold : colors.muted} />
            <Text style={styles.title}>{jigsawResult === "won" ? labels.correct[language] : labels.wrong[language]}</Text>
            <Text style={styles.text}>{labels.correctAnswer[language]}: {localizedText(currentPuzzle.title, language)}</Text>
            {!account.isAdmin && !practiceMode && !jigsawRankSaved ? (
              <RewardedScoreGate
                language={language}
                score={sessionScore}
                scoreLabel={labels.earned[language]}
                onSubmit={async () => {
                  await finishJigsawSession();
                  setJigsawRankSaved(true);
                }}
              />
            ) : (
              <>
                <Text style={styles.score}>{jigsawResult === "won" ? `+${jigsawEarned}` : "+0"}</Text>
                <Pressable onPress={nextJigsaw} style={styles.button}>
                  <Text style={styles.buttonText}>{labels.goBack[language]}</Text>
                </Pressable>
              </>
            )}
          </View>
        ) : (
          <>
            <Text style={styles.text}>{localizedText(currentPuzzle.question, language)}</Text>
            {!canGuessJigsaw ? <Text style={styles.dailyScoreHint}>{labels.openTileFirst[language]}</Text> : null}
            <View style={styles.guessOptions}>
              {options.map((option) => (
                <Pressable
                  key={`${option.label}-${option.index}`}
                  onPress={() => guessJigsaw(option.index)}
                  disabled={!canGuessJigsaw}
                  style={[styles.guessOption, !canGuessJigsaw && styles.guessOptionDisabled]}
                >
                  <Text style={styles.optionLabel}>{option.label}</Text>
                  <Text style={styles.secondaryText} numberOfLines={2} adjustsFontSizeToFit>{option.text}</Text>
                </Pressable>
              ))}
            </View>
          </>
        )}
      </View>
    );
  }

}

function JigsawBoard({ image, gridSize, tileCount, revealed, locked, onTilePress, colors, styles }: { image: string; gridSize: number; tileCount: number; revealed: Set<number>; locked: boolean; onTilePress: (index: number) => void;   colors: ReturnType<typeof getThemeColors>; styles: ReturnType<typeof createStyles> }) {
  const tilePercent = `${100 / gridSize}%` as DimensionValue;
  return (
    <View style={styles.boardWrap}>
      <Image source={{ uri: image }} style={styles.boardImage} contentFit="cover" />
      <View style={styles.boardGrid}>
        {Array.from({ length: tileCount }).map((_, index) => (
          <JigsawTile
            key={index}
            index={index}
            size={tilePercent}
            gridSize={gridSize}
            revealed={revealed.has(index)}
            locked={locked}
            onPress={() => onTilePress(index)}
            styles={styles}
          />
        ))}
      </View>
    </View>
  );
}

function JigsawTile({ index, size, gridSize, revealed, locked, onPress, styles }: { index: number; size: DimensionValue; gridSize: number; revealed: boolean; locked: boolean; onPress: () => void; styles: ReturnType<typeof createStyles> }) {
  const anim = useRef(new Animated.Value(revealed ? 1 : 0)).current;
  const row = Math.floor(index / gridSize);
  const column = index % gridSize;

  useEffect(() => {
    if (!revealed) {
      anim.setValue(0);
      return;
    }
    Animated.timing(anim, {
      toValue: 1,
      duration: 920,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [anim, revealed]);

  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const scale = anim.interpolate({ inputRange: [0, 0.35, 1], outputRange: [1, 1.08, 0.58] });
  const rotate = anim.interpolate({ inputRange: [0, 0.55, 1], outputRange: ["0deg", index % 2 === 0 ? "-5deg" : "5deg", index % 2 === 0 ? "-18deg" : "18deg"] });
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, index % 2 === 0 ? -18 : 18] });
  const translateX = anim.interpolate({ inputRange: [0, 1], outputRange: [0, index % 3 === 0 ? -14 : 14] });

  return (
    <Pressable style={[styles.tile, revealed && styles.tileRevealed, { width: size, height: size }]} disabled={revealed || locked} onPress={onPress}>
      <Animated.View style={[styles.tileCover, { opacity, transform: [{ translateX }, { translateY }, { scale }, { rotate }] }]}>
        <Image
          source={ART_DETECTIVE_COVER}
          style={[
            styles.tileCoverImage,
            {
              width: `${gridSize * 100}%` as DimensionValue,
              height: `${gridSize * 100}%` as DimensionValue,
              left: `-${column * 100}%` as DimensionValue,
              top: `-${row * 100}%` as DimensionValue
            }
          ]}
          contentFit="cover"
        />
        <View style={styles.tileCrackOne} />
        <View style={styles.tileCrackTwo} />
        <View style={styles.tileCrackThree} />
      </Animated.View>
    </Pressable>
  );
}

function ExitModal({ visible, game, practiceMode, jigsawUnanswered, onClose, onConfirm, colors, styles, language }: { visible: boolean; game: GameKey | null; practiceMode: boolean; jigsawUnanswered: boolean; onClose: () => void; onConfirm: () => void; colors: ReturnType<typeof getThemeColors>; styles: ReturnType<typeof createStyles>; language: Lang }) {
  const jigsawExitText = game === "jigsaw"
    ? practiceMode
      ? labels.jigsawExitPractice[language]
      : jigsawUnanswered
        ? labels.jigsawExitRanked[language]
        : labels.jigsawExitRankedAnswered[language]
    : labels.leaveGame[language];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalPanel}>
          <Ionicons name="game-controller-outline" size={30} color={colors.gold} />
          <Text style={styles.modalTitle}>{labels.returnToGames[language]}</Text>
          <Text style={styles.modalText}>{jigsawExitText}</Text>
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.modalCancel}>
              <Text style={styles.modalCancelText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{labels.continue[language]}</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={styles.modalConfirm}>
              <Text style={styles.modalConfirmText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{labels.goBack[language]}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function TileConfirmModal({ visible, onClose, onConfirm, colors, styles, language }: { visible: boolean; onClose: () => void; onConfirm: () => void; colors: ReturnType<typeof getThemeColors>; styles: ReturnType<typeof createStyles>; language: Lang }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalPanel}>
          <Ionicons name="extension-puzzle" size={30} color={colors.gold} />
          <Text style={styles.modalTitle}>{labels.openTile[language]}</Text>
          <Text style={styles.modalText}>{labels.openTileQuestion[language]}</Text>
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.modalCancel}>
              <Text style={styles.modalCancelText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{labels.cancel[language]}</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={styles.modalConfirm}>
              <Text style={styles.modalConfirmText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{labels.yesOpen[language]}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function InfoModal({ visible, practiceMode, dailyScore, onClose, onConfirm, colors, styles, language }: { visible: boolean; practiceMode: boolean; dailyScore: number; onClose: () => void; onConfirm: () => void; colors: ReturnType<typeof getThemeColors>; styles: ReturnType<typeof createStyles>; language: Lang }) {
  const [rulesOpen, setRulesOpen] = useState(!practiceMode);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.modalPanel, styles.modalPanelWide]}>
          <Ionicons name="extension-puzzle" size={32} color={colors.gold} />
          <Text style={styles.modalTitle}>{labels.jigsawTitle[language]}</Text>
          {practiceMode ? (
            <>
              <Text style={styles.modalText}>{`${labels.todayScoreSet[language]}: ${dailyScore}`}</Text>
              <Text style={styles.modalText}>{labels.practiceMode[language]}</Text>
              <Text style={styles.modalRenewalHint}>{formatNextDailyGameResetNotice(language)}</Text>
            </>
          ) : (
            <>
              <Text style={styles.modalText}>{labels.rankedMode[language]}</Text>
              <Text style={styles.modalRenewalHint}>{formatDailyGameResetNotice(language)}</Text>
            </>
          )}
          <Pressable onPress={() => setRulesOpen((value) => !value)} style={styles.rulesToggle}>
            <Text style={styles.rulesToggleText}>{labels.gameRules[language]}</Text>
            <Ionicons name={rulesOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.gold} />
          </Pressable>
          {rulesOpen ? <Text style={styles.rulesBody}>{jigsawRulesText(language)}</Text> : null}
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={styles.modalCancel}>
              <Text style={styles.modalCancelText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{labels.cancel[language]}</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={styles.modalConfirm}>
              <Text style={styles.modalConfirmText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{labels.startGame[language]}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function jigsawRulesText(language: Lang) {
  const reset = formatDailyGameResetNotice(language);
  if (language === "tr") {
    return `${reset}\n• Günde bir puanlı tur; sonraki girişler deneme modu.\n• En az 1 kare açmadan cevap verilemez.\n• Her açılan kare −10 puan.\n• Cevap verdiğin saniye kadar ek ceza (1. sn −1, 17. sn −17).\n• Süre cezası en fazla −${JIGSAW_MAX_TIME_PENALTY} puan.\n• Cevap vermeden çıkarsan bugünkü puanın 0 olur.\n• Başlangıç: 160 puan.`;
  }
  if (language === "ru") {
    return `${reset}\n• Один зачётный заход в день.\n• Нужно открыть минимум 1 плитку.\n• Каждая плитка −10.\n• Штраф за секунды до ответа (макс. −${JIGSAW_MAX_TIME_PENALTY}).\n• Выход без ответа = 0 за день.`;
  }
  if (language === "uz") {
    return `${reset}\n• Kuniga bir marta ballli urinish.\n• Kamida 1 katak ochilishi shart.\n• Har katak −10 ball.\n• Javob saniyasi qadar jarima (maks. −${JIGSAW_MAX_TIME_PENALTY}).\n• Javobsiz chiqish = 0 ball.`;
  }
  return `${reset}\n• One ranked run per day.\n• Open at least 1 tile before answering.\n• Each tile costs 10 points.\n• Time penalty equals seconds at answer (max −${JIGSAW_MAX_TIME_PENALTY}).\n• Leaving without answering locks today's score at 0.\n• Starting score: 160.`;
}

function localizedText(value: Partial<Record<Lang, string>>, language: Lang) {
  return value?.[language] || value?.tr || value?.en || "";
}

function GameOrbitHero({ language, reducedMotion, colors, styles }: { language: Lang; reducedMotion: boolean; colors: ReturnType<typeof getThemeColors>; styles: ReturnType<typeof createStyles> }) {
  const outerOrbit = useRef(new Animated.Value(0)).current;
  const middleOrbit = useRef(new Animated.Value(0)).current;
  const innerOrbit = useRef(new Animated.Value(0)).current;
  const corePulse = useRef(new Animated.Value(0)).current;
  const performanceMode = useRuntimePerformanceMode();
  const isFocused = useIsFocused();
  const animate = !reducedMotion && isFocused && performanceMode === "full";

  useEffect(() => {
    outerOrbit.setValue(0);
    middleOrbit.setValue(0);
    innerOrbit.setValue(0);
    corePulse.setValue(0);
    if (!animate) return undefined;
    const animations = [
      Animated.loop(Animated.timing(outerOrbit, { toValue: 1, duration: 26_000, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.timing(middleOrbit, { toValue: 1, duration: 19_000, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.timing(innerOrbit, { toValue: 1, duration: 14_000, easing: Easing.linear, useNativeDriver: true })),
      Animated.loop(Animated.sequence([
        Animated.timing(corePulse, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(corePulse, { toValue: 0, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
      ]))
    ];
    animations.forEach((animation) => animation.start());
    return () => animations.forEach((animation) => animation.stop());
  }, [animate, corePulse, innerOrbit, middleOrbit, outerOrbit]);

  return (
    <LinearGradient colors={[colors.navy, colors.panel, colors.ink]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View pointerEvents="none" style={styles.heroGlow} />
      <View pointerEvents="none" style={styles.heroPattern}>
        <View style={[styles.heroPatternLine, styles.heroPatternLineOne]} />
        <View style={[styles.heroPatternLine, styles.heroPatternLineTwo]} />
        <View style={[styles.heroPatternLine, styles.heroPatternLineThree]} />
      </View>
      <Text style={styles.heroEyebrow} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{labels.arenaLabel[language]}</Text>
      <Text style={styles.heroMessage}>{labels.heroMessage[language]}</Text>
      <View pointerEvents="none" style={styles.orbitStage}>
        <Animated.View style={[styles.orbit, styles.orbitOuter, { borderColor: `${colors.gold}70`, transform: [{ perspective: 700 }, { rotateX: "58deg" }, { rotateY: "-7deg" }, { rotateZ: outerOrbit.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }]}>
          <View style={[styles.orbitIcon, styles.orbitIconTop, { borderColor: `${colors.electric}90`, backgroundColor: colors.panelSoft, transform: [{ rotateX: "-58deg" }] }]}><Ionicons name="images" size={16} color={colors.electric} /></View>
        </Animated.View>
        <Animated.View style={[styles.orbit, styles.orbitMiddle, { borderColor: `${colors.electric}58`, transform: [{ perspective: 700 }, { rotateX: "65deg" }, { rotateY: "10deg" }, { rotateZ: middleOrbit.interpolate({ inputRange: [0, 1], outputRange: ["360deg", "0deg"] }) }] }]}>
          <View style={[styles.orbitIcon, styles.orbitIconRight, { borderColor: `${colors.plum}90`, backgroundColor: colors.panelSoft, transform: [{ rotateX: "-65deg" }] }]}><Ionicons name="people" size={15} color={colors.plum} /></View>
        </Animated.View>
        <Animated.View style={[styles.orbit, styles.orbitInner, { borderColor: `${colors.magenta}62`, transform: [{ perspective: 700 }, { rotateX: "54deg" }, { rotateY: "-12deg" }, { rotateZ: innerOrbit.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }]}>
          <View style={[styles.orbitIcon, styles.orbitIconBottom, { borderColor: `${colors.magenta}90`, backgroundColor: colors.panelSoft, transform: [{ rotateX: "-54deg" }] }]}><Ionicons name="extension-puzzle" size={15} color={colors.magenta} /></View>
        </Animated.View>
        <Animated.View style={[styles.coreGlow, { opacity: corePulse.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.58] }), transform: [{ scale: corePulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) }] }]} />
        <LinearGradient colors={[colors.plum, colors.navy]} style={styles.gameCore}>
          <View style={styles.gameCoreInner}><Ionicons name="trophy" size={25} color={colors.gold} /></View>
        </LinearGradient>
      </View>
    </LinearGradient>
  );
}

function GameModuleCard({ icon, title, text, status, meta, disabled, loading, onPress, firstAction, secondAction, firstActionLabel, secondActionLabel, accent, cardWidth, reducedMotion, readyLabel, openLabel, colors, styles }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  status: string;
  meta?: string;
  disabled: boolean;
  loading: boolean;
  onPress: () => void;
  firstAction: () => void;
  secondAction: () => void;
  firstActionLabel: string;
  secondActionLabel: string;
  accent: string;
  cardWidth: number;
  reducedMotion: boolean;
  readyLabel: string;
  openLabel: string;
  colors: ReturnType<typeof getThemeColors>;
  styles: ReturnType<typeof createStyles>;
}) {
  const pressProgress = useRef(new Animated.Value(0)).current;

  function setPressed(toValue: number) {
    if (reducedMotion) {
      pressProgress.setValue(toValue);
      return;
    }
    Animated.timing(pressProgress, { toValue, duration: toValue ? 130 : 170, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }

  return (
    <Animated.View style={[styles.gameModule, { width: cardWidth, borderColor: `${accent}5C`, opacity: disabled ? 0.62 : 1, shadowColor: accent, transform: [{ scale: pressProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.985] }) }] }]}>
      <LinearGradient colors={[`${accent}20`, colors.panelSoft, colors.panel]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gameModuleSurface}>
        <View style={[styles.moduleTopRim, { backgroundColor: `${accent}8A` }]} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title}, ${status}, ${openLabel}`}
          disabled={disabled}
          onPress={onPress}
          onPressIn={() => setPressed(1)}
          onPressOut={() => setPressed(0)}
          style={styles.gameModuleMain}
        >
          <View style={styles.moduleTopRow}>
            <Animated.View style={[styles.gameMedallion, { borderColor: `${accent}74`, backgroundColor: `${accent}18`, transform: [{ translateY: pressProgress.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }] }]}>
              <Ionicons name={icon} size={22} color={accent} />
            </Animated.View>
            <View style={[styles.readyBadge, { borderColor: `${accent}58`, backgroundColor: `${accent}13` }]}>
              {disabled && !loading ? <Ionicons name="lock-closed-outline" size={11} color={colors.muted} /> : <View style={[styles.readyDot, { backgroundColor: loading ? colors.muted : accent }]} />}
              <Text style={[styles.readyText, { color: loading || disabled ? colors.muted : accent }]} numberOfLines={1}>{loading ? "•••" : disabled ? "—" : readyLabel}</Text>
            </View>
          </View>
          <EqualHeightHeaderSlot lineHeight={16}>
            <Text style={styles.moduleTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.78} maxFontSizeMultiplier={1.25}>{title}</Text>
          </EqualHeightHeaderSlot>
          <Text style={styles.moduleDescription} numberOfLines={1}>{text}</Text>
          <View style={styles.moduleBottomRow}>
            <View style={styles.moduleStatusWrap}>
              <Text style={[styles.moduleStatus, { color: accent }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{status}</Text>
              {meta ? <Text style={styles.moduleMeta} numberOfLines={1}>{meta}</Text> : null}
            </View>
            <Animated.View style={[styles.moduleArrow, { borderColor: `${accent}55`, transform: [{ translateX: pressProgress.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }) }] }]}><Ionicons name="arrow-forward" size={14} color={accent} /></Animated.View>
          </View>
        </Pressable>
        <View style={styles.moduleActions}>
          <Pressable accessibilityRole="button" accessibilityLabel={firstActionLabel} hitSlop={6} onPress={firstAction} style={({ pressed }) => [styles.moduleAction, pressed && styles.moduleActionPressed]}><Ionicons name="time-outline" size={13} color={accent} /><Text style={styles.moduleActionText} numberOfLines={1}>{firstActionLabel}</Text></Pressable>
          <View style={styles.moduleActionDivider} />
          <Pressable accessibilityRole="button" accessibilityLabel={secondActionLabel} hitSlop={6} onPress={secondAction} style={({ pressed }) => [styles.moduleAction, pressed && styles.moduleActionPressed]}><Ionicons name="podium-outline" size={13} color={accent} /><Text style={styles.moduleActionText} numberOfLines={1}>{secondActionLabel}</Text></Pressable>
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

function GameOverviewOption({ icon, title, text, status, detail, best, disabled = false, onPress, onInfo, onLeaderboard, infoLabel, leaderboardLabel, accent, cardWidth, reducedMotion, readyLabel, openLabel, colors, styles }: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
  status: string;
  detail?: string;
  best?: string;
  disabled?: boolean;
  onPress: () => void;
  onInfo: () => void;
  onLeaderboard: () => void;
  infoLabel: string;
  leaderboardLabel: string;
  accent: string;
  cardWidth: number;
  reducedMotion: boolean;
  readyLabel: string;
  openLabel: string;
  colors: ReturnType<typeof getThemeColors>;
  styles: ReturnType<typeof createStyles>;
}) {
  return <GameModuleCard icon={icon} title={title} text={text} status={status} meta={[best, detail].filter(Boolean).join(" · ")} disabled={disabled} loading={status === timelineGameCopy.preparing.tr || status === timelineGameCopy.preparing.en || status === timelineGameCopy.preparing.ru || status === timelineGameCopy.preparing.uz} onPress={onPress} firstAction={onInfo} secondAction={onLeaderboard} firstActionLabel={infoLabel} secondActionLabel={leaderboardLabel} accent={accent} cardWidth={cardWidth} reducedMotion={reducedMotion} readyLabel={readyLabel} openLabel={openLabel} colors={colors} styles={styles} />;
}

function TimelineGameOption({ gameType, state, resetAtMs, nowMs, language, onPlay, onHistory, onLeaderboard, accent, cardWidth, reducedMotion, readyLabel, openLabel, colors, styles }: { gameType: TimelineGameType; state: TimelineGameState["games"][TimelineGameType] | null; resetAtMs: number; nowMs: number; language: Lang; onPlay: () => void; onHistory: () => void; onLeaderboard: () => void; accent: string; cardWidth: number; reducedMotion: boolean; readyLabel: string; openLabel: string; colors: ReturnType<typeof getThemeColors>; styles: ReturnType<typeof createStyles> }) {
  const title = gameType === "artwork" ? timelineGameCopy.artworkTitle[language] : timelineGameCopy.artistTitle[language];
  const description = gameType === "artwork" ? timelineGameCopy.artworkDescription[language] : timelineGameCopy.artistDescription[language];
  const status = state ? state.unlimited ? timelineGameCopy.unlimitedGames[language] : `${state.remaining} / ${state.limit} ${timelineGameCopy.gamesRemaining[language]}` : timelineGameCopy.preparing[language];
  const reset = state && !state.unlimited ? `${timelineGameCopy.nextRights[language]}: ${formatCountdown(Math.max(0, resetAtMs - nowMs))}` : "";
  const best = state?.dailyBest ? `${timelineGameCopy.dailyBest[language]}: ${state.dailyBest}` : "";
  return <GameModuleCard icon={gameType === "artwork" ? "images" : "people"} title={title} text={description} status={status} meta={[best, reset].filter(Boolean).join(" · ")} disabled={!state || (!state.unlimited && state.remaining <= 0)} loading={!state} onPress={onPlay} firstAction={onHistory} secondAction={onLeaderboard} firstActionLabel={timelineGameCopy.history[language]} secondActionLabel={timelineGameCopy.leaderboard[language]} accent={accent} cardWidth={cardWidth} reducedMotion={reducedMotion} readyLabel={readyLabel} openLabel={openLabel} colors={colors} styles={styles} />;
}

function formatCountdown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, "0");
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, "0");
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function LockedGame({ icon, title, text, status, colors, styles }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string; status: string; colors: ReturnType<typeof getThemeColors>; styles: ReturnType<typeof createStyles> }) {
  return (
    <View accessibilityLabel={`${title}, ${status}`} style={styles.comingSoonCard}>
      <View style={styles.comingSoonMedallion}><Ionicons name={icon} size={19} color={colors.muted} /></View>
      <View style={styles.comingSoonText}>
        <Text style={styles.comingSoonTitle}>{title}</Text>
        <Text style={styles.comingSoonDescription} numberOfLines={1}>{text}</Text>
      </View>
      <View style={styles.comingSoonBadge}><Ionicons name="lock-closed-outline" size={12} color={colors.gold} /><Text style={styles.comingSoonBadgeText}>{status}</Text></View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    list: { width: "100%", alignSelf: "center", gap: 11, position: "relative" },
    hero: { height: 218, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: `${colors.plum}78`, overflow: "hidden", alignItems: "center", shadowColor: colors.plum, shadowOffset: { width: 0, height: 9 }, shadowOpacity: 0.18, shadowRadius: 17, elevation: 5 },
    heroGlow: { position: "absolute", width: 230, height: 230, borderRadius: 115, top: 20, backgroundColor: `${colors.plum}18` },
    heroPattern: { ...StyleSheet.absoluteFillObject, opacity: 0.32, overflow: "hidden" },
    heroPatternLine: { position: "absolute", width: 320, height: StyleSheet.hairlineWidth, backgroundColor: `${colors.ivory}16` },
    heroPatternLineOne: { top: 65, left: -55, transform: [{ rotate: "17deg" }] },
    heroPatternLineTwo: { top: 118, right: -70, transform: [{ rotate: "-20deg" }] },
    heroPatternLineThree: { bottom: 28, left: -35, transform: [{ rotate: "8deg" }] },
    heroEyebrow: { zIndex: 3, color: colors.gold, fontSize: 9, lineHeight: 12, fontWeight: "900", letterSpacing: 1.35, marginTop: 15, paddingHorizontal: 18, textAlign: "center" },
    heroMessage: { zIndex: 3, color: colors.ivory, fontSize: 13, lineHeight: 18, fontWeight: "700", marginTop: 4, textAlign: "center", paddingHorizontal: 16 },
    orbitStage: { position: "absolute", bottom: 2, left: "50%", marginLeft: -100, width: 200, height: 158, alignItems: "center", justifyContent: "center" },
    orbit: { position: "absolute", borderWidth: StyleSheet.hairlineWidth, borderRadius: 999 },
    orbitOuter: { width: 184, height: 126 },
    orbitMiddle: { width: 151, height: 110 },
    orbitInner: { width: 118, height: 88 },
    orbitIcon: { position: "absolute", width: 35, height: 35, borderRadius: 18, borderWidth: 1, alignItems: "center", justifyContent: "center", shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.45, shadowRadius: 7, elevation: 4 },
    orbitIconTop: { top: -18, left: "50%", marginLeft: -18 },
    orbitIconRight: { right: -18, top: "50%", marginTop: -18 },
    orbitIconBottom: { bottom: -18, left: "50%", marginLeft: -18 },
    coreGlow: { position: "absolute", width: 82, height: 82, borderRadius: 41, backgroundColor: `${colors.plum}42` },
    gameCore: { width: 62, height: 62, borderRadius: 31, borderWidth: 1, borderColor: `${colors.gold}92`, alignItems: "center", justifyContent: "center", shadowColor: colors.gold, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.28, shadowRadius: 12, elevation: 7 },
    gameCoreInner: { width: 48, height: 48, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: `${colors.ivory}30`, backgroundColor: `${colors.ink}7A`, alignItems: "center", justifyContent: "center" },
    statusStrip: { minHeight: 49, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", overflow: "hidden", paddingHorizontal: 7 },
    statusSegment: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 5 },
    statusValue: { minWidth: 0, flexShrink: 1, color: colors.ivory, fontSize: 10, lineHeight: 13, fontWeight: "800" },
    statusDivider: { width: StyleSheet.hairlineWidth, height: 22, backgroundColor: colors.line },
    statusRanking: { width: 38, minHeight: 44, alignItems: "center", justifyContent: "center" },
    timelineStatus: { minHeight: 78, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center", gap: 7, padding: 12 },
    timelineStatusText: { color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: "800", textAlign: "center" },
    timelineStatusError: { color: colors.ivory, fontSize: 13, lineHeight: 18, fontWeight: "800", textAlign: "center" },
    timelineRetry: { minHeight: 38, borderRadius: 9, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
    timelineRetryText: { color: colors.ink, fontSize: 12, fontWeight: "900" },
    sectionHeading: { minHeight: 38, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 2, marginTop: 1 },
    sectionHeadingCompact: { minHeight: 27, flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", paddingHorizontal: 2, marginTop: 4 },
    sectionTitle: { color: colors.ivory, fontSize: 15, lineHeight: 20, fontWeight: "800" },
    sectionHint: { color: colors.muted, fontSize: 10, lineHeight: 14, fontWeight: "600", marginTop: 1 },
    sectionSpark: { width: 28, height: 28, borderRadius: 14, backgroundColor: `${colors.gold}13`, alignItems: "center", justifyContent: "center" },
    lightPath: { position: "absolute", top: 330, left: -20, right: -20, height: 330, opacity: 0.62 },
    lightPathLine: { position: "absolute", width: "115%", height: StyleSheet.hairlineWidth, borderRadius: 999, backgroundColor: `${colors.electric}18` },
    lightPathLineOne: { top: 98, left: -15, transform: [{ rotate: "14deg" }] },
    lightPathLineTwo: { top: 220, right: -12, backgroundColor: `${colors.magenta}13`, transform: [{ rotate: "-17deg" }] },
    lightNode: { position: "absolute", width: 5, height: 5, borderRadius: 3, backgroundColor: colors.electric },
    lightNodeOne: { top: 91, left: "24%", opacity: 0.34 },
    lightNodeTwo: { top: 218, right: "21%", backgroundColor: colors.magenta, opacity: 0.28 },
    gameGrid: { flexDirection: "row", flexWrap: "wrap", zIndex: 1 },
    gameModule: { height: 164, borderRadius: 15, borderWidth: 1, backgroundColor: colors.panel, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 4 },
    gameModuleSurface: { flex: 1, borderRadius: 14, overflow: "hidden" },
    moduleTopRim: { position: "absolute", top: 0, left: 14, right: 14, height: StyleSheet.hairlineWidth },
    gameModuleMain: { flex: 1, paddingHorizontal: 10, paddingTop: 9, paddingBottom: 6 },
    moduleTopRow: { height: 41, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
    gameMedallion: { width: 43, height: 43, borderRadius: 22, borderWidth: 1, alignItems: "center", justifyContent: "center", shadowColor: colors.ink, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 6, elevation: 3 },
    readyBadge: { maxWidth: 63, minHeight: 22, borderRadius: 11, borderWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 6 },
    readyDot: { width: 4, height: 4, borderRadius: 2 },
    readyText: { fontSize: 8, lineHeight: 10, fontWeight: "900", letterSpacing: 0.45 },
    moduleTitle: { color: colors.ivory, fontSize: 13.5, lineHeight: 16, fontWeight: "800", marginTop: 5, minHeight: 16 },
    moduleDescription: { color: colors.muted, fontSize: 9.5, lineHeight: 13, fontWeight: "600", marginTop: 2 },
    moduleBottomRow: { flex: 1, minHeight: 29, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", gap: 5 },
    moduleStatusWrap: { flex: 1, minWidth: 0 },
    moduleStatus: { fontSize: 9.5, lineHeight: 12, fontWeight: "900" },
    moduleMeta: { color: colors.muted, fontSize: 8.5, lineHeight: 11, fontWeight: "600", marginTop: 1 },
    moduleArrow: { width: 25, height: 25, borderRadius: 13, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    moduleActions: { height: 34, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, flexDirection: "row", alignItems: "center", backgroundColor: `${colors.ink}20` },
    moduleAction: { flex: 1, height: 34, minWidth: 0, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 4 },
    moduleActionPressed: { opacity: 0.62 },
    moduleActionText: { minWidth: 0, color: colors.ivory, fontSize: 8.5, lineHeight: 11, fontWeight: "700" },
    moduleActionDivider: { width: StyleSheet.hairlineWidth, height: 17, backgroundColor: colors.line },
    comingSoonCard: { minHeight: 66, borderRadius: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: `${colors.panel}B8`, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 11, opacity: 0.76 },
    comingSoonMedallion: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.panelSoft, alignItems: "center", justifyContent: "center" },
    comingSoonText: { flex: 1, minWidth: 0 },
    comingSoonTitle: { color: colors.ivory, fontSize: 12, lineHeight: 16, fontWeight: "800" },
    comingSoonDescription: { color: colors.muted, fontSize: 9.5, lineHeight: 13, fontWeight: "600", marginTop: 1 },
    comingSoonBadge: { minHeight: 25, borderRadius: 13, borderWidth: StyleSheet.hairlineWidth, borderColor: `${colors.gold}42`, backgroundColor: `${colors.gold}0D`, flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 7 },
    comingSoonBadgeText: { color: colors.gold, fontSize: 8.5, lineHeight: 11, fontWeight: "900" },
    rankingPortal: { minHeight: 57, borderRadius: 14, borderWidth: 1, borderColor: `${colors.gold}52`, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 11, shadowColor: colors.gold, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.1, shadowRadius: 9, elevation: 2 },
    rankingPortalPressed: { opacity: 0.78, transform: [{ scale: 0.992 }] },
    rankingMedallion: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, borderColor: `${colors.gold}50`, backgroundColor: `${colors.gold}12`, alignItems: "center", justifyContent: "center" },
    rankingPortalText: { flex: 1, minWidth: 0 },
    rankingPortalTitle: { color: colors.ivory, fontSize: 12.5, lineHeight: 16, fontWeight: "800" },
    rankingPortalHint: { color: colors.muted, fontSize: 9.5, lineHeight: 13, fontWeight: "600", marginTop: 1 },
    card: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: "center", gap: 14, padding: 18 },
    exitButton: { alignSelf: "flex-start", minHeight: 36, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 10 },
    exitButtonText: { color: colors.ivory, fontWeight: "900" },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.52)", justifyContent: "center", padding: 18 },
    modalPanel: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: "center", padding: 18, gap: 10 },
    modalPanelWide: { alignSelf: "stretch", maxWidth: 420, width: "100%" },
    modalTitle: { color: colors.ivory, fontSize: 20, fontWeight: "900", textAlign: "center" },
    modalText: { color: colors.muted, lineHeight: 21, fontWeight: "700", textAlign: "center" },
    modalRenewalHint: { color: colors.muted, lineHeight: 18, fontSize: 12, fontWeight: "700", textAlign: "center", opacity: 0.9 },
    rulesToggle: { alignSelf: "stretch", minHeight: 36, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
    rulesToggleText: { color: colors.gold, fontWeight: "900", fontSize: 13 },
    rulesBody: { alignSelf: "stretch", color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: "700", textAlign: "left" },
    modalActions: { flexDirection: "row", gap: 8, marginTop: 6, alignSelf: "stretch" },
    modalCancel: { flex: 1, minHeight: 42, borderRadius: 8, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
    modalCancelText: { color: colors.ivory, fontWeight: "900" },
    modalConfirm: { flex: 1, minHeight: 42, borderRadius: 8, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
    modalConfirmText: { color: colors.ink, fontWeight: "900" },
    title: { color: colors.ivory, fontSize: 22, fontWeight: "900", textAlign: "center" },
    text: { color: colors.muted, textAlign: "center", lineHeight: 21, fontWeight: "700" },
    counter: { color: colors.gold, fontWeight: "900" },
    score: { color: colors.gold, fontSize: 38, fontWeight: "900" },
    resultBlock: { alignSelf: "stretch", alignItems: "center", gap: 10 },
    boardWrap: { width: "100%", maxWidth: 320, aspectRatio: 1, borderRadius: 10, overflow: "hidden", borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.panel, alignSelf: "center" },
    boardImage: { ...StyleSheet.absoluteFillObject },
    boardGrid: { ...StyleSheet.absoluteFillObject, flexDirection: "row", flexWrap: "wrap" },
    tile: { alignItems: "center", justifyContent: "center", backgroundColor: colors.panel, borderWidth: 0.5, borderColor: "rgba(20, 16, 10, 0.78)", overflow: "hidden" },
    tileRevealed: { backgroundColor: "transparent" },
    tileCover: { ...StyleSheet.absoluteFillObject, left: -1, top: -1, right: -1, bottom: -1, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center" },
    tileCoverImage: { position: "absolute" },
    tileCrackOne: { position: "absolute", width: 1, height: 46, backgroundColor: "rgba(255, 236, 190, 0.24)", transform: [{ rotate: "-28deg" }] },
    tileCrackTwo: { position: "absolute", width: 1, height: 30, backgroundColor: "rgba(255, 236, 190, 0.18)", transform: [{ translateX: 10 }, { translateY: -8 }, { rotate: "38deg" }] },
    tileCrackThree: { position: "absolute", width: 1, height: 24, backgroundColor: "rgba(255, 236, 190, 0.16)", transform: [{ translateX: -11 }, { translateY: 9 }, { rotate: "44deg" }] },
    guessImageWrap: { width: "100%", maxWidth: 260, aspectRatio: 1, borderRadius: 8, overflow: "hidden", borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft },
    guessImage: { width: "100%", height: "100%" },
    guessOptions: { alignSelf: "stretch", gap: 8 },
    guessOption: { minHeight: 48, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, flexDirection: "row", alignItems: "center", gap: 10, justifyContent: "center", paddingHorizontal: 12 },
    guessOptionDisabled: { opacity: 0.45 },
    optionLabel: { color: colors.gold, fontWeight: "900", fontSize: 16 },
    guessScoreBar: { alignSelf: "stretch", minHeight: 34, borderRadius: 8, backgroundColor: colors.panelSoft, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
    dailyScoreBar: { alignSelf: "stretch", borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
    dailyScoreLabel: { color: colors.ivory, fontWeight: "900", textAlign: "center" },
    dailyScoreHint: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: "700", textAlign: "center" },
    dailyResetHint: { color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: "700", textAlign: "center", opacity: 0.92 },
    rankingButton: { minHeight: 46, borderRadius: 8, backgroundColor: colors.gold, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14 },
    rankingButtonText: { color: colors.ink, fontWeight: "900" },
    button: { minHeight: 46, borderRadius: 8, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
    buttonText: { color: colors.ink, fontWeight: "900" },
    secondary: { minHeight: 46, borderRadius: 8, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
    secondaryText: { color: colors.ivory, fontWeight: "900", textAlign: "center" }
  });
}
