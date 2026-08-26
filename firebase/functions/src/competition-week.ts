export const COMPETITION_SETTINGS_DOC = "appSettings/competition";
export const COMPETITION_ARCHIVES_COLLECTION = "competitionArchives";
export const COMPETITION_WEEKS_COLLECTION = "competitionWeeks";
export const COMPETITION_TIME_ZONE = "Europe/Istanbul";
export const TOP_WINNERS_COUNT = 10;
export const DEFAULT_STANDARD_UPLOAD_LIMIT = 2;
export const DEFAULT_PREMIUM_UPLOAD_LIMIT = 2;

export type LocalizedString = {
  tr: string;
  en: string;
  ru: string;
  uz: string;
};

export type CompetitionSettings = {
  activeWeekId: string;
  startsAt: string;
  endsAt: string;
  status: "active" | "transitioning";
  autoEnabled: boolean;
  uploadQuotaGeneration: number;
  standardUploadLimit: number;
  premiumUploadLimit: number;
};

export type CompetitionWeekBounds = {
  weekId: string;
  startsAt: Date;
  endsAt: Date;
};

export type CompetitionImageRecord = {
  id: string;
  ownerId: string;
  ownerUsername: string;
  ownerDisplayName: string;
  title: string;
  story: string;
  imageURL: string;
  language: string;
  likeCount: number;
  dislikeCount: number;
  superLikeCount?: number;
  netScore: number;
  weekId: string;
  quotaGeneration?: number;
};

export type CompetitionArchiveWinner = {
  id: string;
  ownerId?: string;
  artistName: string;
  winnerName?: string;
  username: string;
  image: string;
  story: string;
  title: string;
  likes: number;
  dislikes: number;
  superLikes?: number;
  score: number;
  rank: number;
  status?: "active" | "removed" | "hidden";
  removedAt?: string;
  removedBy?: string;
};

export type FinishCompetitionWeekResult = {
  ok: boolean;
  messages: string[];
  archivedWeekId?: string;
  archiveId?: string;
  nextWeekId?: string;
  winnerCount?: number;
};

function weekdayIndex(weekday: string) {
  const map: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  return map[weekday.slice(0, 3)] ?? 0;
}

export function istanbulCalendarDate(reference = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: COMPETITION_TIME_ZONE }).format(reference);
}

function addDaysToDateString(dateStr: string, days: number) {
  const [year, month, day] = dateStr.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + days));
  return formatDateId(next);
}

export function formatDateId(value: Date) {
  const year = value.getUTCFullYear();
  const month = String(value.getUTCMonth() + 1).padStart(2, "0");
  const day = String(value.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getWeekdayInIstanbul(reference = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: COMPETITION_TIME_ZONE, weekday: "short" }).format(reference);
  return weekdayIndex(weekday);
}

export function parseIstanbulStart(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, -3, 0, 0, 0));
}

export function parseIstanbulEnd(dateStr: string) {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 20, 59, 59, 999));
}

export function getCompetitionWeekBounds(reference = new Date()): CompetitionWeekBounds {
  const today = istanbulCalendarDate(reference);
  const weekday = getWeekdayInIstanbul(reference);
  const weekStart = addDaysToDateString(today, -weekday);
  const weekEnd = addDaysToDateString(today, 6 - weekday);
  return {
    weekId: weekEnd,
    startsAt: parseIstanbulStart(weekStart),
    endsAt: parseIstanbulEnd(weekEnd)
  };
}

export function getCompetitionWeekId(reference = new Date()) {
  return getCompetitionWeekBounds(reference).weekId;
}

/** Unique id per competition run. Same calendar week can have many sessions. */
export function createCompetitionSessionId(periodId: string, reference = new Date()) {
  return `${periodId}~${reference.getTime()}`;
}

export function extractWeekPeriodId(sessionOrPeriodId: string) {
  if (!sessionOrPeriodId) return getCompetitionWeekId();
  const periodPart = sessionOrPeriodId.split("~")[0] ?? sessionOrPeriodId;
  if (/^\d{4}-\d{2}-\d{2}$/.test(periodPart)) return periodPart;
  return sessionOrPeriodId;
}

