import { todayJigsawDayKey, type NormalizedJigsawAttempt } from "./jigsaw-attempts";

export type ChancePeriod = "today" | "week" | "month" | "threeMonth";
export type ProphecyPeriod = "month" | "threeMonth" | "all";
export type GamePeriod = "today" | "week" | "month" | "threeMonth";

export type NormalizedChanceDraw = {
  uid: string;
  username: string;
  displayName: string;
  score: number;
  drawnAtMs: number;
  dayKey: string;
  countryCode?: string;
};

export type LuckyScoreTotals = {
  id: string;
  username: string;
  displayName: string;
  today: number;
  week: number;
  month: number;
  total: number;
};

export type LuckLeaderboardRow = {
  id: string;
  username: string;
  name: string;
  meta: string;
  score: number;
  countryCode?: string;
};

export type ProphecyScoreInput = {
  id?: string;
  username: string;
  displayName: string;
  points: number;
  monthPoints: number;
  threeMonthPoints: number;
};

export type ProphecyLeaderboardRow = {
  name: string;
  meta: string;
  score: number;
};

export type ChanceRankingOverride = {
  rankingStatus?: "active" | "hidden" | "removed";
  displayName?: string;
  username?: string;
  scoreAdjust?: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;
const MONTH_MS = 30 * DAY_MS;
const THREE_MONTH_DAYS = 90;
const THREE_MONTH_MS = THREE_MONTH_DAYS * DAY_MS;

export type JigsawLeaderboardRow = {
  id: string;
  username: string;
  name: string;
  meta: string;
  score: number;
  countryCode?: string;
};

export function firestoreTimestampMillis(value: unknown) {
  if (!value) return 0;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    if (typeof record.toDate === "function") {
      return (record.toDate() as Date).getTime();
    }
    if (typeof record.toMillis === "function") {
      return record.toMillis() as number;
    }
    if (typeof record.seconds === "number") {
      const nanos = typeof record.nanoseconds === "number" ? record.nanoseconds : 0;
      return record.seconds * 1000 + Math.floor(nanos / 1_000_000);
    }
  }
  return 0;
}

