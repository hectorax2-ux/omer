import { randomInt, randomUUID } from "node:crypto";
import * as admin from "firebase-admin";
import { logger } from "firebase-functions";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { applyChanceWeeklyQuota, drawChanceScore } from "./chance-card-core";
import { resolveTimelineCalendar } from "./timeline-game-core";
import { isActivePremium } from "./premium/premium-access";

const db = admin.firestore();
const FREE_DAILY_LIMIT = 1;
const PREMIUM_DAILY_LIMIT = 2;

type PublicChanceCard = {
  id: string;
  type: string;
  title: Record<string, string>;
  description: Record<string, string>;
  value: number | null;
  probability: number;
  active: boolean;
};

type ChanceCardResponse = {
  id: string;
  uid: string;
  username: string;
  displayName: string;
  countryCode: string | null;
  card: PublicChanceCard;
  score: number;
  activeScore: number;
  drawnAt: string;
  dayKey: string;
  weekKey: string;
  monthKey: string;
  leaderboardEligible: boolean;
};

export const drawChanceCard = onCall({ invoker: "public" }, async (request) => {
  const uid = requireUser(request.auth?.uid);
  const requestId = requireRequestId(request.data?.requestId);
  const profile = await db.collection("users").doc(uid).get();
  const profileData = profile.data() ?? {};
  const adminUser = profileData.role === "admin";
  const dailyLimit = activePremium(profileData) ? PREMIUM_DAILY_LIMIT : FREE_DAILY_LIMIT;
  const calendar = resolveTimelineCalendar(new Date(), stringField(request.data?.timeZone, "UTC"));
  const weekKey = mondayWeekKey(calendar.dayKey);
  const card = await selectChanceCard();
  const requestRef = db.collection("chanceCardDrawRequests").doc(`${uid}_${requestId}`);
  const quotaRef = db.collection("chanceCardWeeklyQuota").doc(weekKey);

  const response = await db.runTransaction(async (transaction) => {
    const previousRequest = await transaction.get(requestRef);
    if (previousRequest.exists) return previousRequest.get("response") as ChanceCardResponse;

    const drawRefs = adminUser
      ? []
      : Array.from({ length: dailyLimit }, (_, index) => db.collection("chanceCardDraws").doc(`${uid}_${calendar.dayKey}_${index + 1}`));
    const [quota, ...existingDraws] = await Promise.all([
      transaction.get(quotaRef),
      ...drawRefs.map((drawRef) => transaction.get(drawRef))
    ]);
    const availableIndex = existingDraws.findIndex((draw) => !draw.exists);
    if (!adminUser && availableIndex < 0) throw new HttpsError("resource-exhausted", "CHANCE_DAILY_LIMIT_REACHED");

    const sampled = drawChanceScore(randomUnit);
    const scored = adminUser
      ? { score: sampled.score, tier: sampled.tier, incrementHigh: 0, incrementJackpot: 0 }
      : applyChanceWeeklyQuota(
        sampled,
        numberField(quota.get("high93Count")),
        numberField(quota.get("jackpot98Count")),
        randomUnit
      );
    const drawRef = adminUser
      ? db.collection("chanceCardDraws").doc(`${uid}_${calendar.dayKey}_admin_${randomUUID()}`)
      : drawRefs[availableIndex];
    const drawnAt = admin.firestore.Timestamp.now();
    const activeScore = Math.max(
      scored.score,
      ...existingDraws.filter((draw) => draw.exists).map((draw) => numberField(draw.get("value")))
    );
    const result: ChanceCardResponse = {
      id: drawRef.id,
      uid,
      username: stringField(profileData.username, uid),
      displayName: stringField(profileData.displayName, stringField(profileData.name, stringField(profileData.username, uid))),
      countryCode: optionalString(profileData.countryCode),
      card,
      score: scored.score,
      activeScore,
      drawnAt: drawnAt.toDate().toISOString(),
      dayKey: calendar.dayKey,
      weekKey,
      monthKey: calendar.monthKey,
      leaderboardEligible: !adminUser
    };

    transaction.create(drawRef, {
      uid,
      username: result.username,
      displayName: result.displayName,
      countryCode: result.countryCode,
      cardId: card.id,
      cardType: card.type,
      value: scored.score,
      scoreTier: scored.tier,
      distributionVersion: 2,
      requestId,
      dayKey: calendar.dayKey,
      weekKey,
      monthKey: calendar.monthKey,
      leaderboardEligible: !adminUser,
      drawnAt,
      createdAt: drawnAt,
      updatedAt: drawnAt
    });
    if (!adminUser && (scored.incrementHigh > 0 || scored.incrementJackpot > 0)) {
      transaction.set(quotaRef, {
        weekKey,
        high93Count: numberField(quota.get("high93Count")) + scored.incrementHigh,
        jackpot98Count: numberField(quota.get("jackpot98Count")) + scored.incrementJackpot,
        updatedAt: drawnAt
      }, { merge: true });
    }
    transaction.create(requestRef, {
      uid,
      dayKey: calendar.dayKey,
      response: result,
      createdAt: drawnAt,
      updatedAt: drawnAt
    });
    return result;
  });

  logger.info("Chance card drawn on server.", {
    uid,
    drawId: response.id,
    score: response.score,
    dayKey: response.dayKey,
    weekKey: response.weekKey,
    leaderboardEligible: response.leaderboardEligible
  });
  return response;
});

