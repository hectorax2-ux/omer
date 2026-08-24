import { normalizeCountryLookupKey } from "@/utils/country-utils";

const fetchedCountryCache = new Map<string, string>();

export function readCachedCountryCode(username: string) {
  const key = normalizeCountryLookupKey(username);
  return fetchedCountryCache.get(key) ?? null;
}

export function writeCachedCountryCode(username: string, code: string) {
  fetchedCountryCache.set(normalizeCountryLookupKey(username), code.trim().toUpperCase());
}

export function invalidateCountryCache(keys: (string | undefined | null)[]) {
  keys.forEach((value) => {
    if (!value?.trim()) return;
    fetchedCountryCache.delete(normalizeCountryLookupKey(value));
  });
}
