import * as admin from "firebase-admin";
import { extractWeekPeriodId } from "./competition-week";

function weeklyQuizDocId(periodId: string) {
  return `weekly-${periodId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function dailyQuizDocId(periodId: string) {
  return `daily-${periodId.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

function buildQuizRotationPlan(
  archivedPeriodId: string,
  nextPeriodId: string,
  packs: { id: string; type?: string; weekId?: string; status?: string }[]
) {
  const archiveIds = packs
    .filter((pack) => pack.weekId === archivedPeriodId && pack.status === "published")
    .map((pack) => pack.id);
  const weeklyNextId = weeklyQuizDocId(nextPeriodId);
  const dailyNextId = dailyQuizDocId(nextPeriodId);
  const weeklyCandidate = packs.find((pack) => pack.id === weeklyNextId || (pack.type === "weekly" && pack.weekId === nextPeriodId && pack.status === "scheduled"));
  const dailyCandidate = packs.find((pack) => pack.id === dailyNextId || (pack.type === "daily" && pack.weekId === nextPeriodId && pack.status === "scheduled"));
  return {
    archiveIds,
    publishWeeklyId: weeklyCandidate?.status === "scheduled" ? weeklyCandidate.id : "",
    publishDailyId: dailyCandidate?.status === "scheduled" ? dailyCandidate.id : ""
  };
}

export async function rotateQuizPacksAdmin(
  db: admin.firestore.Firestore,
  archivedWeekId: string,
  nextWeekId: string
) {
  const messages: string[] = [];
  const archivedPeriodId = extractWeekPeriodId(archivedWeekId);
  const nextPeriodId = extractWeekPeriodId(nextWeekId);
  const snapshot = await db.collection("quizzes").where("type", "in", ["weekly", "daily"]).get();
  const packs = snapshot.docs.map((item) => ({
    id: item.id,
    ...(item.data() as { type?: string; weekId?: string; status?: string })
  }));
  const plan = buildQuizRotationPlan(archivedPeriodId, nextPeriodId, packs);
  const batch = db.batch();
  let writes = 0;

  plan.archiveIds.forEach((id) => {
    batch.update(db.doc(`quizzes/${id}`), {
      status: "archived",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    writes += 1;
  });

  if (plan.publishWeeklyId) {
    packs
      .filter((pack) => pack.weekId === nextPeriodId && pack.type === "weekly" && pack.status === "published" && pack.id !== plan.publishWeeklyId)
      .forEach((pack) => {
        batch.update(db.doc(`quizzes/${pack.id}`), {
          status: "hidden",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        writes += 1;
      });
    batch.update(db.doc(`quizzes/${plan.publishWeeklyId}`), {
      status: "published",
      publishedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    writes += 1;
    messages.push(`Haftalık quiz yayına alındı: ${plan.publishWeeklyId}`);
  } else {
    messages.push("Sıradaki haftalık quiz paketi bulunamadı.");
  }

  if (plan.publishDailyId) {
    packs
      .filter((pack) => pack.weekId === nextPeriodId && pack.type === "daily" && pack.status === "published" && pack.id !== plan.publishDailyId)
      .forEach((pack) => {
        batch.update(db.doc(`quizzes/${pack.id}`), {
          status: "hidden",
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        writes += 1;
      });
    batch.update(db.doc(`quizzes/${plan.publishDailyId}`), {
      status: "published",
      publishedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    writes += 1;
    messages.push(`Günlük quiz yayına alındı: ${plan.publishDailyId}`);
  } else {
    messages.push("Sıradaki günlük quiz paketi bulunamadı.");
  }

  if (writes) await batch.commit();
  if (plan.archiveIds.length) messages.push(`${plan.archiveIds.length} quiz paketi arşivlendi.`);
  return { messages, publishedWeekly: Boolean(plan.publishWeeklyId), publishedDaily: Boolean(plan.publishDailyId) };
}
