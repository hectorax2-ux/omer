import { collection, doc, onSnapshot, query, runTransaction, serverTimestamp, where } from "firebase/firestore";
import { firestoreDb } from "./core";
import { listDocuments, firestoreQuery } from "./firestore-helpers";

export type RatingTargetType = "bookFilm";

export type RatingSummary = {
  average: number;
  count: number;
};

export type UserRatingRecord = {
  id: string;
  targetType: RatingTargetType;
  targetId: string;
  value: number;
};

function ratingDocId(uid: string, targetType: RatingTargetType, targetId: string) {
  return `${uid}_${targetType}_${targetId}`;
}

function summaryDocId(targetType: RatingTargetType, targetId: string) {
  return `${targetType}_${targetId}`;
}

// One rating doc per user/target keeps the aggregate idempotent: re-rating updates the
// same row and the summary transaction only swaps the previous value for the new one.
export async function setUserRating(uid: string, targetType: RatingTargetType, targetId: string, value: number): Promise<void> {
  const clamped = Math.max(1, Math.min(10, Math.round(value)));
  const ratingRef = doc(firestoreDb, "ratings", ratingDocId(uid, targetType, targetId));
  const summaryRef = doc(firestoreDb, "ratingSummaries", summaryDocId(targetType, targetId));

  await runTransaction(firestoreDb, async (tx) => {
    const ratingSnap = await tx.get(ratingRef);
    const summarySnap = await tx.get(summaryRef);
    const previousValue = ratingSnap.exists() ? Number(ratingSnap.data().value) || 0 : 0;
    const previousSum = summarySnap.exists() ? Number(summarySnap.data().sum) || 0 : 0;
    const previousCount = summarySnap.exists() ? Number(summarySnap.data().count) || 0 : 0;
    const nextSum = Math.max(0, previousSum - previousValue + clamped);
    const nextCount = ratingSnap.exists() ? previousCount : previousCount + 1;

    tx.set(ratingRef, {
      uid,
      targetType,
      targetId,
      value: clamped,
      updatedAt: serverTimestamp(),
      createdAt: ratingSnap.exists() ? ratingSnap.data().createdAt ?? serverTimestamp() : serverTimestamp()
    });
    tx.set(summaryRef, {
      targetType,
      targetId,
      sum: nextSum,
      count: nextCount,
      updatedAt: serverTimestamp()
    });
  });
}

export function subscribeRatingSummaries(
  targetType: RatingTargetType,
  onChange: (summaries: Record<string, RatingSummary>) => void
) {
  return onSnapshot(
    query(collection(firestoreDb, "ratingSummaries"), where("targetType", "==", targetType)),
    (snapshot) => {
      const map: Record<string, RatingSummary> = {};
      snapshot.docs.forEach((item) => {
        const data = item.data();
        const count = Number(data.count) || 0;
        const sum = Number(data.sum) || 0;
        map[String(data.targetId)] = { average: count > 0 ? sum / count : 0, count };
      });
      onChange(map);
    },
    () => onChange({})
  );
}

export async function listUserRatings(uid: string, targetType: RatingTargetType): Promise<UserRatingRecord[]> {
  if (!uid) return [];
  const records = await listDocuments<UserRatingRecord & { uid: string }>("ratings", [
    firestoreQuery.where("uid", "==", uid),
    firestoreQuery.where("targetType", "==", targetType),
    firestoreQuery.limit(500)
  ]);
  return records.map((item) => ({ id: item.id, targetType, targetId: item.targetId, value: Number(item.value) || 0 }));
}
