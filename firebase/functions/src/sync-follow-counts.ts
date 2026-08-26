import { FieldValue } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";

type FollowDoc = {
  followerId?: string;
  followedId?: string;
};

export const syncUserFollowCounts = onDocumentWritten("userFollows/{followId}", async (event) => {
  const before = event.data?.before?.data() as FollowDoc | undefined;
  const after = event.data?.after?.data() as FollowDoc | undefined;
  const db = getFirestore();

  if (!before && after?.followerId && after.followedId) {
    await Promise.all([
      db.doc(`users/${after.followedId}`).set({ followersCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
      db.doc(`users/${after.followerId}`).set({ followingCount: FieldValue.increment(1), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    ]);
    logger.info("Follow counts incremented", { followerId: after.followerId, followedId: after.followedId });
    return;
  }

  if (before?.followerId && before.followedId && !after) {
    await Promise.all([
      db.doc(`users/${before.followedId}`).set({ followersCount: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() }, { merge: true }),
      db.doc(`users/${before.followerId}`).set({ followingCount: FieldValue.increment(-1), updatedAt: FieldValue.serverTimestamp() }, { merge: true })
    ]);
    logger.info("Follow counts decremented", { followerId: before.followerId, followedId: before.followedId });
  }
});