export function formatArchiveWeekLabel(periodId: string, finishedAt = new Date()) {
  const datePart = formatWeekLabel(periodId);
  const timePart = new Intl.DateTimeFormat("tr-TR", {
    timeZone: COMPETITION_TIME_ZONE,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(finishedAt);
  return `${datePart} · ${timePart}`;
}

export function parseArchiveWeekNumber(data: Record<string, unknown> | undefined) {
  const value = data?.weekNumber;
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  return null;
}

export function formatArchiveSeasonWeekLabel(weekNumber: number): LocalizedString {
  const safe = Math.max(1, Math.floor(weekNumber));
  return {
    tr: `${safe}. Hafta`,
    en: `Week ${safe}`,
    ru: `${safe}-я неделя`,
    uz: `${safe}-hafta`
  };
}

export type ArchiveChronologyItem = {
  id: string;
  archivedAtMs: number;
};

/** Oldest archive = 1. Hafta; numbers stay contiguous when a week is removed. */
export function buildContiguousArchiveWeekNumbers<T extends ArchiveChronologyItem>(items: T[]) {
  const ordered = [...items].sort(
    (a, b) => a.archivedAtMs - b.archivedAtMs || a.id.localeCompare(b.id)
  );
  return ordered.map((item, index) => {
    const weekNumber = index + 1;
    return {
      ...item,
      weekNumber,
      seasonWeekLabel: formatArchiveSeasonWeekLabel(weekNumber)
    };
  });
}

export function sortArchivesNewestFirst<T extends { weekNumber: number; archivedAtMs: number; id: string }>(items: T[]) {
  return [...items].sort(
    (a, b) => b.weekNumber - a.weekNumber || b.archivedAtMs - a.archivedAtMs || b.id.localeCompare(a.id)
  );
}

export function resolveArchiveWeekNumber(
  data: Record<string, unknown> | undefined,
  fallbackOrder: number
) {
  return parseArchiveWeekNumber(data) ?? Math.max(1, fallbackOrder);
}

export function defaultCompetitionSettings(reference = new Date()): CompetitionSettings {
  const bounds = getCompetitionWeekBounds(reference);
  return {
    activeWeekId: createCompetitionSessionId(bounds.weekId, reference),
    startsAt: bounds.startsAt.toISOString(),
    endsAt: bounds.endsAt.toISOString(),
    status: "active",
    autoEnabled: true,
    uploadQuotaGeneration: 0,
    standardUploadLimit: DEFAULT_STANDARD_UPLOAD_LIMIT,
    premiumUploadLimit: DEFAULT_PREMIUM_UPLOAD_LIMIT
  };
}

export function normalizeCompetitionSettings(raw: Partial<CompetitionSettings> | undefined, reference = new Date()): CompetitionSettings {
  const fallback = defaultCompetitionSettings(reference);
  return {
    activeWeekId: typeof raw?.activeWeekId === "string" && raw.activeWeekId.trim() ? raw.activeWeekId.trim() : fallback.activeWeekId,
    startsAt: typeof raw?.startsAt === "string" && raw.startsAt.trim() ? raw.startsAt : fallback.startsAt,
    endsAt: typeof raw?.endsAt === "string" && raw.endsAt.trim() ? raw.endsAt : fallback.endsAt,
    status: raw?.status === "transitioning" ? "transitioning" : "active",
    autoEnabled: raw?.autoEnabled !== false,
    uploadQuotaGeneration: typeof raw?.uploadQuotaGeneration === "number" && Number.isFinite(raw.uploadQuotaGeneration) ? raw.uploadQuotaGeneration : 0,
    standardUploadLimit: typeof raw?.standardUploadLimit === "number" && raw.standardUploadLimit > 0 ? raw.standardUploadLimit : DEFAULT_STANDARD_UPLOAD_LIMIT,
    premiumUploadLimit: typeof raw?.premiumUploadLimit === "number" && raw.premiumUploadLimit > 0 ? raw.premiumUploadLimit : DEFAULT_PREMIUM_UPLOAD_LIMIT
  };
}

export function formatWeekTitle(endDateStr: string): LocalizedString {
  const [year, month, day] = endDateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const tr = new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  const en = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  const ru = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  const uz = new Intl.DateTimeFormat("uz-UZ", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
  return {
    tr: `${tr} haftası`,
    en: `Week ending ${en}`,
    ru: `Неделя до ${ru}`,
    uz: `${uz} haftasi`
  };
}

export function formatWeekLabel(endDateStr: string) {
  const [year, month, day] = endDateStr.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return new Intl.DateTimeFormat("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" }).format(date);
}

export function shouldAutoFinishWeek(settings: CompetitionSettings, reference = new Date()) {
  if (!settings.autoEnabled || settings.status !== "active") return false;
  const endsAt = new Date(settings.endsAt);
  return !Number.isNaN(endsAt.getTime()) && reference.getTime() >= endsAt.getTime();
}

export function getCompetitionVoteScore(likes: number, dislikes: number, superLikes = 0) {
  return likes + superLikes - dislikes;
}

export function buildArchiveWinners(entries: CompetitionImageRecord[]): CompetitionArchiveWinner[] {
  return [...entries]
    .sort((a, b) => {
      const aScore = getCompetitionVoteScore(a.likeCount, a.dislikeCount, a.superLikeCount ?? 0);
      const bScore = getCompetitionVoteScore(b.likeCount, b.dislikeCount, b.superLikeCount ?? 0);
      const scoreDelta = bScore - aScore;
      if (scoreDelta !== 0) return scoreDelta;
      return (b.likeCount + (b.superLikeCount ?? 0)) - (a.likeCount + (a.superLikeCount ?? 0));
    })
    .slice(0, TOP_WINNERS_COUNT)
    .map((entry, index) => ({
      id: entry.id,
      ownerId: entry.ownerId,
      artistName: entry.ownerDisplayName,
      winnerName: entry.ownerDisplayName,
      username: entry.ownerUsername,
      image: entry.imageURL,
      story: entry.story,
      title: entry.title,
      likes: entry.likeCount,
      dislikes: entry.dislikeCount,
      superLikes: entry.superLikeCount ?? 0,
      score: getCompetitionVoteScore(entry.likeCount, entry.dislikeCount, entry.superLikeCount ?? 0),
      rank: index + 1,
      status: "active" as const
    }));
}

export function normalizeArchiveWinners(raw: unknown): CompetitionArchiveWinner[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item, index) => {
    const record = item as Record<string, unknown>;
    const likes = typeof record.likes === "number" ? record.likes : Number(record.likes) || 0;
    const dislikes = typeof record.dislikes === "number" ? record.dislikes : Number(record.dislikes) || 0;
    const superLikes = typeof record.superLikes === "number" ? record.superLikes : Number(record.superLikes ?? record.superLikeCount) || 0;
    const computedScore = getCompetitionVoteScore(likes, dislikes, superLikes);
    const score = typeof record.score === "number" && !superLikes ? record.score : computedScore;
    const status = record.status === "removed" || record.status === "hidden" ? record.status : "active";
    return {
      id: typeof record.id === "string" ? record.id : `winner-${index}`,
      ownerId: typeof record.ownerId === "string" ? record.ownerId : "",
      artistName: typeof record.artistName === "string" ? record.artistName : typeof record.winnerName === "string" ? record.winnerName : "",
      winnerName: typeof record.winnerName === "string" ? record.winnerName : typeof record.artistName === "string" ? record.artistName : "",
      username: typeof record.username === "string" ? record.username : "",
      image: typeof record.image === "string" ? record.image : typeof record.imageURL === "string" ? record.imageURL : "",
      story: typeof record.story === "string" ? record.story : "",
      title: typeof record.title === "string" ? record.title : "",
      likes,
      dislikes,
      superLikes,
      score,
      rank: typeof record.rank === "number" ? record.rank : index + 1,
      status,
      removedAt: typeof record.removedAt === "string" ? record.removedAt : undefined,
      removedBy: typeof record.removedBy === "string" ? record.removedBy : undefined
    };
  });
}

