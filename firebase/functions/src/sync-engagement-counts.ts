import { FieldValue } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";

type LikeDoc = {
  targetType?: string;
  targetId?: string;
  value?: "like" | "dislike";
};

type FavoriteDoc = {
  targetType?: string;
  targetId?: string;
};

function targetCollection(targetType: string) {
  if (targetType === "post") return "posts";
  if (targetType === "communityImage") return "communityImages";
  if (targetType === "bookFilm") return "bookFilms";
  return null;
}

async function countReactions(targetType: string, targetId: string) {
  const snapshot = await getFirestore().collection("likes")
    .where("targetType", "==", targetType)
    .where("targetId", "==", targetId)
    .get();
  let like = 0;
  let dislike = 0;
  snapshot.docs.forEach((item) => {
    const value = item.data().value;
    if (value === "like") like += 1;
    if (value === "dislike") dislike += 1;
  });
  return { like, dislike };
}

export const syncLikeCounts = onDocumentWritten("likes/{likeId}", async (event) => {
  const before = event.data?.before?.data() as LikeDoc | undefined;
  const after = event.data?.after?.data() as LikeDoc | undefined;
  const targetType = after?.targetType ?? before?.targetType;
  const targetId = after?.targetId ?? before?.targetId;
  if (!targetType || !targetId) return;

  const collection = targetCollection(targetType);
  if (!collection) return;

  const counts = await countReactions(targetType, targetId);
  const updates: Record<string, unknown> = {
    updatedAt: FieldValue.serverTimestamp()
  };

  if (targetType === "post") {
    updates.likeCount = counts.like;
  }

  if (targetType === "communityImage") {
    updates.likeCount = counts.like;
    updates.dislikeCount = counts.dislike;
    updates.netScore = counts.like - counts.dislike;
  }

  if (targetType === "bookFilm") {
    updates.voteCount = counts.like;
  }

  await getFirestore().doc(`${collection}/${targetId}`).set(updates, { merge: true });
  logger.info("Like counts synced", { targetType, targetId, counts });
});

export const syncFavoriteCounts = onDocumentWritten("favorites/{favoriteId}", async (event) => {
  const before = event.data?.before?.data() as FavoriteDoc | undefined;
  const after = event.data?.after?.data() as FavoriteDoc | undefined;
  const targetType = after?.targetType ?? before?.targetType;
  const targetId = after?.targetId ?? before?.targetId;
  if (!targetType || !targetId || targetType !== "post") return;

  const created = !before && Boolean(after);
  const removed = Boolean(before) && !after;
  if (!created && !removed) return;

  const delta = created ? 1 : -1;
  await getFirestore().doc(`posts/${targetId}`).set({
    favoriteCount: FieldValue.increment(delta),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  logger.info("Favorite count synced", { targetId, delta });
});
