import { countryOptions } from "@/utils/country-options";

export function normalizeCountryInput(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .replaceAll("İ", "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function findCountryByInput(value: string) {
  const normalized = normalizeCountryInput(value);
  if (!normalized) {
    return null;
  }

  return countryOptions.find((country) => {
    const names = [
      country.code,
      country.id,
      country.name.tr,
      country.name.en,
      country.name.ru,
      country.name.uz
    ];
    return names.some((name) => normalizeCountryInput(name) === normalized);
  }) ?? null;
}

export function getCanonicalCountryName(value: string) {
  return findCountryByInput(value)?.name.tr ?? null;
}

export function resolveCountryId(value?: string) {
  if (!value?.trim()) return undefined;
  return findCountryByInput(value)?.id;
}

export function resolveCountryCode(value?: string) {
  if (!value?.trim()) return null;
  const match = findCountryByInput(value);
  if (match) return match.code;
  const trimmed = value.trim().toUpperCase();
  if (/^[A-Z]{2,3}$/.test(trimmed)) return trimmed;
  return null;
}

export function resolveCountryCodeFromUser(user?: { country?: string; countryId?: string; countryCode?: string }) {
  if (!user) return null;
  if (user.countryCode?.trim()) return user.countryCode.trim().toUpperCase();
  if (user.countryId) {
    const match = countryOptions.find((country) => country.id === user.countryId);
    if (match) return match.code;
  }
  return resolveCountryCode(user.country);
}

export type CountryIdentity = {
  uid?: string;
  username?: string;
  name?: string;
  country?: string;
  countryId?: string;
  countryCode?: string;
};

export function normalizeCountryLookupKey(value: string) {
  return value.trim().replace(/^@+/, "").toLocaleLowerCase("tr");
}

export function buildCountryCodeLookup(identities: CountryIdentity[]) {
  const lookup = new Map<string, string>();
  identities.forEach((identity) => {
    const code = resolveCountryCodeFromUser(identity);
    if (!code) return;
    if (identity.uid?.trim()) {
      const key = normalizeCountryLookupKey(identity.uid);
      if (!lookup.has(key)) lookup.set(key, code);
    }
    if (identity.username?.trim()) {
      const key = normalizeCountryLookupKey(identity.username);
      if (!lookup.has(key)) lookup.set(key, code);
    }
    if (identity.name?.trim()) {
      const key = normalizeCountryLookupKey(identity.name);
      if (!lookup.has(key)) lookup.set(key, code);
    }
  });
  return lookup;
}

export function lookupCountryCode(lookup: Map<string, string>, keys: (string | undefined | null)[]) {
  for (const key of keys) {
    if (!key?.trim()) continue;
    const code = lookup.get(normalizeCountryLookupKey(key));
    if (code) return code;
  }
  return null;
}
