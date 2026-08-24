import type { Artist, ArtStory, Artwork, Language } from "@/types/content";

export type HomeContentState = "loading" | "ready" | "stale" | "empty" | "error";

export type HomePalette = {
  primary: string;
  secondary: string;
  glow: string;
  scrim: [string, string, string];
};

export type HomeArtworkItem = {
  id: string;
  image: string;
  title: string;
  artist: string;
  period: string;
  year: string;
  reason: HomeRecommendationReason;
  palette: HomePalette;
};

export type HomeArtistItem = {
  id: string;
  image: string;
  name: string;
  movement: string;
  life: string;
  reason: HomeRecommendationReason;
};

export type HomeStoryItem = {
  id: string;
  image: string;
  title: string;
  excerpt: string;
  readTime: string;
  reason: HomeRecommendationReason;
};

export type HomeRecommendationReason =
  | "daily"
  | "museum"
  | "favorite"
  | "interest"
  | "unseen"
  | "fresh"
  | "explore";

export type HomeChallenge = {
  id: string;
  icon: "images" | "people" | "extension-puzzle";
  route: "/games" | "/timeline-game";
  params?: { type: "artwork" | "artist" };
  artwork?: HomeArtworkItem;
};

export type HomeFeedModel = {
  schemaVersion: 1;
  engineVersion: string;
  generatedAt: number;
  dayKey: string;
  locale: Language;
  greetingKey: HomeGreetingKey;
  hero: HomeArtworkItem[];
  dailyArtwork?: HomeArtworkItem;
  dailyArtist?: HomeArtistItem;
  dailyStory?: HomeStoryItem;
  recommendations: HomeArtworkItem[];
  popular: HomeArtworkItem[];
  dailyChallenge: HomeChallenge;
  states: {
    artworks: HomeContentState;
    artists: HomeContentState;
    stories: HomeContentState;
  };
};

export type HomeGreetingKey =
  | "morningNew"
  | "morningReturning"
  | "afternoon"
  | "evening"
  | "journey"
  | "museum";

export type HomeEngineConfig = {
  engineVersion: string;
  recentDays: number;
  explorationRatio: number;
  mix: {
    personalized: number;
    adjacent: number;
    serendipity: number;
  };
  recommendationCount: number;
  heroCount: number;
  journeyPreviewCount: number;
  weights: {
    museum: number;
    favorite: number;
    liked: number;
    interest: number;
    affinity: number;
    unseen: number;
    seenOnly: number;
    freshness: number;
    openedPenalty: number;
    readPenalty: number;
    recentPenalty: number;
    sameArtistPenalty: number;
    samePeriodPenalty: number;
    sameMovementPenalty: number;
  };
};

export type HomeExposure = {
  id: string;
  dayKey: string;
  status?: "seen" | "opened";
};

export type HomeEngineInput = {
  artworks: Artwork[];
  artists: Artist[];
  stories: ArtStory[];
  language: Language;
  now: Date;
  userKey: string;
  interests: string[];
  favoriteArtworkIds: string[];
  readArtworkIds: string[];
  likedArtworkIds: string[];
  dislikedArtworkIds: string[];
  museumArtworkIds: string[];
  readStoryIds: string[];
  exposures: HomeExposure[];
  sessionRecentlyShownIds?: string[];
  rotationKey?: number;
  isReturningUser: boolean;
  journeyCompletedCount: number;
  loading: {
    artworks: boolean;
    artists: boolean;
    stories: boolean;
  };
  errors: {
    artworks: boolean;
    artists: boolean;
    stories: boolean;
  };
  dailyOverrides?: {
    artworkId?: string;
    artistId?: string;
    storyId?: string;
    challenge?: "detective" | "artworkTimeline" | "artistTimeline";
  };
};

export type JourneyActivityType =
  | "ARTWORK_DISCOVERY"
  | "ARTIST_DISCOVERY"
  | "ARTICLE"
  | "TIMELINE"
  | "IDENTIFY_ARTWORK";

export type JourneyDifficulty = "beginner" | "intermediate" | "advanced";
export type JourneyNodeState = "completed" | "current" | "available" | "locked";

export type JourneyActivity = {
  id: string;
  type: JourneyActivityType;
  targetId?: string;
  route: "/artwork/[id]" | "/artist/[id]" | "/story/[id]" | "/timeline-game" | "/games";
  params?: Record<string, string>;
  title: string;
  subtitle: string;
  image?: string;
  /** Derived display metadata; source documents remain untouched. */
  historicalYear?: number;
  dateLabel?: string;
  periodLabel?: string;
  eraId?: JourneyEraId;
};

export type JourneyEraId =
  | "prehistoric"
  | "ancient"
  | "medieval"
  | "renaissance"
  | "baroque"
  | "romantic"
  | "modern"
  | "contemporary"
  | "editorial";

export type JourneyStage = {
  id: string;
  chapterId: string;
  order: number;
  difficulty: JourneyDifficulty;
  prerequisiteStageIds: string[];
  activity: JourneyActivity;
};

export type JourneyChapter = {
  id: string;
  order: number;
  title: string;
  dateLabel?: string;
  eraId?: JourneyEraId;
  stageIds: string[];
};

export type ArtJourney = {
  id: string;
  version: number;
  title: string;
  chapters: JourneyChapter[];
  stages: JourneyStage[];
};

export type JourneyProgress = {
  journeyId: string;
  journeyVersion: number;
  completedStageIds: string[];
  activeStageId: string;
  openedStageIds: string[];
  updatedAtMs: number;
};

export type JourneyStageView = JourneyStage & {
  state: JourneyNodeState;
};

export type HomeCachedEnvelope = {
  schemaVersion: 1;
  uidScope: string;
  savedAt: number;
  feed: HomeFeedModel;
};
