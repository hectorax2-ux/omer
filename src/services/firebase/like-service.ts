import { deleteDoc, doc, serverTimestamp, setDoc } from "firebase/firestore";
import { firestoreDb } from "./core";
import { ContentType, LikeDocument, ReactionValue } from "@/src/types/firestore";
import { firestoreQuery, listDocuments } from "@/src/services/firebase/firestore-helpers";

export function likeId(userId: string, targetType: ContentType, targetId: string) {
  return `${userId}_${targetType}_${targetId}`;
}

export async function setReaction(userId: string, targetType: ContentType, targetId: string, value: ReactionValue): Promise<void> {
  await setDoc(doc(firestoreDb, "likes", likeId(userId, targetType, targetId)), {
    userId,
    targetType,
    targetId,
    value,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function removeReaction(userId: string, targetType: ContentType, targetId: string): Promise<void> {
  await deleteDoc(doc(firestoreDb, "likes", likeId(userId, targetType, targetId)));
}

export async function listUserReactions(userId: string): Promise<LikeDocument[]> {
  return listDocuments<LikeDocument>("likes", [
    firestoreQuery.where("userId", "==", userId)
  ]);
}

export async function listReactionsByTargetType(targetType: ContentType, maxResults = 500): Promise<LikeDocument[]> {
  return listDocuments<LikeDocument>("likes", [
    firestoreQuery.where("targetType", "==", targetType),
    firestoreQuery.limit(maxResults)
  ]);
}

export async function listReactionsForTarget(targetType: ContentType, targetId: string, value: ReactionValue = "like") {
  const reactions = await listDocuments<LikeDocument>("likes", [
    firestoreQuery.where("targetType", "==", targetType),
    firestoreQuery.where("targetId", "==", targetId)
  ]);
  return reactions.filter((item) => item.value === value);
}

export async function countTargetReactions(targetType: ContentType, targetId: string, value: ReactionValue = "like") {
  const reactions = await listDocuments<LikeDocument>("likes", [
    firestoreQuery.where("targetType", "==", targetType),
    firestoreQuery.where("targetId", "==", targetId)
  ]);
  return reactions.filter((item) => item.value === value).length;
}
