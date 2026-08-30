import { describe, expect, test } from "bun:test";
import { countryNames } from "../data/country-names";
import { countryCommunities } from "../data/content";
import { countryOptions } from "../utils/country-options";
import { buildCountryCodeLookup, findCountryByCode, findCountryByInput, getCountryProfileFields, getLocalizedCountryName, getSortedCountryOptions, lookupCountryCode, resolveCountryCode, resolveCountryCodeFromUser, searchCountries } from "../utils/country-utils";

const locales = { tr: "tr-TR", en: "en-US", ru: "ru-RU", uz: "uz-UZ" } as const;

describe("global country model", () => {
  test("249 unique ISO entries, all four names, no parallel code list", () => {
    expect(countryOptions).toHaveLength(249);
    expect(new Set(countryOptions.map((country) => country.code)).size).toBe(249);
    expect(countryOptions.map((country) => country.code)).toEqual(Object.keys(countryNames));
    countryOptions.forEach((country) => {
      expect(country.code).toMatch(/^[A-Z]{2}$/);
      Object.values(country.name).forEach((name) => expect(name.trim().length).toBeGreaterThan(0));
      expect(findCountryByCode(country.code)).toBe(country);
      expect(findCountryByInput(country.id)).toBe(country);
    });
  });

  Object.entries(locales).forEach(([key, locale]) => {
    const language = key as keyof typeof locales;
    test(`${language}: locale ordering, stable identity and language switching`, () => {
      const collator = new Intl.Collator(locale, { sensitivity: "base", usage: "sort" });
      const sorted = getSortedCountryOptions(language);
      expect(sorted).toHaveLength(249);
      sorted.slice(1).forEach((country, index) => expect(collator.compare(sorted[index].name[language], country.name[language])).toBeLessThanOrEqual(0));
      expect(getSortedCountryOptions(language)).toBe(sorted);
      countryOptions.forEach((country) => {
        const saved = JSON.parse(JSON.stringify(getCountryProfileFields({ countryCode: country.code })));
        expect(getCountryProfileFields(saved)).toEqual(saved);
        expect(getLocalizedCountryName(saved.countryCode, language)).toBe(country.name[language]);
        expect(searchCountries(language, country.code)).toContain(country);
      });
    });
  });

  test("every historical country route, name and code stays readable", () => {
    countryCommunities.forEach((country) => {
      [country.id, country.code, ...Object.values(country.name)].forEach((value) => {
        expect(resolveCountryCode(value), `${country.code}: ${value}`).toBe(country.code);
      });
    });
  });

  test("accent, case, Uzbek apostrophes and partial name searches", () => {
    const cases = [["öz", "UZ"], ["oz", "UZ"], ["OʻZ", "UZ"], ["O’Z", "UZ"], ["O'Z", "UZ"], ["tür", "TR"], ["TUR", "TR"], ["alm", "DE"], ["kaz", "KZ"], ["azer", "AZ"], ["герм", "DE"], ["germ", "DE"]];
    cases.forEach(([query, code]) => expect(searchCountries("tr", query).map((country) => country.code), query).toContain(code));
    expect(searchCountries("ru", "this-country-does-not-exist")).toEqual([]);
  });

  test("valid ISO wins over stale names and legacy IDs", () => {
    expect(getCountryProfileFields({ countryCode: " de ", country: "Türkiye", countryId: "usa" })).toEqual({ countryCode: "DE", country: "Almanya" });
    expect(resolveCountryCodeFromUser({ countryCode: "ZZ", country: "ABD" })).toBe("US");
    expect(resolveCountryCodeFromUser({ countryId: "uk" })).toBe("GB");
    expect(resolveCountryCode("XYZ")).toBeNull();
    expect(getCountryProfileFields({ country: "Legacy unknown region" })).toEqual({ country: "Legacy unknown region", countryCode: "" });
  });

  test("updated account takes priority over stale directory records", () => {
    const lookup = buildCountryCodeLookup([
      { uid: "one", username: "atlas", countryCode: "NZ", country: "Türkiye" },
      { uid: "one", username: "atlas", countryCode: "TR" },
      { uid: "two", username: "another", country: "Özbekistan" }
    ]);
    expect(lookupCountryCode(lookup, ["one"])).toBe("NZ");
    expect(lookupCountryCode(lookup, ["@atlas"])).toBe("NZ");
    expect(lookupCountryCode(lookup, ["two"])).toBe("UZ");
  });
});
