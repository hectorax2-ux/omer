import * as admin from "firebase-admin";
import {
  advanceDuelBracket,
  buildDuelFirestorePayload,
  defaultDuelAutomationConfig,
  duelDescriptionForType,
  duelTitleForType,
  DUEL_AUTOMATION_COLLECTION,
  DUEL_AUTOMATION_DOC_ID,
  getDailyDuelWindow,
  needsInitialDailyDuel,
  normalizeDuelAutomationConfig,
  resolveLoserPoolId,
  resolveWinnerPoolId,
  shouldRotateDailyDuel,
  type DuelAutomationConfig
} from "./duel-automation";
import { rotateScheduledProphecyAdmin } from "./prophecy-schedule-runner";

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

async function loadConfig(db: admin.firestore.Firestore): Promise<DuelAutomationConfig> {
  const snapshot = await db.doc(`${DUEL_AUTOMATION_COLLECTION}/${DUEL_AUTOMATION_DOC_ID}`).get();
  if (!snapshot.exists) return defaultDuelAutomationConfig();
  return normalizeDuelAutomationConfig(snapshot.data() as Partial<DuelAutomationConfig>);
}

async function saveConfig(db: admin.firestore.Firestore, config: DuelAutomationConfig) {
  await db.doc(`${DUEL_AUTOMATION_COLLECTION}/${DUEL_AUTOMATION_DOC_ID}`).set({ ...config, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
}

async function findActiveDuel(db: admin.firestore.Firestore, type: "artwork" | "artist") {
  const snapshot = await db.collection("duels").where("kind", "==", type).where("active", "==", true).limit(1).get();
  return snapshot.docs[0] ?? null;
}

async function rotateDailyType(
  db: admin.firestore.Firestore,
  config: DuelAutomationConfig,
  type: "artwork" | "artist",
  force: boolean,
  messages: string[]
) {
  const pool = type === "artwork" ? config.artworkPool : config.artistPool;
  const state = type === "artwork" ? { ...config.artworkState } : { ...config.artistState };
  const usablePool = pool.filter((entry) => entry.title.trim());

  const activeWeekSnapshot = await db.collection("prophecyWeeks").where("kind", "==", type).where("status", "==", "active").limit(1).get();
  if (activeWeekSnapshot.empty) {
    messages.push(`${type}: Aktif kehanet haftası yok, günlük düello atlandı.`);
    return state;
  }

  if (usablePool.length < 2) {
    messages.push(`${type}: Havuzda en az 2 isim olmalı.`);
    return state;
  }

  if (state.bracketComplete) {
    messages.push(`${type}: Haftalık eleme tamamlandı, yeni düello beklenmiyor.`);
    return state;
  }

  const activeDuel = await findActiveDuel(db, type);
  const activeDuelEndsAt = activeDuel ? toDate(activeDuel.data().endsAt) : null;
  const shouldRotate =
    force ||
    needsInitialDailyDuel(state, true, Boolean(activeDuel)) ||
    shouldRotateDailyDuel(state, config.dailyRotationHour, activeDuelEndsAt, new Date(), config.timezone);

  if (!shouldRotate) {
    messages.push(`${type}: Günlük rotasyon saati henüz gelmedi.`);
    return state;
  }

  let closedDuel: { winnerPoolId?: string; loserPoolId?: string } | undefined;
  if (activeDuel) {
    const data = activeDuel.data();
    closedDuel = {
      winnerPoolId:
        resolveWinnerPoolId(numberValue(data.votesA), numberValue(data.votesB), stringValue(data.sideAPoolId), stringValue(data.sideBPoolId)) ||
        state.lastWinnerPoolId,
      loserPoolId: resolveLoserPoolId(numberValue(data.votesA), numberValue(data.votesB), stringValue(data.sideAPoolId), stringValue(data.sideBPoolId))
    };
    await activeDuel.ref.update({
      active: false,
      status: "finished",
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    messages.push(`${type}: Önceki düello kapatıldı.`);
  }

  const bracket = advanceDuelBracket(usablePool, state, closedDuel);
  if (bracket.bracketComplete) {
    const champion = usablePool.find((entry) => entry.id === bracket.nextState.lastWinnerPoolId);
    messages.push(`${type}: Eleme tamamlandı${champion ? ` → ${champion.title}` : ""}.`);
    return bracket.nextState;
  }

  if (!bracket.pair) {
    messages.push(`${type}: Yeni eşleşme oluşturulamadı.`);
    return state;
  }

  const window = getDailyDuelWindow(config.dailyRotationHour, new Date(), config.timezone);
  const payload = buildDuelFirestorePayload({
    type,
    title: duelTitleForType(type),
    description: duelDescriptionForType(type),
    sideA: bracket.pair[0],
    sideB: bracket.pair[1],
    startsAt: window.startsAt,
    endsAt: window.endsAt
  });

  const created = await db.collection("duels").add({
    ...payload,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  messages.push(`${type}: Yeni düello → ${bracket.pair[0].title} vs ${bracket.pair[1].title}`);

  return {
    ...bracket.nextState,
    lastRotationDayKey: window.dayKey,
    currentDuelId: created.id
  };
}

export async function runDuelAutomationAdmin(force = false) {
  const db = admin.firestore();
  const messages: string[] = [];
  let config = await loadConfig(db);

  if (!config.enabled && !force) {
    config.enabled = true;
    messages.push("Düello otomasyonu production akışı için etkinleştirildi.");
  }

  await rotateScheduledProphecyAdmin("artwork", force, messages);
  await rotateScheduledProphecyAdmin("artist", force, messages);

  // Prophecy rotation writes the newly selected live candidates into the automation
  // pool. Reload before creating daily duels so a stale config cannot erase that pool.
  config = await loadConfig(db);
  config.enabled = true;

  config.artworkState = await rotateDailyType(db, config, "artwork", force, messages);
  config.artistState = await rotateDailyType(db, config, "artist", force, messages);

  await saveConfig(db, config);

  return { ok: true, messages };
}