export function getVisibleArchiveWinners(winners: CompetitionArchiveWinner[]) {
  return winners
    .filter((winner) => winner.status !== "removed" && winner.status !== "hidden")
    .sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999) || (b.score ?? 0) - (a.score ?? 0));
}

export function reindexArchiveWinners(winners: CompetitionArchiveWinner[]) {
  const visible = getVisibleArchiveWinners(winners);
  const rankMap = new Map(visible.map((winner, index) => [winner.id, index + 1]));
  return winners.map((winner) => {
    if (winner.status === "removed" || winner.status === "hidden") {
      return { ...winner, rank: winner.rank ?? 0 };
    }
    return { ...winner, rank: rankMap.get(winner.id) ?? winner.rank ?? 0 };
  });
}

export function buildArchiveSummaryFromWinners(periodId: string, winners: CompetitionArchiveWinner[]) {
  const leader = getVisibleArchiveWinners(reindexArchiveWinners(winners))[0];
  return {
    weekId: periodId,
    weekLabel: formatWeekLabel(periodId),
    title: formatWeekTitle(periodId),
    winnerId: leader?.id || "",
    winnerName: leader?.artistName || leader?.winnerName || "",
    winnerUsername: leader?.username || "",
    score: leader?.score ?? 0,
    image: leader?.image || ""
  };
}

