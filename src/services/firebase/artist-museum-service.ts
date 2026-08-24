import { ArtistDocument, MuseumDocument } from "@/src/types/firestore";
import { createDocument, deleteDocument, firestoreQuery, getDocument, listDocuments, updateDocument } from "@/src/services/firebase/firestore-helpers";

export async function getArtistDocument(id: string): Promise<ArtistDocument | null> {
  return getDocument<ArtistDocument>("artists", id);
}

export async function listPublishedArtists(maxResults = 50): Promise<ArtistDocument[]> {
  return listDocuments<ArtistDocument>("artists", [
    firestoreQuery.where("status", "==", "published"),
    firestoreQuery.orderBy("pinned", "desc"),
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

export async function getMuseumDocument(id: string): Promise<MuseumDocument | null> {
  return getDocument<MuseumDocument>("museums", id);
}

export async function listPublishedMuseums(maxResults = 50): Promise<MuseumDocument[]> {
  return listDocuments<MuseumDocument>("museums", [
    firestoreQuery.where("status", "==", "published"),
    firestoreQuery.orderBy("pinned", "desc"),
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
