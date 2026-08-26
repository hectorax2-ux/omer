import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";

if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();
const TILE_COUNT = 16;
const START_SCORE = 160;
const REVEAL_PENALTY = 10;
const MAX_TIME_PENALTY = 30;
const OPTION_COUNT = 4;
const POOL_LIMIT = 300;
const RECENT_ARTWORK_LIMIT = 21;
const SESSION_TTL_MS = 36 * 60 * 60 * 1000;

type Language = "tr" | "en" | "ru" | "uz";
type LocalizedText = Record<Language, string>;
type ArtworkCandidate = {
  id: string;
  title: LocalizedText;
  artist: LocalizedText;
  image: string;
};

export const prepareDailyJigsawGame = onCall(async (request) => {
  const uid = requireMember(request.auth);
  const puzzle = await ensureDailyJigsawPuzzle();
  const dayKey = dayKeyForIstanbul();
  const attemptRef = db.doc(`jigsawAttempts/${uid}_${dayKey}`);
  const attempt = await attemptRef.get();

  if (attempt.exists) {
    return {
      puzzle: publicPuzzle(puzzle),
      dayKey,
      ranked: false,
      practice: true,
      sessionId: "",
      status: "practice",
      serverNowMs: Date.now()
    };
  }

  const sessionRef = db.doc(`jigsawGameSessions/${uid}_${dayKey}`);
  await db.runTransaction(async (transaction) => {
    const session = await transaction.get(sessionRef);
    if (session.exists) return;
    transaction.create(sessionRef, {
      uid,
      dayKey,
      puzzleId: puzzle.id,
      status: "prepared",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromMillis(Date.now() + SESSION_TTL_MS)
    });
  });
  const session = await sessionRef.get();

  return {
    puzzle: publicPuzzle(puzzle),
    dayKey,
    ranked: true,
    practice: false,
    sessionId: session.id,
    status: session.get("status") === "active" ? "active" : "prepared",
    startedAtMs: timestampMillis(session.get("startedAt")) || null,
    serverNowMs: Date.now()
  };
});

