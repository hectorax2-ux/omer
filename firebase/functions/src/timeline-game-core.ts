export const TIMELINE_GAME_TYPES = ["artwork", "artist"] as const;
export const TIMELINE_DIRECTIONS = ["oldest-first", "newest-first"] as const;
export const TIMELINE_ITEM_COUNT = 10;
export const TIMELINE_FREE_DAILY_LIMIT = 2;
export const TIMELINE_PREMIUM_DAILY_LIMIT = 5;
export const TIMELINE_GAME_SECONDS = 90;
export const TIMELINE_TIME_PENALTY_CAP_SECONDS = 30;
export const TIMELINE_COMPLETION_NETWORK_GRACE_SECONDS = 120;
export const TIMELINE_MONTHLY_GENERAL_MIN_DAYS = 5;
export const TIMELINE_LEADERBOARD_PAGE_SIZE = 20;
export const TIMELINE_LEADERBOARD_MAX_ROWS = 100;

export type TimelineGameType = (typeof TIMELINE_GAME_TYPES)[number];
export type TimelineDirection = (typeof TIMELINE_DIRECTIONS)[number];

export type TimelineSortableItem = {
  id: string;
  year: number;
};

export type TimelineScore = {
  correctPositions: number;
  accuracyScore: number;
  timePenalty: number;
  normalScore: number;
  timedOut: boolean;
  finalScore: number;
};

export type TimelineCalendar = {
  timeZone: string;
  dayKey: string;
  monthKey: string;
  resetAtMs: number;
};

const SINGLE_YEAR_PATTERN = /^(?:(?:c|ca|circa)\.?\s*)?(-?\d{1,4})(?:\s*(?:ad|ce))?$/i;
const ISO_DATE_PATTERN = /^(-?\d{1,4})-(?:0?[1-9]|1[0-2])-(?:0?[1-9]|[12]\d|3[01])$/;
const LIFE_START_PATTERN = /^(?:(?:b|born)\.?\s*)?(?:(?:c|ca|circa)\.?\s*)?(-?\d{1,4})(?=\s*(?:[-–—/]|to\b|$))/i;

export function isTimelineGameType(value: unknown): value is TimelineGameType {
  return typeof value === "string" && TIMELINE_GAME_TYPES.some((type) => type === value);
}

export function isTimelineDirection(value: unknown): value is TimelineDirection {
  return typeof value === "string" && TIMELINE_DIRECTIONS.some((direction) => direction === value);
}

export function normalizeArtworkYear(value: unknown): number | null {
  if (typeof value === "number") return validYear(value);
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  const isoMatch = normalized.match(ISO_DATE_PATTERN);
  if (isoMatch) return validYear(Number(isoMatch[1]));
  const match = normalized.match(SINGLE_YEAR_PATTERN);
  return match ? validYear(Number(match[1])) : null;
}

export function normalizeArtistBirthYear(birthYear: unknown, lifeYears: unknown): number | null {
  const direct = normalizeArtworkYear(birthYear);
  if (direct !== null) return direct;
  if (typeof lifeYears !== "string") return null;
  const match = lifeYears.trim().match(LIFE_START_PATTERN);
  return match ? validYear(Number(match[1])) : null;
}

export function orderTimelineItems<T extends TimelineSortableItem>(items: T[], direction: TimelineDirection) {
  return [...items].sort((left, right) => {
    const yearDelta = direction === "oldest-first" ? left.year - right.year : right.year - left.year;
    return yearDelta || left.id.localeCompare(right.id);
  });
}

export function countExactTimelinePositions(expectedIds: string[], submittedIds: string[]) {
  return expectedIds.reduce((total, id, index) => total + Number(submittedIds[index] === id), 0);
}

