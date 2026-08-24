import { CommunityImageCommentDocument } from "@/src/types/firestore";
import { createDocument, firestoreQuery, listDocuments, updateDocument } from "@/src/services/firebase/firestore-helpers";

export async function createCommunityImageComment(
  input: Omit<CommunityImageCommentDocument, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  return createDocument<CommunityImageCommentDocument>("communityImageComments", input);
}

export async function listCommunityImageComments(maxResults = 500): Promise<CommunityImageCommentDocument[]> {
  return listDocuments<CommunityImageCommentDocument>("communityImageComments", [firestoreQuery.limit(maxResults)]);
}

export async function updateCommunityImageComment(
  id: string,
  input: Partial<Omit<CommunityImageCommentDocument, "id" | "createdAt" | "updatedAt">>
): Promise<void> {
  return updateDocument<CommunityImageCommentDocument>("communityImageComments", id, input);
}
