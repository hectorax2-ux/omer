import { extractWeekPeriodId, getCompetitionWeekId, getWeekdayInIstanbul, istanbulCalendarDate } from "./competition-week";

export const DEFAULT_WEEKLY_QUIZ_QUESTION_COUNT = 10;
export const MIN_WEEKLY_QUIZ_QUESTIONS = 1;
export const MAX_WEEKLY_QUIZ_QUESTIONS = 15;
/** @deprecated Use DEFAULT_WEEKLY_QUIZ_QUESTION_COUNT */
export const WEEKLY_QUIZ_QUESTION_COUNT = DEFAULT_WEEKLY_QUIZ_QUESTION_COUNT;
export const DEFAULT_DAILY_QUIZ_QUESTION_COUNT = 3;
export const MIN_DAILY_QUIZ_QUESTIONS = 1;
export const MAX_DAILY_QUIZ_QUESTIONS = 10;
export const DEFAULT_DAILY_QUIZ_SECONDS = 20;
export const DEFAULT_QUIZ_SECONDS = 15;
export const DEFAULT_QUIZ_POINTS_PER_SECOND = 10;
export const DEFAULT_WEEKLY_QUIZ_SECONDS = 30;
export const DEFAULT_WEEKLY_QUIZ_SCORE_WINDOW_SECONDS = 15;
export const DEFAULT_WEEKLY_QUIZ_POINTS_PER_SECOND = 1;
export const QUIZ_ATTEMPTS_COLLECTION = "quizAttempts";

export type QuizAppLanguage = "tr" | "en" | "ru" | "uz";

export type QuizLocalizedText = Record<QuizAppLanguage, string>;

export type WeeklyQuizQuestionInput = {
  id: string;
  question: Partial<Record<QuizAppLanguage, string>>;
  options: Partial<Record<QuizAppLanguage, string[]>>;
  answerIndex: number;
  image?: string;
  seconds: number;
  pointsPerSecond: number;
};

export type WeeklyQuizPackInput = {
  id: string;
  weekId: string;
  title: Partial<Record<QuizAppLanguage, string>>;
  questions: WeeklyQuizQuestionInput[];
  status: "draft" | "scheduled" | "published" | "hidden" | "archived";
  scheduledAt?: string;
};

