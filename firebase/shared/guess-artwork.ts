import {
  emptyQuizOptionSlots,
  filledQuizOptionSlots,
  isQuizAnswerIndexValid,
  normalizeQuizLocalizedText,
  normalizeQuizOptions,
  normalizeQuizOptionSlots,
  type QuizAppLanguage,
  type QuizLocalizedText,
  DEFAULT_QUIZ_POINTS_PER_SECOND,
  DEFAULT_QUIZ_SECONDS
} from "./quiz-week";
import { istanbulCalendarDate } from "./competition-week";

export type GuessArtworkAppLanguage = QuizAppLanguage;

export type GuessArtworkStatus = "draft" | "scheduled" | "published" | "hidden" | "archived";

export type GuessArtworkInput = {
  id: string;
  title: QuizLocalizedText;
  question: QuizLocalizedText;
  image: string;
  options: Partial<Record<GuessArtworkAppLanguage, string[]>>;
  answerIndex: number;
  seconds: number;
  pointsMultiplier: number;
  status: GuessArtworkStatus;
  dayKey: string;
  pinned?: boolean;
  scheduledAt?: string;
};

export function todayGuessArtworkDayKey(reference = new Date()) {
  return istanbulCalendarDate(reference);
}

export function isGuessArtworkReady(puzzle: GuessArtworkInput) {
  if (!puzzle.image.trim()) return false;
  if (!puzzle.title.tr.trim()) return false;
  if (!puzzle.dayKey.trim()) return false;
  const options = normalizeQuizOptionSlots(puzzle.options.tr);
  return filledQuizOptionSlots(options).length >= 2 && isQuizAnswerIndexValid(options, puzzle.answerIndex);
}

export function createEmptyGuessArtwork(id = ""): GuessArtworkInput {
  return {
    id,
    title: { tr: "", en: "", ru: "", uz: "" },
    question: {
      tr: "Bu detay hangi esere ait?",
      en: "Which artwork is this detail from?",
      ru: "К какому произведению относится этот фрагмент?",
      uz: "Bu parcha qaysi asarga tegishli?"
    },
    image: "",
    options: { tr: emptyQuizOptionSlots(), en: emptyQuizOptionSlots(), ru: emptyQuizOptionSlots(), uz: emptyQuizOptionSlots() },
    answerIndex: 0,
    seconds: DEFAULT_QUIZ_SECONDS,
    pointsMultiplier: DEFAULT_QUIZ_POINTS_PER_SECOND,
    status: "draft",
    dayKey: todayGuessArtworkDayKey()
  };
}

export function normalizeGuessArtwork(id: string, data: Record<string, unknown>): GuessArtworkInput {
  const firstQuestion = Array.isArray(data.questions) ? data.questions[0] as Record<string, unknown> | undefined : undefined;
  const options = normalizeQuizOptions(firstQuestion?.options ?? data.options);
  const answerIndex = typeof firstQuestion?.answerIndex === "number" ? firstQuestion.answerIndex : typeof data.answerIndex === "number" ? data.answerIndex : 0;
  return {
    id,
    title: normalizeQuizLocalizedText(data.title),
    question: normalizeQuizLocalizedText(firstQuestion?.question ?? data.question, "Bu detay hangi esere ait?"),
    image: typeof firstQuestion?.image === "string"
      ? firstQuestion.image
      : typeof firstQuestion?.imageURL === "string"
        ? firstQuestion.imageURL
        : typeof data.image === "string"
          ? data.image
          : typeof data.imageURL === "string"
            ? data.imageURL
            : "",
    options: Object.keys(options).length ? options : { tr: emptyQuizOptionSlots() },
    answerIndex,
    seconds: typeof firstQuestion?.seconds === "number" && firstQuestion.seconds > 0
      ? firstQuestion.seconds
      : typeof data.seconds === "number" && data.seconds > 0
        ? data.seconds
        : DEFAULT_QUIZ_SECONDS,
    pointsMultiplier: typeof firstQuestion?.pointsPerSecond === "number" && firstQuestion.pointsPerSecond > 0
      ? firstQuestion.pointsPerSecond
      : typeof data.pointsMultiplier === "number" && data.pointsMultiplier > 0
        ? data.pointsMultiplier
        : DEFAULT_QUIZ_POINTS_PER_SECOND,
    status: data.status === "published" || data.status === "scheduled" || data.status === "hidden" || data.status === "archived"
      ? data.status
      : "draft",
    dayKey: typeof data.dayKey === "string" && data.dayKey.trim() ? data.dayKey.trim() : "",
    pinned: data.pinned === true,
    scheduledAt: typeof data.scheduledAt === "string" ? data.scheduledAt : ""
  };
}

export function guessArtworkDayPlanLabel(dayKey: string, reference = new Date()) {
  const todayKey = todayGuessArtworkDayKey(reference);
  if (dayKey === todayKey) return "today";
  if (dayKey > todayKey) return "future";
  return "past";
}

export function isGuessArtworkLive(puzzle: Pick<GuessArtworkInput, "dayKey" | "status">, reference = new Date()) {
  if (!puzzle.dayKey || puzzle.dayKey !== todayGuessArtworkDayKey(reference)) return false;
  return puzzle.status === "published" || puzzle.status === "scheduled";
}
