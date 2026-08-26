import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import {
  TIMELINE_FREE_DAILY_LIMIT,
  TIMELINE_GAME_SECONDS,
  TIMELINE_ITEM_COUNT,
  TIMELINE_LEADERBOARD_MAX_ROWS,
  TIMELINE_LEADERBOARD_PAGE_SIZE,
  TIMELINE_MONTHLY_GENERAL_MIN_DAYS,
  TIMELINE_PREMIUM_DAILY_LIMIT,
  countExactTimelinePositions,
  dailyPercentileScore,
  isTimelineGameType,
  normalizeArtistBirthYear,
  normalizeArtworkYear,
  orderTimelineItems,
  resolveTimelineCalendar,
  resolveTimelineCompletionElapsed,
  scoreTimelineGame,
  shuffleTimelineItems,
  type TimelineDirection,
  type TimelineGameType
} from "./timeline-game-core";
import { isActivePremium } from "./premium/premium-access";

const db = admin.firestore();
const POOL_CACHE_MS = 10 * 60 * 1000;
const POOL_QUERY_LIMIT = 500;
const RECENT_ITEM_LIMIT = 200;
const PREPARED_QUEUE_SIZE = 3;

type LocalizedValue = Record<string, string>;

type PoolItem = {
  id: string;
  year: number;
  title: LocalizedValue;
  subtitle: LocalizedValue;
  image: string;
  kind: TimelineGameType;
  artistId?: string;
};

type SessionItem = PoolItem & {
  sortYear: number;
};

type PoolCache = {
  expiresAt: number;
  items: PoolItem[];
};

type TimelinePeriod = "daily" | "monthly" | "general";

const poolCache: Partial<Record<TimelineGameType, PoolCache>> = {};

export const getTimelineGameState = onCall({ invoker: "public" }, async (request) => {
  const uid = requireUser(request.auth?.uid);
  const profile = await db.collection("users").doc(uid).get();
  const access = timelineAccess(profile.data() ?? {});
  const calendar = await userCalendar(uid, profile.data() ?? {}, request.data?.timeZone);
  const usageRef = db.collection("userDailyGameUsage").doc(`${calendar.dayKey}_${uid}`);
  const bestRefs = [
    db.collection("dailyGameScores").doc(`artwork_${calendar.dayKey}_${uid}`),
    db.collection("dailyGameScores").doc(`artist_${calendar.dayKey}_${uid}`)
  ];
  const [usage, artworkBest, artistBest] = await db.getAll(usageRef, ...bestRefs);
  const artworkUsed = numberField(usage.get("artworkUsed"));
  const artistUsed = numberField(usage.get("artistUsed"));
  logger.info("Timeline game state loaded.", { uid, dayKey: calendar.dayKey, limit: access.limit, unlimited: access.unlimited });
  return {
    serverNowMs: Date.now(),
    resetAtMs: calendar.resetAtMs,
    dayKey: calendar.dayKey,
    monthKey: calendar.monthKey,
    timeZone: calendar.timeZone,
    premium: activePremium(profile.data() ?? {}),
    admin: access.unlimited,
    games: {
      artwork: gameState(access.limit, artworkUsed, artworkBest.get("score"), access.unlimited),
      artist: gameState(access.limit, artistUsed, artistBest.get("score"), access.unlimited)
    }
  };
});

