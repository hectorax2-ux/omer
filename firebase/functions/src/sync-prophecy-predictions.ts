import * as admin from "firebase-admin";
import { onDocumentWritten } from "firebase-functions/v2/firestore";

export const syncProphecyPredictionCounts = onDocumentWritten(
  "prophecyWeeks/{weekId}/predictions/{userId}",
  async (event) => {
    const weekId = event.params.weekId;
    const db = admin.firestore();
    const weekRef = db.doc(`prophecyWeeks/${weekId}`);
    const weekSnapshot = await weekRef.get();
    if (!weekSnapshot.exists) return;

    const weekData = weekSnapshot.data() as { candidates?: { id: string; predictions?: number }[] };
    const candidates = Array.isArray(weekData.candidates) ? weekData.candidates : [];
    const predictionsSnapshot = await weekRef.collection("predictions").get();
    const counts = new Map<string, number>();

    predictionsSnapshot.docs.forEach((item) => {
      const candidateId = String(item.data().candidateId ?? "");
      if (!candidateId) return;
      counts.set(candidateId, (counts.get(candidateId) ?? 0) + 1);
    });

    const nextCandidates = candidates.map((candidate) => ({
      ...candidate,
      predictions: counts.get(candidate.id) ?? 0
    }));

    await weekRef.set({
      candidates: nextCandidates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  }
);
