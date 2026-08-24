import { getFunctions, httpsCallable } from "firebase/functions";
import { ChanceCard, ChanceDraw } from "@/types/art-systems";
import { firebaseApp } from "@/src/services/firebase";

type ServerChanceCard = Omit<ChanceCard, "value"> & { value: number | null };

type ChanceCardResponse = {
  id: string;
  uid: string;
  username: string;
  displayName: string;
  countryCode: string | null;
  card: ServerChanceCard;
  score: number;
  activeScore: number;
  drawnAt: string;
  dayKey: string;
  weekKey: string;
  monthKey: string;
  leaderboardEligible: boolean;
};

export async function openChanceCard(requestId: string, timeZone: string) {
  const callable = httpsCallable<{ requestId: string; timeZone: string }, ChanceCardResponse>(
    getFunctions(firebaseApp, "us-central1"),
    "drawChanceCard",
    { timeout: 15_000 }
  );
  const response = (await callable({ requestId, timeZone })).data;
  const card: ChanceCard = {
    ...response.card,
    value: typeof response.card.value === "number" ? response.card.value : undefined
  };
  const draw: ChanceDraw = {
    id: response.id,
    uid: response.uid,
    username: response.username,
    displayName: response.displayName,
    countryCode: response.countryCode ?? undefined,
    cardId: card.id,
    cardType: card.type,
    score: response.score,
    drawnAt: response.drawnAt,
    dayKey: response.dayKey,
    weekKey: response.weekKey,
    monthKey: response.monthKey,
    leaderboardEligible: response.leaderboardEligible
  };
  return { card, draw, activeScore: response.activeScore };
}
