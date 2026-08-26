import * as admin from "firebase-admin";
import { onDocumentCreated } from "firebase-functions/v2/firestore";

export const syncChanceCardSeerPoints = onDocumentCreated(
  "chanceCardDraws/{drawId}",
  async (event) => {
    const data = event.data?.data();
    if (!data || data.cardType !== "seer_points") return;
    const uid = String(data.uid ?? "");
    if (!uid) return;
    const value = typeof data.value === "number" ? data.value : Number(data.value) || 1;
    const db = admin.firestore();
    const ref = db.doc(`seerScores/${uid}`);
    const snapshot = await ref.get();
    if (snapshot.exists) {
      await ref.set({
        totalPoints: admin.firestore.FieldValue.increment(value),
        monthPoints: admin.firestore.FieldValue.increment(value),
        threeMonthPoints: admin.firestore.FieldValue.increment(value),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return;
    }
    await ref.set({
      uid,
      username: typeof data.username === "string" ? data.username : "",
      displayName: typeof data.displayName === "string" ? data.displayName : "",
      totalPoints: value,
      monthPoints: value,
      threeMonthPoints: value,
      rankingStatus: "active",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  }
);
