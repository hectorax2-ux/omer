import * as admin from "firebase-admin";
import {
  buildDuelFirestorePayload,
  buildInitialPair,
  defaultDuelAutomationConfig,
  duelDescriptionForType,
  duelTitleForType,
  DUEL_AUTOMATION_COLLECTION,
  DUEL_AUTOMATION_DOC_ID,
  getDailyDuelWindow,
  normalizeDuelAutomationConfig,
  resetDuelTypeState,
  resolveProphecyWinnerId
} from "./duel-automation";
import {
  buildLiveProphecyWeekPayload,
  normalizeScheduledProphecyPackage,
  pickNextScheduledPackage,
  PROPHECY_PACKAGES_COLLECTION,
  realignPackageWeekDates,
  type ProphecyPackageKind,
  type ScheduledProphecyPackage
} from "./prophecy-schedule";
import {
  defaultProphecyQuestion,
  defaultProphecyTitle,
  poolFromCandidates,
  resolveChampionPoolIdFromDuelData,
  WEEKLY_CANDIDATE_COUNT
} from "./prophecy-duel-bridge";
import type { DuelPoolEntry } from "./duel-automation";

const AUTO_POOL_LIMIT = 300;
const AUTO_RECENT_LIMIT = 48;

function numberValue(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) return value;
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate();
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function loadAutomationConfig(db: admin.firestore.Firestore) {
  const snapshot = await db.doc(`${DUEL_AUTOMATION_COLLECTION}/${DUEL_AUTOMATION_DOC_ID}`).get();
  if (!snapshot.exists) return defaultDuelAutomationConfig();
  return normalizeDuelAutomationConfig(snapshot.data() as Partial<ReturnType<typeof defaultDuelAutomationConfig>>);
}

async function saveAutomationConfig(db: admin.firestore.Firestore, config: ReturnType<typeof defaultDuelAutomationConfig>) {
  await db.doc(`${DUEL_AUTOMATION_COLLECTION}/${DUEL_AUTOMATION_DOC_ID}`).set(
    { ...config, updatedAt: admin.firestore.FieldValue.serverTimestamp() },
    { merge: true }
  );
}

export async function findActiveDuel(db: admin.firestore.Firestore, kind: ProphecyPackageKind) {
  const snapshot = await db.collection("duels").where("kind", "==", kind).where("active", "==", true).limit(1).get();
  return snapshot.docs[0] ?? null;
}

