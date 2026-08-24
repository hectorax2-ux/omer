import { getFunctions, httpsCallable } from "firebase/functions";

let lastCatchUpAt = 0;

export async function requestDuelRotationCatchUp() {
  const now = Date.now();
  if (now - lastCatchUpAt < 5 * 60 * 1000) return;
  lastCatchUpAt = now;
  const callable = httpsCallable<void, { ok?: boolean }>(getFunctions(), "ensureDuelRotation");
  await callable().catch(() => undefined);
}

export function hasExpiredActiveDuel(endsAt: unknown) {
  if (!endsAt) return false;
  const endDate =
    typeof endsAt === "object" && endsAt !== null && "toDate" in endsAt && typeof (endsAt as { toDate: () => Date }).toDate === "function"
      ? (endsAt as { toDate: () => Date }).toDate()
      : new Date(String(endsAt));
  return !Number.isNaN(endDate.getTime()) && endDate.getTime() <= Date.now();
}
