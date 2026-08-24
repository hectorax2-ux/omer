import type { Artist, ArtStory, Artwork, Language, LocalizedText } from "@/types/content";
import type {
  HomeArtistItem,
  HomeChallenge,
  HomeEngineConfig,
  HomeEngineInput,
  HomeFeedModel,
  HomeGreetingKey,
  HomePalette,
  HomeRecommendationReason,
  HomeStoryItem,
  HomeArtworkItem
} from "./types";

export const HOME_ENGINE_CONFIG: HomeEngineConfig = {
  engineVersion: "home-v2.2-unseen",
  recentDays: 30,
  explorationRatio: 0.25,
  mix: { personalized: 0.7, adjacent: 0.22, serendipity: 0.08 },
  recommendationCount: 8,
  heroCount: 5,
  journeyPreviewCount: 5,
  weights: {
    museum: 44,
    favorite: 36,
    liked: 22,
    interest: 14,
    affinity: 18,
    unseen: 70,
    seenOnly: 28,
    freshness: 8,
    openedPenalty: 34,
    readPenalty: 58,
    recentPenalty: 46,
    sameArtistPenalty: 15,
    samePeriodPenalty: 9,
    sameMovementPenalty: 7
  }
};

const PALETTES: HomePalette[] = [
  { primary: "#6056E8", secondary: "#B048D8", glow: "rgba(96,86,232,0.42)", scrim: ["rgba(8,10,25,0.04)", "rgba(8,10,25,0.42)", "rgba(7,8,20,0.94)"] },
  { primary: "#2878D4", secondary: "#44B7C6", glow: "rgba(40,120,212,0.42)", scrim: ["rgba(5,15,28,0.02)", "rgba(5,15,28,0.44)", "rgba(5,13,24,0.94)"] },
  { primary: "#8D3E78", secondary: "#D04D79", glow: "rgba(208,77,121,0.34)", scrim: ["rgba(25,6,17,0.02)", "rgba(25,6,17,0.46)", "rgba(20,6,15,0.95)"] },
  { primary: "#50309A", secondary: "#A53B92", glow: "rgba(139,92,246,0.34)", scrim: ["rgba(17,7,35,0.02)", "rgba(17,7,35,0.45)", "rgba(8,8,24,0.95)"] },
  { primary: "#315C72", secondary: "#5C8C79", glow: "rgba(92,140,121,0.34)", scrim: ["rgba(4,14,17,0.02)", "rgba(4,14,17,0.46)", "rgba(4,12,15,0.95)"] }
];