export const prepareTimelineGame = onCall({ invoker: "public" }, async (request) => {
  const uid = requireUser(request.auth?.uid);
  const gameType = requireGameType(request.data?.gameType);
  const queueSlot = Math.floor(numberField(request.data?.queueSlot));
  if (queueSlot < 0 || queueSlot >= PREPARED_QUEUE_SIZE) throw new HttpsError("invalid-argument", "TIMELINE_QUEUE_SLOT_INVALID");
  const profile = await db.collection("users").doc(uid).get();
  const access = timelineAccess(profile.data() ?? {});
  const calendar = await userCalendar(uid, profile.data() ?? {}, request.data?.timeZone);
  const usageRef = db.collection("userDailyGameUsage").doc(`${calendar.dayKey}_${uid}`);
  const usage = await usageRef.get();
  const used = numberField(usage.get(`${gameType}Used`));
  if (!access.unlimited && used >= access.limit) throw new HttpsError("resource-exhausted", "TIMELINE_DAILY_LIMIT_REACHED");

  const sequence = used + queueSlot + 1;
  if (!access.unlimited && sequence > access.limit) throw new HttpsError("resource-exhausted", "TIMELINE_DAILY_LIMIT_REACHED");
  const sessionRef = db.collection("gameSessions").doc(`${uid}_${gameType}_${calendar.dayKey}_${sequence}`);
  const existing = await sessionRef.get();
  if (existing.exists) {
    logger.info("Existing timeline session returned.", { uid, gameType, sessionId: existing.id, status: existing.get("status") });
    return publicSession(existing);
  }

  const earlierQueueRefs = Array.from({ length: queueSlot }, (_, index) =>
    db.collection("gameSessions").doc(`${uid}_${gameType}_${calendar.dayKey}_${used + index + 1}`)
  );
  const earlierQueue = earlierQueueRefs.length ? await db.getAll(...earlierQueueRefs) : [];
  const reservedIds = earlierQueue.flatMap((session) => stringArray(session.get("selectedItemIds")));
  const recentIds = [...reservedIds, ...stringArray(usage.get(`${gameType}RecentIds`))];
  const items = await chooseSessionItems(gameType, recentIds);
  if (items.length < TIMELINE_ITEM_COUNT) {
    throw new HttpsError("failed-precondition", "TIMELINE_NOT_ENOUGH_CONTENT");
  }
  const direction: TimelineDirection = Math.random() < 0.5 ? "oldest-first" : "newest-first";
  const now = admin.firestore.Timestamp.now();
  const payload = {
    uid,
    gameType,
    sequence,
    dayKey: calendar.dayKey,
    monthKey: calendar.monthKey,
    timeZone: calendar.timeZone,
    direction,
    selectedItemIds: items.map((item) => item.id),
    items: items.map((item) => ({ ...item, sortYear: item.year })),
    status: "prepared",
    valid: true,
    used: false,
    createdAt: now,
    startedAt: null,
    completedAt: null,
    expiresAt: admin.firestore.Timestamp.fromMillis(calendar.resetAtMs)
  };

  await sessionRef.create(payload).catch(async (error: unknown) => {
    const raced = await sessionRef.get();
    if (raced.exists) return;
    throw error;
  });
  const created = await sessionRef.get();
  logger.info("Timeline session prepared.", { uid, gameType, sessionId: sessionRef.id, itemCount: items.length });
  return publicSession(created);
});

