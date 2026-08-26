import * as admin from "firebase-admin";
import { isDueScheduledContent, SCHEDULED_CONTENT_RULES } from "./content-schedule";

export type ScheduledContentPublishResult = {
  ok: boolean;
  published: number;
  items: string[];
  messages: string[];
};

export async function runScheduledContentPublishAdmin(now = Date.now()): Promise<ScheduledContentPublishResult> {
  const db = admin.firestore();
  const items: string[] = [];
  const messages: string[] = [];
  let published = 0;

  for (const rule of SCHEDULED_CONTENT_RULES) {
    const snapshot = await db.collection(rule.collection).where("status", "==", rule.queryStatus).limit(200).get();
    if (snapshot.empty) continue;

    const batch = db.batch();
    let writes = 0;

    snapshot.docs.forEach((snapshotDoc) => {
      const data = snapshotDoc.data() as Record<string, unknown>;
      if (!isDueScheduledContent(data, now)) return;

      const update: Record<string, unknown> = {
        status: rule.publishStatus,
        publishedAt: admin.firestore.FieldValue.serverTimestamp(),
        scheduledAt: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        ...rule.extra
      };

      if (rule.collection === "communityImages") {
        update.reviewedAt = admin.firestore.FieldValue.serverTimestamp();
      }

      batch.update(snapshotDoc.ref, update);
      writes += 1;
      published += 1;
      items.push(`${rule.collection}/${snapshotDoc.id}`);
    });

    if (!writes) continue;
    await batch.commit();
    messages.push(`${rule.collection}: ${writes} içerik yayına alındı`);
  }

  return { ok: true, published, items, messages };
}
