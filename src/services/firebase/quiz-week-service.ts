import { doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, where, collection } from "firebase/firestore";
import {
  QUIZ_ATTEMPTS_COLLECTION,
  buildDailyQuizDocumentId,
  buildWeeklyQuizDocumentId,
  normalizeWeeklyQuizQuestions
} from "../../../firebase/shared/quiz-week";
import { extractWeekPeriodId, getCompetitionWeekId } from "../../../firebase/shared/competition-week";
import { firestoreDb } from "@/src/services/firebase";
import type { QuizDocument } from "@/src/types/firestore";
import { getCompetitionSettings, resolveActiveWeekId } from "@/src/services/firebase/competition-week-service";
import { listAdminRankingKeys } from "@/src/services/firebase/user-service";
import { loadResourceCache, refreshResourceCache } from "@/src/services/cache/resource-cache";

const ACTIVE_WEEKLY_QUIZ_CACHE_KEY = "quiz:active-weekly";
const ACTIVE_DAILY_QUIZ_CACHE_KEY = "quiz:active-daily";

export type QuizAttemptRecord = {
  id: string;
  uid: string;
  weekId: string;
  quizId: string;
  score: number;
  displayName: string;
  username: string;
  completedAtMs: number;
};

function mapQuizDocument(id: string, data: Record<string, unknown>): QuizDocument {
  return {
    id,
    ...(data as Omit<QuizDocument, "id">),
    questions: normalizeWeeklyQuizQuestions(data.questions) as QuizDocument["questions"]
  };
}

export async function getWeeklyQuizPackByWeekId(weekId: string) {
  const periodId = extractWeekPeriodId(weekId);
  const directId = buildWeeklyQuizDocumentId(periodId);
  const direct = await getDoc(doc(firestoreDb, "quizzes", directId));
  if (direct.exists()) {
    const mapped = mapQuizDocument(direct.id, direct.data() as Record<string, unknown>);
    if (mapped.type === "weekly" && mapped.status === "published") return mapped;
  }
  const snapshot = await getDocs(query(
    collection(firestoreDb, "quizzes"),
    where("type", "==", "weekly"),
    where("weekId", "==", periodId),
    where("status", "==", "published"),
    limit(5)
  ));
  const match = snapshot.docs
    .map((item) => mapQuizDocument(item.id, item.data() as Record<string, unknown>))
    .sort((a, b) => (b.questions?.length ?? 0) - (a.questions?.length ?? 0))[0];
  return match ?? null;
}

export async function getActiveWeeklyQuizPack(force = false) {
  const cached = await loadResourceCache(ACTIVE_WEEKLY_QUIZ_CACHE_KEY, isQuizDocumentOrNull);
  try {
    return await refreshResourceCache(ACTIVE_WEEKLY_QUIZ_CACHE_KEY, loadActiveWeeklyQuizPack, force);
  } catch (error) {
    if (cached !== null) return cached;
    throw error;
  }
}

async function loadActiveWeeklyQuizPack() {
  const settings = await getCompetitionSettings().catch(() => null);
  const activeWeekId = resolveActiveWeekId(settings ?? undefined);
  const activePack = await getWeeklyQuizPackByWeekId(activeWeekId);
  if (activePack) return activePack;

  const snapshot = await getDocs(query(
    collection(firestoreDb, "quizzes"),
    where("type", "==", "weekly"),
    where("status", "==", "published"),
    limit(10)
  ));
  return snapshot.docs
    .map((item) => mapQuizDocument(item.id, item.data() as Record<string, unknown>))
    .sort((a, b) => extractWeekPeriodId(b.weekId || b.id).localeCompare(extractWeekPeriodId(a.weekId || a.id)))[0] ?? null;
}

export async function getDailyQuizPackByWeekId(weekId: string) {
  const periodId = extractWeekPeriodId(weekId);
  const directId = buildDailyQuizDocumentId(periodId);
  const direct = await getDoc(doc(firestoreDb, "quizzes", directId));
  if (direct.exists()) {
    const mapped = mapQuizDocument(direct.id, direct.data() as Record<string, unknown>);
    if (mapped.type === "daily" && mapped.status === "published") return mapped;
  }
  const snapshot = await getDocs(query(
    collection(firestoreDb, "quizzes"),
    where("type", "==", "daily"),
    where("weekId", "==", periodId),
    where("status", "==", "published"),
    limit(5)
  ));
  const match = snapshot.docs
    .map((item) => mapQuizDocument(item.id, item.data() as Record<string, unknown>))
    .sort((a, b) => (b.questions?.length ?? 0) - (a.questions?.length ?? 0))[0];
  return match ?? null;
}

export async function getActiveDailyQuizPack(force = false) {
  const cached = await loadResourceCache(ACTIVE_DAILY_QUIZ_CACHE_KEY, isQuizDocumentOrNull);
  try {
    return await refreshResourceCache(ACTIVE_DAILY_QUIZ_CACHE_KEY, async () => {
      const settings = await getCompetitionSettings().catch(() => null);
      const activeWeekId = resolveActiveWeekId(settings ?? undefined);
      return getDailyQuizPackByWeekId(activeWeekId);
    }, force);
  } catch (error) {
    if (cached !== null) return cached;
    throw error;
  }
}

