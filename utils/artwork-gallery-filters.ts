import type { Artwork, Language } from "@/types/content";

export type GalleryMode = "new" | "personalized" | "undiscovered";
export type GalleryStatusFilter = "favorites" | "read" | "unread" | null;
export type GallerySort =
  | "default"
  | "historical-asc"
  | "historical-desc"
  | "published-desc"
  | "published-asc"
  | "title-asc"
  | "title-desc"
  | "artist-asc"
  | "artist-desc";

type GalleryOptions = {
  mode: GalleryMode;
  statusFilter: GalleryStatusFilter;
  sort: GallerySort;
  query: string;
  language: Language;
  readArtworkIds: string[];
  favoriteArtworkIds: string[];
  artworkVotes?: Record<string, "like" | "dislike">;
  interests?: string[];
  userKey?: string;
  seed?: string;
};

function normalizeSearchText(value: string, language: Language) {
  return value.toLocaleLowerCase(language === "tr" ? "tr" : undefined);
}

function normalizeRankingText(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

function artworkSearchHaystack(artwork: Artwork, language: Language) {
  return [
    artwork.title[language],
    artwork.title.tr,
    artwork.title.en,
    artwork.title.ru,
    artwork.title.uz,
    artwork.artist[language],
    artwork.artist.tr,
    artwork.artist.en,
    artwork.artist.ru,
    artwork.artist.uz,
    artwork.period[language],
    artwork.period.tr,
    artwork.period.en,
    artwork.description[language],
    artwork.origin,
    artwork.year,
    ...(artwork.tags ?? []).flatMap((tag) => Object.values(tag))
  ].join(" ");
}

export function matchesArtworkQuery(artwork: Artwork, query: string, language: Language) {
  const normalizedQuery = normalizeSearchText(query.trim(), language);
  if (!normalizedQuery) return true;
  return normalizeSearchText(artworkSearchHaystack(artwork, language), language).includes(normalizedQuery);
}

export function filterArtworksForGallery(artworks: Artwork[], options: GalleryOptions) {
  const reads = new Set(options.readArtworkIds);
  const favorites = new Set(options.favoriteArtworkIds);
  const filtered = artworks.filter((artwork) => {
    if (!matchesArtworkQuery(artwork, options.query, options.language)) return false;
    if (options.statusFilter === "read") return reads.has(artwork.id);
    if (options.statusFilter === "favorites") return favorites.has(artwork.id);
    if (options.statusFilter === "unread") return !reads.has(artwork.id);
    return true;
  });
  const seed = `${options.seed ?? "gallery"}:${options.userKey ?? "guest"}`;
  const modeOrdered = options.mode === "personalized"
    ? rankPersonalizedArtworks(filtered, options, seed)
    : options.mode === "undiscovered"
      ? rankUndiscoveredArtworks(filtered, reads, seed)
      : sortArtworksNewestFirst(filtered);

  if (options.sort === "default") return modeOrdered;
  return sortArtworks(modeOrdered, options.sort, options.language);
}

function rankPersonalizedArtworks(artworks: Artwork[], options: GalleryOptions, seed: string) {
  const favorites = new Set(options.favoriteArtworkIds);
  const reads = new Set(options.readArtworkIds);
  const liked = new Set(Object.entries(options.artworkVotes ?? {}).filter(([, vote]) => vote === "like").map(([id]) => id));
  const disliked = new Set(Object.entries(options.artworkVotes ?? {}).filter(([, vote]) => vote === "dislike").map(([id]) => id));
  const affinityItems = artworks.filter((artwork) => favorites.has(artwork.id) || liked.has(artwork.id));
  const affinityArtists = new Set(affinityItems.flatMap((artwork) => Object.values(artwork.artist).map(normalizeRankingText)));
  const affinityPeriods = new Set(affinityItems.flatMap((artwork) => Object.values(artwork.period).map(normalizeRankingText)));
  const interests = (options.interests ?? []).map(normalizeRankingText).filter(Boolean);
  const ranked = artworks.map((artwork) => {
    const searchable = normalizeRankingText(artworkSearchHaystack(artwork, options.language));
    const artistMatch = Object.values(artwork.artist).some((artist) => affinityArtists.has(normalizeRankingText(artist)));
    const periodMatch = Object.values(artwork.period).some((period) => affinityPeriods.has(normalizeRankingText(period)));
    const interestMatches = interests.filter((interest) => searchable.includes(interest)).length;
    const score =
      (favorites.has(artwork.id) ? 28 : 0) +
      (liked.has(artwork.id) ? 18 : 0) +
      (artistMatch ? 14 : 0) +
      (periodMatch ? 9 : 0) +
      interestMatches * 8 +
      (!reads.has(artwork.id) ? 7 : 0) -
      (disliked.has(artwork.id) ? 24 : 0) +
      (stableHash(`${seed}:${artwork.id}`) % 1000) / 1000;
    return { artwork, score };
  });

  return diversify(ranked, seed);
}

function rankUndiscoveredArtworks(artworks: Artwork[], reads: Set<string>, seed: string) {
  const unread = artworks.filter((artwork) => !reads.has(artwork.id));
  const read = artworks.filter((artwork) => reads.has(artwork.id));
  return [
    ...diversify(unread.map((artwork) => ({ artwork, score: (stableHash(`${seed}:unread:${artwork.id}`) % 1000) / 1000 })), `${seed}:unread`),
    ...diversify(read.map((artwork) => ({ artwork, score: (stableHash(`${seed}:read:${artwork.id}`) % 1000) / 1000 })), `${seed}:read`)
  ];
}

function diversify(ranked: { artwork: Artwork; score: number }[], seed: string) {
  const remaining = [...ranked];
  const selected: Artwork[] = [];
  const artistCounts = new Map<string, number>();
  const periodCounts = new Map<string, number>();

  while (remaining.length) {
    const bestIndex = remaining.reduce((bestIndex, entry, index) => {
      const artist = normalizeRankingText(entry.artwork.artist.tr || entry.artwork.artist.en);
      const period = normalizeRankingText(entry.artwork.period.tr || entry.artwork.period.en);
      const score = entry.score
        - (artistCounts.get(artist) ?? 0) * 5
        - (periodCounts.get(period) ?? 0) * 2
        + (stableHash(`${seed}:diversify:${entry.artwork.id}`) % 100) / 10000;
      if (bestIndex < 0) return index;
      const best = remaining[bestIndex];
      const bestArtist = normalizeRankingText(best.artwork.artist.tr || best.artwork.artist.en);
      const bestPeriod = normalizeRankingText(best.artwork.period.tr || best.artwork.period.en);
      const bestScore = best.score
        - (artistCounts.get(bestArtist) ?? 0) * 5
        - (periodCounts.get(bestPeriod) ?? 0) * 2
        + (stableHash(`${seed}:diversify:${best.artwork.id}`) % 100) / 10000;
      return score > bestScore || (score === bestScore && entry.artwork.id.localeCompare(best.artwork.id) < 0) ? index : bestIndex;
    }, -1);
    const [next] = remaining.splice(bestIndex, 1);
    const artist = normalizeRankingText(next.artwork.artist.tr || next.artwork.artist.en);
    const period = normalizeRankingText(next.artwork.period.tr || next.artwork.period.en);
    selected.push(next.artwork);
    artistCounts.set(artist, (artistCounts.get(artist) ?? 0) + 1);
    periodCounts.set(period, (periodCounts.get(period) ?? 0) + 1);
  }

  return selected;
}

export function sortArtworks(artworks: Artwork[], sort: Exclude<GallerySort, "default">, language: Language) {
  const direction = sort.endsWith("desc") ? -1 : 1;
  return [...artworks].sort((left, right) => {
    if (sort.startsWith("historical")) {
      return compareOptionalNumbers(normalizeArtworkYear(left.year), normalizeArtworkYear(right.year), direction, left.id, right.id);
    }
    if (sort.startsWith("published")) {
      return compareOptionalNumbers(artworkSortTime(left) || null, artworkSortTime(right) || null, direction, left.id, right.id);
    }
    const leftText = sort.startsWith("title") ? left.title[language] : left.artist[language];
    const rightText = sort.startsWith("title") ? right.title[language] : right.artist[language];
    return direction * leftText.localeCompare(rightText, localeForLanguage(language), { sensitivity: "base" }) || left.id.localeCompare(right.id);
  });
}

function compareOptionalNumbers(left: number | null, right: number | null, direction: number, leftId: string, rightId: string) {
  if (left === null && right === null) return leftId.localeCompare(rightId);
  if (left === null) return 1;
  if (right === null) return -1;
  return direction * (left - right) || leftId.localeCompare(rightId);
}

export function normalizeArtworkYear(value: string) {
  const normalized = value.trim().replace(/[–—]/g, "-");
  if (!normalized) return null;
  const numeric = normalized.match(/\d{3,4}/)?.[0];
  if (numeric) {
    const year = Number(numeric);
    return /(?:\bBC\b|\bBCE\b|M\.?\s*Ö\.?)/i.test(normalized) ? -year : year;
  }
  const century = normalized.match(/(\d{1,2})(?:st|nd|rd|th)?\.?\s*(?:yüzyıl|yuzyil|century|asr)/i)?.[1];
  if (century) return (Number(century) - 1) * 100;
  const romanCentury = normalized.match(/(?:^|\s)([IVXLCDM]+)\s*(?:век|century)(?:\s|$)/i)?.[1];
  if (!romanCentury) return null;
  const parsed = parseRomanNumber(romanCentury.toUpperCase());
  return parsed > 0 ? (parsed - 1) * 100 : null;
}

function parseRomanNumber(value: string) {
  const digits: Record<string, number> = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 };
  return value.split("").reduceRight((total, digit, index, source) => {
    const current = digits[digit] ?? 0;
    const next = digits[source[index + 1]] ?? 0;
    return total + (current < next ? -current : current);
  }, 0);
}