export function buildWeeklyQuizDocumentId(weekId: string) {
  const periodId = extractWeekPeriodId(weekId);
  return `weekly-${periodId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export function buildDailyQuizDocumentId(weekId: string) {
  const periodId = extractWeekPeriodId(weekId);
  return `daily-${periodId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export function randomAnswerIndex(optionCount = 4) {
  if (optionCount <= 1) return 0;
  return Math.floor(Math.random() * optionCount);
}

export function shuffleAnswerIndex(previous?: number, optionCount = 4) {
  if (optionCount <= 1) return 0;
  let next = randomAnswerIndex(optionCount);
  while (next === previous) {
    next = randomAnswerIndex(optionCount);
  }
  return next;
}

function buildQuizOptionPermutation(optionCount = QUIZ_OPTION_SLOT_COUNT) {
  const permutation = Array.from({ length: optionCount }, (_, index) => index);
  for (let index = permutation.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [permutation[index], permutation[swapIndex]] = [permutation[swapIndex], permutation[index]];
  }
  return permutation;
}

export function shuffleQuizQuestionOptions(question: WeeklyQuizQuestionInput): WeeklyQuizQuestionInput {
  const trSlots = normalizeQuizOptionSlots(question.options.tr);
  const currentAnswerIndex = isQuizAnswerIndexValid(trSlots, question.answerIndex)
    ? question.answerIndex
    : filledQuizOptionSlots(trSlots)[0]?.index ?? 0;
  const permutation = buildQuizOptionPermutation();
  const languages: QuizAppLanguage[] = ["tr", "en", "ru", "uz"];

  const shuffleSlots = (options?: string[]) => {
    const slots = normalizeQuizOptionSlots(options?.some((item) => item.trim()) ? options : trSlots);
    return permutation.map((oldIndex) => slots[oldIndex] ?? "");
  };

  const nextOptions = languages.reduce<Partial<Record<QuizAppLanguage, string[]>>>((acc, language) => {
    acc[language] = shuffleSlots(question.options[language]);
    return acc;
  }, {});

  const nextAnswerIndex = permutation.indexOf(currentAnswerIndex);
  return {
    ...question,
    options: nextOptions,
    answerIndex: nextAnswerIndex >= 0 ? nextAnswerIndex : currentAnswerIndex
  };
}

export function shuffleQuizPackQuestionAnswers(questions: WeeklyQuizQuestionInput[]) {
  return questions.map((question) => shuffleQuizQuestionOptions(question));
}

export const QUIZ_OPTION_SLOT_COUNT = 4;

export function emptyQuizOptionSlots() {
  return Array.from({ length: QUIZ_OPTION_SLOT_COUNT }, () => "");
}

export function normalizeQuizOptionSlots(options?: string[] | null) {
  const items = Array.isArray(options)
    ? options.map((item) => (typeof item === "string" ? item : ""))
    : [];
  const padded = items.slice(0, QUIZ_OPTION_SLOT_COUNT);
  while (padded.length < QUIZ_OPTION_SLOT_COUNT) padded.push("");
  return padded;
}

export function sanitizeQuizOptionSlotsForSave(options?: string[] | null) {
  return normalizeQuizOptionSlots(options).map((item) => item.trim());
}

export function filledQuizOptionSlots(options?: string[] | null) {
  return normalizeQuizOptionSlots(options)
    .map((text, index) => ({ index, text, label: String.fromCharCode(65 + index) }))
    .filter(({ text }) => text.trim().length > 0);
}

export function countFilledQuizOptions(options?: string[] | null) {
  return filledQuizOptionSlots(options).length;
}

export function isQuizAnswerIndexValid(options: string[] | undefined, answerIndex: number) {
  const slots = normalizeQuizOptionSlots(options);
  return answerIndex >= 0 && answerIndex < QUIZ_OPTION_SLOT_COUNT && Boolean(slots[answerIndex]?.trim());
}

export function quizQuestionOptionsReady(options: string[] | undefined, answerIndex: number) {
  return countFilledQuizOptions(options) >= 2 && isQuizAnswerIndexValid(options, answerIndex);
}

export function visibleQuizOptionsForLanguage(
  options: Partial<Record<QuizAppLanguage, string[]>> | undefined,
  language: QuizAppLanguage
) {
  const raw = options?.[language]?.length
    ? options[language]
    : options?.tr?.length
      ? options.tr
      : options?.en?.length
        ? options.en
        : Object.values(options ?? {}).find((item) => item?.length) ?? [];
  return filledQuizOptionSlots(raw);
}

export function createEmptyDailyQuestion(index: number): WeeklyQuizQuestionInput {
  return {
    id: `q-${index + 1}`,
    question: { tr: "", en: "", ru: "", uz: "" },
    options: { tr: emptyQuizOptionSlots(), en: emptyQuizOptionSlots(), ru: emptyQuizOptionSlots(), uz: emptyQuizOptionSlots() },
    answerIndex: randomAnswerIndex(),
    seconds: DEFAULT_DAILY_QUIZ_SECONDS,
    pointsPerSecond: 0
  };
}

export function createEmptyDailyPack(weekId: string): WeeklyQuizPackInput {
  const periodId = extractWeekPeriodId(weekId);
  return {
    id: buildDailyQuizDocumentId(periodId),
    weekId: periodId,
    title: {
      tr: `${periodId} günlük pratik`,
      en: `Daily practice ${periodId}`,
      ru: `Ежедневная практика ${periodId}`,
      uz: `${periodId} kunlik mashq`
    },
    questions: Array.from({ length: DEFAULT_DAILY_QUIZ_QUESTION_COUNT }, (_, index) => createEmptyDailyQuestion(index)),
    status: "draft"
  };
}

export function clampDailyQuestionCount(count: number) {
  return Math.min(MAX_DAILY_QUIZ_QUESTIONS, Math.max(MIN_DAILY_QUIZ_QUESTIONS, Math.floor(count)));
}

export function isDailyQuizPackReady(pack: WeeklyQuizPackInput) {
  if (pack.questions.length < MIN_DAILY_QUIZ_QUESTIONS || pack.questions.length > MAX_DAILY_QUIZ_QUESTIONS) return false;
  return pack.questions.every((question) => (
    question.question.tr?.trim() && quizQuestionOptionsReady(question.options.tr, question.answerIndex)
  ));
}

export function createEmptyWeeklyQuestion(index: number): WeeklyQuizQuestionInput {
  return {
    id: `q-${index + 1}`,
    question: { tr: "", en: "", ru: "", uz: "" },
    options: { tr: emptyQuizOptionSlots(), en: emptyQuizOptionSlots(), ru: emptyQuizOptionSlots(), uz: emptyQuizOptionSlots() },
    answerIndex: randomAnswerIndex(),
    seconds: DEFAULT_WEEKLY_QUIZ_SECONDS,
    pointsPerSecond: DEFAULT_WEEKLY_QUIZ_POINTS_PER_SECOND
  };
}

export function createEmptyWeeklyPack(weekId: string): WeeklyQuizPackInput {
  const periodId = extractWeekPeriodId(weekId);
  return {
    id: buildWeeklyQuizDocumentId(periodId),
    weekId: periodId,
    title: {
      tr: `${periodId} haftalık quiz`,
      en: `Weekly quiz ${periodId}`,
      ru: `Недельный квиз ${periodId}`,
      uz: `${periodId} haftalik quiz`
    },
    questions: Array.from({ length: DEFAULT_WEEKLY_QUIZ_QUESTION_COUNT }, (_, index) => createEmptyWeeklyQuestion(index)),
    status: "draft"
  };
}

export function shiftWeekDateId(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  const nextYear = next.getUTCFullYear();
  const nextMonth = String(next.getUTCMonth() + 1).padStart(2, "0");
  const nextDay = String(next.getUTCDate()).padStart(2, "0");
  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function weekEndFromStartDate(startDateStr: string) {
  return shiftWeekDateId(extractWeekPeriodId(startDateStr), 6);
}

export function weekStartFromEndDate(weekId: string) {
  return shiftWeekDateId(extractWeekPeriodId(weekId), -6);
}

export function weekStartInDays(days: number, reference = new Date()) {
  return shiftWeekDateId(istanbulCalendarDate(reference), days);
}

export function nextMondayWeekStart(reference = new Date()) {
  const weekday = getWeekdayInIstanbul(reference);
  const daysToNextMonday = weekday === 0 ? 7 : 7 - weekday;
  return shiftWeekDateId(istanbulCalendarDate(reference), daysToNextMonday);
}

export function buildQuizWeekOptions(count = 16, reference = new Date()) {
  const seen = new Set<string>();
  const options: { weekId: string; label: string }[] = [];
  for (let offset = 0; offset < count; offset += 1) {
    const date = new Date(reference);
    date.setDate(date.getDate() + offset * 7);
    const weekId = getCompetitionWeekId(date);
    if (seen.has(weekId)) continue;
    seen.add(weekId);
    options.push({ weekId, label: weekId });
  }
  return options;
}

export function buildAvailableWeekOptions(input?: {
  reservedWeekIds?: string[];
  count?: number;
  reference?: Date;
  includeWeekId?: string;
}) {
  const reserved = new Set((input?.reservedWeekIds ?? []).map((weekId) => extractWeekPeriodId(weekId)));
  const includeWeekId = input?.includeWeekId ? extractWeekPeriodId(input.includeWeekId) : "";
  return buildQuizWeekOptions(input?.count ?? 16, input?.reference).filter((option) => {
    if (option.weekId === includeWeekId) return true;
    return !reserved.has(option.weekId);
  });
}

export function clampWeeklyQuestionCount(count: number) {
  return Math.min(MAX_WEEKLY_QUIZ_QUESTIONS, Math.max(MIN_WEEKLY_QUIZ_QUESTIONS, Math.floor(count)));
}

export function normalizeQuizLocalizedText(value: unknown, fallback = ""): QuizLocalizedText {
  const record = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const pick = (key: QuizAppLanguage) => (typeof record[key] === "string" ? record[key].trim() : "") || fallback;
  const tr = pick("tr") || fallback;
  return {
    tr,
    en: pick("en") || tr,
    ru: pick("ru") || tr,
    uz: pick("uz") || tr
  };
}

export function normalizeQuizOptions(value: unknown): Partial<Record<QuizAppLanguage, string[]>> {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const languages: QuizAppLanguage[] = ["tr", "en", "ru", "uz"];
  return languages.reduce<Partial<Record<QuizAppLanguage, string[]>>>((acc, language) => {
    const raw = record[language];
    if (!Array.isArray(raw)) return acc;
    const options = normalizeQuizOptionSlots(raw.map((item) => (typeof item === "string" ? item : "")));
    if (options.some((item) => item.length > 0)) acc[language] = options;
    return acc;
  }, {});
}

export function normalizeWeeklyQuizQuestions(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const record = item && typeof item === "object" ? item as Record<string, unknown> : {};
    const options = normalizeQuizOptions(record.options);
    const answerIndex = typeof record.answerIndex === "number" ? record.answerIndex : 0;
    return {
      id: typeof record.id === "string" && record.id.trim() ? record.id.trim() : `q-${index + 1}`,
      question: normalizeQuizLocalizedText(record.question),
      options,
      answerIndex,
      image: typeof record.imageURL === "string" ? record.imageURL : typeof record.image === "string" ? record.image : "",
      seconds: typeof record.seconds === "number" && record.seconds > 0 ? record.seconds : DEFAULT_QUIZ_SECONDS,
      pointsPerSecond: typeof record.pointsPerSecond === "number" && record.pointsPerSecond > 0 ? record.pointsPerSecond : DEFAULT_QUIZ_POINTS_PER_SECOND
    } satisfies WeeklyQuizQuestionInput;
  });
}

export function isWeeklyQuizPackReady(pack: WeeklyQuizPackInput) {
  if (pack.questions.length < MIN_WEEKLY_QUIZ_QUESTIONS || pack.questions.length > MAX_WEEKLY_QUIZ_QUESTIONS) return false;
  return pack.questions.every((question) => (
    question.question.tr?.trim() && quizQuestionOptionsReady(question.options.tr, question.answerIndex)
  ));
}

export function scoreCorrectAnswer(secondsLeft: number, pointsPerSecond: number) {
  return Math.max(0, Math.min(secondsLeft, DEFAULT_WEEKLY_QUIZ_SCORE_WINDOW_SECONDS)) * pointsPerSecond;
}
