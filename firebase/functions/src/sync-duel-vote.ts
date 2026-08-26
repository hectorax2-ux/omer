import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions";

type VoteSide = "a" | "b";

function sideField(side: VoteSide) {
  return side === "a" ? "votesA" : "votesB";
}

export const syncDuelVoteCounts = onDocumentWritten("duels/{duelId}/votes/{userId}", async (event) => {
  const before = event.data?.before?.data() as { side?: VoteSide } | undefined;
  const after = event.data?.after?.data() as { side?: VoteSide } | undefined;
  const duelRef = event.data?.after?.ref.parent.parent ?? event.data?.before?.ref.parent.parent;
  if (!duelRef) return;

  const updates: Record<string, admin.firestore.FieldValue> = {};

  if (!before && after?.side) {
    updates[sideField(after.side)] = FieldValue.increment(1);
  } else if (before?.side && after?.side && before.side !== after.side) {
    updates[sideField(before.side)] = FieldValue.increment(-1);
    updates[sideField(after.side)] = FieldValue.increment(1);
  } else if (before?.side && !after) {
    updates[sideField(before.side)] = FieldValue.increment(-1);
  } else {
    return;
  }

  updates.updatedAt = FieldValue.serverTimestamp();
  await duelRef.update(updates);
  logger.info("Duel vote counts synced", { duelId: duelRef.id, userId: event.params.userId });
});
