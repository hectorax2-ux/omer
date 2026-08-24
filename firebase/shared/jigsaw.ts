import {
  emptyQuizOptionSlots,
  filledQuizOptionSlots,
  isQuizAnswerIndexValid,
  normalizeQuizLocalizedText,
  normalizeQuizOptions,
  normalizeQuizOptionSlots,
  type QuizAppLanguage,
  type QuizLocalizedText
} from "./quiz-week";
import { istanbulCalendarDate, parseIstanbulStart } from "./competition-week";

export type JigsawAppLanguage = QuizAppLanguage;

export const JIGSAW_GRID_SIZE = 4;
export const JIGSAW_TILE_COUNT = JIGSAW_GRID_SIZE * JIGSAW_GRID_SIZE;
export const JIGSAW_DEFAULT_START_SCORE = 160;
export const JIGSAW_DEFAULT_REVEAL_PENALTY = 10;
export const JIGSAW_MAX_TIME_PENALTY = 30;

export function todayJigsawDayKey(reference = new Date()) {
  return istanbulCalendarDate(reference);
}

function addDaysToDateString(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  const nextYear = next.getUTCFullYear();
  const nextMonth = String(next.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(next.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function resetPresentationForLanguage(language: JigsawAppLanguage) {
  if (language === "tr") return { timeZone: "Europe/Istanbul", hour12: false, locale: "tr-TR" };
  if (language === "uz") return { timeZone: "Asia/Tashkent", hour12: false, locale: "uz-UZ" };
  if (language === "ru") return { timeZone: "Asia/Tashkent", hour12: false, locale: "ru-RU" };
  return { timeZone: "Europe/Istanbul", hour12: true, locale: "en-US" };
}

export function nextIstanbulMidnight(reference = new Date()) {
  const nextDayKey = addDaysToDateString(istanbulCalendarDate(reference), 1);
  return parseIstanbulStart(nextDayKey);
}

function formatResetClock(language: JigsawAppLanguage, instant: Date) {
  const presentation = resetPresentationForLanguage(language);
  return new Intl.DateTimeFormat(presentation.locale, {
    timeZone: presentation.timeZone,
    hour: presentation.hour12 ? "numeric" : "2-digit",
    minute: "2-digit",
    hour12: presentation.hour12
  }).format(instant);
}

function formatResetDate(language: JigsawAppLanguage, instant: Date) {
  const presentation = resetPresentationForLanguage(language);
  return new Intl.DateTimeFormat(presentation.locale, {
    timeZone: presentation.timeZone,
    day: "numeric",
    month: "long"
  }).format(instant);
}

function dailyResetClock(language: JigsawAppLanguage) {
  return formatResetClock(language, nextIstanbulMidnight());
}

export function formatDailyGameResetNotice(language: JigsawAppLanguage) {
  const time = dailyResetClock(language);
  if (language === "tr") return `Yeni bölüm her gün ${time}'da başlar.`;
  if (language === "ru") return `Новый выпуск каждый день в ${time}.`;
  if (language === "uz") return `Yangi bo'lim har kuni ${time} da boshlanadi.`;
  return `A new episode starts every day at ${time}.`;
}

export function formatNextDailyGameResetNotice(language: JigsawAppLanguage, reference = new Date()) {
  const instant = nextIstanbulMidnight(reference);
  const dateLabel = formatResetDate(language, instant);
  const time = formatResetClock(language, instant);
  if (language === "tr") return `Sıradaki bölüm ${dateLabel} ${time}'da başlar.`;
  if (language === "ru") return `Следующий выпуск: ${dateLabel}, ${time}.`;
  if (language === "uz") return `Keyingi bo'lim ${dateLabel} ${time} da boshlanadi.`;
  return `Next episode starts on ${dateLabel} at ${time}.`;
}

export function jigsawTimePenalty(elapsedSeconds: number) {
  const seconds = Math.max(0, Math.floor(elapsedSeconds));
  if (seconds <= 0) return 0;
  return Math.min(JIGSAW_MAX_TIME_PENALTY, seconds);
}

export function scoreForJigsawGuess(input: {
  startScore: number;
  revealedCount: number;
  revealPenalty: number;
  elapsedSeconds: number;
}) {
  const tileScore = scoreForRevealedTiles({
    startScore: input.startScore,
    revealedCount: input.revealedCount,
    revealPenalty: input.revealPenalty
  });
  return Math.max(0, tileScore - jigsawTimePenalty(input.elapsedSeconds));
}

export type JigsawPuzzleStatus = "draft" | "scheduled" | "published" | "hidden" | "archived";

export type JigsawPuzzleInput = {
  id: string;
  title: QuizLocalizedText;
  question: QuizLocalizedText;
  image: string;
  options: Partial<Record<JigsawAppLanguage, string[]>>;
  answerIndex: number;
  tileCount: number;
  startScore: number;
  revealPenalty: number;
  status: JigsawPuzzleStatus;
  dayKey: string;
  pinned?: boolean;
  scheduledAt?: string;
};

export function clampJigsawAnswerIndex(options: string[] | undefined, answerIndex: number) {
  if (isQuizAnswerIndexValid(options, answerIndex)) return answerIndex;
  return filledQuizOptionSlots(options)[0]?.index ?? 0;
}

export function scoreForRevealedTiles(input: { startScore: number; revealedCount: number; revealPenalty: number }) {
  const start = Number.isFinite(input.startScore) && input.startScore > 0 ? input.startScore : JIGSAW_DEFAULT_START_SCORE;
  const penalty = Number.isFinite(input.revealPenalty) && input.revealPenalty > 0 ? input.revealPenalty : JIGSAW_DEFAULT_REVEAL_PENALTY;
  const revealed = Math.max(0, Math.floor(input.revealedCount));
  return Math.max(0, start - revealed * penalty);
}

export function isJigsawPuzzleReady(puzzle: JigsawPuzzleInput) {
  if (!puzzle.image.trim()) return false;
  if (!puzzle.title.tr.trim()) return false;
  if (!puzzle.dayKey.trim()) return false;
  const options = normalizeQuizOptionSlots(puzzle.options.tr);
  return filledQuizOptionSlots(options).length >= 2 && isQuizAnswerIndexValid(options, puzzle.answerIndex);
}

export function createEmptyJigsawPuzzle(id = ""): JigsawPuzzleInput {
  return {
    id,
    title: { tr: "", en: "", ru: "", uz: "" },
    question: {
      tr: "Bu eser hangisi?",
      en: "Which artwork is this?",
      ru: "Что это за произведение?",
      uz: "Bu qaysi asar?"
    },
    image: "",
    options: { tr: emptyQuizOptionSlots(), en: emptyQuizOptionSlots(), ru: emptyQuizOptionSlots(), uz: emptyQuizOptionSlots() },
    answerIndex: 0,
    tileCount: JIGSAW_TILE_COUNT,
    startScore: JIGSAW_DEFAULT_START_SCORE,
    revealPenalty: JIGSAW_DEFAULT_REVEAL_PENALTY,
    status: "draft",
    dayKey: todayJigsawDayKey()
  };
}

export function normalizeJigsawPuzzle(id: string, data: Record<string, unknown>): JigsawPuzzleInput {
  const options = normalizeQuizOptions(data.options);
  const answerIndex = typeof data.answerIndex === "number" ? data.answerIndex : 0;
  const tileCount = typeof data.tileCount === "number" && data.tileCount > 0 ? data.tileCount : JIGSAW_TILE_COUNT;
  return {
    id,
    title: normalizeQuizLocalizedText(data.title),
    question: normalizeQuizLocalizedText(data.question, "Bu eser hangisi?"),
    image: typeof data.image === "string" ? data.image : typeof data.imageURL === "string" ? data.imageURL : "",
    options: Object.keys(options).length ? options : { tr: emptyQuizOptionSlots() },
    answerIndex: clampJigsawAnswerIndex(options.tr, answerIndex),
    tileCount,
    startScore: typeof data.startScore === "number" && data.startScore > 0 ? data.startScore : JIGSAW_DEFAULT_START_SCORE,
    revealPenalty: typeof data.revealPenalty === "number" && data.revealPenalty > 0 ? data.revealPenalty : JIGSAW_DEFAULT_REVEAL_PENALTY,
    status: data.status === "published" || data.status === "scheduled" || data.status === "hidden" || data.status === "archived"
      ? data.status
      : "draft",
    dayKey: typeof data.dayKey === "string" && data.dayKey.trim() ? data.dayKey.trim() : "",
    pinned: data.pinned === true,
    scheduledAt: typeof data.scheduledAt === "string" ? data.scheduledAt : ""
  };
}

export function resolveJigsawPublishStatus(dayKey: string) {
  return dayKey.trim() ? "published" : "draft";
}

export function isJigsawPuzzleLive(puzzle: Pick<JigsawPuzzleInput, "dayKey" | "status">, reference = new Date()) {
  if (!puzzle.dayKey || puzzle.dayKey !== todayJigsawDayKey(reference)) return false;
  return puzzle.status === "published" || puzzle.status === "scheduled";
}

export function isJigsawPuzzlePlayable(puzzle: JigsawPuzzleInput, reference = new Date()) {
  if (!puzzle.image.trim() || !puzzle.title.tr.trim()) return false;
  if (puzzle.status === "draft" || puzzle.status === "hidden" || puzzle.status === "archived") return false;
  if (isJigsawPuzzleLive(puzzle, reference)) return true;
  if (puzzle.status === "published" && !puzzle.dayKey.trim()) return true;
  if (puzzle.status === "published" && puzzle.pinned) return true;
  return false;
}

export function pickActiveJigsawPuzzle(puzzles: JigsawPuzzleInput[], reference = new Date()) {
  const todayKey = todayJigsawDayKey(reference);
  const playable = puzzles.filter((puzzle) => isJigsawPuzzlePlayable(puzzle, reference));
  const todayMatches = playable.filter((puzzle) => puzzle.dayKey === todayKey);
  if (todayMatches.length) {
    return todayMatches.sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      if (a.status === "published" && b.status !== "published") return -1;
      if (b.status === "published" && a.status !== "published") return 1;
      return a.id.localeCompare(b.id);
    })[0];
  }

  const legacyPublished = playable.filter((puzzle) => puzzle.status === "published" && !puzzle.dayKey.trim());
  if (legacyPublished.length) return legacyPublished.sort((a, b) => a.id.localeCompare(b.id))[0];

  const pinnedPublished = playable.filter((puzzle) => puzzle.pinned && puzzle.status === "published");
  if (pinnedPublished.length) return pinnedPublished.sort((a, b) => a.id.localeCompare(b.id))[0];

  return null;
}

export function jigsawDayPlanLabel(dayKey: string, reference = new Date()) {
  const todayKey = todayJigsawDayKey(reference);
  if (dayKey === todayKey) return "today";
  if (dayKey > todayKey) return "future";
  return "past";
}
