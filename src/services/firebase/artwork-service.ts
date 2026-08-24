import { ArtworkDocument } from "@/src/types/firestore";
import { createDocument, deleteDocument, firestoreQuery, getDocument, listDocuments, updateDocument } from "@/src/services/firebase/firestore-helpers";

export async function getArtworkDocument(id: string): Promise<ArtworkDocument | null> {
  return getDocument<ArtworkDocument>("artworks", id);
}

export async function listPublishedArtworks(maxResults = 50): Promise<ArtworkDocument[]> {
  return listDocuments<ArtworkDocument>("artworks", [
    firestoreQuery.where("status", "==", "published"),
    firestoreQuery.orderBy("updatedAt", "desc"),
    firestoreQuery.limit(maxResults)
  ]);
}

export async function listAllPublishedArtworks(): Promise<ArtworkDocument[]> {
  return listDocuments<ArtworkDocument>("artworks", [
    firestoreQuery.where("status", "==", "published"),
    firestoreQuery.orderBy("updatedAt", "desc")
  ]);
}

export async function createArtworkDocument(input: Omit<ArtworkDocument, "id" | "createdAt" | "updatedAt"> & { id?: string }): Promise<string> {
  return createDocument<ArtworkDocument>("artworks", input);
}

export async function updateArtworkDocument(id: string, input: Partial<Omit<ArtworkDocument, "id" | "createdAt" | "updatedAt">>): Promise<void> {
  return updateDocument<ArtworkDocument>("artworks", id, input);
}

export async function deleteArtworkDocument(id: string): Promise<void> {
  return deleteDocument("artworks", id);
}