export function scoreTimelineGame(correctPositions: number, elapsedSeconds: number): TimelineScore {
  const safeCorrect = Math.max(0, Math.min(TIMELINE_ITEM_COUNT, Math.floor(correctPositions)));
  const safeElapsed = Math.max(0, Math.floor(elapsedSeconds));
  const accuracyScore = safeCorrect * 100;
  const timePenalty = Math.min(safeElapsed, TIMELINE_TIME_PENALTY_CAP_SECONDS) * 10;
  const normalScore = Math.max(0, accuracyScore - timePenalty);
  const timedOut = safeElapsed >= TIMELINE_GAME_SECONDS;
  return {
    correctPositions: safeCorrect,
    accuracyScore,
    timePenalty,
    normalScore,
    timedOut,
    finalScore: timedOut ? Math.round(normalScore * 0.5) : normalScore
  };
}

export function resolveTimelineCompletionElapsed(reportedElapsedSeconds: number, serverElapsedSeconds: number) {
  const safeServerElapsed = Math.max(0, Math.floor(serverElapsedSeconds));
  if (!Number.isFinite(reportedElapsedSeconds)) return safeServerElapsed;
  const safeReportedElapsed = Math.max(0, Math.floor(reportedElapsedSeconds));
  if (safeReportedElapsed > safeServerElapsed) return safeServerElapsed;
  if (safeServerElapsed - safeReportedElapsed > TIMELINE_COMPLETION_NETWORK_GRACE_SECONDS) return safeServerElapsed;
  return safeReportedElapsed;
}

export function timelineDailyLimit(premium: boolean) {
  return premium ? TIMELINE_PREMIUM_DAILY_LIMIT : TIMELINE_FREE_DAILY_LIMIT;
}

export function remainingTimelineGames(used: number, premium: boolean) {
  return Math.max(0, timelineDailyLimit(premium) - Math.max(0, Math.floor(used)));
}

export function shuffleTimelineItems<T>(items: T[], random: () => number = Math.random) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex];
    shuffled[swapIndex] = current;
  }
  return shuffled;
}

export function resolveTimelineCalendar(now: Date, requestedTimeZone: string): TimelineCalendar {
  const timeZone = validTimeZone(requestedTimeZone) ? requestedTimeZone : "UTC";
  const parts = zonedParts(now, timeZone);
  const nextDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + 1));
  const resetAtMs = zonedDateTimeToUtc(
    nextDate.getUTCFullYear(),
    nextDate.getUTCMonth() + 1,
    nextDate.getUTCDate(),
    timeZone
  );
  const month = String(parts.month).padStart(2, "0");
  const day = String(parts.day).padStart(2, "0");
  return {
    timeZone,
    dayKey: `${parts.year}-${month}-${day}`,
    monthKey: `${parts.year}-${month}`,
    resetAtMs
  };
}

export function dailyPercentileScore(rank: number, participantCount: number) {
  if (participantCount <= 1) return 100;
  const safeRank = Math.max(1, Math.min(participantCount, Math.floor(rank)));
  return Number((((participantCount - safeRank) / participantCount) * 100).toFixed(4));
}

function validYear(value: number) {
  if (!Number.isInteger(value) || value < -5000 || value > 2500) return null;
  return value;
}

function validTimeZone(timeZone: string) {
  if (!timeZone || timeZone.length > 80) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function zonedParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second")
  };
}

function zonedDateTimeToUtc(year: number, month: number, day: number, timeZone: string) {
  const desiredUtc = Date.UTC(year, month - 1, day, 0, 0, 0);
  const firstParts = zonedParts(new Date(desiredUtc), timeZone);
  const firstAsUtc = Date.UTC(firstParts.year, firstParts.month - 1, firstParts.day, firstParts.hour, firstParts.minute, firstParts.second);
  const firstGuess = desiredUtc - (firstAsUtc - desiredUtc);
  const secondParts = zonedParts(new Date(firstGuess), timeZone);
  const secondAsUtc = Date.UTC(secondParts.year, secondParts.month - 1, secondParts.day, secondParts.hour, secondParts.minute, secondParts.second);
  return firstGuess - (secondAsUtc - desiredUtc);
}
