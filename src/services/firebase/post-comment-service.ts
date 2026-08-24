import {
  collection,
  limit,
  onSnapshot,
  query,
  type Unsubscribe
} from "firebase/firestore";
import { serverTimestamp } from "firebase/firestore";
import { FirestoreTimestamp, PostCommentDocument } from "@/src/types/firestore";
import { firestoreDb } from "@/src/services/firebase/core";
import { createDocument, firestoreQuery, listDocuments, updateDocument } from "@/src/services/firebase/firestore-helpers";

export const POST_COMMENTS_SUBSCRIBE_LIMIT = 500;

export async function createPostComment(input: Omit<PostCommentDocument, "id" | "createdAt" | "updatedAt">): Promise<string> {
  return createDocument<PostCommentDocument>("postComments", input);
}

export async function listPostComments(maxResults = 300): Promise<PostCommentDocument[]> {
  return listDocuments<PostCommentDocument>("postComments", [
    firestoreQuery.limit(maxResults)
  ]);
}

export function subscribePostComments(
  onChange: (comments: PostCommentDocument[]) => void,
  onError?: () => void
): Unsubscribe {
  return onSnapshot(
    query(collection(firestoreDb, "postComments"), limit(POST_COMMENTS_SUBSCRIBE_LIMIT)),
    (snapshot) => {
      onChange(snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as PostCommentDocument)));
    },
    () => onError?.()
  );
}

export async function updatePostComment(id: string, input: Partial<Omit<PostCommentDocument, "id" | "createdAt" | "updatedAt">>): Promise<void> {
  return updateDocument<PostCommentDocument>("postComments", id, input);
}

export async function editPostComment(id: string, text: string) {
  return updatePostComment(id, { text, editedAt: serverTimestamp() as FirestoreTimestamp });
}
