import { countryNames } from "@/data/country-names";
import type { Language } from "@/types/content";

const countryCodes = Object.keys(countryNames);

const legacyAliases: Partial<Record<string, string[]>> = {
  TR: ["turkiye", "Turkey"], UZ: ["uzbekistan", "O'zbekiston"], RU: ["russia"],
  US: ["usa", "ABD", "США", "AQSH"], GB: ["uk", "İngiltere", "England", "Angliya"], CA: ["canada"],
  DE: ["germany"], KZ: ["kazakhstan", "Qozog'iston"], FR: ["france"], IT: ["italy"], ES: ["spain"],
  BR: ["brazil"], MX: ["mexico"], IN: ["india"], CN: ["china"], JP: ["japan"],
  KR: ["south-korea", "Южная Корея"], ID: ["indonesia"], PK: ["pakistan"], EG: ["egypt"], IR: ["iran"],
  AU: ["australia"], NL: ["netherlands"], PL: ["poland"], UA: ["ukraine"],
  SA: ["saudi-arabia"], AR: ["argentina"], ZA: ["south-africa", "ЮАР", "Janubiy Afrika"]
};

export type CountryOption = {
  id: string;
  code: string;
  name: Record<Language, string>;
  aliases: string[];
};

export const countryOptions: CountryOption[] = countryCodes.map((code) => {
  const localized = countryNames[code as keyof typeof countryNames];
  return {
    id: code.toLocaleLowerCase("en"),
    code,
    name: {
      tr: localized.tr,
      en: localized.en,
      ru: localized.ru,
      uz: localized.uz
    },
    aliases: legacyAliases[code] ?? []
  };
});
