import { ArtistDocument } from "@/src/types/firestore";
import { createDocument, deleteDocument, firestoreQuery, getDocument, listDocuments, updateDocument } from "@/src/services/firebase/firestore-helpers";

export async function getArtistDocument(id: string): Promise<ArtistDocument | null> {
  return getDocument<ArtistDocument>("artists", id);
}

export async function listPublishedArtists(maxResults = 100): Promise<ArtistDocument[]> {
  return listDocuments<ArtistDocument>("artists", [
    firestoreQuery.where("status", "==", "published"),
    firestoreQuery.orderBy("updatedAt", "desc"),
    firestoreQuery.limit(maxResults)
  ]);
}

export async function createArtistDocument(input: Omit<ArtistDocument, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<string> {
  return createDocument<ArtistDocument>("artists", input);
}

export async function updateArtistDocument(id: string, input: Partial<Omit<ArtistDocument, "id" | "createdAt" | "updatedAt">>): Promise<void> {
  return updateDocument<ArtistDocument>("artists", id, input);
}

export async function deleteArtistDocument(id: string): Promise<void> {
  return deleteDocument("artists", id);
}