export function buildCompetitionArchivePayload(
  sessionId: string,
  winners: CompetitionArchiveWinner[],
  options?: { finishedAt?: Date; weekNumber?: number }
) {
  const periodId = extractWeekPeriodId(sessionId);
  const finishedAt = options?.finishedAt ?? new Date();
  const visible = getVisibleArchiveWinners(winners);
  const winner = visible[0] ?? winners[0];
  const title = formatWeekTitle(periodId);
  const weekLabel = formatArchiveWeekLabel(periodId, finishedAt);
  const weekNumber = typeof options?.weekNumber === "number" && options.weekNumber > 0 ? Math.floor(options.weekNumber) : undefined;
  return {
    competition: "weekly_artworks",
    sessionId,
    weekId: periodId,
    weekLabel,
    weekNumber,
    seasonWeekLabel: weekNumber ? formatArchiveSeasonWeekLabel(weekNumber) : undefined,
    title,
    winnerId: winner?.id || "",
    winnerName: winner?.artistName || winner?.winnerName || "",
    winnerUsername: winner?.username || "",
    score: winner?.score ?? 0,
    image: winner?.image || "",
    winners,
    status: "published"
  };
}

export function mapCompetitionImageRecord(id: string, data: Record<string, unknown>): CompetitionImageRecord {
  const likeCount = typeof data.likeCount === "number" ? data.likeCount : Number(data.likeCount) || 0;
  const dislikeCount = typeof data.dislikeCount === "number" ? data.dislikeCount : Number(data.dislikeCount) || 0;
  const superLikeCount = typeof data.superLikeCount === "number" ? data.superLikeCount : Number(data.superLikeCount ?? data.superLikes) || 0;
  const computedScore = getCompetitionVoteScore(likeCount, dislikeCount, superLikeCount);
  const netScore = typeof data.netScore === "number" && !superLikeCount ? data.netScore : computedScore;
  return {
    id,
    ownerId: typeof data.ownerId === "string" ? data.ownerId : "",
    ownerUsername: typeof data.ownerUsername === "string" ? data.ownerUsername : "",
    ownerDisplayName: typeof data.ownerDisplayName === "string" ? data.ownerDisplayName : "",
    title: typeof data.title === "string" ? data.title : "",
    story: typeof data.story === "string" ? data.story : "",
    imageURL: typeof data.imageURL === "string" ? data.imageURL : typeof data.image === "string" ? data.image : "",
    language: typeof data.language === "string" ? data.language : "tr",
    likeCount,
    dislikeCount,
    superLikeCount,
    netScore,
    weekId: typeof data.weekId === "string" ? data.weekId : "",
    quotaGeneration: typeof data.quotaGeneration === "number" ? data.quotaGeneration : 0
  };
}