async function finalizeWeeklyDuelChampion(db: admin.firestore.Firestore, kind: ProphecyPackageKind) {
  const config = await loadAutomationConfig(db);
  const state = kind === "artwork" ? { ...config.artworkState } : { ...config.artistState };
  let championId = state.lastWinnerPoolId;

  const activeDuels = await db.collection("duels").where("kind", "==", kind).where("active", "==", true).limit(5).get();
  const activeDuel = activeDuels.docs[0];
  if (activeDuel) {
    const data = activeDuel.data();
    championId = resolveChampionPoolIdFromDuelData(
      {
        votesA: numberValue(data.votesA),
        votesB: numberValue(data.votesB),
        sideAPoolId: stringValue(data.sideAPoolId),
        sideBPoolId: stringValue(data.sideBPoolId)
      },
      championId
    );
  }

  await Promise.all(
    activeDuels.docs.map((duelDoc) =>
      duelDoc.ref.update({
        active: false,
        status: "finished",
        weekChampion: duelDoc.id === activeDuel?.id,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
    )
  );

  if (kind === "artwork") config.artworkState = resetDuelTypeState();
  else config.artistState = resetDuelTypeState();
  await saveAutomationConfig(db, config);

  return championId;
}

async function countPredictionsByCandidate(db: admin.firestore.Firestore, weekId: string, candidateIds: string[]) {
  const predictionSnapshot = await db.collection(`prophecyWeeks/${weekId}/predictions`).get();
  const counts = new Map(candidateIds.map((id) => [id, 0]));
  predictionSnapshot.docs.forEach((predictionDoc) => {
    const candidateId = stringValue(predictionDoc.data().candidateId);
    counts.set(candidateId, (counts.get(candidateId) ?? 0) + 1);
  });
  return { counts, total: predictionSnapshot.docs.length };
}

async function syncPackageToDuelPool(db: admin.firestore.Firestore, pkg: ScheduledProphecyPackage) {
  const config = await loadAutomationConfig(db);
  const pool = poolFromCandidates(pkg.candidates);
  if (pkg.kind === "artwork") config.artworkPool = pool;
  else config.artistPool = pool;
  await saveAutomationConfig(db, config);
}

async function ensureDailyDuelFromPackage(db: admin.firestore.Firestore, pkg: ScheduledProphecyPackage) {
  const config = await loadAutomationConfig(db);
  const duelSnapshot = await db.collection("duels").where("kind", "==", pkg.kind).where("active", "==", true).limit(1).get();
  if (!duelSnapshot.empty) return;

  const pair = buildInitialPair(poolFromCandidates(pkg.candidates));
  if (!pair) return;

  const window = getDailyDuelWindow(config.dailyRotationHour, new Date(), config.timezone);
  const payload = buildDuelFirestorePayload({
    type: pkg.kind,
    title: duelTitleForType(pkg.kind),
    description: duelDescriptionForType(pkg.kind),
    sideA: pair[0],
    sideB: pair[1],
    startsAt: window.startsAt,
    endsAt: window.endsAt
  });

  const created = await db.collection("duels").add({
    ...payload,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  if (pkg.kind === "artwork") {
    config.artworkState = {
      initialized: true,
      lastRotationDayKey: window.dayKey,
      currentDuelId: created.id,
      nextChallengerIndex: 2,
      eliminatedPoolIds: [],
      bracketComplete: false
    };
  } else {
    config.artistState = {
      initialized: true,
      lastRotationDayKey: window.dayKey,
      currentDuelId: created.id,
      nextChallengerIndex: 2,
      eliminatedPoolIds: [],
      bracketComplete: false
    };
  }
  await saveAutomationConfig(db, config);
}

async function awardSeerPoints(db: admin.firestore.Firestore, weekId: string, winnerId: string) {
  const predictionSnapshot = await db.collection(`prophecyWeeks/${weekId}/predictions`).get();
  const winnerUids = predictionSnapshot.docs
    .filter((prediction) => stringValue(prediction.data().candidateId) === winnerId)
    .map((prediction) => prediction.id);
  if (!winnerUids.length) return 0;

  const awarded = await Promise.all(winnerUids.map(async (uid) => {
    const eventRef = db.doc(`seerPointEvents/${weekId}_${uid}`);
    const scoreRef = db.doc(`seerScores/${uid}`);
    const userRef = db.doc(`users/${uid}`);
    return db.runTransaction(async (transaction) => {
      const [event, user] = await Promise.all([transaction.get(eventRef), transaction.get(userRef)]);
      if (event.exists) return false;
      const userData = user.data() ?? {};
      const username = stringValue(userData.username, uid.slice(0, 8));
      transaction.set(eventRef, {
        uid,
        weekId,
        winnerId,
        points: 1,
        source: "prophecy_week",
        awardedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      transaction.set(scoreRef, {
        uid,
        username,
        displayName: stringValue(userData.displayName) || username,
        totalPoints: admin.firestore.FieldValue.increment(1),
        monthPoints: admin.firestore.FieldValue.increment(1),
        threeMonthPoints: admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      return true;
    });
  }));

  return awarded.filter(Boolean).length;
}

async function findActiveLiveWeek(db: admin.firestore.Firestore, kind: ProphecyPackageKind) {
  const snapshot = await db.collection("prophecyWeeks").where("kind", "==", kind).where("status", "==", "active").limit(1).get();
  return snapshot.docs[0] ?? null;
}

async function finishLiveWeek(
  db: admin.firestore.Firestore,
  weekDoc: admin.firestore.QueryDocumentSnapshot,
  schedulePackageId?: string
) {
  const data = weekDoc.data();
  if (data.pointsAwardedAt) {
    return { winnerId: stringValue(data.winnerId), awarded: 0, stats: null };
  }

  const kind: ProphecyPackageKind = data.kind === "artist" ? "artist" : "artwork";
  let championId = await finalizeWeeklyDuelChampion(db, kind);

  const candidates = Array.isArray(data.candidates)
    ? (data.candidates as { id?: string; title?: unknown }[]).map((candidate) => ({
        id: stringValue(candidate.id),
        title: typeof candidate.title === "object" && candidate.title !== null && "tr" in candidate.title
          ? stringValue((candidate.title as { tr?: string }).tr)
          : stringValue(candidate.title)
      }))
    : [];
  const candidateIds = candidates.map((candidate) => candidate.id).filter(Boolean);
  const { counts, total } = await countPredictionsByCandidate(db, weekDoc.id, candidateIds);

  if (!championId && candidateIds.length) {
    championId = resolveProphecyWinnerId(
      candidateIds.map((id) => ({ id, predictions: counts.get(id) ?? 0 }))
    );
  }

  const winnerId = championId || stringValue(data.winnerId);
  const correct = winnerId ? counts.get(winnerId) ?? 0 : 0;
  const stats = {
    totalPredictions: total,
    correctPredictions: correct,
    missedPredictions: total - correct,
    pointsAwarded: correct,
    winnerId: winnerId || "",
    winnerName: candidates.find((candidate) => candidate.id === winnerId)?.title ?? "",
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      name: candidate.title,
      predictions: counts.get(candidate.id) ?? 0
    }))
  };

  await weekDoc.ref.update({
    winnerId: winnerId || "",
    status: "finished",
    active: false,
    resolutionSource: championId ? "duel_champion" : winnerId ? "prediction_fallback" : "manual",
    pointsAwardedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  let awarded = 0;
  if (winnerId) {
    awarded = await awardSeerPoints(db, weekDoc.id, winnerId);
  }

  const packageId = schedulePackageId || stringValue(data.schedulePackageId);
  if (packageId) {
    await db.doc(`${PROPHECY_PACKAGES_COLLECTION}/${packageId}`).set(
      {
        status: "finished",
        winnerId: winnerId || "",
        statsSnapshot: stats,
        finishedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }

  return { winnerId, awarded, stats };
}

async function deactivateOtherPackages(db: admin.firestore.Firestore, kind: ProphecyPackageKind, keepId?: string) {
  const snapshot = await db
    .collection(PROPHECY_PACKAGES_COLLECTION)
    .where("kind", "==", kind)
    .where("status", "==", "active")
    .limit(20)
    .get();
  await Promise.all(
    snapshot.docs
      .filter((item) => item.id !== keepId)
      .map((item) =>
        item.ref.set({ status: "finished", updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true })
      )
  );
}

async function activateProphecyPackage(db: admin.firestore.Firestore, pkg: ScheduledProphecyPackage) {
  const activeWeek = await findActiveLiveWeek(db, pkg.kind);
  if (activeWeek) {
    await finishLiveWeek(db, activeWeek, stringValue(activeWeek.data().schedulePackageId));
  }

  await deactivateOtherPackages(db, pkg.kind, pkg.id);

  const config = await loadAutomationConfig(db);
  config.enabled = true;
  if (pkg.kind === "artwork") config.artworkState = resetDuelTypeState();
  else config.artistState = resetDuelTypeState();
  await saveAutomationConfig(db, config);

  const payload = buildLiveProphecyWeekPayload({ ...pkg, status: "active" });
  const created = await db.collection("prophecyWeeks").add({
    ...payload,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  await db.doc(`${PROPHECY_PACKAGES_COLLECTION}/${pkg.id}`).set(
    {
      status: "active",
      liveWeekId: created.id,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  await syncPackageToDuelPool(db, pkg);
  await ensureDailyDuelFromPackage(db, pkg);
}

async function loadAllProphecyPackages(db: admin.firestore.Firestore) {
  const snapshot = await db.collection(PROPHECY_PACKAGES_COLLECTION).limit(200).get();
  return snapshot.docs.map((item) => normalizeScheduledProphecyPackage(item.id, item.data() as Record<string, unknown>));
}

async function createAutomaticPackage(db: admin.firestore.Firestore, kind: ProphecyPackageKind, now: Date) {
  const sourceCollection = kind === "artwork" ? "artworks" : "artists";
  const snapshot = await db.collection(sourceCollection).where("status", "==", "published").limit(AUTO_POOL_LIMIT).get();
  const pool = snapshot.docs.flatMap((document) => {
    const data = document.data();
    const title = localizedRecord(kind === "artwork" ? data.title ?? data.name : data.name);
    const subtitle = localizedRecord(kind === "artwork" ? data.artistName : data.movement ?? data.period ?? data.artMovement);
    const image = firstString([data.imageURL, data.image, data.imageUrl, data.photoURL]);
    if (!title.tr || !image) return [];
    return [{
      id: document.id,
      title: title.tr,
      titles: title,
      subtitle: subtitle.tr,
      subtitles: subtitle,
      image
    } satisfies DuelPoolEntry];
  });
  if (pool.length < 2) return null;

  const rotationRef = db.doc(`gameContentRotations/${kind === "artwork" ? "duelArtwork" : "duelArtist"}`);
  const [rotation, detectiveRotation] = await Promise.all([
    rotationRef.get(),
    kind === "artwork" ? db.doc("gameContentRotations/artDetective").get() : Promise.resolve(null)
  ]);
  const recentIds = new Set([
    ...stringArray(rotation.get("recentSourceIds")),
    ...(detectiveRotation ? stringArray(detectiveRotation.get("recentArtworkIds")) : [])
  ]);
  const fresh = pool.filter((entry) => !recentIds.has(entry.id));
  const candidateSource = fresh.length >= Math.min(WEEKLY_CANDIDATE_COUNT, pool.length) ? fresh : pool;
  const dayKey = calendarDayKey(now);
  const candidates = seededShuffle(candidateSource, `duel:${kind}:${dayKey}`).slice(0, Math.min(WEEKLY_CANDIDATE_COUNT, candidateSource.length));
  const id = `auto-${kind}-${dayKey}`;
  const startsAt = now;
  const endsAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const title = defaultProphecyTitle(kind, now);
  const question = defaultProphecyQuestion(kind);
  const pkg: ScheduledProphecyPackage = {
    id,
    kind,
    title,
    titleLocalized: automaticTitle(kind, title),
    question,
    questionLocalized: automaticQuestion(kind, question),
    candidates,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    status: "scheduled"
  };
  const batch = db.batch();
  batch.set(db.doc(`${PROPHECY_PACKAGES_COLLECTION}/${id}`), {
    kind,
    title: pkg.titleLocalized,
    question: pkg.questionLocalized,
    candidates: candidates.map((candidate) => ({
      id: candidate.id,
      title: candidate.titles,
      subtitle: candidate.subtitles,
      image: candidate.image
    })),
    startsAt: admin.firestore.Timestamp.fromDate(startsAt),
    endsAt: admin.firestore.Timestamp.fromDate(endsAt),
    status: "scheduled",
    automated: true,
    sourceCollection,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  batch.set(rotationRef, {
    recentSourceIds: [
      ...candidates.map((candidate) => candidate.id),
      ...stringArray(rotation.get("recentSourceIds")).filter((idValue) => !candidates.some((candidate) => candidate.id === idValue))
    ].slice(0, AUTO_RECENT_LIMIT),
    lastPackageId: id,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
  await batch.commit();
  return pkg;
}

export async function rotateScheduledProphecyAdmin(kind: ProphecyPackageKind, force = false, messages: string[] = []) {
  const db = admin.firestore();
  const packages = await loadAllProphecyPackages(db);
  const now = new Date();
  const activeWeek = await findActiveLiveWeek(db, kind);
  const activePackage = packages.find((pkg) => pkg.kind === kind && pkg.status === "active");

  if (activeWeek) {
    const endsAt = toDate(activeWeek.data().endsAt);
    if (!force && endsAt && endsAt.getTime() > now.getTime()) {
      messages.push(`${kind}: Aktif kehanet haftası devam ediyor.`);
      return;
    }

    const result = await finishLiveWeek(db, activeWeek, activePackage?.id || stringValue(activeWeek.data().schedulePackageId));
    messages.push(
      `${kind}: Hafta kapatıldı${result.winnerId ? ` — kazanan: ${result.stats?.winnerName || result.winnerId}` : ""}${result.awarded ? `, ${result.awarded} kullanıcıya kahin puanı` : ""}.`
    );
  } else if (activePackage) {
    if (activePackage.liveWeekId) {
      const weekSnap = await db.doc(`prophecyWeeks/${activePackage.liveWeekId}`).get();
      if (weekSnap.exists) {
        await finishLiveWeek(db, weekSnap as admin.firestore.QueryDocumentSnapshot, activePackage.id);
      }
    }
    await db.doc(`${PROPHECY_PACKAGES_COLLECTION}/${activePackage.id}`).set(
      { status: "finished", updatedAt: admin.firestore.FieldValue.serverTimestamp() },
      { merge: true }
    );
  }

  const refreshed = await loadAllProphecyPackages(db);
  const scheduledPackage = pickNextScheduledPackage(refreshed, kind, now, { immediate: force });
  const automaticPackage = scheduledPackage ? null : await createAutomaticPackage(db, kind, now);
  if (!scheduledPackage && !automaticPackage) {
      messages.push(`${kind}: Otomatik hafta için yeterli yayınlanmış içerik yok.`);
      return;
  }
  if (automaticPackage) {
    messages.push(`${kind}: Yayınlanmış içeriklerden otomatik hafta hazırlandı.`);
  }
  let nextPackage = scheduledPackage ?? automaticPackage;
  if (!nextPackage) return;

  if (force) {
    nextPackage = realignPackageWeekDates(nextPackage, now);
    await db.doc(`${PROPHECY_PACKAGES_COLLECTION}/${nextPackage.id}`).set(
      {
        startsAt: nextPackage.startsAt,
        endsAt: nextPackage.endsAt,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
  }

  await activateProphecyPackage(db, nextPackage);
  messages.push(`${kind}: "${nextPackage.title}" paketi otomatik başlatıldı.`);
}

function localizedRecord(value: unknown) {
  if (typeof value === "string") return { tr: value.trim(), en: value.trim(), ru: value.trim(), uz: value.trim() };
  if (!value || typeof value !== "object") return { tr: "", en: "", ru: "", uz: "" };
  const record = value as Record<string, unknown>;
  const tr = firstString([record.tr, record.en, record.ru, record.uz, record.all]);
  return {
    tr,
    en: firstString([record.en, tr]),
    ru: firstString([record.ru, tr]),
    uz: firstString([record.uz, tr])
  };
}

function firstString(values: unknown[]) {
  return values.find((value): value is string => typeof value === "string" && Boolean(value.trim()))?.trim() ?? "";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && Boolean(item)) : [];
}

function calendarDayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function automaticTitle(kind: ProphecyPackageKind, fallback: string) {
  if (kind === "artist") {
    return { tr: fallback, en: "Artist Prophecy Week", ru: "Неделя прогнозов художников", uz: "San'atkorlar bashorati haftasi" };
  }
  return { tr: fallback, en: "Artwork Prophecy Week", ru: "Неделя прогнозов произведений", uz: "Asarlar bashorati haftasi" };
}

function automaticQuestion(kind: ProphecyPackageKind, fallback: string) {
  if (kind === "artist") {
    return { tr: fallback, en: "Which artist will win this week's duels?", ru: "Какой художник победит в дуэлях недели?", uz: "Bu haftalik duellarda qaysi san'atkor g'olib bo'ladi?" };
  }
  return { tr: fallback, en: "Which artwork will win this week's duels?", ru: "Какое произведение победит в дуэлях недели?", uz: "Bu haftalik duellarda qaysi asar g'olib bo'ladi?" };
}

function hashString(value: string) {
  return [...value].reduce((hash, character) => Math.imul(hash ^ character.charCodeAt(0), 16777619) >>> 0, 2166136261);
}

function seededShuffle<T>(items: T[], seed: string) {
  const next = [...items];
  let state = hashString(seed) || 1;
  for (let index = next.length - 1; index > 0; index -= 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const target = state % (index + 1);
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}
