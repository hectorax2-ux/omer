import type { Artist, ArtStory, Artwork, Language, LocalizedText } from "@/types/content";
import { homeCopy } from "@/app/i18n/common";
import { t } from "@/utils/localized-text";
import type {
  ArtJourney,
  JourneyActivity,
  JourneyChapter,
  JourneyDifficulty,
  JourneyEraId,
  JourneyProgress,
  JourneyStage,
  JourneyStageView
} from "./types";

const JOURNEY_ID = "art-foundations";
export const JOURNEY_VERSION = 2;

const ERA_RANGES: { id: JourneyEraId; start: number; end: number }[] = [
  { id: "prehistoric", start: Number.NEGATIVE_INFINITY, end: -3000 },
  { id: "ancient", start: -3000, end: 476 },
  { id: "medieval", start: 476, end: 1400 },
  { id: "renaissance", start: 1400, end: 1600 },
  { id: "baroque", start: 1600, end: 1750 },
  { id: "romantic", start: 1750, end: 1850 },
  { id: "modern", start: 1850, end: 1970 },
  { id: "contemporary", start: 1970, end: Number.POSITIVE_INFINITY }
];

export function buildArtJourney(input: {
  artworks: Artwork[];
  artists: Artist[];
  stories: ArtStory[];
  language: Language;
}): ArtJourney {
  const activities = [
    ...artworkActivities(input.artworks, input.language),
    ...artistActivities(input.artists, input.language),
    ...storyActivities(input.stories, input.language)
  ].sort(compareActivities);
  const stages = activities.map((activity, index) => {
    const id = `stage:${activity.id}`;
    return {
      id,
      chapterId: `chapter:${activity.eraId ?? "editorial"}`,
      order: index,
      difficulty: difficultyFor(index, activities.length),
      prerequisiteStageIds: index === 0 ? [] : [`stage:${activities[index - 1].id}`],
      activity
    } satisfies JourneyStage;
  });
  const chapterIds = [...new Set(stages.map((stage) => stage.chapterId))];
  const chapters = chapterIds.map((id, index) => chapterFor(id, index, stages, input.language));
  return {
    id: JOURNEY_ID,
    version: JOURNEY_VERSION,
    title: journeyTitle(input.language),
    chapters,
    stages
  };
}

export function resolveJourneyStages(journey: ArtJourney, progress: JourneyProgress): JourneyStageView[] {
  const completed = new Set(progress.completedStageIds);
  const firstIncomplete = journey.stages.find((stage) => !completed.has(stage.id));
  return journey.stages.map((stage) => {
    if (completed.has(stage.id)) return { ...stage, state: "completed" };
    const unlocked = stage.prerequisiteStageIds.every((id) => completed.has(id));
    if (stage.id === progress.activeStageId || stage.id === firstIncomplete?.id) return { ...stage, state: unlocked ? "current" : "locked" };
    return { ...stage, state: unlocked ? "available" : "locked" };
  });
}

export function normalizeJourneyProgress(journey: ArtJourney, progress?: Partial<JourneyProgress> | null): JourneyProgress {
  const validStageIds = new Set(journey.stages.map((stage) => stage.id));
  const completedStageIds = [...new Set(progress?.completedStageIds ?? [])].filter((id) => validStageIds.has(id));
  const openedStageIds = [...new Set(progress?.openedStageIds ?? [])].filter((id) => validStageIds.has(id));
  const firstIncomplete = journey.stages.find((stage) => !completedStageIds.includes(stage.id));
  const requestedActive = progress?.activeStageId && validStageIds.has(progress.activeStageId) ? progress.activeStageId : "";
  return {
    journeyId: journey.id,
    journeyVersion: journey.version,
    completedStageIds,
    openedStageIds,
    activeStageId: requestedActive || firstIncomplete?.id || journey.stages.at(-1)?.id || "",
    updatedAtMs: progress?.updatedAtMs ?? 0
  };
}

export function completeJourneyStage(journey: ArtJourney, progress: JourneyProgress, stageId: string) {
  const stage = journey.stages.find((item) => item.id === stageId);
  if (!stage) return progress;
  const completed = new Set(progress.completedStageIds);
  if (!stage.prerequisiteStageIds.every((id) => completed.has(id))) return progress;
  completed.add(stageId);
  const next = journey.stages.find((item) => !completed.has(item.id) && item.prerequisiteStageIds.every((id) => completed.has(id)));
  return {
    ...progress,
    completedStageIds: [...completed],
    activeStageId: next?.id ?? stageId,
    openedStageIds: progress.openedStageIds.includes(stageId) ? progress.openedStageIds : [...progress.openedStageIds, stageId],
    updatedAtMs: Date.now()
  };
}