async function selectChanceCard(): Promise<PublicChanceCard> {
  const snapshot = await db.collection("chanceCards").limit(80).get();
  const cards: admin.firestore.DocumentData[] = snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }) as admin.firestore.DocumentData)
    .filter((card) => card.active !== false && card.status !== "hidden" && card.status !== "archived");
  if (!cards.length) return defaultChanceCard();
  const total = cards.reduce((sum, card) => sum + Math.max(0, numberField(card.probability, 1)), 0);
  const cursor = randomUnit() * total;
  const selected = cards.reduce<{ card: admin.firestore.DocumentData | null; remaining: number }>((state, card) => {
    if (state.card) return state;
    const weight = Math.max(0, numberField(card.probability, 1));
    if (state.remaining < weight) return { card, remaining: state.remaining };
    return { card: null, remaining: state.remaining - weight };
  }, { card: null, remaining: cursor }).card ?? cards[0];
  return {
    id: stringField(selected.id, "daily-luck-points"),
    type: stringField(selected.type, "points"),
    title: localizedField(selected.title, "Daily luck score"),
    description: localizedField(selected.description, "Daily luck score"),
    value: typeof selected.value === "number" ? selected.value : null,
    probability: Math.max(0, numberField(selected.probability, 1)),
    active: true
  };
}

function defaultChanceCard(): PublicChanceCard {
  return {
    id: "daily-luck-points",
    type: "points",
    title: { tr: "Günlük şans puanı", en: "Daily luck score", ru: "Ежедневный балл удачи", uz: "Kunlik omad balli" },
    description: { tr: "Bugünkü şans kartı sonucu.", en: "Today's chance card result.", ru: "Результат карты удачи за сегодня.", uz: "Bugungi omad kartasi natijasi." },
    value: null,
    probability: 1,
    active: true
  };
}

function mondayWeekKey(dayKey: string) {
  const date = new Date(`${dayKey}T00:00:00.000Z`);
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday);
  return date.toISOString().slice(0, 10);
}

function activePremium(profile: admin.firestore.DocumentData) {
  return isActivePremium(profile);
}

function localizedField(value: unknown, fallback: string) {
  if (typeof value === "string") return { tr: value, en: value, ru: value, uz: value };
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const first = [source.tr, source.en, source.ru, source.uz].find((item) => typeof item === "string") as string | undefined;
  const resolved = first ?? fallback;
  return {
    tr: stringField(source.tr, resolved),
    en: stringField(source.en, resolved),
    ru: stringField(source.ru, resolved),
    uz: stringField(source.uz, resolved)
  };
}

function requireUser(uid: unknown) {
  if (typeof uid === "string" && uid) return uid;
  throw new HttpsError("unauthenticated", "CHANCE_SIGN_IN_REQUIRED");
}

function requireRequestId(value: unknown) {
  const requestId = stringField(value);
  if (/^[A-Za-z0-9_-]{8,96}$/.test(requestId)) return requestId;
  throw new HttpsError("invalid-argument", "CHANCE_REQUEST_ID_INVALID");
}

function randomUnit() {
  return randomInt(0, 1_000_000) / 1_000_000;
}

function optionalString(value: unknown) {
  const result = stringField(value);
  return result || null;
}

function stringField(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberField(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
