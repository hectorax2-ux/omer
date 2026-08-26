import * as admin from "firebase-admin";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger } from "firebase-functions";

const db = admin.firestore();
const bucket = admin.storage().bucket();

const BATCH_LIMIT = 400;

async function commitBatch(batch: admin.firestore.WriteBatch, pending: number): Promise<admin.firestore.WriteBatch> {
  if (pending >= BATCH_LIMIT) {
    await batch.commit();
    return db.batch();
  }
  return batch;
}

async function deleteQueryDocs(query: admin.firestore.Query): Promise<number> {
  let deleted = 0;
  let batch = db.batch();
  let pending = 0;

  const snapshot = await query.get();
  for (const docSnap of snapshot.docs) {
    batch.delete(docSnap.ref);
    pending += 1;
    deleted += 1;
    batch = await commitBatch(batch, pending);
    if (pending >= BATCH_LIMIT) {
      pending = 0;
    }
  }

  if (pending > 0) {
    await batch.commit();
  }

  return deleted;
}

async function deleteTopLevelWhere(collectionName: string, field: string, value: string): Promise<number> {
  return deleteQueryDocs(db.collection(collectionName).where(field, "==", value));
}

async function deleteDocIfExists(path: string): Promise<void> {
  const ref = db.doc(path);
  const snap = await ref.get();
  if (snap.exists) {
    await ref.delete();
  }
}

async function deleteUserStorage(uid: string): Promise<void> {
  try {
    await bucket.deleteFiles({ prefix: `users/${uid}/` });
  } catch (error) {
    logger.warn("Storage cleanup partial failure", { uid, error });
  }
}

async function deleteDuelVotes(uid: string): Promise<number> {
  let deleted = 0;
  const duels = await db.collection("duels").select().get();
  for (const duel of duels.docs) {
    const voteRef = duel.ref.collection("votes").doc(uid);
    const voteSnap = await voteRef.get();
    if (voteSnap.exists) {
      await voteRef.delete();
      deleted += 1;
    }
  }
  return deleted;
}

async function deleteProphecyPredictions(uid: string): Promise<number> {
  let deleted = 0;
  const weeks = await db.collection("prophecyWeeks").select().get();
  for (const week of weeks.docs) {
    const predictionRef = week.ref.collection("predictions").doc(uid);
    const predictionSnap = await predictionRef.get();
    if (predictionSnap.exists) {
      await predictionRef.delete();
      deleted += 1;
    }
  }
  return deleted;
}

async function deleteProfileVisitData(uid: string): Promise<number> {
  const summariesRef = db.doc(`profileVisitSummaries/${uid}`);
  const viewsRef = db.doc(`profileVisitViews/${uid}`);
  const [summaries, views] = await Promise.all([
    summariesRef.collection("visitors").count().get(),
    viewsRef.collection("visitors").count().get()
  ]);
  await Promise.all([
    db.recursiveDelete(summariesRef),
    db.recursiveDelete(viewsRef)
  ]);
  return summaries.data().count + views.data().count;
}

export async function purgeUserData(uid: string, username?: string): Promise<Record<string, number>> {
  const counts: Record<string, number> = {};

  counts.posts = await deleteTopLevelWhere("posts", "authorId", uid);
  counts.postComments = await deleteTopLevelWhere("postComments", "authorId", uid);
  counts.communityImageComments = await deleteTopLevelWhere("communityImageComments", "authorId", uid);
  counts.communityImages = await deleteTopLevelWhere("communityImages", "ownerId", uid);
  counts.artStories = await deleteTopLevelWhere("artStories", "authorId", uid);
  counts.likes = await deleteTopLevelWhere("likes", "userId", uid);
  counts.favorites = await deleteTopLevelWhere("favorites", "userId", uid);
  counts.reads = await deleteTopLevelWhere("reads", "userId", uid);
  counts.reports = await deleteTopLevelWhere("reports", "reporterId", uid);
  counts.supportTickets = await deleteTopLevelWhere("supportTickets", "userId", uid);
  counts.artDnaResults = await deleteTopLevelWhere("artDnaResults", "uid", uid);
  counts.chanceCardDraws = await deleteTopLevelWhere("chanceCardDraws", "uid", uid);
  counts.jigsawAttempts = await deleteTopLevelWhere("jigsawAttempts", "uid", uid);
  counts.jigsawGameSessions = await deleteTopLevelWhere("jigsawGameSessions", "uid", uid);
  counts.seerPointEvents = await deleteTopLevelWhere("seerPointEvents", "uid", uid);
  counts.profileVisits = await deleteTopLevelWhere("profileVisits", "visitorUid", uid);
  counts.profileVisitSignalsAsVisitor = await deleteTopLevelWhere("profileVisitSignals", "visitorUid", uid);
  counts.profileVisitSignalsAsOwner = await deleteTopLevelWhere("profileVisitSignals", "ownerUid", uid);
  counts.profileVisitViews = await deleteProfileVisitData(uid);
  counts.timeCapsules = await deleteTopLevelWhere("timeCapsules", "uid", uid);
  counts.rewardedBoostCredits = await deleteTopLevelWhere("rewardedBoostCredits", "uid", uid);
  counts.notificationsRecipient = await deleteTopLevelWhere("notifications", "recipientId", uid);
  counts.notificationsUser = await deleteTopLevelWhere("notifications", "userId", uid);
  counts.pushDevices = await deleteTopLevelWhere("pushDevices", "uid", uid);
  counts.pushDeliveries = await deleteTopLevelWhere("pushDeliveries", "userId", uid);
  counts.pushReceipts = await deleteTopLevelWhere("pushReceipts", "userId", uid);

  if (username) {
    counts.personalMuseums = await deleteTopLevelWhere("personalMuseums", "ownerUsername", username);
    counts.profileVisitsAsProfile = await deleteTopLevelWhere("profileVisits", "profileUsername", username);
  }

  counts.duelVotes = await deleteDuelVotes(uid);
  counts.prophecyPredictions = await deleteProphecyPredictions(uid);

  await deleteDocIfExists(`seerScores/${uid}`);
  await deleteDocIfExists(`users/${uid}`);

  await deleteUserStorage(uid);

  return counts;
}

export const purgeUserAccount = onCall({ enforceAppCheck: false }, async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Hesap silmek için oturum açmış olmanız gerekir.");
  }

  const uid = request.auth.uid;
  let username: string | undefined;

  try {
    const userSnap = await db.doc(`users/${uid}`).get();
    if (userSnap.exists) {
      const data = userSnap.data();
      username = typeof data?.username === "string" ? data.username : undefined;
    }

    const counts = await purgeUserData(uid, username);
    await admin.auth().deleteUser(uid);

    logger.info("User account purged", { uid, counts });
    return { ok: true, counts };
  } catch (error) {
    logger.error("User account purge failed", { uid, error });
    throw new HttpsError("internal", "Hesap silinirken bir hata oluştu. Lütfen destek ile iletişime geçin.");
  }
});
