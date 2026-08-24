import { collection, doc, onSnapshot, runTransaction, serverTimestamp } from "firebase/firestore";
import { firestoreDb } from "./core";
import { listDocuments, firestoreQuery } from "./firestore-helpers";

export const SUPER_LIKE_WEEKLY_LIMIT = 5;

export type SuperLikeRecord = {
  id: string;
  uid: string;
  targetId: string;
  weekId: string;
};

function superLikeDocId(uid: string, targetId: string) {
  return `${uid}_${targetId}`;
}

// A Super Like is a one-time premium action per artwork. The per-user/target doc id keeps it
// idempotent and the summary transaction increments the shared count exactly once.
export async function addSuperLike(uid: string, targetId: string, weekId: string): Promise<void> {
  const likeRef = doc(firestoreDb, "superLikes", superLikeDocId(uid, targetId));
  const summaryRef = doc(firestoreDb, "superLikeSummaries", targetId);

  await runTransaction(firestoreDb, async (tx) => {
    const likeSnap = await tx.get(likeRef);
    if (likeSnap.exists()) return;
    const summarySnap = await tx.get(summaryRef);
    const previousCount = summarySnap.exists() ? Number(summarySnap.data().count) || 0 : 0;
    tx.set(likeRef, { uid, targetId, weekId, createdAt: serverTimestamp() });
    tx.set(summaryRef, { targetId, count: previousCount + 1, updatedAt: serverTimestamp() });
  });
}

// Super Like is toggleable like a normal like: removing it frees the weekly quota slot and
// decrements the shared count so it can be re-spent on another artwork in the same week.
export async function removeSuperLike(uid: string, targetId: string): Promise<void> {
  const likeRef = doc(firestoreDb, "superLikes", superLikeDocId(uid, targetId));
  const summaryRef = doc(firestoreDb, "superLikeSummaries", targetId);

  await runTransaction(firestoreDb, async (tx) => {
    const likeSnap = await tx.get(likeRef);
    if (!likeSnap.exists()) return;
    const summarySnap = await tx.get(summaryRef);
    const previousCount = summarySnap.exists() ? Number(summarySnap.data().count) || 0 : 0;
    tx.delete(likeRef);
    tx.set(summaryRef, { targetId, count: Math.max(0, previousCount - 1), updatedAt: serverTimestamp() });
  });
}

export function subscribeSuperLikeSummaries(onChange: (counts: Record<string, number>) => void) {
  return onSnapshot(
    collection(firestoreDb, "superLikeSummaries"),
    (snapshot) => {
      const map: Record<string, number> = {};
      snapshot.docs.forEach((item) => {
        map[item.id] = Number(item.data().count) || 0;
      });
      onChange(map);
    },
    () => onChange({})
  );
}

export async function listUserSuperLikes(uid: string): Promise<SuperLikeRecord[]> {
  if (!uid) return [];
  const records = await listDocuments<SuperLikeRecord & { uid: string }>("superLikes", [
    firestoreQuery.where("uid", "==", uid),
    firestoreQuery.limit(500)
  ]);
  return records.map((item) => ({ id: item.id, uid, targetId: item.targetId, weekId: item.weekId }));
}
