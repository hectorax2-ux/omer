import { deleteDoc, doc, getDocs, query, serverTimestamp, setDoc, where, collection } from "firebase/firestore";
import { firestoreDb } from "./core";
import { ContentType } from "@/src/types/firestore";

export type ReadDocument = {
  id: string;
  uid?: string;
  userId: string;
  targetType: ContentType;
  targetId: string;
  createdAt?: unknown;
  updatedAt?: unknown;
};

export function readId(userId: string, targetType: ContentType, targetId: string) {
  return `${userId}_${targetType}_${targetId}`;
}

export async function markRead(userId: string, targetType: ContentType, targetId: string): Promise<void> {
  await setDoc(doc(firestoreDb, "reads", readId(userId, targetType, targetId)), {
    uid: userId,
    userId,
    targetType,
    targetId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function removeRead(userId: string, targetType: ContentType, targetId: string): Promise<void> {
  await deleteDoc(doc(firestoreDb, "reads", readId(userId, targetType, targetId)));
}

export async function listUserReads(userId: string): Promise<ReadDocument[]> {
  const snapshots = await Promise.allSettled([
    getDocs(query(
      collection(firestoreDb, "reads"),
      where("userId", "==", userId)
    )),
    getDocs(query(
      collection(firestoreDb, "reads"),
      where("uid", "==", userId)
    ))
  ]);
  return snapshots
    .filter((item) => item.status === "fulfilled")
    .flatMap((item) => item.value.docs)
    .map((item) => ({ id: item.id, ...item.data() } as ReadDocument))
    .filter((item, index, items) => items.findIndex((candidate) => candidate.id === item.id) === index);
}

export async function listUserReadsByTargetType(userId: string, targetType: ContentType): Promise<ReadDocument[]> {
  const reads = await listUserReads(userId);
  return reads.filter((item) => item.targetType === targetType);
}
