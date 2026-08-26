import { randomUUID } from "node:crypto";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";
import { resolveProfileVisitIdentity, shouldCountProfileVisit } from "./profile-visit-core";

type ProfileVisitSignal = {
  ownerUid?: string;
  visitorUid?: string;
  requestedAt?: Timestamp;
  firstVisitedAt?: Timestamp;
  lastVisitedAt?: Timestamp;
  visitCount?: number;
  viewId?: string;
};

export const syncProfileVisit = onDocumentWritten("profileVisitSignals/{signalId}", async (event) => {
  const before = event.data?.before.data() as ProfileVisitSignal | undefined;
  const after = event.data?.after.data() as ProfileVisitSignal | undefined;
  if (!after?.ownerUid || !after.visitorUid || after.ownerUid === after.visitorUid) return;
  const visitorUid = after.visitorUid;
  if (before?.requestedAt?.isEqual(after.requestedAt ?? Timestamp.fromMillis(0))) return;

  const db = getFirestore();
  const signalRef = event.data?.after.ref;
  if (!signalRef) return;

  await db.runTransaction(async (transaction) => {
    const [signalSnapshot, visitorSnapshot, ownerSnapshot] = await Promise.all([
      transaction.get(signalRef),
      transaction.get(db.doc(`users/${after.visitorUid}`)),
      transaction.get(db.doc(`users/${after.ownerUid}`))
    ]);
    if (!signalSnapshot.exists || !visitorSnapshot.exists || !ownerSnapshot.exists) return;
    const signal = signalSnapshot.data() as ProfileVisitSignal;
    const requestedAt = signal.requestedAt;
    if (!(requestedAt instanceof Timestamp)) return;
    const lastVisitedAt = signal.lastVisitedAt;
    if (!shouldCountProfileVisit(lastVisitedAt instanceof Timestamp ? lastVisitedAt.toMillis() : undefined, requestedAt.toMillis())) return;

    const visitor = visitorSnapshot.data();
    if (!visitor) return;
    const visibility = visitor.profileVisitVisibility === "anonymous" ? "anonymous" : "visible";
    const identity = resolveProfileVisitIdentity(visibility, visitorUid, visitor);
    const anonymous = visibility === "anonymous";
    const firstVisitedAt = signal.firstVisitedAt instanceof Timestamp ? signal.firstVisitedAt : requestedAt;
    const visitCount = Math.max(0, signal.visitCount ?? 0) + 1;
    const viewId = signal.viewId || randomUUID();
    const summaryRef = db.doc(`profileVisitSummaries/${after.ownerUid}/visitors/${viewId}`);
    const viewRef = db.doc(`profileVisitViews/${after.ownerUid}/visitors/${viewId}`);

    transaction.set(signalRef, {
      firstVisitedAt,
      lastVisitedAt: requestedAt,
      visitCount,
      viewId,
      processedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.set(summaryRef, {
      ownerUid: after.ownerUid,
      firstVisitedAt,
      lastVisitedAt: requestedAt,
      visitCount,
      anonymous,
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    transaction.set(viewRef, {
      ownerUid: after.ownerUid,
      firstVisitedAt,
      lastVisitedAt: requestedAt,
      visitCount,
      visibilityMode: anonymous ? "anonymous" : "visible",
      anonymous,
      visitorUid: identity?.visitorUid ?? FieldValue.delete(),
      visitorName: identity?.visitorName ?? FieldValue.delete(),
      visitorUsername: identity?.visitorUsername ?? FieldValue.delete(),
      visitorPhotoURL: identity?.visitorPhotoURL ?? FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });

  logger.info("Profile visit reconciled", { ownerUid: after.ownerUid });
});

export const syncProfileVisitPrivacy = onDocumentUpdated("users/{userId}", async (event) => {
  const before = event.data?.before.data();
  const after = event.data?.after.data();
  const beforeVisibility = before?.profileVisitVisibility === "anonymous" ? "anonymous" : "visible";
  const afterVisibility = after?.profileVisitVisibility === "anonymous" ? "anonymous" : "visible";
  if (beforeVisibility === afterVisibility || !event.params.userId || !after) return;

  const db = getFirestore();
  const signals = await db.collection("profileVisitSignals").where("visitorUid", "==", event.params.userId).get();
  const writer = db.bulkWriter();
  const identity = resolveProfileVisitIdentity(afterVisibility, event.params.userId, after);
  signals.docs.forEach((item) => {
    const signal = item.data() as ProfileVisitSignal;
    if (!signal.ownerUid || !signal.viewId) return;
    writer.set(db.doc(`profileVisitSummaries/${signal.ownerUid}/visitors/${signal.viewId}`), {
      anonymous: afterVisibility === "anonymous",
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    writer.set(db.doc(`profileVisitViews/${signal.ownerUid}/visitors/${signal.viewId}`), {
      visibilityMode: afterVisibility,
      anonymous: afterVisibility === "anonymous",
      visitorUid: identity?.visitorUid ?? FieldValue.delete(),
      visitorName: identity?.visitorName ?? FieldValue.delete(),
      visitorUsername: identity?.visitorUsername ?? FieldValue.delete(),
      visitorPhotoURL: identity?.visitorPhotoURL ?? FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  });
  await writer.close();

  logger.info("Profile visit privacy reconciled", { visitorUid: event.params.userId, visibility: afterVisibility });
});
