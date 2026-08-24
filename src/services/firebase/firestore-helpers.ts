import {
  DocumentData,
  QueryConstraint,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from "firebase/firestore";
import { firestoreDb } from "./core";

export type CreateInput<T extends { id: string; createdAt: unknown; updatedAt: unknown }> =
  Omit<T, "id" | "createdAt" | "updatedAt"> & Partial<Pick<T, "id">>;

export type UpdateInput<T extends { id: string; createdAt: unknown; updatedAt: unknown }> =
  Partial<Omit<T, "id" | "createdAt" | "updatedAt">>;

export function withId<T>(id: string, data: DocumentData): T {
  return { id, ...data } as T;
}

export async function getDocument<T>(collectionName: string, id: string): Promise<T | null> {
  const snapshot = await getDoc(doc(firestoreDb, collectionName, id));
  return snapshot.exists() ? withId<T>(snapshot.id, snapshot.data()) : null;
}

export async function createDocument<T extends { id: string; createdAt: unknown; updatedAt: unknown }>(
  collectionName: string,
  input: CreateInput<T>
): Promise<string> {
  const payload = {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  if (input.id) {
    await setDoc(doc(firestoreDb, collectionName, input.id), payload);
    return input.id;
  }

  const reference = await addDoc(collection(firestoreDb, collectionName), payload);
  return reference.id;
}

export async function updateDocument<T extends { id: string; createdAt: unknown; updatedAt: unknown }>(
  collectionName: string,
  id: string,
  input: UpdateInput<T>
): Promise<void> {
  await updateDoc(doc(firestoreDb, collectionName, id), {
    ...input,
    updatedAt: serverTimestamp()
  });
}

export async function deleteDocument(collectionName: string, id: string): Promise<void> {
  await deleteDoc(doc(firestoreDb, collectionName, id));
}

export async function listDocuments<T>(collectionName: string, constraints: QueryConstraint[] = []): Promise<T[]> {
  const snapshot = await getDocs(query(collection(firestoreDb, collectionName), ...constraints));
  return snapshot.docs.map((item) => withId<T>(item.id, item.data()));
}

export const firestoreQuery = {
  where,
  orderBy,
  limit
};
