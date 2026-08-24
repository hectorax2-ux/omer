import { Language } from "@/types/content";

export type LocalizedCopy = Record<Language, string>;

export function t(copy: LocalizedCopy, language: Language) {
  return copy[language] ?? copy.en;
}

export function tFormat(copy: LocalizedCopy, language: Language, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    t(copy, language)
  );
}