export function buildHomeFeed(input: HomeEngineInput, config = HOME_ENGINE_CONFIG): HomeFeedModel {
  const dayKey = resolveDayKey(input.now);
  const seed = `${config.engineVersion}:${dayKey}:${input.userKey}:${input.rotationKey ?? 0}`;
  const eligibleArtworks = input.artworks.filter((item) => item.id && item.image && text(item.title, input.language));
  const eligibleArtists = input.artists.filter((item) => item.id && text(item.name, input.language));
  const eligibleStories = input.stories.filter((item) => item.id && text(item.title, input.language));
  const activeExposures = input.exposures.filter((item) => daysBetween(item.dayKey, dayKey) <= config.recentDays);
  const seenIds = new Set(activeExposures.map((item) => item.id));
  const recentIds = new Set([
    ...activeExposures.map((item) => item.id),
    ...(input.sessionRecentlyShownIds ?? [])
  ]);
  const unseenArtworks = eligibleArtworks.filter((item) => !seenIds.has(item.id) && !input.readArtworkIds.includes(item.id));
  const dailyArtwork = eligibleArtworks.find((item) => item.id === input.dailyOverrides?.artworkId)
    ?? deterministicPick(unseenArtworks.length ? unseenArtworks : eligibleArtworks, `${seed}:artwork`);
  const unseenArtists = eligibleArtists.filter((item) => !seenIds.has(`artist:${item.id}`));
  const dailyArtist = eligibleArtists.find((item) => item.id === input.dailyOverrides?.artistId)
    ?? deterministicPick(unseenArtists.length ? unseenArtists : eligibleArtists, `${seed}:artist`);
  const unreadStories = eligibleStories.filter((item) => !input.readStoryIds.includes(item.id));
  const unseenStories = unreadStories.filter((item) => !seenIds.has(`story:${item.id}`));
  const dailyStory = eligibleStories.find((item) => item.id === input.dailyOverrides?.storyId)
    ?? deterministicPick(unseenStories.length ? unseenStories : unreadStories.length ? unreadStories : eligibleStories, `${seed}:story`);
  const ranked = rankArtworks(eligibleArtworks, input, seenIds, recentIds, config, dayKey);
  const recommendations = diversify(
    ranked.filter((entry) => entry.item.id !== dailyArtwork?.id),
    config.recommendationCount,
    config,
    `${seed}:recommendations`
  ).map((entry) => artworkItem(entry.item, input.language, entry.reason));
  const heroSource = [
    ...(dailyArtwork ? [dailyArtwork] : []),
    ...seededOrder(ranked.map((entry) => entry.item), `${seed}:hero`)
  ];
  const hero = uniqueById(heroSource).slice(0, config.heroCount).map((item, index) => artworkItem(
    item,
    input.language,
    index === 0 && item.id === dailyArtwork?.id ? "daily" : reasonForArtwork(item, input, seenIds)
  ));
  const occupiedIds = new Set([...hero, ...recommendations].map((item) => item.id));
  const popular = ranked
    .filter((entry) => !occupiedIds.has(entry.item.id))
    .slice(0, 8)
    .map((entry) => artworkItem(entry.item, input.language, entry.reason === "explore" ? "fresh" : entry.reason));

  return {
    schemaVersion: 1,
    engineVersion: config.engineVersion,
    generatedAt: input.now.getTime(),
    dayKey,
    locale: input.language,
    greetingKey: resolveGreeting(input),
    hero,
    dailyArtwork: dailyArtwork ? artworkItem(dailyArtwork, input.language, "daily") : undefined,
    dailyArtist: dailyArtist ? artistItem(dailyArtist, input.language) : undefined,
    dailyStory: dailyStory ? storyItem(dailyStory, input.language, input.readStoryIds.includes(dailyStory.id) ? "explore" : "unseen") : undefined,
    recommendations,
    popular,
    dailyChallenge: dailyChallenge(dayKey, dailyArtwork ? artworkItem(dailyArtwork, input.language, "daily") : undefined, input.dailyOverrides?.challenge),
    states: {
      artworks: contentState(input.loading.artworks, eligibleArtworks.length, input.errors.artworks),
      artists: contentState(input.loading.artists, eligibleArtists.length, input.errors.artists),
      stories: contentState(input.loading.stories, eligibleStories.length, input.errors.stories)
    }
  };
}

export function resolveDayKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function deterministicPick<T extends { id: string }>(items: T[], seed: string) {
  if (!items.length) return undefined;
  const sorted = [...items].sort((a, b) => a.id.localeCompare(b.id));
  return sorted[stableHash(seed) % sorted.length];
}

export function seededOrder<T extends { id: string }>(items: T[], seed: string) {
  return [...items].sort((a, b) => {
    const delta = stableHash(`${seed}:${a.id}`) - stableHash(`${seed}:${b.id}`);
    return delta || a.id.localeCompare(b.id);
  });
}

export function paletteForArtwork(id: string) {
  return PALETTES[stableHash(id) % PALETTES.length];
}

