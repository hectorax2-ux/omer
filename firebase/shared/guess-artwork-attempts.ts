import { istanbulCalendarDate } from "./competition-week";

export const GUESS_ARTWORK_ATTEMPTS_COLLECTION = "guessArtworkAttempts";

export type NormalizedGuessArtworkAttempt = {
  id: string;
  uid: string;
  username: string;
  displayName: string;
  countryCode?: string;
  score: number;
  dayKey: string;
  completedAtMs: number;
};

export function buildGuessArtworkAttemptId(uid: string, dayKey: string) {
  return `${uid}_${dayKey.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
}

export function todayGuessArtworkAttemptDayKey(reference = new Date()) {
  return istanbulCalendarDate(reference);
}

function stringField(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function numberField(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function normalizeGuessArtworkAttemptFromFirebase(id: string, raw: Record<string, unknown>): NormalizedGuessArtworkAttempt | null {
  const uid = stringField(raw.uid, id.split("_")[0]);
  const username = stringField(raw.username, uid);
  const displayName = stringField(raw.displayName, username);
  const dayKey = stringField(raw.dayKey, todayGuessArtworkAttemptDayKey());
  const completedAtMs = typeof raw.completedAtMs === "number" ? raw.completedAtMs : Date.now();
  const score = numberField(raw.score);
  const countryCode = stringField(raw.countryCode) || undefined;
  if (!uid || !username) return null;
  return { id, uid, username, displayName, countryCode, score, dayKey, completedAtMs };
}
