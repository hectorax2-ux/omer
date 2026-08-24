export const PREMIUM_PROPHECY_CHANGE_COOLDOWN_HOURS = 2;
export const PREMIUM_PROPHECY_CHANGE_COOLDOWN_MS = PREMIUM_PROPHECY_CHANGE_COOLDOWN_HOURS * 60 * 60 * 1000;

export type ProphecyPredictionTimes = {
  createdAt?: string;
  updatedAt?: string;
};

export function timestampToIso(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

export function getProphecyLastWriteAt(times?: ProphecyPredictionTimes) {
  if (!times) return undefined;
  return times.updatedAt || times.createdAt;
}

export function getProphecyChangeCooldownRemainingMs(lastWriteAt?: string, cooldownMs = PREMIUM_PROPHECY_CHANGE_COOLDOWN_MS) {
  if (!lastWriteAt) return 0;
  const nextChangeAt = new Date(lastWriteAt).getTime() + cooldownMs;
  return Math.max(0, nextChangeAt - Date.now());
}

export function canChangeProphecyPrediction(times?: ProphecyPredictionTimes, cooldownMs = PREMIUM_PROPHECY_CHANGE_COOLDOWN_MS) {
  return getProphecyChangeCooldownRemainingMs(getProphecyLastWriteAt(times), cooldownMs) === 0;
}

export function formatProphecyCountdown(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const hours = Math.floor(totalSec / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
