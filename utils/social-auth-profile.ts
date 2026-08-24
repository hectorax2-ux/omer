import {
  DISPLAY_NAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  normalizeDisplayName,
  normalizeUsername
} from "@/constants/account-limits";

export function socialUsername(email: string, uid: string) {
  const suffix = uid.replace(/[^a-zA-Z0-9]/g, "").slice(0, 6).toLocaleLowerCase("en") || "member";
  const emailStem = email.split("@")[0]?.replace(/[^a-zA-Z0-9._-]/g, "").replace(/^[._-]+|[._-]+$/g, "") || "user";
  return normalizeUsername(`${emailStem.slice(0, USERNAME_MAX_LENGTH - suffix.length - 1)}_${suffix}`);
}

export function socialDisplayName(candidate: string, email: string, uid: string) {
  const normalized = normalizeDisplayName(candidate);
  if (normalized.length >= DISPLAY_NAME_MIN_LENGTH) return normalized;
  return socialUsername(email, uid);
}
