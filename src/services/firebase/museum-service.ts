import { MuseumDocument } from "@/src/types/firestore";
import { createDocument, deleteDocument, firestoreQuery, getDocument, listDocuments, updateDocument } from "@/src/services/firebase/firestore-helpers";

export async function getMuseumDocument(id: string): Promise<MuseumDocument | null> {
  return getDocument<MuseumDocument>("museums", id);
}

export async function listPublishedMuseums(maxResults = 100): Promise<MuseumDocument[]> {
  return listDocuments<MuseumDocument>("museums", [
    firestoreQuery.where("status", "==", "published"),
    firestoreQuery.limit(maxResults)
  ]);
}

export async function createMuseumDocument(input: Omit<MuseumDocument, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<string> {
  return createDocument<MuseumDocument>("museums", input);
}

export async function updateMuseumDocument(id: string, input: Partial<Omit<MuseumDocument, "id" | "createdAt" | "updatedAt">>): Promise<void> {
  return updateDocument<MuseumDocument>("museums", id, input);
}

export async function deleteMuseumDocument(id: string): Promise<void> {
  return deleteDocument("museums", id);
}
