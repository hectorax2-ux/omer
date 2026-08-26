import * as admin from "firebase-admin";
import {
  buildArchiveWinners,
  buildCompetitionArchivePayload,
  COMPETITION_ARCHIVES_COLLECTION,
  COMPETITION_SETTINGS_DOC,
  COMPETITION_WEEKS_COLLECTION,
  createCompetitionSessionId,
  defaultCompetitionSettings,
  extractWeekPeriodId,
  FinishCompetitionWeekResult,
  formatArchiveWeekLabel,
  getCompetitionWeekBounds,
  mapCompetitionImageRecord,
  normalizeCompetitionSettings,
  parseArchiveWeekNumber,
  shouldAutoFinishWeek,
  type CompetitionSettings
} from "./competition-week";
import { rotateQuizPacksAdmin } from "./quiz-schedule-runner";

type FinishOptions = {
  force?: boolean;
  triggeredBy?: "auto" | "admin";
};

function uniqueBadges(badges: unknown) {
  const list = Array.isArray(badges) ? badges.filter((item): item is string => typeof item === "string") : [];
  return list;
}

async function loadCompetitionSettings(db: admin.firestore.Firestore): Promise<CompetitionSettings> {
  const snapshot = await db.doc(COMPETITION_SETTINGS_DOC).get();
  if (!snapshot.exists) {
    const defaults = defaultCompetitionSettings();
    await db.doc(COMPETITION_SETTINGS_DOC).set({
      ...defaults,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    const bounds = getCompetitionWeekBounds();
    await db.doc(`${COMPETITION_WEEKS_COLLECTION}/${defaults.activeWeekId}`).set({
      sessionId: defaults.activeWeekId,
      weekId: bounds.weekId,
      startsAt: admin.firestore.Timestamp.fromDate(bounds.startsAt),
      endsAt: admin.firestore.Timestamp.fromDate(bounds.endsAt),
      status: "active",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    return defaults;
  }
  return normalizeCompetitionSettings(snapshot.data() as Partial<CompetitionSettings>);
}

async function ensureActiveSessionId(db: admin.firestore.Firestore, settings: CompetitionSettings) {
  if (settings.activeWeekId.includes("~")) return settings;
  const migrated: CompetitionSettings = {
    ...settings,
    activeWeekId: createCompetitionSessionId(extractWeekPeriodId(settings.activeWeekId))
  };
  await db.doc(COMPETITION_SETTINGS_DOC).set({
    activeWeekId: migrated.activeWeekId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return migrated;
}

async function awardWeeklyWinnerBadge(db: admin.firestore.Firestore, ownerId: string) {
  if (!ownerId) return;
  const userRef = db.collection("users").doc(ownerId);
  const snapshot = await userRef.get();
  if (!snapshot.exists) return;
  const badges = uniqueBadges(snapshot.data()?.badges);
  if (badges.includes("weekly_winner")) return;
  await userRef.set({
    badges: [...badges, "weekly_winner"],
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

async function archiveCompetitionImages(db: admin.firestore.Firestore, sessionId: string) {
  const snapshot = await db.collection("communityImages")
    .where("weekId", "==", sessionId)
    .where("competitionEntry", "==", true)
    .where("status", "==", "published")
    .get();

  if (snapshot.empty) return 0;

  for (let index = 0; index < snapshot.docs.length; index += 400) {
    const batch = db.batch();
    snapshot.docs.slice(index, index + 400).forEach((docSnapshot) => {
      batch.update(docSnapshot.ref, {
        competitionWeekArchived: true,
        archivedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
    await batch.commit();
  }
  return snapshot.size;
}

async function allocateArchiveWeekNumber(db: admin.firestore.Firestore) {
  const [archivesSnapshot, settingsSnapshot] = await Promise.all([
    db.collection(COMPETITION_ARCHIVES_COLLECTION).get(),
    db.doc(COMPETITION_SETTINGS_DOC).get()
  ]);
  let maxNumber = 0;
  archivesSnapshot.docs.forEach((item) => {
    const weekNumber = parseArchiveWeekNumber(item.data() as Record<string, unknown>);
    if (weekNumber && weekNumber > maxNumber) maxNumber = weekNumber;
  });
  const counter = settingsSnapshot.data()?.nextArchiveWeekNumber;
  const nextNumber = Math.max(maxNumber, typeof counter === "number" && counter > 0 ? counter - 1 : 0) + 1;
  await db.doc(COMPETITION_SETTINGS_DOC).set({
    nextArchiveWeekNumber: nextNumber + 1,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return nextNumber;
}

export async function finishCompetitionWeekAdmin(
  db: admin.firestore.Firestore,
  options: FinishOptions = {}
): Promise<FinishCompetitionWeekResult> {
  const messages: string[] = [];
  let settings = await loadCompetitionSettings(db);
  settings = await ensureActiveSessionId(db, settings);
  const now = new Date();

  if (!options.force && !shouldAutoFinishWeek(settings, now)) {
    return { ok: false, messages: ["Aktif hafta henüz bitmedi."] };
  }

  const archivedSessionId = settings.activeWeekId;
  const archivedPeriodId = extractWeekPeriodId(archivedSessionId);
  const publishedSnapshot = await db.collection("communityImages")
    .where("weekId", "==", archivedSessionId)
    .where("competitionEntry", "==", true)
    .where("status", "==", "published")
    .get();

  const publishedEntries = publishedSnapshot.docs.map((docSnapshot) => mapCompetitionImageRecord(docSnapshot.id, docSnapshot.data() as Record<string, unknown>));
  const winners = buildArchiveWinners(publishedEntries);
  const weekNumber = await allocateArchiveWeekNumber(db);
  const archivePayload = buildCompetitionArchivePayload(archivedSessionId, winners, { finishedAt: now, weekNumber });

  await db.doc(`${COMPETITION_ARCHIVES_COLLECTION}/${archivedSessionId}`).set({
    ...archivePayload,
    winners,
    archivedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    finishedBy: options.triggeredBy || "admin"
  });

  if (winners.length) {
    const winnerEntry = publishedEntries.find((entry) => entry.id === winners[0].id);
    await awardWeeklyWinnerBadge(db, winnerEntry?.ownerId || "");
    messages.push(`${archivePayload.weekLabel} için ilk ${winners.length} kazanan arşivlendi.`);
  } else {
    messages.push(`${archivePayload.weekLabel} için yayınlanmış eser yok; arşiv boş kaydedildi.`);
  }

  const archivedCount = await archiveCompetitionImages(db, archivedSessionId);
  messages.push(archivedCount ? `${archivedCount} yayınlanmış eser hafta arşivine işaretlendi.` : "Onay bekleyen gönderiler korundu; yalnızca yayında olanlar arşivlendi.");

  await db.doc(`${COMPETITION_WEEKS_COLLECTION}/${archivedSessionId}`).set({
    sessionId: archivedSessionId,
    weekId: archivedPeriodId,
    status: "finished",
    winnerCount: winners.length,
    winnerId: winners[0]?.id || "",
    finishedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  const nextBounds = getCompetitionWeekBounds(new Date(now.getTime() + 60_000));
  const nextSessionId = createCompetitionSessionId(nextBounds.weekId, now);
  const nextSettings: CompetitionSettings = {
    ...settings,
    activeWeekId: nextSessionId,
    startsAt: nextBounds.startsAt.toISOString(),
    endsAt: nextBounds.endsAt.toISOString(),
    status: "active",
    uploadQuotaGeneration: settings.uploadQuotaGeneration + 1
  };

  await db.doc(COMPETITION_SETTINGS_DOC).set({
    ...nextSettings,
    lastFinishedSessionId: archivedSessionId,
    lastFinishedWeekId: archivedPeriodId,
    lastFinishedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  await db.doc(`${COMPETITION_WEEKS_COLLECTION}/${nextSessionId}`).set({
    sessionId: nextSessionId,
    weekId: nextBounds.weekId,
    startsAt: admin.firestore.Timestamp.fromDate(nextBounds.startsAt),
    endsAt: admin.firestore.Timestamp.fromDate(nextBounds.endsAt),
    status: "active",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });

  messages.push(`Yeni yarışma oturumu başlatıldı: ${formatArchiveWeekLabel(nextBounds.weekId, now)}`);

  const quizRotation = await rotateQuizPacksAdmin(db, archivedPeriodId, nextBounds.weekId);
  messages.push(...quizRotation.messages);

  return {
    ok: true,
    messages,
    archivedWeekId: archivedSessionId,
    archiveId: archivedSessionId,
    nextWeekId: nextSessionId,
    winnerCount: winners.length
  };
}

export async function resetCompetitionUploadQuotasAdmin(db: admin.firestore.Firestore) {
  const settings = await loadCompetitionSettings(db);
  const nextGeneration = settings.uploadQuotaGeneration + 1;
  await db.doc(COMPETITION_SETTINGS_DOC).set({
    uploadQuotaGeneration: nextGeneration,
    lastQuotaResetAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  return {
    ok: true,
    uploadQuotaGeneration: nextGeneration,
    activeWeekId: settings.activeWeekId
  };
}

export async function runCompetitionWeekAutomation(force = false): Promise<FinishCompetitionWeekResult> {
  const db = admin.firestore();
  const settings = await loadCompetitionSettings(db);
  if (!force && !shouldAutoFinishWeek(settings)) {
    return { ok: false, messages: ["Otomasyon: aktif hafta devam ediyor."] };
  }
  return finishCompetitionWeekAdmin(db, { force: true, triggeredBy: "auto" });
}

export async function ensureCompetitionWeekBootstrapped(db: admin.firestore.Firestore) {
  await loadCompetitionSettings(db);
}