export async function getUserQuizAttempt(uid: string, weekId: string) {
  if (!uid) return null;
  const periodId = extractWeekPeriodId(weekId);
  const attemptId = `${uid}_${periodId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const snapshot = await getDoc(doc(firestoreDb, QUIZ_ATTEMPTS_COLLECTION, attemptId));
  if (!snapshot.exists()) return null;
  const data = snapshot.data() as Record<string, unknown>;
  return {
    id: snapshot.id,
    uid: typeof data.uid === "string" ? data.uid : uid,
    weekId: typeof data.weekId === "string" ? data.weekId : periodId,
    quizId: typeof data.quizId === "string" ? data.quizId : "",
    score: typeof data.score === "number" ? data.score : Number(data.score) || 0,
    displayName: typeof data.displayName === "string" ? data.displayName : "",
    username: typeof data.username === "string" ? data.username : "",
    completedAtMs: typeof data.completedAtMs === "number" ? data.completedAtMs : Date.now()
  } satisfies QuizAttemptRecord;
}

export async function listUserQuizAttempts(uid: string, maxResults = 52) {
  if (!uid) return [] as QuizAttemptRecord[];
  const snapshot = await getDocs(query(
    collection(firestoreDb, QUIZ_ATTEMPTS_COLLECTION),
    where("uid", "==", uid),
    limit(maxResults)
  ));
  return snapshot.docs.map((item) => {
    const data = item.data() as Record<string, unknown>;
    return {
      id: item.id,
      uid,
      weekId: typeof data.weekId === "string" ? data.weekId : "",
      quizId: typeof data.quizId === "string" ? data.quizId : "",
      score: typeof data.score === "number" ? data.score : Number(data.score) || 0,
      displayName: typeof data.displayName === "string" ? data.displayName : "",
      username: typeof data.username === "string" ? data.username : "",
      completedAtMs: typeof data.completedAtMs === "number" ? data.completedAtMs : Date.now()
    } satisfies QuizAttemptRecord;
  });
}

export async function saveQuizAttempt(input: {
  uid: string;
  weekId: string;
  quizId: string;
  score: number;
  displayName: string;
  username: string;
}) {
  const periodId = extractWeekPeriodId(input.weekId);
  const attemptId = `${input.uid}_${periodId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
  const existing = await getDoc(doc(firestoreDb, QUIZ_ATTEMPTS_COLLECTION, attemptId));
  if (existing.exists()) {
    return existing.id;
  }
  await setDoc(doc(firestoreDb, QUIZ_ATTEMPTS_COLLECTION, attemptId), {
    uid: input.uid,
    weekId: periodId,
    quizId: input.quizId,
    score: input.score,
    displayName: input.displayName,
    username: input.username,
    completedAtMs: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return attemptId;
}

export async function listQuizLeaderboard(weekId: string, maxResults = 50) {
  const periodId = extractWeekPeriodId(weekId);
  const [snapshot, adminRankingKeys] = await Promise.all([
    getDocs(query(
      collection(firestoreDb, QUIZ_ATTEMPTS_COLLECTION),
      where("weekId", "==", periodId),
      limit(maxResults)
    )),
    listAdminRankingKeys().catch(() => new Set<string>())
  ]);
  return snapshot.docs
    .filter((item) => {
      const data = item.data() as Record<string, unknown>;
      const uid = typeof data.uid === "string" ? data.uid : "";
      const username = typeof data.username === "string" ? data.username.replace(/^@+/, "") : "";
      return !adminRankingKeys.has(uid) && !adminRankingKeys.has(username);
    })
    .map((item) => {
      const data = item.data() as Record<string, unknown>;
      return {
        name: typeof data.displayName === "string" ? data.displayName : "Art Atlas Üyesi",
        username: typeof data.username === "string" ? data.username : "",
        score: typeof data.score === "number" ? data.score : Number(data.score) || 0,
        city: ""
      };
    })
    .sort((a, b) => b.score - a.score);
}

export function resolveQuizWeekIdFromPack(pack: QuizDocument | null | undefined) {
  if (!pack) return getCompetitionWeekId();
  return extractWeekPeriodId(pack.weekId || pack.id);
}

export async function listRecentPublishedWeeklyQuizWeekIds(maxResults = 5) {
  const snapshot = await getDocs(query(
    collection(firestoreDb, "quizzes"),
    where("type", "==", "weekly"),
    where("status", "==", "published"),
    limit(30)
  ));
  return [...new Set(snapshot.docs.map((item) => {
    const data = item.data() as Record<string, unknown>;
    return extractWeekPeriodId(typeof data.weekId === "string" ? data.weekId : item.id);
  }))]
    .sort((a, b) => b.localeCompare(a))
    .slice(0, maxResults);
}

function isQuizDocumentOrNull(value: unknown): value is QuizDocument | null {
  if (value === null) return true;
  if (!value || typeof value !== "object") return false;
  const quiz = value as Partial<QuizDocument>;
  return typeof quiz.id === "string" && Array.isArray(quiz.questions);
}