export const activateDailyJigsawGame = onCall(async (request) => {
  const uid = requireMember(request.auth);
  const sessionId = stringValue(request.data?.sessionId);
  if (!sessionId) throw new HttpsError("invalid-argument", "JIGSAW_SESSION_REQUIRED");
  const sessionRef = db.doc(`jigsawGameSessions/${sessionId}`);

  await db.runTransaction(async (transaction) => {
    const session = await transaction.get(sessionRef);
    if (!session.exists || session.get("uid") !== uid) throw new HttpsError("not-found", "JIGSAW_SESSION_NOT_FOUND");
    if (session.get("status") === "completed") return;
    if (session.get("status") === "active") return;
    transaction.update(sessionRef, {
      status: "active",
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });

  const session = await sessionRef.get();
  if (session.get("status") === "completed") throw new HttpsError("failed-precondition", "JIGSAW_SESSION_COMPLETED");
  return {
    sessionId,
    startedAtMs: timestampMillis(session.get("startedAt")),
    serverNowMs: Date.now()
  };
});

export const completeDailyJigsawGame = onCall(async (request) => {
  const uid = requireMember(request.auth);
  const sessionId = stringValue(request.data?.sessionId);
  if (!sessionId) throw new HttpsError("invalid-argument", "JIGSAW_SESSION_REQUIRED");
  const sessionRef = db.doc(`jigsawGameSessions/${sessionId}`);
  const session = await sessionRef.get();
  if (!session.exists || session.get("uid") !== uid) throw new HttpsError("not-found", "JIGSAW_SESSION_NOT_FOUND");

  const dayKey = stringValue(session.get("dayKey"));
  const puzzleId = stringValue(session.get("puzzleId"));
  const attemptRef = db.doc(`jigsawAttempts/${uid}_${dayKey}`);
  const puzzleRef = db.doc(`jigsawPuzzles/${puzzleId}`);
  const [profile, puzzle] = await Promise.all([db.doc(`users/${uid}`).get(), puzzleRef.get()]);
  if (!puzzle.exists) throw new HttpsError("not-found", "JIGSAW_PUZZLE_NOT_FOUND");

  const selectedOptionIndex = integerValue(request.data?.selectedOptionIndex, -1);
  const revealedIndices = uniqueValidIndices(request.data?.revealedIndices);
  const forcedZero = request.data?.forcedZero === true;
  const elapsedSeconds = Math.max(0, integerValue(request.data?.elapsedSeconds));
  const correct = !forcedZero && revealedIndices.length > 0 && selectedOptionIndex === integerValue(puzzle.get("answerIndex"), -2);
  const score = correct
    ? Math.max(
        0,
        numberValue(puzzle.get("startScore"), START_SCORE)
          - revealedIndices.length * numberValue(puzzle.get("revealPenalty"), REVEAL_PENALTY)
          - Math.min(MAX_TIME_PENALTY, elapsedSeconds)
      )
    : 0;
  const now = admin.firestore.Timestamp.now();

  await db.runTransaction(async (transaction) => {
    const [freshSession, existingAttempt] = await Promise.all([
      transaction.get(sessionRef),
      transaction.get(attemptRef)
    ]);
    if (existingAttempt.exists) return;
    if (!freshSession.exists || freshSession.get("uid") !== uid) throw new HttpsError("not-found", "JIGSAW_SESSION_NOT_FOUND");
    if (freshSession.get("status") !== "active") throw new HttpsError("failed-precondition", "JIGSAW_SESSION_NOT_ACTIVE");

    const username = stringValue(profile.get("username"), uid.slice(0, 8));
    const displayName = stringValue(profile.get("displayName"), username);
    transaction.create(attemptRef, {
      uid,
      username,
      displayName,
      countryCode: stringValue(profile.get("countryCode")),
      puzzleId,
      sourceArtworkId: stringValue(puzzle.get("sourceArtworkId")),
      selectedOptionIndex,
      revealedCount: revealedIndices.length,
      elapsedSeconds,
      correct,
      score,
      dayKey,
      completedAtMs: now.toMillis(),
      createdAt: now,
      updatedAt: now,
      verifiedByServer: true
    });
    transaction.update(sessionRef, {
      status: "completed",
      result: { score, correct, elapsedSeconds, revealedCount: revealedIndices.length },
      completedAt: now,
      updatedAt: now
    });
  });

  const savedAttempt = await attemptRef.get();
  return {
    attemptId: savedAttempt.id,
    score: numberValue(savedAttempt.get("score")),
    correct: savedAttempt.get("correct") === true,
    elapsedSeconds: numberValue(savedAttempt.get("elapsedSeconds")),
    revealedCount: numberValue(savedAttempt.get("revealedCount")),
    dayKey
  };
});

export async function ensureDailyJigsawPuzzle(reference = new Date()) {
  const dayKey = dayKeyForIstanbul(reference);
  const puzzleRef = db.doc(`jigsawPuzzles/auto-${dayKey}`);
  const existing = await puzzleRef.get();
  if (existing.exists) return { id: existing.id, ...existing.data() } as Record<string, unknown> & { id: string };

  const snapshot = await db.collection("artworks").where("status", "==", "published").limit(POOL_LIMIT).get();
  const pool = snapshot.docs.flatMap((document) => {
    const data = document.data();
    const title = localizedValue(data.title ?? data.name);
    const image = firstString([data.imageURL, data.image, data.imageUrl]);
    if (!title.tr || !image) return [];
    return [{ id: document.id, title, artist: localizedValue(data.artistName), image } satisfies ArtworkCandidate];
  }).filter((candidate, index, candidates) => candidates.findIndex((item) => item.title.tr.toLocaleLowerCase("tr") === candidate.title.tr.toLocaleLowerCase("tr")) === index);
  if (pool.length < OPTION_COUNT) {
    logger.error("Daily Art Detective pool is too small.", { dayKey, eligible: pool.length });
    throw new HttpsError("failed-precondition", "JIGSAW_CONTENT_INSUFFICIENT");
  }

  const rotationRef = db.doc("gameContentRotations/artDetective");
  const [rotation, duelRotation] = await Promise.all([
    rotationRef.get(),
    db.doc("gameContentRotations/duelArtwork").get()
  ]);
  const recentIds = new Set([
    ...stringArray(rotation.get("recentArtworkIds")),
    ...stringArray(duelRotation.get("recentSourceIds"))
  ]);
  const fresh = pool.filter((item) => !recentIds.has(item.id));
  const candidates = fresh.length >= OPTION_COUNT ? fresh : pool;
  const ordered = seededShuffle(candidates, `jigsaw:${dayKey}`);
  const answer = ordered[0];
  const distractors = seededShuffle(pool.filter((item) => item.id !== answer.id), `jigsaw-options:${dayKey}`).slice(0, OPTION_COUNT - 1);
  const answerIndex = hashString(`answer:${dayKey}`) % OPTION_COUNT;
  const optionEntries = [...distractors];
  optionEntries.splice(answerIndex, 0, answer);
  const payload = {
    title: answer.title,
    question: {
      tr: "Bu eser hangisi?",
      en: "Which artwork is this?",
      ru: "Что это за произведение?",
      uz: "Bu qaysi asar?"
    },
    image: answer.image,
    options: {
      tr: optionEntries.map((item) => item.title.tr),
      en: optionEntries.map((item) => item.title.en),
      ru: optionEntries.map((item) => item.title.ru),
      uz: optionEntries.map((item) => item.title.uz)
    },
    answerIndex,
    tileCount: TILE_COUNT,
    startScore: START_SCORE,
    revealPenalty: REVEAL_PENALTY,
    status: "published",
    dayKey,
    pinned: false,
    automated: true,
    sourceArtworkId: answer.id,
    sourceArtist: answer.artist,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  const nextRecent = [answer.id, ...stringArray(rotation.get("recentArtworkIds")).filter((id) => id !== answer.id)].slice(0, RECENT_ARTWORK_LIMIT);
  const batch = db.batch();
  batch.create(puzzleRef, payload);
  batch.set(rotationRef, { recentArtworkIds: nextRecent, lastDayKey: dayKey, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
  await batch.commit().catch(async (error: unknown) => {
    const concurrent = await puzzleRef.get();
    if (!concurrent.exists) throw error;
  });
  const created = await puzzleRef.get();
  logger.info("Daily Art Detective puzzle prepared.", { dayKey, artworkId: answer.id, poolSize: pool.length });
  return { id: created.id, ...created.data() } as Record<string, unknown> & { id: string };
}

function publicPuzzle(puzzle: Record<string, unknown> & { id: string }) {
  return {
    id: puzzle.id,
    title: localizedValue(puzzle.title),
    question: localizedValue(puzzle.question),
    image: stringValue(puzzle.image),
    options: puzzle.options,
    answerIndex: integerValue(puzzle.answerIndex),
    tileCount: integerValue(puzzle.tileCount, TILE_COUNT),
    startScore: numberValue(puzzle.startScore, START_SCORE),
    revealPenalty: numberValue(puzzle.revealPenalty, REVEAL_PENALTY),
    status: "published",
    dayKey: stringValue(puzzle.dayKey)
  };
}

function requireMember(auth: { uid: string; token: Record<string, unknown> } | undefined) {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "JIGSAW_AUTH_REQUIRED");
  if (auth.token.email_verified === false) throw new HttpsError("failed-precondition", "JIGSAW_VERIFICATION_REQUIRED");
  return auth.uid;
}

function dayKeyForIstanbul(reference = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(reference);
  const values = Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function localizedValue(value: unknown): LocalizedText {
  if (typeof value === "string") return { tr: value.trim(), en: value.trim(), ru: value.trim(), uz: value.trim() };
  if (!value || typeof value !== "object") return { tr: "", en: "", ru: "", uz: "" };
  const record = value as Record<string, unknown>;
  const tr = firstString([record.tr, record.en, record.ru, record.uz, record.all]);
  return {
    tr,
    en: firstString([record.en, tr]),
    ru: firstString([record.ru, tr]),
    uz: firstString([record.uz, tr])
  };
}

function firstString(values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && Boolean(value.trim()))?.trim() ?? "";
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item)) : [];
}

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function integerValue(value: unknown, fallback = 0) {
  return Math.floor(numberValue(value, fallback));
}

function timestampMillis(value: unknown) {
  if (value instanceof admin.firestore.Timestamp) return value.toMillis();
  return 0;
}

function uniqueValidIndices(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is number => Number.isInteger(item) && item >= 0 && item < TILE_COUNT))];
}

function hashString(value: string) {
  return [...value].reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0, 2166136261);
}

function seededShuffle<T>(items: T[], seed: string) {
  const next = [...items];
  let state = hashString(seed) || 1;
  for (let index = next.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const target = state % (index + 1);
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}
