import {
  createPoolEntry,
  resolveWinnerPoolId,
  resetDuelTypeState,
  type DuelPoolEntry,
  type DuelTypeState
} from "./duel-automation";
import type { ProphecyPackageKind } from "./prophecy-schedule";

export const WEEKLY_CANDIDATE_COUNT = 8;

export function createWeeklyCandidateSlots(count = WEEKLY_CANDIDATE_COUNT): DuelPoolEntry[] {
  return Array.from({ length: count }, () => createPoolEntry());
}

export function defaultProphecyQuestion(kind: ProphecyPackageKind) {
  return kind === "artwork"
    ? "Bu haftanın eser düellosunda hangi eser birinci olacak?"
    : "Bu haftanın sanatçı düellosunda hangi sanatçı birinci olacak?";
}

export function defaultProphecyTitle(kind: ProphecyPackageKind, now = new Date()) {
  const label = `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
  return kind === "artwork" ? `Eser Kehaneti ${label}` : `Sanatçı Kehaneti ${label}`;
}

export function poolFromCandidates(candidates: DuelPoolEntry[]) {
  return candidates.filter((entry) => entry.title.trim());
}

export function resolveChampionPoolIdFromDuelData(
  data: { votesA?: number; votesB?: number; sideAPoolId?: string; sideBPoolId?: string },
  fallbackPoolId?: string
) {
  return (
    resolveWinnerPoolId(data.votesA ?? 0, data.votesB ?? 0, data.sideAPoolId, data.sideBPoolId) ||
    fallbackPoolId
  );
}

export { resetDuelTypeState };
export type { DuelTypeState, ProphecyPackageKind };
