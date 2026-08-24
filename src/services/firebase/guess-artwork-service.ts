import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { isGuessArtworkLive, normalizeGuessArtwork, todayGuessArtworkDayKey, type GuessArtworkInput } from "../../../firebase/shared/guess-artwork";
import { firestoreDb } from "@/src/services/firebase";

export type GuessArtworkQuiz = GuessArtworkInput;

const PUBLIC_GUESS_STATUSES = ["published", "scheduled"] as const;

export async function listPublicGuessArtworkPuzzles(maxResults = 50) {
  const snapshot = await getDocs(query(
    collection(firestoreDb, "quizzes"),
    where("type", "==", "guessArtwork"),
    where("status", "in", [...PUBLIC_GUESS_STATUSES]),
    limit(maxResults)
  ));
  return snapshot.docs.map((item) => normalizeGuessArtwork(item.id, item.data() as Record<string, unknown>));
}

export async function getGuessArtworkForDay(dayKey = todayGuessArtworkDayKey()) {
  const puzzles = await listPublicGuessArtworkPuzzles();
  return puzzles
    .filter((puzzle) => puzzle.image && puzzle.title.tr && puzzle.dayKey === dayKey && isGuessArtworkLive(puzzle))
    .sort((a, b) => a.id.localeCompare(b.id))[0]
    ?? puzzles
      .filter((puzzle) => puzzle.image && puzzle.title.tr && isGuessArtworkLive(puzzle))
      .sort((a, b) => a.id.localeCompare(b.id))[0]
    ?? null;
}

export async function getTodayGuessArtwork() {
  return getGuessArtworkForDay(todayGuessArtworkDayKey());
}
