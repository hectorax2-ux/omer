import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc } from "firebase/firestore";
import {
  buildGuessArtworkAttemptId,
  GUESS_ARTWORK_ATTEMPTS_COLLECTION,
  normalizeGuessArtworkAttemptFromFirebase,
  todayGuessArtworkAttemptDayKey,
  type NormalizedGuessArtworkAttempt
} from "../../../firebase/shared/guess-artwork-attempts";
import { firestoreDb } from "@/src/services/firebase";

export type GuessArtworkAttemptRecord = NormalizedGuessArtworkAttempt;

export async function getUserGuessArtworkAttempt(uid: string, dayKey = todayGuessArtworkAttemptDayKey()) {
  if (!uid) return null;
  const attemptId = buildGuessArtworkAttemptId(uid, dayKey);
  const snapshot = await getDoc(doc(firestoreDb, GUESS_ARTWORK_ATTEMPTS_COLLECTION, attemptId));
  if (!snapshot.exists()) return null;
  return normalizeGuessArtworkAttemptFromFirebase(snapshot.id, snapshot.data() as Record<string, unknown>);
}

export async function saveGuessArtworkAttempt(input: {
  uid: string;
  username: string;
  displayName: string;
  score: number;
  dayKey?: string;
  countryCode?: string;
}) {
  const dayKey = input.dayKey || todayGuessArtworkAttemptDayKey();
  const attemptId = buildGuessArtworkAttemptId(input.uid, dayKey);
  const existing = await getDoc(doc(firestoreDb, GUESS_ARTWORK_ATTEMPTS_COLLECTION, attemptId));
  if (existing.exists()) {
    return existing.id;
  }
  await setDoc(doc(firestoreDb, GUESS_ARTWORK_ATTEMPTS_COLLECTION, attemptId), {
    uid: input.uid,
    username: input.username,
    displayName: input.displayName,
    score: input.score,
    dayKey,
    countryCode: input.countryCode ?? "",
    completedAtMs: Date.now(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return attemptId;
}

export async function listGuessArtworkAttempts(maxResults = 500) {
  const snapshot = await getDocs(query(
    collection(firestoreDb, GUESS_ARTWORK_ATTEMPTS_COLLECTION),
    limit(maxResults)
  ));
  return snapshot.docs
    .map((item) => normalizeGuessArtworkAttemptFromFirebase(item.id, item.data() as Record<string, unknown>))
    .filter((item): item is GuessArtworkAttemptRecord => Boolean(item))
    .sort((a, b) => b.completedAtMs - a.completedAtMs);
}
