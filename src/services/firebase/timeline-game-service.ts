import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp, firebaseAuth } from "./core";
import type { Language, LocalizedText } from "@/types/content";
import type { TimelineDirection, TimelineGameType } from "@/firebase/shared/timeline-game";
import { startPerformanceSpan } from "@/utils/performance";
import { prefetchImageUrls } from "@/utils/image-prefetch";

export type TimelineGameStateEntry = {
  limit: number;
  used: number;
  remaining: number;
  dailyBest: number;
  unlimited: boolean;
};

export type TimelineGameState = {
  serverNowMs: number;
  resetAtMs: number;
  dayKey: string;
  monthKey: string;
  timeZone: string;
  premium: boolean;
  admin: boolean;
  games: Record<TimelineGameType, TimelineGameStateEntry>;
};

export type TimelineGameItem = {
  id: string;
  title: Partial<LocalizedText>;
  subtitle: Partial<LocalizedText>;
  image: string;
  kind: TimelineGameType;
};

export type PreparedTimelineGame = {
  sessionId: string;
  sequence: number;
  status: "prepared" | "active";
  gameType: TimelineGameType;
  direction: TimelineDirection;
  items: TimelineGameItem[];
  startedAtMs: number | null;
  expiresAtMs: number;
  serverNowMs: number;
};

export type ActivatedTimelineGame = {
  sessionId: string;
  status: "active";
  startedAtMs: number;
  expiresAtMs: number;
  serverNowMs: number;
  remaining?: number;
  limit?: number;
};

export type TimelineResultItem = TimelineGameItem & { year: number };

export type TimelineGameResult = {
  sessionId: string;
  gameType: TimelineGameType;
  direction: TimelineDirection;
  correctPositions: number;
  elapsedSeconds: number;
  score: number;
  normalScore: number;
  timedOut: boolean;
  dailyBest: number;
  newRecord: boolean;
  correctItems: TimelineResultItem[];
};

export type TimelineLeaderboardPeriod = "daily" | "monthly" | "general";

export type TimelineLeaderboardRow = {
  id: string;
  uid: string;
  username: string;
  displayName: string;
  photoURL: string;
  countryCode: string;
  score: number;
  elapsedSeconds: number | null;
  activeDays: number | null;
  rank: number;
  eligible?: boolean;
  requiredDays?: number;
};

export type TimelineLeaderboardCursor = {
  score: number;
  elapsedSeconds: number;
  activeDays: number;
  achievedAtMs: number;
  loaded: number;
};

export type TimelineLeaderboardPage = {
  rows: TimelineLeaderboardRow[];
  nextCursor: TimelineLeaderboardCursor | null;
  ownRank: TimelineLeaderboardRow | { eligible: false; activeDays: number; requiredDays: number } | null;
  periodKey: string;
  minimumDays: number;
};

export type TimelineHistoryRow = {
  id: string;
  score: number;
  correctPositions: number;
  elapsedSeconds: number;
  timedOut: boolean;
  direction: TimelineDirection;
  finishedAtMs: number;
};

const functions = getFunctions(firebaseApp, "us-central1");
const callableOptions = { timeout: 12_000 };
const timelineStateCache = new Map<string, TimelineGameState>();
const preparedQueueCache = new Map<string, PreparedTimelineGame[]>();
const preparedQueueRequests = new Map<string, Promise<PreparedTimelineGame[]>>();
const preparedQueueValidatedAt = new Map<string, number>();
const leaderboardCache = new Map<string, { savedAt: number; value: TimelineLeaderboardPage }>();
const historyCache = new Map<string, { savedAt: number; value: { rows: TimelineHistoryRow[]; nextCursorMs: number | null } }>();
const PREPARED_QUEUE_SIZE = 3;
const LEADERBOARD_CACHE_MS = 30_000;
const HISTORY_CACHE_MS = 60_000;

export function peekTimelineGameState() {
  const uid = firebaseAuth.currentUser?.uid;
  return uid ? timelineStateCache.get(uid) ?? null : null;
}

