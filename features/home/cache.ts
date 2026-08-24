import AsyncStorage from "@react-native-async-storage/async-storage";
import type { HomeCachedEnvelope, HomeExposure, HomeFeedModel, JourneyProgress } from "./types";

const CACHE_PREFIX = "art-atlas:home-v2";
const MAX_EXPOSURES = 120;
const MAX_CACHE_AGE_MS = 48 * 60 * 60 * 1000;

export async function loadHomeFeedCache(uidScope: string) {
  const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}:feed:${uidScope}`);
  if (!raw) return null;
  const parsed = safeJson<HomeCachedEnvelope>(raw);
  if (!parsed || parsed.schemaVersion !== 1 || parsed.uidScope !== uidScope) return null;
  if (Date.now() - parsed.savedAt > MAX_CACHE_AGE_MS) return null;
  return parsed.feed;
}

export async function saveHomeFeedCache(uidScope: string, feed: HomeFeedModel) {
  const envelope: HomeCachedEnvelope = { schemaVersion: 1, uidScope, savedAt: Date.now(), feed };
  await AsyncStorage.setItem(`${CACHE_PREFIX}:feed:${uidScope}`, JSON.stringify(envelope));
}

export async function loadHomeExposures(uidScope: string) {
  const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}:exposures:${uidScope}`);
  const parsed = raw ? safeJson<HomeExposure[]>(raw) : null;
  return Array.isArray(parsed) ? parsed.filter(validExposure).slice(0, MAX_EXPOSURES) : [];
}

export async function recordHomeExposures(uidScope: string, dayKey: string, ids: string[], status: HomeExposure["status"] = "seen") {
  const current = await loadHomeExposures(uidScope);
  const next = [...new Set(ids.filter(Boolean))].map((id) => ({ id, dayKey, status }));
  const deduped = [...next, ...current].reduce<HomeExposure[]>((entries, entry) => {
    const existingIndex = entries.findIndex((candidate) => candidate.id === entry.id && candidate.dayKey === entry.dayKey);
    if (existingIndex < 0) return [...entries, entry];
    if (entry.status === "opened" && entries[existingIndex].status !== "opened") return entries.map((candidate, index) => index === existingIndex ? entry : candidate);
    return entries;
  }, []);
  await AsyncStorage.setItem(`${CACHE_PREFIX}:exposures:${uidScope}`, JSON.stringify(deduped.slice(0, MAX_EXPOSURES)));
}

export async function loadLocalJourneyProgress(uidScope: string) {
  const raw = await AsyncStorage.getItem(`${CACHE_PREFIX}:journey:${uidScope}`);
  return raw ? safeJson<JourneyProgress>(raw) : null;
}

export async function saveLocalJourneyProgress(uidScope: string, progress: JourneyProgress) {
  await AsyncStorage.setItem(`${CACHE_PREFIX}:journey:${uidScope}`, JSON.stringify(progress));
}

function safeJson<T>(raw: string) {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function validExposure(value: unknown): value is HomeExposure {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<HomeExposure>;
  return typeof candidate.id === "string"
    && typeof candidate.dayKey === "string"
    && (candidate.status === undefined || candidate.status === "seen" || candidate.status === "opened");
}
