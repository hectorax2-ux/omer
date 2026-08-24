const ISTANBUL_OFFSET_MS = 3 * 60 * 60 * 1000;

function toDate(value: string | Date = new Date()) {
  return value instanceof Date ? value : new Date(value);
}

export function getArtistLetterDayKey(value: string | Date = new Date()) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  const istanbul = new Date(date.getTime() + ISTANBUL_OFFSET_MS);
  const year = istanbul.getUTCFullYear();
  const month = String(istanbul.getUTCMonth() + 1).padStart(2, "0");
  const day = String(istanbul.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getNextArtistLetterResetAt(value: string | Date = new Date()) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return new Date();
  const istanbul = new Date(date.getTime() + ISTANBUL_OFFSET_MS);
  return new Date(Date.UTC(istanbul.getUTCFullYear(), istanbul.getUTCMonth(), istanbul.getUTCDate() + 1) - ISTANBUL_OFFSET_MS);
}

export function getArtistLetterResetRemainingMs(value: string | Date = new Date()) {
  return Math.max(0, getNextArtistLetterResetAt(value).getTime() - toDate(value).getTime());
}

export function isSameArtistLetterWindow(createdAt: string, now: string | Date = new Date()) {
  const createdKey = getArtistLetterDayKey(createdAt);
  return Boolean(createdKey) && createdKey === getArtistLetterDayKey(now);
}
