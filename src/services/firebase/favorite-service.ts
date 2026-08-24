import { doc, serverTimestamp, setDoc, deleteDoc } from "firebase/firestore";
import { firestoreDb } from "./core";
import { ContentType, FavoriteDocument } from "@/src/types/firestore";
import { firestoreQuery, listDocuments } from "@/src/services/firebase/firestore-helpers";

export function favoriteId(userId: string, targetType: ContentType, targetId: string) {
  return `${userId}_${targetType}_${targetId}`;
}

export async function setFavorite(userId: string, targetType: ContentType, targetId: string): Promise<void> {
  await setDoc(doc(firestoreDb, "favorites", favoriteId(userId, targetType, targetId)), {
    userId,
    targetType,
    targetId,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function removeFavorite(userId: string, targetType: ContentType, targetId: string): Promise<void> {
  await deleteDoc(doc(firestoreDb, "favorites", favoriteId(userId, targetType, targetId)));
}

export async function listUserFavorites(userId: string): Promise<FavoriteDocument[]> {
  return listDocuments<FavoriteDocument>("favorites", [
    firestoreQuery.where("userId", "==", userId)
  ]);
}

export async function listFavoritesByTargetType(targetType: ContentType, maxResults = 500): Promise<FavoriteDocument[]> {
  return listDocuments<FavoriteDocument>("favorites", [
    firestoreQuery.where("targetType", "==", targetType),
    firestoreQuery.limit(maxResults)
  ]);
}