function localeForLanguage(language: Language) {
  if (language === "tr") return "tr-TR";
  if (language === "ru") return "ru-RU";
  if (language === "uz") return "uz-UZ";
  return "en-US";
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

type DatedArtwork = Artwork & {
  pinned?: boolean;
  publishedAt?: { toMillis?: () => number } | null;
  createdAt?: { toMillis?: () => number } | null;
};

function artworkSortTime(artwork: Artwork) {
  const datedArtwork = artwork as DatedArtwork;
  return datedArtwork.publishedAt?.toMillis?.() ?? datedArtwork.createdAt?.toMillis?.() ?? 0;
}

export function sortArtworksNewestFirst(artworks: Artwork[]) {
  return [...artworks].sort((left, right) => {
    const pinnedDelta = Number(Boolean((right as DatedArtwork).pinned)) - Number(Boolean((left as DatedArtwork).pinned));
    if (pinnedDelta) return pinnedDelta;
    return artworkSortTime(right) - artworkSortTime(left) || left.id.localeCompare(right.id);
  });
}

export function sortArtworkDocuments<T extends { id?: string; pinned?: boolean; publishedAt?: { toMillis?: () => number } | null; createdAt?: { toMillis?: () => number } | null }>(documents: T[]) {
  return [...documents].sort((left, right) => {
    const pinnedDelta = Number(Boolean(right.pinned)) - Number(Boolean(left.pinned));
    if (pinnedDelta) return pinnedDelta;
    const rightTime = right.publishedAt?.toMillis?.() ?? right.createdAt?.toMillis?.() ?? 0;
    const leftTime = left.publishedAt?.toMillis?.() ?? left.createdAt?.toMillis?.() ?? 0;
    return rightTime - leftTime || (left.id ?? "").localeCompare(right.id ?? "");
  });
}
