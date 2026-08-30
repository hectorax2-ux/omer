import { countryOptions, type CountryOption } from "@/utils/country-options";
import type { Language } from "@/types/content";

const countryLocales: Record<Language, string> = {
  tr: "tr-TR",
  en: "en-US",
  ru: "ru-RU",
  uz: "uz-UZ"
};

export function normalizeCountryInput(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .replaceAll("İ", "i")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[ʻʼ‘’']/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "");
}

const countryIndex = countryOptions.map((country) => ({
  country,
  terms: [country.code, country.id, ...Object.values(country.name), ...country.aliases].map(normalizeCountryInput)
}));
const sortedCountries = new Map<Language, CountryOption[]>();

export function findCountryByInput(value: string) {
  const normalized = normalizeCountryInput(value);
  if (!normalized) {
    return null;
  }

  return countryIndex.find((entry) => entry.terms.includes(normalized))?.country ?? null;
}

export function findCountryByCode(code?: string | null) {
  if (!code?.trim()) return null;
  const normalized = code.trim().toUpperCase();
  return countryOptions.find((country) => country.code === normalized) ?? null;
}

export function getLocalizedCountryName(value: string | undefined | null, language: Language) {
  if (!value?.trim()) return "";
  return findCountryByCode(value)?.name[language] ?? findCountryByInput(value)?.name[language] ?? value.trim();
}

export function getSortedCountryOptions(language: Language) {
  const cached = sortedCountries.get(language);
  if (cached) return cached;
  const collator = new Intl.Collator(countryLocales[language], { sensitivity: "base", usage: "sort" });
  const sorted = [...countryOptions].sort((left, right) => collator.compare(left.name[language], right.name[language]));
  sortedCountries.set(language, sorted);
  return sorted;
}

export function searchCountries(language: Language, query: string) {
  const normalized = normalizeCountryInput(query);
  const sorted = getSortedCountryOptions(language);
  if (!normalized) return sorted;
  const matches = new Set(countryIndex.filter((entry) => entry.terms.some((term) => term.includes(normalized))).map((entry) => entry.country.code));
  return sorted.filter((country) => matches.has(country.code));
}

export function getCountryProfileFields(input: { country?: string; countryCode?: string; countryId?: string }) {
  const match = findCountryByCode(input.countryCode)
    ?? findCountryByInput(input.country ?? "")
    ?? findCountryByInput(input.countryId ?? "");
  return { country: match?.name.tr ?? input.country?.trim() ?? "", countryCode: match?.code ?? "" };
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
  return findCountryByInput(value)?.code ?? null;
}

export function resolveCountryCodeFromUser(user?: { country?: string; countryId?: string; countryCode?: string }) {
  if (!user) return null;
  return getCountryProfileFields(user).countryCode || null;
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