function rankArtworks(items: Artwork[], input: HomeEngineInput, seenIds: Set<string>, recentIds: Set<string>, config: HomeEngineConfig, dayKey: string) {
  const interests = input.interests.map(normalize).filter(Boolean);
  const favorites = new Set(input.favoriteArtworkIds);
  const reads = new Set(input.readArtworkIds);
  const likes = new Set(input.likedArtworkIds);
  const dislikes = new Set(input.dislikedArtworkIds);
  const museum = new Set(input.museumArtworkIds);
  const opened = new Set(input.exposures
    .filter((item) => item.status === "opened" && daysBetween(item.dayKey, dayKey) <= config.recentDays)
    .map((item) => item.id));
  const affinityIds = new Set([...favorites, ...likes, ...museum]);
  const affinityTerms = items
    .filter((item) => affinityIds.has(item.id))
    .flatMap((item) => artworkFacets(item))
    .filter(Boolean);

  return items
    .map((item) => {
      const searchable = normalize([...Object.values(item.title), ...artworkFacets(item)].join(" "));
      const interestMatches = interests.filter((interest) => searchable.includes(interest)).length;
      const affinityMatches = affinityTerms.filter((term) => searchable.includes(term)).length;
      const neverSeen = !seenIds.has(item.id) && !opened.has(item.id) && !reads.has(item.id);
      const seenOnly = seenIds.has(item.id) && !opened.has(item.id) && !reads.has(item.id);
      const novelty = neverSeen ? 3 : seenOnly ? 2 : opened.has(item.id) && !reads.has(item.id) ? 1 : 0;
      const score =
        (museum.has(item.id) ? config.weights.museum : 0) +
        (favorites.has(item.id) ? config.weights.favorite : 0) +
        (likes.has(item.id) ? config.weights.liked : 0) +
        interestMatches * config.weights.interest +
        Math.min(3, affinityMatches) * config.weights.affinity +
        (neverSeen ? config.weights.unseen : 0) +
        (seenOnly ? config.weights.seenOnly : 0) +
        config.weights.freshness +
        (opened.has(item.id) ? -config.weights.openedPenalty : 0) +
        (reads.has(item.id) ? -config.weights.readPenalty : 0) +
        (recentIds.has(item.id) ? -config.weights.recentPenalty : 0) +
        (dislikes.has(item.id) ? -config.weights.favorite : 0) +
        (stableHash(`${dayKey}:${input.userKey}:${input.rotationKey ?? 0}:${item.id}`) % 1000) / 1000;
      return { item, score, novelty, reason: reasonForArtwork(item, input, seenIds, interestMatches, affinityMatches) };
    })
    .sort((a, b) => b.novelty - a.novelty || b.score - a.score || a.item.id.localeCompare(b.item.id));
}

function diversify(
  ranked: { item: Artwork; score: number; novelty: number; reason: HomeRecommendationReason }[],
  count: number,
  config: HomeEngineConfig,
  seed: string
) {
  const selected: typeof ranked = [];
  const remaining = [...ranked];
  const mixTotal = config.mix.personalized + config.mix.adjacent + config.mix.serendipity;
  const adjacentCount = Math.min(count, Math.round(count * config.mix.adjacent / mixTotal));
  const serendipityCount = Math.min(count - adjacentCount, Math.round(count * config.mix.serendipity / mixTotal));
  const specialSlots = seededOrder(Array.from({ length: count }, (_, index) => ({ id: String(index), index })), seed)
    .map((item) => item.index)
    .filter((index) => index > 0);
  const adjacentSlots = new Set(specialSlots.slice(0, adjacentCount));
  const serendipitySlots = new Set(specialSlots.slice(adjacentCount, adjacentCount + serendipityCount));
  while (selected.length < count && remaining.length) {
    const artistCounts = countBy(selected.map((entry) => normalize(entry.item.artist.tr || entry.item.artist.en)));
    const periodCounts = countBy(selected.map((entry) => normalize(entry.item.period.tr || entry.item.period.en)));
    const movementCounts = countBy(selected.map((entry) => normalize(Object.values(entry.item.tags?.[0] ?? {}).join(" "))));
    const reranked = remaining
      .map((entry) => ({
        entry,
        adjusted: entry.score
          - (artistCounts.get(normalize(entry.item.artist.tr || entry.item.artist.en)) ?? 0) * config.weights.sameArtistPenalty
          - (periodCounts.get(normalize(entry.item.period.tr || entry.item.period.en)) ?? 0) * config.weights.samePeriodPenalty
          - (movementCounts.get(normalize(Object.values(entry.item.tags?.[0] ?? {}).join(" "))) ?? 0) * config.weights.sameMovementPenalty
      }))
      .sort((a, b) => b.entry.novelty - a.entry.novelty || b.adjusted - a.adjusted || a.entry.item.id.localeCompare(b.entry.item.id));
    const adjacent = adjacentSlots.has(selected.length);
    const serendipity = serendipitySlots.has(selected.length);
    const highestNovelty = reranked[0].entry.novelty;
    const noveltyPool = reranked.filter((candidate) => candidate.entry.novelty === highestNovelty);
    const choiceIndex = serendipity
      ? Math.min(noveltyPool.length - 1, Math.floor(noveltyPool.length * 0.58))
      : adjacent
        ? Math.min(noveltyPool.length - 1, Math.floor(noveltyPool.length * 0.28))
        : 0;
    const choice = noveltyPool[choiceIndex].entry;
    selected.push(adjacent || serendipity ? { ...choice, reason: "explore" } : choice);
    remaining.splice(remaining.findIndex((entry) => entry.item.id === choice.item.id), 1);
  }
  return selected;
}