export function getLocalDayKey(value: number | string | Date = Date.now()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function nextLocalMidnight(reference = new Date()) {
  const next = new Date(reference);
  next.setHours(24, 0, 0, 0);
  return next;
}

export function millisecondsUntilLocalMidnight(reference = new Date()) {
  return Math.max(0, nextLocalMidnight(reference).getTime() - reference.getTime());
}

export function countUserTodayChanceDraws(
  draws: { uid?: string; username: string; dayKey?: string; drawnAt?: string }[],
  account: { uid?: string | null; username: string }
) {
  const todayKey = getLocalDayKey();
  return draws.filter((draw) => {
    const ownsDraw = account.uid && draw.uid ? draw.uid === account.uid : draw.username === account.username;
    if (!ownsDraw) return false;
    const drawDayKey = draw.dayKey || (draw.drawnAt ? getLocalDayKey(draw.drawnAt) : "");
    return drawDayKey === todayKey;
  }).length;
}

function stringField(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberField(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeChanceDrawFromFirebase(raw: Record<string, unknown>, fallbackId = "") {
  if (raw.leaderboardEligible === false) return null;
  const drawnAtMs = firestoreTimestampMillis(raw.drawnAt ?? raw.createdAt);
  if (!drawnAtMs) return null;
  const uid = stringField(raw.uid, stringField(raw.username, fallbackId));
  const username = stringField(raw.username, uid);
  const displayName = stringField(raw.displayName, username);
  const score = numberField(raw.value ?? raw.score);
  const dayKey = stringField(raw.dayKey, getLocalDayKey(drawnAtMs));
  const countryCode = stringField(raw.countryCode) || undefined;
  return { uid, username, displayName, score, drawnAtMs, dayKey, countryCode } satisfies NormalizedChanceDraw;
}

export function normalizeChanceDrawFromApp(draw: {
  uid?: string;
  username: string;
  displayName: string;
  score: number;
  drawnAt: string;
  dayKey?: string;
  countryCode?: string;
  leaderboardEligible?: boolean;
}) {
  if (draw.leaderboardEligible === false) return null;
  const drawnAtMs = Date.parse(draw.drawnAt);
  if (Number.isNaN(drawnAtMs)) return null;
  const uid = stringField(draw.uid, draw.username);
  return {
    uid,
    username: draw.username,
    displayName: draw.displayName,
    score: draw.score,
    drawnAtMs,
    dayKey: draw.dayKey || getLocalDayKey(drawnAtMs),
    countryCode: draw.countryCode
  } satisfies NormalizedChanceDraw;
}

export function buildLuckyScoreTotals(draws: NormalizedChanceDraw[], nowMs = Date.now()) {
  const todayKey = getLocalDayKey(nowMs);
  const dailyBest = new Map<string, NormalizedChanceDraw>();

  draws.forEach((draw) => {
    const key = `${draw.username}-${draw.dayKey}`;
    const current = dailyBest.get(key);
    if (!current || draw.score > current.score) {
      dailyBest.set(key, draw);
    }
  });

  const totals = new Map<string, LuckyScoreTotals>();
  dailyBest.forEach((draw) => {
    const current = totals.get(draw.uid) ?? {
      id: draw.uid,
      username: draw.username,
      displayName: draw.displayName,
      today: 0,
      week: 0,
      month: 0,
      total: 0
    };
    const age = nowMs - draw.drawnAtMs;
    totals.set(draw.uid, {
      ...current,
      username: draw.username,
      displayName: draw.displayName,
      today: draw.dayKey === todayKey ? Math.max(current.today, draw.score) : current.today,
      week: age <= WEEK_MS ? current.week + draw.score : current.week,
      month: age <= MONTH_MS ? current.month + draw.score : current.month,
      total: current.total + draw.score
    });
  });

  return [...totals.values()].sort((a, b) => b.today - a.today || b.week - a.week || b.total - a.total);
}

function resolveChanceOverride(
  draw: NormalizedChanceDraw,
  overrideByKey: Map<string, ChanceRankingOverride>
) {
  return overrideByKey.get(draw.uid) ?? overrideByKey.get(draw.username);
}

function chancePeriodDayKeys(period: ChancePeriod, nowMs: number) {
  if (period === "today") return [getLocalDayKey(nowMs)];
  const dayCount = period === "week" ? 7 : period === "month" ? 30 : THREE_MONTH_DAYS;
  const keys: string[] = [];
  for (let offset = dayCount - 1; offset >= 0; offset -= 1) {
    const date = new Date(nowMs);
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() - offset);
    keys.push(getLocalDayKey(date.getTime()));
  }
  return keys;
}

function chancePeriodRange(period: ChancePeriod) {
  if (period === "week") return WEEK_MS;
  if (period === "month") return MONTH_MS;
  if (period === "threeMonth") return THREE_MONTH_MS;
  return DAY_MS;
}

export function buildLuckLeaderboardRows(
  draws: NormalizedChanceDraw[],
  period: ChancePeriod,
  options: {
    nowMs?: number;
    hiddenKeys?: Set<string>;
    overrideByKey?: Map<string, ChanceRankingOverride>;
    maxRows?: number;
  } = {}
) {
  const nowMs = options.nowMs ?? Date.now();
  const hiddenKeys = options.hiddenKeys ?? new Set<string>();
  const overrideByKey = options.overrideByKey ?? new Map<string, ChanceRankingOverride>();
  const periodDayKeys = chancePeriodDayKeys(period, nowMs);
  const periodStartMs = nowMs - chancePeriodRange(period);
  const dailyBest = new Map<string, number>();

  draws
    .filter((draw) => !hiddenKeys.has(draw.username) && !hiddenKeys.has(draw.uid))
    .filter((draw) => {
      const override = resolveChanceOverride(draw, overrideByKey);
      if (override?.rankingStatus && override.rankingStatus !== "active") return false;
      if (period === "today") return draw.dayKey === periodDayKeys[0];
      return draw.drawnAtMs >= periodStartMs;
    })
    .forEach((draw) => {
      const key = `${draw.username}:${draw.dayKey}`;
      const current = dailyBest.get(key) ?? 0;
      if (draw.score > current) dailyBest.set(key, draw.score);
    });

  const usernames = new Set<string>();
  draws
    .filter((draw) => !hiddenKeys.has(draw.username) && !hiddenKeys.has(draw.uid))
    .filter((draw) => {
      const override = resolveChanceOverride(draw, overrideByKey);
      if (override?.rankingStatus && override.rankingStatus !== "active") return false;
      if (period === "today") return draw.dayKey === periodDayKeys[0];
      return draw.drawnAtMs >= periodStartMs;
    })
    .forEach((draw) => usernames.add(draw.username));

  const totals = new Map<string, LuckLeaderboardRow>();
  usernames.forEach((username) => {
    const sampleDraw = draws.find((draw) => draw.username === username);
    if (!sampleDraw) return;
    const override = resolveChanceOverride(sampleDraw, overrideByKey);
    const adjust = override?.scoreAdjust ?? 0;
    const displayName = override?.displayName || sampleDraw.displayName;
    const resolvedUsername = override?.username || username;
    const dayScores = periodDayKeys.map((dayKey) => dailyBest.get(`${username}:${dayKey}`) ?? 0);
    const averageScore = Math.round(dayScores.reduce((sum, value) => sum + value, 0) / periodDayKeys.length);
    totals.set(resolvedUsername, {
      id: sampleDraw.uid,
      username: resolvedUsername,
      name: displayName,
      meta: `@${resolvedUsername} · Şans Kartı`,
      score: averageScore + adjust,
      countryCode: sampleDraw.countryCode
    });
  });

  const maxRows = options.maxRows ?? 200;
  return [...totals.values()].sort((a, b) => b.score - a.score).slice(0, maxRows);
}

export function buildProphecyLeaderboardRows(scores: ProphecyScoreInput[], period: ProphecyPeriod, maxRows = 200) {
  return scores
    .map((item) => ({
      name: item.displayName,
      meta: `@${item.username} · Kahin puanı`,
      score: period === "month" ? item.monthPoints : period === "threeMonth" ? item.threeMonthPoints : item.points
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxRows);
}

export function luckyPeriodScore(totals: Pick<LuckyScoreTotals, "today" | "week" | "month" | "total">, period: ChancePeriod) {
  if (period === "today") return totals.today;
  if (period === "week") return totals.week;
  if (period === "month") return totals.month;
  return totals.total;
}

export function luckRankingAverageNote(period: ChancePeriod, language: "tr" | "en" | "ru" | "uz" = "tr") {
  const dayCount = period === "today" ? 1 : period === "week" ? 7 : period === "month" ? 30 : THREE_MONTH_DAYS;
  if (language === "tr") {
    return `Sıralama, seçilen ${dayCount} günlük dönemde katılmadığınız günler 0 sayılarak hesaplanan günlük ortalama puana göre yapılır.`;
  }
  if (language === "ru") {
    return `Рейтинг строится по среднему дневному баллу за ${dayCount} дней; пропущенные дни считаются как 0.`;
  }
  if (language === "uz") {
    return `Reyting tanlangan ${dayCount} kun davomida qatnashilmagan kunlar 0 deb hisoblanadigan kunlik o'rtacha ball bo'yicha tuziladi.`;
  }
  return `Rankings use the daily average over ${dayCount} days; missed days count as 0.`;
}

export function buildHiddenChanceKeys(overrides: { id: string; chance?: ChanceRankingOverride }[]) {
  return new Set(
    overrides
      .filter((item) => item.chance?.rankingStatus && item.chance.rankingStatus !== "active")
      .flatMap((item) => [item.chance?.username, item.id].filter(Boolean) as string[])
  );
}

export function buildChanceOverrideMap(overrides: { id: string; chance?: ChanceRankingOverride }[]) {
  const map = new Map<string, ChanceRankingOverride>();
  overrides.forEach((item) => {
    if (!item.chance) return;
    map.set(item.id, item.chance);
    if (item.chance.username) map.set(item.chance.username, item.chance);
  });
  return map;
}

function gamePeriodRange(period: GamePeriod) {
  if (period === "week") return WEEK_MS;
  if (period === "month") return MONTH_MS;
  if (period === "threeMonth") return THREE_MONTH_MS;
  return Number.POSITIVE_INFINITY;
}

export function buildJigsawLeaderboardRows(
  attempts: NormalizedJigsawAttempt[],
  period: GamePeriod,
  options: { nowMs?: number; maxRows?: number; hiddenKeys?: Set<string> } = {}
) {
  const nowMs = options.nowMs ?? Date.now();
  const todayKey = todayJigsawDayKey(new Date(nowMs));
  const range = gamePeriodRange(period);
  const totals = new Map<string, JigsawLeaderboardRow>();

  attempts
    .filter((attempt) => !options.hiddenKeys?.has(attempt.uid) && !options.hiddenKeys?.has(attempt.username))
    .filter((attempt) => {
      if (period === "today") return attempt.dayKey === todayKey;
      return nowMs - attempt.completedAtMs <= range;
    })
    .forEach((attempt) => {
      const current = totals.get(attempt.username) ?? {
        id: attempt.uid,
        username: attempt.username,
        name: attempt.displayName,
        meta: `@${attempt.username} · Sanat Dedektifi`,
        score: 0,
        countryCode: attempt.countryCode
      };
      totals.set(attempt.username, {
        ...current,
        id: attempt.uid,
        username: attempt.username,
        name: attempt.displayName,
        meta: `@${attempt.username} · Sanat Dedektifi`,
        score: current.score + attempt.score,
        countryCode: current.countryCode || attempt.countryCode
      });
    });

  const maxRows = options.maxRows ?? 200;
  return [...totals.values()].sort((a, b) => b.score - a.score).slice(0, maxRows);
}
