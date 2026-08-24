import type { ImageSourcePropType } from "react-native";

export const BOOK_PLACEHOLDER = require("../assets/images/book-film-placeholder.png");
export const FILM_PLACEHOLDER = require("../assets/images/film-placeholder.png");

const LEGACY_BOOK_PLACEHOLDER_TOKENS = [
  "photo-1519682337058",
  "photo-1544947950"
];

const LEGACY_FILM_PLACEHOLDER_TOKENS = [
  "photo-1485846234645",
  "photo-1500530855697",
  "photo-1505686994434"
];

export type BookFilmKind = "book" | "film";

export function isBookFilmPlaceholderImage(kind: BookFilmKind, image?: string) {
  const value = image?.trim();
  if (!value) return true;
  const tokens = kind === "film" ? LEGACY_FILM_PLACEHOLDER_TOKENS : LEGACY_BOOK_PLACEHOLDER_TOKENS;
  return tokens.some((token) => value.includes(token));
}

export function bookFilmPlaceholderSource(kind: BookFilmKind): ImageSourcePropType {
  return kind === "film" ? FILM_PLACEHOLDER : BOOK_PLACEHOLDER;
}

export function resolveBookFilmImageSource(kind: BookFilmKind, image?: string): ImageSourcePropType {
  if (isBookFilmPlaceholderImage(kind, image)) return bookFilmPlaceholderSource(kind);
  return { uri: image!.trim() };
}