export async function fetchTimelineGameState() {
  const call = httpsCallable<{ timeZone: string }, TimelineGameState>(functions, "getTimelineGameState", callableOptions);
  const state = await runTimelineCall("getTimelineGameState", async () => (await call({ timeZone: localTimeZone() })).data);
  const uid = firebaseAuth.currentUser?.uid;
  if (uid) timelineStateCache.set(uid, state);
  return state;
}

export async function prepareTimelineGame(gameType: TimelineGameType, queueSlot = 0) {
  const call = httpsCallable<{ gameType: TimelineGameType; queueSlot: number; timeZone: string }, PreparedTimelineGame>(functions, "prepareTimelineGame", callableOptions);
  return runTimelineCall("prepareTimelineGame", async () => (await call({ gameType, queueSlot, timeZone: localTimeZone() })).data);
}

export function peekPreparedTimelineGame(gameType: TimelineGameType) {
  const key = preparedQueueKey(gameType);
  const existing = preparedQueueCache.get(key) ?? [];
  const valid = existing.filter((session) => session.expiresAtMs > Date.now());
  if (valid.length !== existing.length) {
    preparedQueueCache.set(key, valid);
    preparedQueueValidatedAt.delete(key);
  }
  return valid[0] ?? null;
}

export async function prepareTimelineGameQueue(gameType: TimelineGameType, targetSize = PREPARED_QUEUE_SIZE): Promise<PreparedTimelineGame[]> {
  const key = preparedQueueKey(gameType);
  const existing = preparedQueueCache.get(key) ?? [];
  const validExisting = existing.filter((session) => session.expiresAtMs > Date.now());
  if (validExisting.length !== existing.length) {
    preparedQueueCache.set(key, validExisting);
    preparedQueueValidatedAt.delete(key);
  }
  const queueSize = Math.max(1, Math.min(PREPARED_QUEUE_SIZE, targetSize));
  if (validExisting.length >= queueSize && preparedQueueValidatedAt.get(key) && Date.now() - (preparedQueueValidatedAt.get(key) ?? 0) < 2 * 60 * 1000) return validExisting;
  const pending = preparedQueueRequests.get(key);
  if (pending) return pending.then((sessions) => sessions.length >= queueSize ? sessions : prepareTimelineGameQueue(gameType, queueSize));
  const span = startPerformanceSpan(`timeline.queue.${gameType}`);
  const request = Promise.all(Array.from({ length: queueSize }, (_, queueSlot) => (
    prepareTimelineGame(gameType, queueSlot).catch((error: unknown) => {
      if (timelineErrorCode(error) === "functions/resource-exhausted") return null;
      throw error;
    })
  )))
    .then(async (sessions) => {
      const ordered = sessions
        .filter((session): session is PreparedTimelineGame => Boolean(session))
        .filter((session, index, items) => items.findIndex((item) => item.sessionId === session.sessionId) === index)
        .sort((a, b) => a.sequence - b.sequence);
      preparedQueueCache.set(key, ordered);
      preparedQueueValidatedAt.set(key, Date.now());
      void prefetchImageUrls(ordered[0]?.items.map((item) => item.image) ?? [], 2);
      span.end({ sessions: ordered.length, images: ordered[0]?.items.length ?? 0 });
      return ordered;
    })
    .catch((error) => {
      span.end({ failed: true });
      throw error;
    })
    .finally(() => preparedQueueRequests.delete(key));
  preparedQueueRequests.set(key, request);
  return request;
}

export function consumePreparedTimelineGame(gameType: TimelineGameType, sessionId: string) {
  const key = preparedQueueKey(gameType);
  preparedQueueCache.set(key, (preparedQueueCache.get(key) ?? []).filter((session) => session.sessionId !== sessionId));
  preparedQueueValidatedAt.delete(key);
}

export async function activateTimelineGame(sessionId: string) {
  const call = httpsCallable<{ sessionId: string; timeZone: string }, ActivatedTimelineGame>(functions, "activateTimelineGame", callableOptions);
  return runTimelineCall("activateTimelineGame", async () => (await call({ sessionId, timeZone: localTimeZone() })).data);
}