export const activateTimelineGame = onCall({ invoker: "public" }, async (request) => {
  const uid = requireUser(request.auth?.uid);
  const sessionId = stringField(request.data?.sessionId);
  if (!sessionId) throw new HttpsError("invalid-argument", "TIMELINE_SESSION_REQUIRED");
  const profileRef = db.collection("users").doc(uid);
  const profile = await profileRef.get();
  const access = timelineAccess(profile.data() ?? {});
  const calendar = await userCalendar(uid, profile.data() ?? {}, request.data?.timeZone);
  const sessionRef = db.collection("gameSessions").doc(sessionId);
  const usageRef = db.collection("userDailyGameUsage").doc(`${calendar.dayKey}_${uid}`);

  const result = await db.runTransaction(async (transaction) => {
    const [session, usage] = await Promise.all([transaction.get(sessionRef), transaction.get(usageRef)]);
    if (!session.exists || session.get("uid") !== uid) throw new HttpsError("not-found", "TIMELINE_SESSION_NOT_FOUND");
    if (session.get("status") === "active") return activeSessionResponse(session);
    if (session.get("status") !== "prepared" || session.get("valid") !== true || session.get("dayKey") !== calendar.dayKey) {
      throw new HttpsError("failed-precondition", "TIMELINE_SESSION_NOT_PREPARED");
    }
    const gameType = requireGameType(session.get("gameType"));
    const usedField = `${gameType}Used`;
    const recentField = `${gameType}RecentIds`;
    const used = numberField(usage.get(usedField));
    const sequence = numberField(session.get("sequence"), sessionSequence(session.id));
    if (sequence !== used + 1) throw new HttpsError("failed-precondition", "TIMELINE_SESSION_OUT_OF_ORDER");
    if (!access.unlimited && used >= access.limit) throw new HttpsError("resource-exhausted", "TIMELINE_DAILY_LIMIT_REACHED");
    const startedAt = admin.firestore.Timestamp.now();
    const selectedItemIds = stringArray(session.get("selectedItemIds"));
    transaction.set(usageRef, {
      uid,
      dayKey: calendar.dayKey,
      monthKey: calendar.monthKey,
      timeZone: calendar.timeZone,
      resetAt: admin.firestore.Timestamp.fromMillis(calendar.resetAtMs),
      [usedField]: used + 1,
      [recentField]: [...selectedItemIds, ...stringArray(usage.get(recentField)).filter((id) => !selectedItemIds.includes(id))].slice(0, RECENT_ITEM_LIMIT),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.update(sessionRef, { status: "active", startedAt, used: true, activatedAt: startedAt });
    return {
      sessionId: session.id,
      status: "active",
      startedAtMs: startedAt.toMillis(),
      serverNowMs: startedAt.toMillis(),
      expiresAtMs: timestampMillis(session.get("expiresAt")),
      remaining: access.unlimited ? 0 : Math.max(0, access.limit - used - 1),
      limit: access.limit,
      unlimited: access.unlimited
    };
  });
  logger.info("Timeline session activated and daily right consumed.", { uid, sessionId, remaining: "remaining" in result ? result.remaining : null });
  return result;
});

export const completeTimelineGame = onCall({ invoker: "public" }, async (request) => {
  const uid = requireUser(request.auth?.uid);
  const sessionId = stringField(request.data?.sessionId);
  const orderedIds = stringArray(request.data?.orderedIds);
  const reportedElapsedSeconds = numberField(request.data?.elapsedSeconds, Number.NaN);
  if (!sessionId || orderedIds.length !== TIMELINE_ITEM_COUNT || new Set(orderedIds).size !== TIMELINE_ITEM_COUNT) {
    throw new HttpsError("invalid-argument", "TIMELINE_INVALID_SUBMISSION");
  }
  const sessionRef = db.collection("gameSessions").doc(sessionId);

  const result = await db.runTransaction(async (transaction) => {
    const session = await transaction.get(sessionRef);
    if (!session.exists || session.get("uid") !== uid) throw new HttpsError("not-found", "TIMELINE_SESSION_NOT_FOUND");
    if (session.get("status") === "completed") return completedSessionResponse(session);
    if (session.get("status") !== "active" || session.get("valid") !== true || session.get("used") !== true) {
      throw new HttpsError("failed-precondition", "TIMELINE_SESSION_NOT_ACTIVE");
    }
    const completedAt = admin.firestore.Timestamp.now();
    if (completedAt.toMillis() > timestampMillis(session.get("expiresAt")) + 2 * 60 * 60 * 1000) {
      throw new HttpsError("deadline-exceeded", "TIMELINE_SESSION_EXPIRED");
    }
    const gameType = requireGameType(session.get("gameType"));
    const items = sessionItems(session.get("items"));
    const selectedIds = items.map((item) => item.id);
    if (items.length !== TIMELINE_ITEM_COUNT || orderedIds.some((id) => !selectedIds.includes(id))) {
      throw new HttpsError("invalid-argument", "TIMELINE_ITEMS_MISMATCH");
    }
    const direction = session.get("direction") === "newest-first" ? "newest-first" : "oldest-first";
    const sourceRefs = items.map((item) => db.collection(gameType === "artwork" ? "artworks" : "artists").doc(item.id));
    const sourceDocs = await Promise.all(sourceRefs.map((ref) => transaction.get(ref)));
    const verifiedItems = sourceDocs.map((source, index) => {
      if (!source.exists || source.get("status") !== "published") throw new HttpsError("failed-precondition", "TIMELINE_SOURCE_CHANGED");
      const sourceData = source.data() ?? {};
      const year = gameType === "artwork"
        ? firstNormalizedYear([sourceData.year, sourceData.date, sourceData.creationYear, sourceData.createdYear])
        : normalizeArtistBirthYear(firstPresentValue([sourceData.birthYear, sourceData.birthDate, sourceData.born, sourceData.yearBorn]), sourceData.lifeYears);
      if (year === null || year !== items[index].sortYear) throw new HttpsError("failed-precondition", "TIMELINE_SOURCE_CHANGED");
      return { ...items[index], year };
    });
    const expectedIds = orderTimelineItems(verifiedItems, direction).map((item) => item.id);
    const correctPositions = countExactTimelinePositions(expectedIds, orderedIds);
    const startedAtMs = timestampMillis(session.get("startedAt"));
    const serverElapsedSeconds = Math.max(0, Math.floor((completedAt.toMillis() - startedAtMs) / 1000));
    const elapsedSeconds = resolveTimelineCompletionElapsed(reportedElapsedSeconds, serverElapsedSeconds);
    const score = scoreTimelineGame(correctPositions, elapsedSeconds);
    const dayKey = stringField(session.get("dayKey"));
    const monthKey = stringField(session.get("monthKey"));
    const profileRef = db.collection("users").doc(uid);
    const dailyRef = db.collection("dailyGameScores").doc(`${gameType}_${dayKey}_${uid}`);
    const monthlyRef = db.collection("monthlyGameScores").doc(`${gameType}_${monthKey}_${uid}`);
    const resultRef = db.collection("timelineGameResults").doc(sessionId);
    const bucketRef = db.collection("timelineDailyBuckets").doc(`${gameType}_${dayKey}`);
    const [profile, daily, monthly] = await Promise.all([
      transaction.get(profileRef),
      transaction.get(dailyRef),
      transaction.get(monthlyRef)
    ]);
    const excludedFromLeaderboard = isAdminProfile(profile.data() ?? {});
    const identity = profileIdentity(uid, profile.data() ?? {});
    const row = {
      uid,
      gameType,
      username: identity.username,
      displayName: identity.displayName,
      photoURL: identity.photoURL,
      countryCode: identity.countryCode,
      score: score.finalScore,
      correctPositions,
      elapsedSeconds,
      serverElapsedSeconds,
      submissionDelaySeconds: Math.max(0, serverElapsedSeconds - elapsedSeconds),
      leaderboardEligible: !excludedFromLeaderboard,
      achievedAt: completedAt,
      updatedAt: completedAt
    };
    const dailyImproved = !excludedFromLeaderboard && betterScore(row, daily.data());
    const monthlyImproved = !excludedFromLeaderboard && betterScore(row, monthly.data());
    if (dailyImproved) transaction.set(dailyRef, { ...row, dayKey, monthKey, resetAt: session.get("expiresAt"), percentileFinalized: false }, { merge: true });
    if (monthlyImproved) transaction.set(monthlyRef, { ...row, monthKey }, { merge: true });
    transaction.set(resultRef, { ...row, dayKey, monthKey, direction, sessionId, finishedAt: completedAt }, { merge: false });
    const resetAtMs = timestampMillis(session.get("expiresAt"));
    if (!excludedFromLeaderboard) {
      transaction.set(bucketRef, {
        gameType,
        dayKey,
        monthKey,
        resetAt: session.get("expiresAt"),
        finalizeAfter: admin.firestore.Timestamp.fromMillis(resetAtMs + 2 * 60 * 60 * 1000),
        finalized: false,
        updatedAt: completedAt
      }, { merge: true });
    }
    const correctItems = orderTimelineItems(verifiedItems, direction).map(publicResultItem);
    const response = {
      sessionId,
      gameType,
      direction,
      correctPositions,
      elapsedSeconds,
      score: score.finalScore,
      normalScore: score.normalScore,
      timedOut: score.timedOut,
      dailyBest: excludedFromLeaderboard ? score.finalScore : dailyImproved ? score.finalScore : numberField(daily.get("score")),
      newRecord: !excludedFromLeaderboard && dailyImproved && score.finalScore > numberField(daily.get("score")),
      correctItems
    };
    transaction.update(sessionRef, {
      status: "completed",
      completedAt,
      result: response,
      valid: false
    });
    return response;
  });
  logger.info("Timeline result verified and saved.", { uid, sessionId, gameType: result.gameType, score: result.score });
  return result;
});

export const getTimelineLeaderboard = onCall({ invoker: "public" }, async (request) => {
  const uid = requireUser(request.auth?.uid);
  const gameType = requireGameType(request.data?.gameType);
  const period = requirePeriod(request.data?.period);
  const profile = await db.collection("users").doc(uid).get();
  const requestingAdmin = isAdminProfile(profile.data() ?? {});
  const calendar = await userCalendar(uid, profile.data() ?? {}, request.data?.timeZone);
  const cursor = cursorValue(request.data?.cursor);
  const loaded = Math.max(0, Math.min(1_000_000, Math.floor(numberField(cursor?.loaded))));
  const pageSize = period === "general"
    ? Math.min(TIMELINE_LEADERBOARD_PAGE_SIZE, TIMELINE_LEADERBOARD_MAX_ROWS - loaded)
    : TIMELINE_LEADERBOARD_PAGE_SIZE;
  if (pageSize <= 0) return { rows: [], nextCursor: null, ownRank: await ownRankSafely(gameType, period, calendar, uid, requestingAdmin), periodKey: periodKey(period, calendar) };

  const queryLimit = pageSize * 3 + 1;
  let query = leaderboardQuery(gameType, period, calendar).limit(queryLimit);
  if (cursor) query = applyLeaderboardCursor(query, period, cursor);
  const snapshot = await query.get();
  const eligible = await withoutAdminScores(snapshot.docs);
  const visible = eligible.slice(0, pageSize);
  const rows = visible.map((document, index) => publicLeaderboardRow(document, loaded + index + 1, period));
  const last = visible[visible.length - 1] ?? snapshot.docs[snapshot.docs.length - 1];
  const reachedPeriodLimit = period === "general" && loaded + visible.length >= TIMELINE_LEADERBOARD_MAX_ROWS;
  const nextCursor = (eligible.length > pageSize || snapshot.size === queryLimit) && last && !reachedPeriodLimit
    ? leaderboardCursor(last, period, loaded + visible.length)
    : null;
  logger.info("Timeline leaderboard page loaded.", { uid, gameType, period, count: rows.length });
  return {
    rows,
    nextCursor,
    ownRank: await ownRankSafely(gameType, period, calendar, uid, requestingAdmin),
    periodKey: periodKey(period, calendar),
    minimumDays: TIMELINE_MONTHLY_GENERAL_MIN_DAYS
  };
});

export const getTimelineGameHistory = onCall({ invoker: "public" }, async (request) => {
  const uid = requireUser(request.auth?.uid);
  const gameType = requireGameType(request.data?.gameType);
  const cursorMs = numberField(request.data?.cursorMs);
  let query = db.collection("timelineGameResults")
    .where("uid", "==", uid)
    .where("gameType", "==", gameType)
    .orderBy("finishedAt", "desc")
    .limit(TIMELINE_LEADERBOARD_PAGE_SIZE + 1);
  if (cursorMs > 0) query = query.startAfter(admin.firestore.Timestamp.fromMillis(cursorMs));
  const snapshot = await query.get();
  const visible = snapshot.docs.slice(0, TIMELINE_LEADERBOARD_PAGE_SIZE);
  return {
    rows: visible.map((document) => ({
      id: document.id,
      score: numberField(document.get("score")),
      correctPositions: numberField(document.get("correctPositions")),
      elapsedSeconds: numberField(document.get("elapsedSeconds")),
      timedOut: numberField(document.get("elapsedSeconds")) >= TIMELINE_GAME_SECONDS,
      direction: document.get("direction") === "newest-first" ? "newest-first" : "oldest-first",
      finishedAtMs: timestampMillis(document.get("finishedAt"))
    })),
    nextCursorMs: snapshot.size > TIMELINE_LEADERBOARD_PAGE_SIZE ? timestampMillis(visible[visible.length - 1]?.get("finishedAt")) : null
  };
});

export const finalizeTimelineDailyPercentiles = onSchedule(
  { schedule: "15 * * * *", timeZone: "UTC", timeoutSeconds: 540, memory: "1GiB" },
  async () => {
    const buckets = await db.collection("timelineDailyBuckets")
      .where("finalized", "==", false)
      .where("finalizeAfter", "<=", admin.firestore.Timestamp.now())
      .orderBy("finalizeAfter", "asc")
      .limit(4)
      .get();
    for (const bucket of buckets.docs) await finalizeBucket(bucket);
  }
);

function requireUser(uid: string | undefined) {
  if (!uid) throw new HttpsError("unauthenticated", "TIMELINE_AUTH_REQUIRED");
  return uid;
}

function requireGameType(value: unknown) {
  if (!isTimelineGameType(value)) throw new HttpsError("invalid-argument", "TIMELINE_INVALID_GAME_TYPE");
  return value;
}

function requirePeriod(value: unknown): TimelinePeriod {
  if (value === "daily" || value === "monthly" || value === "general") return value;
  throw new HttpsError("invalid-argument", "TIMELINE_INVALID_PERIOD");
}

async function userCalendar(uid: string, profile: admin.firestore.DocumentData, requested: unknown) {
  const stored = stringField(profile.timelineTimeZone);
  const candidate = stored || stringField(requested) || "UTC";
  const calendar = resolveTimelineCalendar(new Date(), candidate);
  if (!stored) {
    await db.collection("users").doc(uid).set({
      timelineTimeZone: calendar.timeZone,
      timelineTimeZoneUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
  return calendar;
}

function activePremium(profile: admin.firestore.DocumentData) {
  return isActivePremium(profile);
}

function isAdminProfile(profile: admin.firestore.DocumentData) {
  return profile.role === "admin";
}

function timelineAccess(profile: admin.firestore.DocumentData) {
  if (isAdminProfile(profile)) return { limit: 0, unlimited: true };
  return {
    limit: activePremium(profile) ? TIMELINE_PREMIUM_DAILY_LIMIT : TIMELINE_FREE_DAILY_LIMIT,
    unlimited: false
  };
}

function gameState(limit: number, used: number, bestScore: unknown, unlimited: boolean) {
  return { limit, used, remaining: unlimited ? 0 : Math.max(0, limit - used), dailyBest: numberField(bestScore), unlimited };
}

async function chooseSessionItems(gameType: TimelineGameType, recentIds: string[]) {
  const pool = await loadPool(gameType);
  const recent = new Set(recentIds);
  const fresh = pool.filter((item) => !recent.has(item.id));
  const selected: PoolItem[] = [];
  const years = new Set<number>();
  const targetCount = gameType === "artwork" ? Math.min(uniqueYearCount(pool), TIMELINE_ITEM_COUNT * 3) : TIMELINE_ITEM_COUNT;
  const addCandidates = (items: PoolItem[]) => items.some((item) => {
      if (years.has(item.year)) return false;
      years.add(item.year);
      selected.push(item);
      return selected.length === targetCount;
    });
  addCandidates(shuffleTimelineItems(fresh));
  if (selected.length < targetCount) {
    const recentOrder = new Map(recentIds.map((id, index) => [id, index]));
    addCandidates(pool
      .filter((item) => !selected.some((selectedItem) => selectedItem.id === item.id))
      .sort((a, b) => (recentOrder.get(b.id) ?? -1) - (recentOrder.get(a.id) ?? -1)));
  }
  if (gameType !== "artwork") return shuffleTimelineItems(selected);
  const hydrated = await hydrateArtworkArtists(selected);
  return shuffleTimelineItems(hydrated.filter((item) => localizedPresent(item.subtitle)).slice(0, TIMELINE_ITEM_COUNT));
}

async function loadPool(gameType: TimelineGameType) {
  const cached = poolCache[gameType];
  if (cached && cached.expiresAt > Date.now()) return cached.items;
  const collectionName = gameType === "artwork" ? "artworks" : "artists";
  const snapshot = await db.collection(collectionName)
    .where("status", "==", "published")
    .orderBy("updatedAt", "desc")
    .limit(POOL_QUERY_LIMIT)
    .get();
  const items = snapshot.docs.flatMap((document) => {
    const data = document.data();
    const year = gameType === "artwork"
      ? firstNormalizedYear([data.year, data.date, data.creationYear, data.createdYear])
      : normalizeArtistBirthYear(firstPresentValue([data.birthYear, data.birthDate, data.born, data.yearBorn]), data.lifeYears);
    const title = firstLocalizedValue(gameType === "artwork" ? [data.title, data.name] : [data.name]);
    const image = firstStringField([data.imageURL, data.image, data.imageUrl, data.photoURL]);
    const subtitle = firstLocalizedValue(
      gameType === "artwork"
        ? [data.artistName]
        : [data.movement, data.period, data.artMovement, data.era]
    );
    if (year === null || !localizedPresent(title) || (gameType === "artwork" && !image)) return [];
    if (gameType === "artwork" && !localizedPresent(subtitle) && !stringField(data.artistId)) return [];
    return [{
      id: document.id,
      year,
      title,
      subtitle,
      image,
      kind: gameType,
      ...(gameType === "artwork" && stringField(data.artistId) ? { artistId: stringField(data.artistId) } : {})
    } satisfies PoolItem];
  });
  poolCache[gameType] = { expiresAt: Date.now() + POOL_CACHE_MS, items };
  logger.info("Timeline candidate pool refreshed.", { gameType, fetched: snapshot.size, eligible: items.length });
  return items;
}

async function hydrateArtworkArtists(items: PoolItem[]) {
  const missing = items.filter((item) => !localizedPresent(item.subtitle) && item.artistId);
  if (!missing.length) return items;
  const snapshots = await db.getAll(...missing.map((item) => db.collection("artists").doc(item.artistId as string)));
  const names = new Map(snapshots.filter((document) => document.exists).map((document) => [document.id, localizedValue(document.get("name"))]));
  return items.map((item) => ({ ...item, subtitle: localizedPresent(item.subtitle) ? item.subtitle : names.get(item.artistId ?? "") ?? {} }));
}

function uniqueYearCount(items: PoolItem[]) {
  return new Set(items.map((item) => item.year)).size;
}

function publicSession(session: admin.firestore.DocumentSnapshot) {
  if (!session.exists) throw new HttpsError("internal", "TIMELINE_SESSION_CREATE_FAILED");
  const status = session.get("status") === "active" ? "active" : "prepared";
  return {
    sessionId: session.id,
    status,
    gameType: requireGameType(session.get("gameType")),
    sequence: numberField(session.get("sequence"), sessionSequence(session.id)),
    direction: session.get("direction") === "newest-first" ? "newest-first" : "oldest-first",
    items: sessionItems(session.get("items")).map(publicDisplayItem),
    startedAtMs: timestampMillis(session.get("startedAt")) || null,
    expiresAtMs: timestampMillis(session.get("expiresAt")),
    serverNowMs: Date.now()
  };
}

function sessionSequence(sessionId: string) {
  const value = Number(sessionId.split("_").pop());
  return Number.isFinite(value) ? value : 0;
}

function activeSessionResponse(session: admin.firestore.DocumentSnapshot) {
  return {
    sessionId: session.id,
    status: "active",
    startedAtMs: timestampMillis(session.get("startedAt")),
    expiresAtMs: timestampMillis(session.get("expiresAt")),
    serverNowMs: Date.now()
  };
}

function completedSessionResponse(session: admin.firestore.DocumentSnapshot) {
  const result = session.get("result");
  if (!result || typeof result !== "object") throw new HttpsError("internal", "TIMELINE_RESULT_MISSING");
  return result;
}

function sessionItems(value: unknown): SessionItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    const id = stringField(record.id);
    const year = numberField(record.sortYear ?? record.year, Number.NaN);
    const kind = isTimelineGameType(record.kind) ? record.kind : null;
    if (!id || !Number.isFinite(year) || !kind) return [];
    return [{
      id,
      year,
      sortYear: year,
      title: localizedValue(record.title),
      subtitle: localizedValue(record.subtitle),
      image: stringField(record.image),
      kind,
      ...(stringField(record.artistId) ? { artistId: stringField(record.artistId) } : {})
    }];
  });
}

function publicDisplayItem(item: SessionItem) {
  return { id: item.id, title: item.title, subtitle: item.subtitle, image: item.image, kind: item.kind };
}

function publicResultItem(item: PoolItem) {
  return { ...publicDisplayItem({ ...item, sortYear: item.year }), year: item.year };
}

function profileIdentity(uid: string, profile: admin.firestore.DocumentData) {
  const username = stringField(profile.username, uid);
  return {
    username,
    displayName: stringField(profile.displayName, username),
    photoURL: stringField(profile.photoURL),
    countryCode: stringField(profile.countryCode)
  };
}

function betterScore(next: { score: number; elapsedSeconds: number; achievedAt: admin.firestore.Timestamp }, current?: admin.firestore.DocumentData) {
  if (!current) return true;
  const currentScore = numberField(current.score);
  if (next.score !== currentScore) return next.score > currentScore;
  const currentElapsed = numberField(current.elapsedSeconds, Number.MAX_SAFE_INTEGER);
  if (next.elapsedSeconds !== currentElapsed) return next.elapsedSeconds < currentElapsed;
  return next.achievedAt.toMillis() < timestampMillis(current.achievedAt);
}

function leaderboardQuery(gameType: TimelineGameType, period: TimelinePeriod, calendar: ReturnType<typeof resolveTimelineCalendar>) {
  if (period === "daily") {
    return db.collection("dailyGameScores")
      .where("gameType", "==", gameType)
      .where("dayKey", "==", calendar.dayKey)
      .orderBy("score", "desc")
      .orderBy("elapsedSeconds", "asc")
      .orderBy("achievedAt", "asc");
  }
  if (period === "monthly") {
    return db.collection("monthlyGameScores")
      .where("gameType", "==", gameType)
      .where("monthKey", "==", calendar.monthKey)
      .orderBy("score", "desc")
      .orderBy("elapsedSeconds", "asc")
      .orderBy("achievedAt", "asc");
  }
  return db.collection("monthlyGeneralScores")
    .where("gameType", "==", gameType)
    .where("monthKey", "==", calendar.monthKey)
    .where("eligible", "==", true)
    .orderBy("score", "desc")
    .orderBy("activeDays", "desc")
    .orderBy("updatedAt", "asc");
}

function applyLeaderboardCursor(query: admin.firestore.Query, period: TimelinePeriod, cursor: Record<string, unknown>) {
  const score = numberField(cursor.score);
  const achievedAt = admin.firestore.Timestamp.fromMillis(numberField(cursor.achievedAtMs));
  if (period === "general") return query.startAfter(score, numberField(cursor.activeDays), achievedAt);
  return query.startAfter(score, numberField(cursor.elapsedSeconds), achievedAt);
}

function leaderboardCursor(document: admin.firestore.QueryDocumentSnapshot, period: TimelinePeriod, loaded: number) {
  return {
    score: numberField(document.get("score")),
    elapsedSeconds: numberField(document.get("elapsedSeconds")),
    activeDays: numberField(document.get("activeDays")),
    achievedAtMs: timestampMillis(document.get(period === "general" ? "updatedAt" : "achievedAt")),
    loaded
  };
}

function publicLeaderboardRow(document: admin.firestore.DocumentSnapshot, rank: number, period: TimelinePeriod) {
  return {
    id: document.id,
    uid: stringField(document.get("uid")),
    username: stringField(document.get("username")),
    displayName: stringField(document.get("displayName")),
    photoURL: stringField(document.get("photoURL")),
    countryCode: stringField(document.get("countryCode")),
    score: numberField(document.get("score")),
    elapsedSeconds: period === "general" ? null : numberField(document.get("elapsedSeconds")),
    activeDays: period === "general" ? numberField(document.get("activeDays")) : null,
    rank
  };
}

async function ownRank(gameType: TimelineGameType, period: TimelinePeriod, calendar: ReturnType<typeof resolveTimelineCalendar>, uid: string, excluded: boolean) {
  if (excluded) return null;
  const collectionName = period === "daily" ? "dailyGameScores" : period === "monthly" ? "monthlyGameScores" : "monthlyGeneralScores";
  const key = period === "daily" ? calendar.dayKey : calendar.monthKey;
  const document = await db.collection(collectionName).doc(`${gameType}_${key}_${uid}`).get();
  if (!document.exists) return null;
  if (period === "general" && document.get("eligible") !== true) {
    return { eligible: false, activeDays: numberField(document.get("activeDays")), requiredDays: TIMELINE_MONTHLY_GENERAL_MIN_DAYS };
  }
  const unfilteredBase = db.collection(collectionName)
    .where("gameType", "==", gameType)
    .where(period === "daily" ? "dayKey" : "monthKey", "==", key);
  const base = period === "general" ? unfilteredBase.where("eligible", "==", true) : unfilteredBase;
  const score = numberField(document.get("score"));
  const higher = await base.where("score", ">", score).count().get();
  const secondaryTie = period === "general"
    ? await base.where("score", "==", score).where("activeDays", ">", numberField(document.get("activeDays"))).count().get()
    : await base.where("score", "==", score).where("elapsedSeconds", "<", numberField(document.get("elapsedSeconds"))).count().get();
  const exactTie = period === "general"
    ? await base
      .where("score", "==", score)
      .where("activeDays", "==", numberField(document.get("activeDays")))
      .where("updatedAt", "<", document.get("updatedAt"))
      .count().get()
    : await base
      .where("score", "==", score)
      .where("elapsedSeconds", "==", numberField(document.get("elapsedSeconds")))
      .where("achievedAt", "<", document.get("achievedAt"))
      .count().get();
  return { ...publicLeaderboardRow(document, higher.data().count + secondaryTie.data().count + exactTie.data().count + 1, period), eligible: true };
}

async function ownRankSafely(gameType: TimelineGameType, period: TimelinePeriod, calendar: ReturnType<typeof resolveTimelineCalendar>, uid: string, excluded: boolean) {
  try {
    return await ownRank(gameType, period, calendar, uid, excluded);
  } catch (error) {
    logger.error("Timeline own-rank calculation failed without blocking the leaderboard.", {
      uid,
      gameType,
      period,
      error: error instanceof Error ? error.message : String(error)
    });
    return null;
  }
}

async function withoutAdminScores<T extends admin.firestore.QueryDocumentSnapshot>(documents: T[]) {
  const userIds = [...new Set(documents.map((document) => stringField(document.get("uid"))).filter(Boolean))];
  if (!userIds.length) return documents;
  const profiles = await db.getAll(...userIds.map((userId) => db.collection("users").doc(userId)));
  const adminIds = new Set(profiles.filter((profile) => profile.exists && isAdminProfile(profile.data() ?? {})).map((profile) => profile.id));
  return documents.filter((document) => !adminIds.has(stringField(document.get("uid"))));
}

function periodKey(period: TimelinePeriod, calendar: ReturnType<typeof resolveTimelineCalendar>) {
  return period === "daily" ? calendar.dayKey : calendar.monthKey;
}

async function finalizeBucket(bucket: admin.firestore.QueryDocumentSnapshot) {
  const gameType = requireGameType(bucket.get("gameType"));
  const dayKey = stringField(bucket.get("dayKey"));
  const monthKey = stringField(bucket.get("monthKey"));
  const scores: admin.firestore.QueryDocumentSnapshot[] = [];
  let cursor: admin.firestore.QueryDocumentSnapshot | undefined;
  do {
    let query = db.collection("dailyGameScores")
      .where("gameType", "==", gameType)
      .where("dayKey", "==", dayKey)
      .orderBy("score", "desc")
      .orderBy("elapsedSeconds", "asc")
      .orderBy("achievedAt", "asc")
      .limit(500);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    scores.push(...page.docs);
    cursor = page.size === 500 ? page.docs[page.docs.length - 1] : undefined;
  } while (cursor);

  const eligibleScores = await withoutAdminScores(scores);
  for (let start = 0; start < eligibleScores.length; start += 180) {
    const chunk = eligibleScores.slice(start, start + 180);
    const generalRefs = chunk.map((score) => db.collection("monthlyGeneralScores").doc(`${gameType}_${monthKey}_${score.get("uid")}`));
    const generalDocs = await db.getAll(...generalRefs);
    const batch = db.batch();
    chunk.forEach((score, offset) => {
      const general = generalDocs[offset];
      const finalizedDayKeys = stringArray(general.get("finalizedDayKeys"));
      if (score.get("percentileFinalized") === true || finalizedDayKeys.includes(dayKey)) return;
      const percentile = dailyPercentileScore(start + offset + 1, eligibleScores.length);
      const percentileSum = numberField(general.get("percentileSum")) + percentile;
      const activeDays = numberField(general.get("activeDays")) + 1;
      batch.set(generalRefs[offset], {
        uid: score.get("uid"),
        gameType,
        monthKey,
        username: score.get("username"),
        displayName: score.get("displayName"),
        photoURL: score.get("photoURL"),
        countryCode: score.get("countryCode"),
        percentileSum,
        activeDays,
        score: Number((percentileSum / activeDays).toFixed(4)),
        eligible: activeDays >= TIMELINE_MONTHLY_GENERAL_MIN_DAYS,
        finalizedDayKeys: [...finalizedDayKeys, dayKey],
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      batch.set(score.ref, { dailyPercentileScore: percentile, percentileFinalized: true }, { merge: true });
    });
    await batch.commit();
  }
  await bucket.ref.set({ finalized: true, participantCount: eligibleScores.length, finalizedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  logger.info("Timeline daily percentiles finalized.", { gameType, dayKey, participantCount: eligibleScores.length });
}

function localizedValue(value: unknown): LocalizedValue {
  if (typeof value === "string" && value.trim()) return { tr: value.trim(), en: value.trim(), ru: value.trim(), uz: value.trim() };
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  return ["tr", "en", "ru", "uz"].reduce<LocalizedValue>((result, language) => {
    const text = stringField(record[language]);
    if (text) result[language] = text;
    return result;
  }, {});
}

function localizedPresent(value: LocalizedValue) {
  return Object.values(value).some(Boolean);
}

function firstLocalizedValue(values: unknown[]) {
  return values.map(localizedValue).find(localizedPresent) ?? {};
}

function firstStringField(values: unknown[]) {
  return values.map((value) => stringField(value)).find(Boolean) ?? "";
}

function firstNormalizedYear(values: unknown[]) {
  for (const value of values) {
    const year = normalizeArtworkYear(value);
    if (year !== null) return year;
  }
  return null;
}

function firstPresentValue(values: unknown[]) {
  return values.find((value) => value !== null && value !== undefined && value !== "");
}

function stringField(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item)) : [];
}

function numberField(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function timestampMillis(value: unknown) {
  if (value instanceof admin.firestore.Timestamp) return value.toMillis();
  return 0;
}

function cursorValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}
