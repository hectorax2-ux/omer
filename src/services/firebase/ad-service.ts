import { AdDocument } from "@/src/types/firestore";
import { createDocument, deleteDocument, firestoreQuery, getDocument, listDocuments, updateDocument } from "@/src/services/firebase/firestore-helpers";

export async function getAdDocument(id: string): Promise<AdDocument | null> {
  return getDocument<AdDocument>("ads", id);
}

export async function listActiveAds(placement?: AdDocument["placement"], maxResults = 20): Promise<AdDocument[]> {
  return listDocuments<AdDocument>("ads", [
    firestoreQuery.where("status", "==", "published"),
    ...(placement ? [firestoreQuery.where("placement", "==", placement)] : []),
    firestoreQuery.orderBy("pinned", "desc"),
    firestoreQuery.limit(maxResults)
  ]);
}

export async function createAdDocument(input: Omit<AdDocument, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<string> {
  return createDocument<AdDocument>("ads", input);
}

export async function updateAdDocument(id: string, input: Partial<Omit<AdDocument, "id" | "createdAt" | "updatedAt">>): Promise<void> {
  return updateDocument<AdDocument>("ads", id, input);
}

export async function deleteAdDocument(id: string): Promise<void> {
  return deleteDocument("ads", id);
}
