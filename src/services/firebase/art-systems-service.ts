import { doc, getDoc, increment, runTransaction, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { firestoreDb } from "./core";
import { createDocument, firestoreQuery, getDocument, listDocuments, updateDocument } from "@/src/services/firebase/firestore-helpers";
import {
  ArtDuel,
  ArtDnaPoolResult,
  ArtDnaResult,
  ArtSystemsNotification,
  ChanceCard,
  PersonalMuseum,
  ProphecyWeek,
  SeerLevel,
  TimeCapsule
} from "@/types/art-systems";

type FirestoreMeta = {
  createdAt: unknown;
  updatedAt: unknown;
};

export type ArtDuelDocument = ArtDuel & FirestoreMeta;
export type ProphecyWeekDocument = ProphecyWeek & FirestoreMeta;
export type SeerLevelDocument = SeerLevel & FirestoreMeta;
export type ArtDnaPoolDocument = ArtDnaPoolResult & FirestoreMeta;
export type ArtDnaResultDocument = ArtDnaResult & FirestoreMeta & { uid: string };
export type ChanceCardDocument = ChanceCard & FirestoreMeta;
export type ChanceCardDrawDocument = {
  id: string;
  uid: string;
  username?: string;
  displayName?: string;
  countryCode?: string;
  cardId: string;
  cardType: ChanceCard["type"];
  value?: number;
  dayKey?: string;
  weekKey?: string;
  monthKey?: string;
  leaderboardEligible?: boolean;
  drawnAt?: unknown;
  createdAt: unknown;
  updatedAt: unknown;
};
export type PersonalMuseumDocument = PersonalMuseum & FirestoreMeta;
export type TimeCapsuleDocument = Omit<TimeCapsule, "note"> & FirestoreMeta & {
  uid: string;
  noteEncrypted?: string;
  dayKey?: string;
};
export type ArtSystemsNotificationDocument = ArtSystemsNotification & FirestoreMeta & {
  uid?: string;
};

export type DuelVoteDocument = {
  id: string;
  uid: string;
  side: "a" | "b";
  changeCount?: number;
  createdAt: unknown;
  updatedAt?: unknown;
};

export async function listActiveDuels(maxResults = 10): Promise<ArtDuelDocument[]> {
  const duels = await listDocuments<ArtDuelDocument>("duels", [
    firestoreQuery.where("active", "==", true),
    firestoreQuery.limit(maxResults)
  ]);
  return duels
    .filter((duel) => {
      const status = String(duel.status ?? "");
      return !status || status === "active" || status === "published";
    })
    .sort((a, b) => timestampToMillis(b.startsAt) - timestampToMillis(a.startsAt));
}

export async function createOrUpdateDuelVote(duelId: string, uid: string, side: "a" | "b") {
  const voteRef = doc(firestoreDb, "duels", duelId, "votes", uid);
  const snapshot = await getDoc(voteRef);
  if (snapshot.exists()) {
    throw new Error("Bu eşleşmeye daha önce oy verdiniz.");
  }

  await setDoc(voteRef, {
    uid,
    side,
    createdAt: serverTimestamp()
  });
  await updateDoc(doc(firestoreDb, "duels", duelId), {
    [side === "a" ? "votesA" : "votesB"]: increment(1),
    updatedAt: serverTimestamp()
  });
}

export async function getDuelVote(duelId: string, uid: string): Promise<DuelVoteDocument | null> {
  const snapshot = await getDoc(doc(firestoreDb, "duels", duelId, "votes", uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as DuelVoteDocument : null;
}

export async function castOrChangeDuelVote(duelId: string, uid: string, side: "a" | "b", canChange: boolean, unlimited = false) {
  const voteRef = doc(firestoreDb, "duels", duelId, "votes", uid);

  await runTransaction(firestoreDb, async (transaction) => {
    const voteSnapshot = await transaction.get(voteRef);
    const now = serverTimestamp();

    if (!voteSnapshot.exists()) {
      transaction.set(voteRef, {
        uid,
        side,
        changeCount: 0,
        createdAt: now,
        updatedAt: now
      });
      return;
    }

    const current = voteSnapshot.data() as DuelVoteDocument;
    if (current.side === side) {
      return;
    }
    if (!canChange || (!unlimited && (current.changeCount ?? 0) >= 1)) {
      throw new Error("Bu düelloda oy değiştirme hakkınız kalmadı.");
    }

    transaction.update(voteRef, {
      side,
      changeCount: increment(1),
      updatedAt: now
    });
  });
}

export async function createDuelDocument(input: Omit<ArtDuelDocument, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  return createDocument<ArtDuelDocument>("duels", input);
}

export async function updateDuelDocument(id: string, input: Partial<Omit<ArtDuelDocument, "id" | "createdAt" | "updatedAt">>) {
  return updateDocument<ArtDuelDocument>("duels", id, input);
}

export async function getActiveProphecyWeek(): Promise<ProphecyWeekDocument | null> {
  const weeks = await listDocuments<ProphecyWeekDocument>("prophecyWeeks", [
    firestoreQuery.orderBy("startsAt", "desc"),
    firestoreQuery.limit(1)
  ]);
  return weeks[0] ?? null;
}

export async function listActiveProphecyWeeks(maxResults = 20): Promise<ProphecyWeekDocument[]> {
  const weeks = await listDocuments<ProphecyWeekDocument>("prophecyWeeks", [
    firestoreQuery.limit(maxResults)
  ]);
  return weeks
    .filter((week) => {
      const status = (week as ProphecyWeekDocument & { status?: string }).status;
      return !status || status === "active" || status === "published";
    })
    .sort((a, b) => timestampToMillis(b.startsAt) - timestampToMillis(a.startsAt));
}

export async function listProphecyWeeksForDisplay(maxResults = 40): Promise<ProphecyWeekDocument[]> {
  const weeks = await listDocuments<ProphecyWeekDocument>("prophecyWeeks", [firestoreQuery.limit(maxResults)]);
  return weeks.sort((a, b) => timestampToMillis(b.startsAt) - timestampToMillis(a.startsAt));
}

export type SeerScoreDocument = {
  id: string;
  uid: string;
  username: string;
  displayName: string;
  totalPoints: number;
  monthPoints: number;
  threeMonthPoints: number;
  rankingStatus?: "active" | "hidden" | "removed";
};

export type RankingOverrideDocument = {
  id: string;
  chance?: {
    rankingStatus?: "active" | "hidden" | "removed";
    displayName?: string;
    username?: string;
    scoreAdjust?: number;
  };
};

export async function listRankingOverrides(maxResults = 200): Promise<RankingOverrideDocument[]> {
  return listDocuments<RankingOverrideDocument>("rankingOverrides", [firestoreQuery.limit(maxResults)]);
}

export async function listSeerScores(maxResults = 100): Promise<SeerScoreDocument[]> {
  const scores = await listDocuments<SeerScoreDocument>("seerScores", [firestoreQuery.limit(maxResults)]);
  return scores.sort((a, b) => (b.threeMonthPoints ?? 0) - (a.threeMonthPoints ?? 0));
}

export async function getSeerScore(uid: string): Promise<SeerScoreDocument | null> {
  return getDocument<SeerScoreDocument>("seerScores", uid);
}

export async function getProphecyPrediction(weekId: string, uid: string): Promise<{ id: string; uid: string; candidateId: string; createdAt?: unknown; updatedAt?: unknown } | null> {
  const snapshot = await getDoc(doc(firestoreDb, "prophecyWeeks", weekId, "predictions", uid));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } as { id: string; uid: string; candidateId: string; createdAt?: unknown; updatedAt?: unknown } : null;
}

export async function upsertProphecyPrediction(weekId: string, uid: string, candidateId: string, allowChange = false, unlimited = false) {
  const predictionRef = doc(firestoreDb, "prophecyWeeks", weekId, "predictions", uid);
  await runTransaction(firestoreDb, async (transaction) => {
    const predictionSnapshot = await transaction.get(predictionRef);
    const previousCandidateId = predictionSnapshot.exists() ? String(predictionSnapshot.data()?.candidateId || "") : "";

    if (predictionSnapshot.exists()) {
      if (!allowChange) throw new Error("Bu haftaki tahmin değiştirilemez.");
      if (previousCandidateId === candidateId) return;
      const predictionData = predictionSnapshot.data();
      const lastWrite = predictionData?.updatedAt || predictionData?.createdAt;
      if (lastWrite && !unlimited) {
        const lastWriteMs = typeof lastWrite === "object" && lastWrite !== null && "toDate" in lastWrite
          ? (lastWrite as { toDate: () => Date }).toDate().getTime()
          : new Date(String(lastWrite)).getTime();
        if (!Number.isNaN(lastWriteMs) && Date.now() < lastWriteMs + 2 * 60 * 60 * 1000) {
          throw new Error("Değişiklik için 2 saat beklemeniz gerekiyor.");
        }
      }
      transaction.update(predictionRef, { candidateId, updatedAt: serverTimestamp() });
      return;
    }

    transaction.set(predictionRef, { uid, candidateId, createdAt: serverTimestamp() });
  });
}

export async function createProphecyPrediction(weekId: string, uid: string, candidateId: string) {
  return upsertProphecyPrediction(weekId, uid, candidateId, false);
}

export async function listSeerLevels(): Promise<SeerLevelDocument[]> {
  return listDocuments<SeerLevelDocument>("seerLevels", [
    firestoreQuery.orderBy("requiredPoints", "asc")
  ]);
}

export async function listArtDnaPools(): Promise<ArtDnaPoolDocument[]> {
  return listDocuments<ArtDnaPoolDocument>("artDnaPools", [
    firestoreQuery.where("active", "==", true),
    firestoreQuery.limit(40)
  ]);
}

export async function saveArtDnaResult(uid: string, result: Omit<ArtDnaResultDocument, "id" | "uid" | "createdAt" | "updatedAt">) {
  return createDocument<ArtDnaResultDocument>("artDnaResults", { ...result, uid });
}

export async function listActiveChanceCards(): Promise<ChanceCardDocument[]> {
  const cards = await listDocuments<ChanceCardDocument>("chanceCards", [
    firestoreQuery.limit(80)
  ]);
  return cards.filter((card) => card.active !== false && (card as ChanceCardDocument & { status?: string }).status !== "hidden" && (card as ChanceCardDocument & { status?: string }).status !== "archived");
}

export async function saveChanceCardDraw(input: Omit<ChanceCardDrawDocument, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  return createDocument<ChanceCardDrawDocument>("chanceCardDraws", input);
}

export async function getChanceCardDraw(id: string): Promise<ChanceCardDrawDocument | null> {
  return getDocument<ChanceCardDrawDocument>("chanceCardDraws", id);
}

export async function listChanceCardDraws(maxResults = 500): Promise<ChanceCardDrawDocument[]> {
  return listDocuments<ChanceCardDrawDocument>("chanceCardDraws", [
    firestoreQuery.orderBy("createdAt", "desc"),
    firestoreQuery.limit(maxResults)
  ]);
}

export async function listUserChanceCardDraws(uid: string, maxResults = 200): Promise<ChanceCardDrawDocument[]> {
  const draws = await listDocuments<ChanceCardDrawDocument>("chanceCardDraws", [
    firestoreQuery.where("uid", "==", uid),
    firestoreQuery.limit(maxResults)
  ]);
  return draws.sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
}

function timestampToMillis(value: unknown) {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

export async function getPersonalMuseum(ownerUsername: string): Promise<PersonalMuseumDocument | null> {
  const museums = await listDocuments<PersonalMuseumDocument>("personalMuseums", [
    firestoreQuery.where("ownerUsername", "==", ownerUsername),
    firestoreQuery.limit(1)
  ]);
  return museums[0] ?? null;
}

export async function createPersonalMuseumDocument(input: Omit<PersonalMuseumDocument, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  return createDocument<PersonalMuseumDocument>("personalMuseums", input);
}

export async function updatePersonalMuseumDocument(id: string, input: Partial<Omit<PersonalMuseumDocument, "id" | "createdAt" | "updatedAt">>) {
  return updateDocument<PersonalMuseumDocument>("personalMuseums", id, input);
}

export async function listPublicPersonalMuseums(maxResults = 50): Promise<PersonalMuseumDocument[]> {
  return listDocuments<PersonalMuseumDocument>("personalMuseums", [
    firestoreQuery.where("active", "==", true),
    firestoreQuery.orderBy("createdAt", "desc"),
    firestoreQuery.limit(maxResults)
  ]);
}

export async function listPersonalMuseumsForOwner(ownerId: string, ownerUsername: string, maxResults = 5): Promise<PersonalMuseumDocument[]> {
  const direct = await getDocument<PersonalMuseumDocument>("personalMuseums", ownerId);
  if (direct) return [direct];

  const byOwnerId = await listDocuments<PersonalMuseumDocument>("personalMuseums", [
    firestoreQuery.where("ownerId", "==", ownerId),
    firestoreQuery.orderBy("createdAt", "desc"),
    firestoreQuery.limit(maxResults)
  ]);
  if (byOwnerId.length) return byOwnerId;
  if (!ownerUsername) return [];
  return listDocuments<PersonalMuseumDocument>("personalMuseums", [
    firestoreQuery.where("ownerUsername", "==", ownerUsername),
    firestoreQuery.limit(maxResults)
  ]);
}

export async function listAllPersonalMuseums(maxResults = 300): Promise<PersonalMuseumDocument[]> {
  return listDocuments<PersonalMuseumDocument>("personalMuseums", [
    firestoreQuery.orderBy("createdAt", "desc"),
    firestoreQuery.limit(maxResults)
  ]);
}

export async function createTimeCapsuleDocument(input: Omit<TimeCapsuleDocument, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  return createDocument<TimeCapsuleDocument>("timeCapsules", input);
}

export async function listUserTimeCapsules(uid: string, maxResults = 50): Promise<TimeCapsuleDocument[]> {
  const capsules = await listDocuments<TimeCapsuleDocument>("timeCapsules", [
    firestoreQuery.where("uid", "==", uid),
    firestoreQuery.limit(maxResults)
  ]);
  return capsules.sort((a, b) => timestampToMillis(b.createdAt) - timestampToMillis(a.createdAt));
}

export async function getTimeCapsuleDocument(id: string): Promise<TimeCapsuleDocument | null> {
  return getDocument<TimeCapsuleDocument>("timeCapsules", id);
}

export async function updateTimeCapsuleStatus(id: string, input: Partial<Pick<TimeCapsuleDocument, "active" | "opened">>) {
  return updateDocument<TimeCapsuleDocument>("timeCapsules", id, input);
}

export async function createArtSystemsNotification(input: Omit<ArtSystemsNotificationDocument, "id" | "createdAt" | "updatedAt"> & { id?: string }) {
  return createDocument<ArtSystemsNotificationDocument>("notifications", input);
}