export function openJourneyStage(journey: ArtJourney, progress: JourneyProgress, stageId: string) {
  const views = resolveJourneyStages(journey, progress);
  const stage = views.find((item) => item.id === stageId);
  if (!stage || stage.state === "locked") return progress;
  return {
    ...progress,
    activeStageId: stageId,
    openedStageIds: progress.openedStageIds.includes(stageId) ? progress.openedStageIds : [...progress.openedStageIds, stageId],
    updatedAtMs: Date.now()
  };
}

export function journeyProgressPercent(journey: ArtJourney, progress: JourneyProgress) {
  if (!journey.stages.length) return 0;
  return Math.round((progress.completedStageIds.length / journey.stages.length) * 100);
}

function artworkActivities(artworks: Artwork[], language: Language) {
  return artworks.filter((item) => item.id && item.image && localized(item.title, language)).map((item) => {
    const historicalYear = normalizeHistoricalYear(item.year);
    return {
    id: `artwork:${item.id}`,
    type: "ARTWORK_DISCOVERY" as const,
    targetId: item.id,
    route: "/artwork/[id]" as const,
    params: { id: item.id },
    title: localized(item.title, language),
    subtitle: [localized(item.artist, language), item.year].filter(Boolean).join(" · "),
    image: item.image,
    historicalYear,
    dateLabel: item.year,
    periodLabel: localized(item.period, language),
    eraId: resolveEraId(historicalYear, localized(item.period, language))
  } satisfies JourneyActivity;
  });
}

function artistActivities(artists: Artist[], language: Language) {
  return artists.filter((item) => item.id && localized(item.name, language)).map((item) => {
    const historicalYear = normalizeHistoricalYear(item.life);
    return {
    id: `artist:${item.id}`,
    type: "ARTIST_DISCOVERY" as const,
    targetId: item.id,
    route: "/artist/[id]" as const,
    params: { id: item.id },
    title: localized(item.name, language),
    subtitle: [localized(item.movement, language), item.life].filter(Boolean).join(" · "),
    image: item.image,
    historicalYear,
    dateLabel: item.life,
    periodLabel: localized(item.movement, language),
    eraId: resolveEraId(historicalYear, localized(item.movement, language))
  } satisfies JourneyActivity;
  });
}

function storyActivities(stories: ArtStory[], language: Language) {
  return stories.filter((item) => item.id && localized(item.title, language)).map((item) => {
    const historicalYear = normalizeHistoricalYear([
      localized(item.title, language),
      localized(item.excerpt, language),
      localized(item.body, language)
    ].join(" ")) ?? timestampYear(item.publishedAt) ?? timestampYear(item.createdAt);
    return {
    id: `story:${item.id}`,
    type: "ARTICLE" as const,
    targetId: item.id,
    route: "/story/[id]" as const,
    params: { id: item.id },
    title: localized(item.title, language),
    subtitle: localized(item.readTime, language),
    image: item.image,
    historicalYear,
    dateLabel: historicalYear === undefined ? undefined : formatHistoricalYear(historicalYear, language),
    eraId: historicalYear === undefined ? "editorial" : resolveEraId(historicalYear)
  } satisfies JourneyActivity;
  });
}

function compareActivities(left: JourneyActivity, right: JourneyActivity) {
  const leftYear = left.historicalYear ?? Number.POSITIVE_INFINITY;
  const rightYear = right.historicalYear ?? Number.POSITIVE_INFINITY;
  if (leftYear !== rightYear) return leftYear - rightYear;
  const typeOrder = { ARTWORK_DISCOVERY: 0, ARTIST_DISCOVERY: 1, ARTICLE: 2, TIMELINE: 3, IDENTIFY_ARTWORK: 4 } as const;
  return typeOrder[left.type] - typeOrder[right.type] || left.id.localeCompare(right.id);
}

function chapterFor(id: string, index: number, stages: JourneyStage[], language: Language): JourneyChapter {
  const eraId = id.replace("chapter:", "") as JourneyEraId;
  return {
    id,
    order: index,
    title: eraTitle(eraId, language),
    dateLabel: eraDateLabel(eraId, language),
    eraId,
    stageIds: stages.filter((stage) => stage.chapterId === id).map((stage) => stage.id)
  };
}

function difficultyFor(index: number, total: number): JourneyDifficulty {
  const ratio = total <= 1 ? 0 : index / (total - 1);
  if (ratio < 0.34) return "beginner";
  if (ratio < 0.72) return "intermediate";
  return "advanced";
}

function journeyTitle(language: Language) {
  return t(homeCopy.artJourney, language);
}

