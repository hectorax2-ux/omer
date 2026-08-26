import * as admin from "firebase-admin";
import {
  buildAutomationNotificationPayload,
  dayKeyInTimezone,
  shouldRunNotificationAutomation,
  type NotificationAutomationRecord,
  type NotificationTemplateRecord
} from "./notification-automation";

export type NotificationAutomationRunResult = {
  ok: boolean;
  processed: number;
  dispatched: number;
  skipped: number;
  messages: string[];
};

export async function runNotificationAutomationAdmin(force = false): Promise<NotificationAutomationRunResult> {
  const db = admin.firestore();
  const now = new Date();
  const messages: string[] = [];
  let processed = 0;
  let dispatched = 0;
  let skipped = 0;

  const automationsSnap = await db.collection("notificationAutomations").get();
  for (const automationDoc of automationsSnap.docs) {
    const automation = { id: automationDoc.id, ...(automationDoc.data() as Omit<NotificationAutomationRecord, "id">) };
    if (!automation.enabled) continue;
    if (!automation.templateId?.trim()) {
      skipped += 1;
      messages.push(`${automation.name}: şablon bağlı değil`);
      continue;
    }

    processed += 1;
    const timezone = automation.timezone || "Europe/Istanbul";
    const dayKey = dayKeyInTimezone(now, timezone);
    if (!force && !shouldRunNotificationAutomation(automation, now)) {
      skipped += 1;
      continue;
    }

    const dedupeKey = `auto_${automation.id}_${dayKey}`.slice(0, 180);
    const existing = await db.collection("notifications").where("dedupeKey", "==", dedupeKey).limit(1).get();
    if (!existing.empty) {
      skipped += 1;
      messages.push(`${automation.name}: bugün zaten gönderildi`);
      continue;
    }

    const templateSnap = await db.collection("notificationTemplates").doc(automation.templateId).get();
    if (!templateSnap.exists) {
      skipped += 1;
      messages.push(`${automation.name}: şablon bulunamadı`);
      continue;
    }

    const template = { id: templateSnap.id, ...(templateSnap.data() as Omit<NotificationTemplateRecord, "id">) };
    const payload = buildAutomationNotificationPayload(template, automation, dayKey);
    const notificationRef = await db.collection("notifications").add({
      ...payload,
      dedupeKey,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await db.collection("notificationLogs").add({
      type: "admin_notification",
      status: "notification_created",
      action: "automation_dispatch",
      source: "automation",
      title: typeof template.title === "string" ? template.title : template.title?.tr || template.name,
      notificationId: notificationRef.id,
      templateId: template.id,
      automationId: automation.id,
      targetPath: payload.targetPath,
      detail: force ? "manual_force" : "scheduled",
      actorId: "system",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await automationDoc.ref.set({
      lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
      lastRunDayKey: dayKey,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    dispatched += 1;
    messages.push(`${automation.name}: bildirim gönderildi`);
  }

  return { ok: true, processed, dispatched, skipped, messages };
}
