export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
export const DISPLAY_NAME_MIN_LENGTH = 3;
export const DISPLAY_NAME_MAX_LENGTH = 25;

export function normalizeUsername(value: string) {
  return value.trim().slice(0, USERNAME_MAX_LENGTH);
}

export function normalizeDisplayName(value: string) {
  return value.trim().slice(0, DISPLAY_NAME_MAX_LENGTH);
}

export function isValidUsername(value: string) {
  const normalized = normalizeUsername(value);
  return normalized.length >= USERNAME_MIN_LENGTH && normalized.length <= USERNAME_MAX_LENGTH;
}

export function isValidDisplayName(value: string) {
  const normalized = normalizeDisplayName(value);
  return normalized.length >= DISPLAY_NAME_MIN_LENGTH && normalized.length <= DISPLAY_NAME_MAX_LENGTH;
}