export function normalizeHistoricalYear(value?: string | null) {
  if (!value?.trim()) return undefined;
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[‐‑‒–—]/g, "-")
    .replace(/,/g, "")
    .toLocaleLowerCase("en-US");
  const century = centuryYear(normalized);
  if (century !== undefined) return century;
  const match = normalized.match(/-?\d{1,6}/);
  if (!match) return undefined;
  const absolute = Math.abs(Number(match[0]));
  if (!Number.isFinite(absolute)) return undefined;
  const bce = isBceText(normalized);
  return bce ? -absolute : Number(match[0]);
}

function centuryYear(value: string) {
  const match = value.match(/(\d{1,2})(?:st|nd|rd|th)?\.?\s*(?:century|yuzy[iı]l|век|asr)/);
  if (!match) return undefined;
  const century = Number(match[1]);
  const bce = isBceText(value);
  return bce ? -(century * 100) : (century - 1) * 100;
}

function isBceText(value: string) {
  return /\b(?:bce|bc)\b|(?:^|\s)m\.?\s*o\.?\s*(?=\d)|до\s*н\.?\s*э\.?|miloddan\s+avval|mil\.?\s*avv/.test(value);
}

function timestampYear(value?: { toMillis?: () => number } | null) {
  const milliseconds = value?.toMillis?.();
  if (!milliseconds || !Number.isFinite(milliseconds)) return undefined;
  return new Date(milliseconds).getUTCFullYear();
}

function resolveEraId(year?: number, period = ""): JourneyEraId {
  const normalized = period.normalize("NFKD").toLocaleLowerCase("en-US");
  if (/prehistor|tarih.?onces|tarih.?önces|доистор/.test(normalized)) return "prehistoric";
  if (/ancient|antik|classical|klasik|древн/.test(normalized)) return "ancient";
  if (/medieval|middle ages|orta cag|orta çağ|средневек/.test(normalized)) return "medieval";
  if (/renaissance|ronesans|rönesans|возрожд/.test(normalized)) return "renaissance";
  if (/baroque|barok|rococo|rokoko|барок|рококо/.test(normalized)) return "baroque";
  if (/romantic|romant|neoclass|neoklas|realism|реализм|романтиз/.test(normalized)) return "romantic";
  if (/modern|impression|empresyon|cubis|kubiz|surreal|sürreal|expression|ekspres|модерн|импрес|кубизм|сюрреал/.test(normalized)) return "modern";
  if (year === undefined) return "editorial";
  return ERA_RANGES.find((era) => year >= era.start && year < era.end)?.id ?? "contemporary";
}

function eraTitle(era: JourneyEraId, language: Language) {
  return {
    prehistoric: { tr: "Tarih Öncesi", en: "Prehistoric", ru: "Доисторическое искусство", uz: "Tarixdan oldingi davr" },
    ancient: { tr: "Antik Dünyalar", en: "Ancient Worlds", ru: "Древний мир", uz: "Qadimgi dunyo" },
    medieval: { tr: "Orta Çağ", en: "Medieval", ru: "Средневековье", uz: "O'rta asrlar" },
    renaissance: { tr: "Rönesans", en: "Renaissance", ru: "Возрождение", uz: "Uyg'onish" },
    baroque: { tr: "Barok ve Rokoko", en: "Baroque & Rococo", ru: "Барокко и рококо", uz: "Barokko va rokoko" },
    romantic: { tr: "Devrim ve Romantizm", en: "Revolution & Romanticism", ru: "Революция и романтизм", uz: "Inqilob va romantizm" },
    modern: { tr: "Modern Sanat", en: "Modern Art", ru: "Модернизм", uz: "Modern san'at" },
    contemporary: { tr: "Çağdaş Sanat", en: "Contemporary", ru: "Современное искусство", uz: "Zamonaviy san'at" },
    editorial: { tr: "Çağdaş Okumalar", en: "Contemporary Readings", ru: "Современные чтения", uz: "Zamonaviy o'qishlar" }
  }[era][language];
}

function eraDateLabel(era: JourneyEraId, language: Language) {
  const labels: Record<JourneyEraId, string> = {
    prehistoric: language === "tr" ? "M.Ö. 30.000–3.000" : "30,000–3,000 BCE",
    ancient: language === "tr" ? "M.Ö. 3.000–M.S. 476" : "3,000 BCE–476 CE",
    medieval: "476–1400",
    renaissance: "1400–1600",
    baroque: "1600–1750",
    romantic: "1750–1850",
    modern: "1850–1970",
    contemporary: "1970–",
    editorial: ""
  };
  return labels[era];
}

function formatHistoricalYear(year: number, language: Language) {
  if (year >= 0) return String(year);
  const absolute = Math.abs(year).toLocaleString(language);
  return language === "tr" ? `M.Ö. ${absolute}` : `${absolute} BCE`;
}

function localized(value: LocalizedText, language: Language) {
  return value[language] || value.tr || value.en || value.ru || value.uz || "";
}
