import { ArtStoryDocument } from "@/src/types/firestore";
import {
  createDocument,
  deleteDocument,
  firestoreQuery,
  getDocument,
  listDocuments,
  updateDocument
} from "./firestore-helpers";

export type SubmitArtStoryInput = {
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  title: string;
  excerpt: string;
  body: string;
  imageURL: string;
  category?: NonNullable<ArtStoryDocument["category"]>;
};

export async function createArtStoryDocument(input: Omit<ArtStoryDocument, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  return createDocument<ArtStoryDocument>("artStories", input);
}

export async function getArtStoryDocument(id: string) {
  return getDocument<ArtStoryDocument>("artStories", id);
}

export async function listPublishedArtStories(maxResults = 100): Promise<ArtStoryDocument[]> {
  return listDocuments<ArtStoryDocument>("artStories", [
    firestoreQuery.where("status", "==", "published"),
    firestoreQuery.limit(maxResults)
  ]);
}

export async function listUserArtStorySubmissions(authorId: string, maxResults = 20): Promise<ArtStoryDocument[]> {
  return listDocuments<ArtStoryDocument>("artStories", [
    firestoreQuery.where("authorId", "==", authorId),
    firestoreQuery.limit(maxResults)
  ]);
}

export async function submitMemberArtStory(input: SubmitArtStoryInput): Promise<string> {
  const todayPrefix = new Date().toISOString().slice(0, 10);
  const todaySubmissions = await listDocuments<ArtStoryDocument>("artStories", [
    firestoreQuery.where("authorId", "==", input.authorId),
    firestoreQuery.limit(30)
  ]);
  const activeToday = todaySubmissions.filter((story) => {
    const maybeTimestamp = story.createdAt as { toDate?: () => Date };
    const createdAt = story.createdAt instanceof Date ? story.createdAt.toISOString() : maybeTimestamp?.toDate ? maybeTimestamp.toDate().toISOString() : String(story.createdAt ?? "");
    return createdAt.startsWith(todayPrefix) && story.status !== "rejected" && story.status !== "archived";
  });
  if (activeToday.length >= 3) {
    throw new Error("Günde en fazla 3 sanat yazısı isteği gönderebilirsiniz.");
  }
  return createArtStoryDocument({
    title: { tr: input.title },
    excerpt: { tr: input.excerpt },
    body: { tr: input.body },
    readTime: { tr: "4 dk" },
    imageURL: input.imageURL,
    image: input.imageURL,
    status: "pending",
    pinned: false,
    scheduledAt: null,
    publishedAt: null,
    source: "member",
    category: input.category ?? "other",
    authorId: input.authorId,
    authorUsername: input.authorUsername,
    authorDisplayName: input.authorDisplayName
  });
}

export async function updateArtStoryDocument(id: string, input: Partial<Omit<ArtStoryDocument, "id" | "createdAt" | "updatedAt">>) {
  return updateDocument<ArtStoryDocument>("artStories", id, input);
}

export async function deleteArtStoryDocument(id: string) {
  return deleteDocument("artStories", id);
}