export async function completeTimelineGame(sessionId: string, orderedIds: string[], elapsedSeconds: number) {
  const call = httpsCallable<{ sessionId: string; orderedIds: string[]; elapsedSeconds: number }, TimelineGameResult>(functions, "completeTimelineGame", { timeout: 30_000 });
  const result = await runTimelineCall("completeTimelineGame", async () => (await call({ sessionId, orderedIds, elapsedSeconds })).data);
  clearTimelineResultCaches();
  return result;
}

export function peekTimelineLeaderboard(gameType: TimelineGameType, period: TimelineLeaderboardPeriod) {
  return leaderboardCache.get(timelineLeaderboardKey(gameType, period))?.value ?? null;
}

export async function fetchTimelineLeaderboard(gameType: TimelineGameType, period: TimelineLeaderboardPeriod, cursor?: TimelineLeaderboardCursor | null, force = false) {
  const key = timelineLeaderboardKey(gameType, period);
  const cached = leaderboardCache.get(key);
  if (!cursor && !force && cached && Date.now() - cached.savedAt < LEADERBOARD_CACHE_MS) return cached.value;
  const call = httpsCallable<{
    gameType: TimelineGameType;
    period: TimelineLeaderboardPeriod;
    cursor?: TimelineLeaderboardCursor | null;
    timeZone: string;
  }, TimelineLeaderboardPage>(functions, "getTimelineLeaderboard", callableOptions);
  const result = await runTimelineCall("getTimelineLeaderboard", async () => (await call({ gameType, period, cursor, timeZone: localTimeZone() })).data);
  if (!cursor) leaderboardCache.set(key, { savedAt: Date.now(), value: result });
  return result;
}

export function peekTimelineGameHistory(gameType: TimelineGameType) {
  return historyCache.get(preparedQueueKey(gameType))?.value ?? null;
}

export async function fetchTimelineGameHistory(gameType: TimelineGameType, cursorMs?: number | null, force = false) {
  const key = preparedQueueKey(gameType);
  const cached = historyCache.get(key);
  if (!cursorMs && !force && cached && Date.now() - cached.savedAt < HISTORY_CACHE_MS) return cached.value;
  const call = httpsCallable<{
    gameType: TimelineGameType;
    cursorMs?: number | null;
  }, { rows: TimelineHistoryRow[]; nextCursorMs: number | null }>(functions, "getTimelineGameHistory", callableOptions);
  const result = await runTimelineCall("getTimelineGameHistory", async () => (await call({ gameType, cursorMs })).data);
  if (!cursorMs) historyCache.set(key, { savedAt: Date.now(), value: result });
  return result;
}

export function timelineLocalizedText(value: Partial<LocalizedText>, language: Language) {
  return value[language] || value.tr || value.en || value.ru || value.uz || "";
}

function localTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function preparedQueueKey(gameType: TimelineGameType) {
  return `${firebaseAuth.currentUser?.uid ?? "guest"}:${gameType}`;
}

function timelineLeaderboardKey(gameType: TimelineGameType, period: TimelineLeaderboardPeriod) {
  return `${preparedQueueKey(gameType)}:${period}`;
}

function clearTimelineResultCaches() {
  const uid = firebaseAuth.currentUser?.uid;
  if (!uid) return;
  [...leaderboardCache.keys()].filter((key) => key.startsWith(`${uid}:`)).forEach((key) => leaderboardCache.delete(key));
  [...historyCache.keys()].filter((key) => key.startsWith(`${uid}:`)).forEach((key) => historyCache.delete(key));
}

async function runTimelineCall<Result>(operation: string, request: () => Promise<Result>, attempt = 1): Promise<Result> {
  try {
    const result = await request();
    if (attempt > 1) console.info(`[timeline] ${operation} recovered`, { attempt });
    return result;
  } catch (error) {
    const code = timelineErrorCode(error);
    console.warn(`[timeline] ${operation} failed`, { attempt, code });
    if (attempt >= 3 || !retryableTimelineError(code)) throw error;
    await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** (attempt - 1)));
    return runTimelineCall(operation, request, attempt + 1);
  }
}

function timelineErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "";
  return typeof error.code === "string" ? error.code : "";
}

function retryableTimelineError(code: string) {
  return !code || [
    "functions/unavailable",
    "functions/deadline-exceeded",
    "functions/internal",
    "functions/unknown",
    "auth/network-request-failed"
  ].includes(code);
}
