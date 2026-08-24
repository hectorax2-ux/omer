import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import {
  normalizeJigsawPuzzle,
  pickActiveJigsawPuzzle,
  todayJigsawDayKey,
  type JigsawPuzzleInput
} from "../../../firebase/shared/jigsaw";
import { firestoreDb } from "@/src/services/firebase";

export type JigsawPuzzle = JigsawPuzzleInput;

export type PreparedJigsawGame = {
  puzzle: JigsawPuzzle;
  dayKey: string;
  ranked: boolean;
  practice: boolean;
  sessionId: string;
  status: "prepared" | "active" | "practice";
  startedAtMs?: number | null;
  serverNowMs: number;
};

const PUBLIC_JIGSAW_STATUSES = ["published", "scheduled"] as const;

export async function listPublicJigsawPuzzles(maxResults = 100) {
  const snapshot = await getDocs(query(
    collection(firestoreDb, "jigsawPuzzles"),
    where("status", "in", [...PUBLIC_JIGSAW_STATUSES]),
    limit(maxResults)
  ));
  return snapshot.docs.map((item) => normalizeJigsawPuzzle(item.id, item.data()));
}

export async function getJigsawPuzzleForDay(dayKey = todayJigsawDayKey()) {
  const puzzles = await listPublicJigsawPuzzles();
  return pickActiveJigsawPuzzle(puzzles.filter((puzzle) => !puzzle.dayKey || puzzle.dayKey === dayKey))
    ?? pickActiveJigsawPuzzle(puzzles);
}

export async function getActiveJigsawPuzzles() {
  const puzzle = await getJigsawPuzzleForDay(todayJigsawDayKey());
  return puzzle ? [puzzle] : [];
}

export async function prepareDailyJigsawGame() {
  const callable = httpsCallable<void, PreparedJigsawGame>(getFunctions(), "prepareDailyJigsawGame");
  const response = await callable();
  return {
    ...response.data,
    puzzle: normalizeJigsawPuzzle(response.data.puzzle.id, response.data.puzzle as unknown as Record<string, unknown>)
  };
}

export async function activateDailyJigsawGame(sessionId: string) {
  const callable = httpsCallable<{ sessionId: string }, { sessionId: string; startedAtMs: number; serverNowMs: number }>(
    getFunctions(),
    "activateDailyJigsawGame"
  );
  return (await callable({ sessionId })).data;
}

export async function completeDailyJigsawGame(input: {
  sessionId: string;
  selectedOptionIndex: number;
  revealedIndices: number[];
  elapsedSeconds: number;
  forcedZero?: boolean;
}) {
  const callable = httpsCallable<typeof input, {
    attemptId: string;
    score: number;
    correct: boolean;
    elapsedSeconds: number;
    revealedCount: number;
    dayKey: string;
  }>(getFunctions(), "completeDailyJigsawGame");
  return (await callable(input)).data;
}
