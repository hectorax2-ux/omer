import { collection, doc, getDoc, getDocs, limit, query, serverTimestamp, setDoc, where } from "firebase/firestore";
import {
  buildJigsawAttemptId,
  JIGSAW_ATTEMPTS_COLLECTION,
  normalizeJigsawAttemptFromFirebase,
  todayJigsawDayKey,
  type NormalizedJigsawAttempt
} from "../../../firebase/shared/jigsaw-attempts";
import { firestoreDb } from "@/src/services/firebase";

export type JigsawAttemptRecord = NormalizedJigsawAttempt;

export async function getUserJigsawAttempt(uid: string, dayKey = todayJigsawDayKey()) {
  if (!uid) return null;
  const attemptId = buildJigsawAttemptId(uid, dayKey);
  const snapshot = await getDoc(doc(firestoreDb, JIGSAW_ATTEMPTS_COLLECTION, attemptId));
  if (!snapshot.exists()) return null;
  return normalizeJigsawAttemptFromFirebase(snapshot.id, snapshot.data() as Record<string, unknown>);
}

export async function saveJigsawAttempt(input: {
  uid: string;
  username: string;
  displayName: string;
  score: number;
  dayKey?: string;
  countryCode?: string;
}) {
  const dayKey = input.dayKey || todayJigsawDayKey();
  const attemptId = buildJigsawAttemptId(input.uid, dayKey);
  const existing = await getDoc(doc(firestoreDb, JIGSAW_ATTEMPTS_COLLECTION, attemptId));
  if (existing.exists()) {
    return existing.id;
  }
  await setDoc(doc(firestoreDb, JIGSAW_ATTEMPTS_COLLECTION, attemptId), {
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

export async function listJigsawAttempts(maxResults = 500) {
  const snapshot = await getDocs(query(
    collection(firestoreDb, JIGSAW_ATTEMPTS_COLLECTION),
    limit(maxResults)
  ));
  return snapshot.docs
    .map((item) => normalizeJigsawAttemptFromFirebase(item.id, item.data() as Record<string, unknown>))
    .filter((item): item is JigsawAttemptRecord => Boolean(item))
    .sort((a, b) => b.completedAtMs - a.completedAtMs);
}

export async function listUserJigsawAttempts(uid: string, maxResults = 200) {
  if (!uid) return [] as JigsawAttemptRecord[];
  const snapshot = await getDocs(query(
    collection(firestoreDb, JIGSAW_ATTEMPTS_COLLECTION),
    where("uid", "==", uid),
    limit(maxResults)
  ));
  return snapshot.docs
    .map((item) => normalizeJigsawAttemptFromFirebase(item.id, item.data() as Record<string, unknown>))
    .filter((item): item is JigsawAttemptRecord => Boolean(item));
}