function reasonForArtwork(item: Artwork, input: HomeEngineInput, seenIds: Set<string>, interestMatches = 0, affinityMatches = 0): HomeRecommendationReason {
  if (input.museumArtworkIds.includes(item.id)) return "museum";
  if (input.favoriteArtworkIds.includes(item.id)) return "favorite";
  if (interestMatches > 0 || affinityMatches > 0) return "interest";
  if (!input.readArtworkIds.includes(item.id) && !seenIds.has(item.id)) return "unseen";
  return "explore";
}

function artworkFacets(item: Artwork) {
  return [
    ...Object.values(item.artist),
    ...Object.values(item.period),
    ...Object.values(item.country ?? {}),
    ...(item.tags ?? []).flatMap((tag) => Object.values(tag))
  ].map(normalize).filter(Boolean);
}

function artworkItem(item: Artwork, language: Language, reason: HomeRecommendationReason): HomeArtworkItem {
  return {
    id: item.id,
    image: item.image,
    title: text(item.title, language),
    artist: text(item.artist, language),
    period: text(item.period, language),
    year: item.year,
    reason,
    palette: paletteForArtwork(item.id)
  };
}

function artistItem(item: Artist, language: Language): HomeArtistItem {
  return {
    id: item.id,
    image: item.image,
    name: text(item.name, language),
    movement: text(item.movement, language),
    life: item.life,
    reason: "daily"
  };
}

function storyItem(item: ArtStory, language: Language, reason: HomeRecommendationReason): HomeStoryItem {
  return {
    id: item.id,
    image: item.image,
    title: text(item.title, language),
    excerpt: text(item.excerpt, language),
    readTime: text(item.readTime, language),
    reason
  };
}

function dailyChallenge(dayKey: string, artwork?: HomeArtworkItem, override?: "detective" | "artworkTimeline" | "artistTimeline"): HomeChallenge {
  const choices: Omit<HomeChallenge, "artwork">[] = [
    { id: `${dayKey}:detective`, icon: "extension-puzzle", route: "/games" },
    { id: `${dayKey}:artwork-timeline`, icon: "images", route: "/timeline-game", params: { type: "artwork" } },
    { id: `${dayKey}:artist-timeline`, icon: "people", route: "/timeline-game", params: { type: "artist" } }
  ];
  const overrideIndex = override === "detective" ? 0 : override === "artworkTimeline" ? 1 : override === "artistTimeline" ? 2 : -1;
  return { ...choices[overrideIndex >= 0 ? overrideIndex : stableHash(`${dayKey}:challenge`) % choices.length], artwork };
}

function resolveGreeting(input: HomeEngineInput): HomeGreetingKey {
  if (input.journeyCompletedCount > 0 && input.journeyCompletedCount % 4 !== 0) return "journey";
  if (input.museumArtworkIds.length >= 3) return "museum";
  const hour = input.now.getHours();
  if (hour < 12) return input.isReturningUser ? "morningReturning" : "morningNew";
  if (hour < 18) return "afternoon";
  return "evening";
}

function contentState(loading: boolean, count: number, error: boolean) {
  if (loading && !count) return "loading" as const;
  if (error && !count) return "error" as const;
  if (!count) return "empty" as const;
  return "ready" as const;
}

function text(value: LocalizedText, language: Language) {
  return value[language] || value.tr || value.en || value.ru || value.uz || "";
}

function normalize(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("tr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replaceAll("ı", "i");
}

function daysBetween(fromDayKey: string, toDayKey: string) {
  const from = Date.parse(`${fromDayKey}T00:00:00.000Z`);
  const to = Date.parse(`${toDayKey}T00:00:00.000Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return Number.POSITIVE_INFINITY;
  return Math.max(0, Math.floor((to - from) / 86_400_000));
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function countBy(values: string[]) {
  return values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map<string, number>());
}
