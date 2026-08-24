import {
  collection,
  DocumentData,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  FieldValue,
  QueryDocumentSnapshot,
  serverTimestamp,
  startAfter,
  Unsubscribe
} from "firebase/firestore";
import { PostDocument } from "@/src/types/firestore";
import { createDocument, deleteDocument, firestoreQuery, getDocument, listDocuments, updateDocument } from "@/src/services/firebase/firestore-helpers";
import { firestoreDb } from "@/src/services/firebase/core";

export const PUBLISHED_POSTS_PAGE_SIZE = 60;

export function isFeedVisiblePost(post: Pick<PostDocument, "status">) {
  // Legacy documents without a status were public before moderation was introduced.
  return !post.status || post.status === "published";
}

export type PublishedPostsPage = {
  posts: PostDocument[];
  cursor: QueryDocumentSnapshot<DocumentData> | null;
  hasMore: boolean;
};

export function subscribePublishedPosts(
  pageSize: number,
  onChange: (page: PublishedPostsPage) => void,
  onError?: (error: unknown) => void
): Unsubscribe {
  return onSnapshot(
    query(
      collection(firestoreDb, "posts"),
      orderBy("createdAt", "desc"),
      limit(pageSize)
    ),
    (snapshot) => {
      const posts = snapshot.docs
        .map((item) => ({ id: item.id, ...item.data() } as PostDocument))
        .filter(isFeedVisiblePost);
      const cursor = snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null;
      onChange({
        posts,
        cursor,
        hasMore: snapshot.docs.length === pageSize
      });
    },
    (error) => onError?.(error)
  );
}

export async function listAllFeedPostsFallback(maxResults = 200): Promise<PostDocument[]> {
  try {
    const ordered = await getDocs(query(collection(firestoreDb, "posts"), orderBy("createdAt", "desc"), limit(maxResults)));
    const posts = ordered.docs
      .map((item) => ({ id: item.id, ...item.data() } as PostDocument))
      .filter(isFeedVisiblePost);
    if (posts.length) {
      return posts.sort((a, b) => postCreatedAtMs(b) - postCreatedAtMs(a));
    }
  } catch (error) {
    if (__DEV__) console.warn("[posts] ordered feed fallback", error);
    // Fall back to an unordered scan when createdAt ordering is unavailable.
  }

  const snapshot = await getDocs(query(collection(firestoreDb, "posts"), limit(maxResults)));
  return snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() } as PostDocument))
    .filter(isFeedVisiblePost)
    .sort((a, b) => postCreatedAtMs(b) - postCreatedAtMs(a));
}

export async function listPublishedPostsPage(
  pageSize = PUBLISHED_POSTS_PAGE_SIZE,
  cursor?: QueryDocumentSnapshot<DocumentData> | null
): Promise<PublishedPostsPage> {
  try {
    const constraints = [
      orderBy("createdAt", "desc"),
      ...(cursor ? [startAfter(cursor)] : []),
      limit(pageSize)
    ];
    const snapshot = await getDocs(query(collection(firestoreDb, "posts"), ...constraints));
    const posts = snapshot.docs
      .map((item) => ({ id: item.id, ...item.data() } as PostDocument))
      .filter(isFeedVisiblePost);
    const nextCursor = snapshot.docs.length ? snapshot.docs[snapshot.docs.length - 1] : null;
    return {
      posts,
      cursor: nextCursor,
      hasMore: snapshot.docs.length === pageSize
    };
  } catch (error) {
    if (__DEV__) console.warn("[posts] paged feed fallback", error);
    const legacy = await listAllFeedPostsFallback(pageSize);
    return {
      posts: legacy,
      cursor: null,
      hasMore: legacy.length === pageSize
    };
  }
}

function postCreatedAtMs(post: PostDocument) {
  if (post.createdAt && typeof post.createdAt === "object" && "toMillis" in post.createdAt && typeof post.createdAt.toMillis === "function") {
    return post.createdAt.toMillis();
  }
  if (post.publishedAt && typeof post.publishedAt === "object" && "toMillis" in post.publishedAt && typeof post.publishedAt.toMillis === "function") {
    return post.publishedAt.toMillis();
  }
  return 0;
}

type PostWriteTimestamps = {
  scheduledAt?: PostDocument["scheduledAt"] | FieldValue;
  publishedAt?: PostDocument["publishedAt"] | FieldValue;
};

export async function createPostDocument(
  input: Omit<PostDocument, "id" | "createdAt" | "updatedAt" | "likeCount" | "favoriteCount" | "scheduledAt" | "publishedAt"> &
    PostWriteTimestamps & { id?: string }
): Promise<string> {
  return createDocument<PostDocument>("posts", {
    ...input,
    likeCount: 0,
    favoriteCount: 0
  } as Parameters<typeof createDocument<PostDocument>>[1]);
}

export async function getPostDocument(id: string): Promise<PostDocument | null> {
  return getDocument<PostDocument>("posts", id);
}

export async function listPublishedPosts(language: PostDocument["language"], maxResults = 20): Promise<PostDocument[]> {
  const posts = await listAllFeedPostsFallback(maxResults * 3);
  return posts.filter((post) => post.language === language).slice(0, maxResults);
}

export async function listRecentPublishedPosts(maxResults = 100): Promise<PostDocument[]> {
  const page = await listPublishedPostsPage(maxResults);
  return page.posts;
}

export async function updatePostDocument(
  id: string,
  input: Partial<Omit<PostDocument, "id" | "createdAt" | "updatedAt" | "scheduledAt" | "publishedAt">> & PostWriteTimestamps
): Promise<void> {
  return updateDocument<PostDocument>("posts", id, input as Parameters<typeof updateDocument<PostDocument>>[2]);
}

export async function listAuthorPosts(authorId: string, maxResults = 40): Promise<PostDocument[]> {
  if (!authorId) return [];
  return listDocuments<PostDocument>("posts", [
    firestoreQuery.where("authorId", "==", authorId),
    firestoreQuery.limit(maxResults)
  ]).then((posts) => posts
    .filter((post) => post.status !== "removed" && post.status !== "archived")
    .sort((a, b) => postCreatedAtMs(b) - postCreatedAtMs(a)));
}

export async function promoteAuthorPendingPosts(authorId: string): Promise<void> {
  if (!authorId) return;
  const pending = await listDocuments<PostDocument>("posts", [
    firestoreQuery.where("authorId", "==", authorId),
    firestoreQuery.where("status", "==", "pending"),
    firestoreQuery.limit(100)
  ]);
  await Promise.all(
    pending.map((post) =>
      updatePostDocument(post.id, { status: "published", publishedAt: serverTimestamp() }).catch((error) => {
        if (__DEV__) console.warn("[posts] pending post promotion failed", post.id, error);
      })
    )
  );
}

export async function deletePostDocument(id: string): Promise<void> {
  return deleteDocument("posts", id);
}
