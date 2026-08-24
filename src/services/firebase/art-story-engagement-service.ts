import { collection, onSnapshot, query, where, type Unsubscribe } from "firebase/firestore";
import { firestoreDb } from "./core";
import { FavoriteDocument } from "@/src/types/firestore";
import { listUserReadsByTargetType, ReadDocument } from "./read-service";

export type ArtStoryEngagement = {
  favoriteIds: string[];
  readIds: string[];
};

export function subscribeUserArtStoryEngagement(
  uid: string,
  onChange: (engagement: ArtStoryEngagement) => void
): Unsubscribe {
  const next: ArtStoryEngagement = {
    favoriteIds: [],
    readIds: []
  };

  function publish() {
    onChange({
      favoriteIds: [...next.favoriteIds],
      readIds: [...next.readIds]
    });
  }

  const unsubscribers = [
    onSnapshot(
      query(collection(firestoreDb, "favorites"), where("userId", "==", uid)),
      (snapshot) => {
        next.favoriteIds = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() } as FavoriteDocument))
          .filter((item) => item.targetType === "artStory")
          .map((item) => item.targetId);
        publish();
      },
      () => {
        publish();
      }
    ),
    onSnapshot(
      query(collection(firestoreDb, "reads"), where("userId", "==", uid)),
      (snapshot) => {
        next.readIds = snapshot.docs
          .map((item) => ({ id: item.id, ...item.data() } as ReadDocument))
          .filter((item) => item.targetType === "artStory")
          .map((item) => item.targetId);
        publish();
      },
      () => {
        publish();
      }
    )
  ];

  return () => {
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
}

export async function listUserArtStoryReadIds(uid: string): Promise<string[]> {
  const reads = await listUserReadsByTargetType(uid, "artStory");
  return reads.map((item) => item.targetId);
}
