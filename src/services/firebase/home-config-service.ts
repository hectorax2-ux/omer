import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDoc } from "firebase/firestore";
import { HOME_ENGINE_CONFIG } from "@/features/home/content-engine";
import type { HomeEngineConfig } from "@/features/home/types";
import { firestoreDb } from "./core";

const CACHE_KEY = "art-atlas:home-v2:runtime-config";

export type HomeRuntimeConfig = {
  config: HomeEngineConfig;
  overrides: {
    artworkId?: string;
    artistId?: string;
    storyId?: string;
    challenge?: "detective" | "artworkTimeline" | "artistTimeline";
  };
};

type RemoteHomeConfig = {
  mode?: "AUTO" | "MANUAL" | "SCHEDULED";
  engineVersion?: string;
  recentDays?: number;
  explorationRatio?: number;
  mix?: Partial<HomeEngineConfig["mix"]>;
  recommendationCount?: number;
  heroCount?: number;
  journeyPreviewCount?: number;
  weights?: Partial<HomeEngineConfig["weights"]>;
  dailyArtworkId?: string;
  dailyArtistId?: string;
  dailyStoryId?: string;
  dailyChallenge?: "detective" | "artworkTimeline" | "artistTimeline";
  startsAt?: { toMillis?: () => number } | null;
  endsAt?: { toMillis?: () => number } | null;
};

export async function loadHomeRuntimeConfig(now = Date.now()): Promise<HomeRuntimeConfig> {
  try {
    const snapshot = await getDoc(doc(firestoreDb, "appSettings", "homeContent"));
    if (!snapshot.exists()) return defaultRuntimeConfig();
    const resolved = resolveRuntimeConfig(snapshot.data() as RemoteHomeConfig, now);
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(resolved));
    return resolved;
  } catch {
    return loadCachedRuntimeConfig();
  }
}

async function loadCachedRuntimeConfig() {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return defaultRuntimeConfig();
    const parsed = JSON.parse(raw) as HomeRuntimeConfig;
    if (!parsed?.config?.engineVersion) return defaultRuntimeConfig();
    return {
      ...parsed,
      config: {
        ...HOME_ENGINE_CONFIG,
        ...parsed.config,
        mix: { ...HOME_ENGINE_CONFIG.mix, ...parsed.config.mix },
        weights: { ...HOME_ENGINE_CONFIG.weights, ...parsed.config.weights }
      }
    };
  } catch {
    return defaultRuntimeConfig();
  }
}

function resolveRuntimeConfig(remote: RemoteHomeConfig, now: number): HomeRuntimeConfig {
  const mode = remote.mode ?? "AUTO";
  const startsAt = remote.startsAt?.toMillis?.() ?? Number.NEGATIVE_INFINITY;
  const endsAt = remote.endsAt?.toMillis?.() ?? Number.POSITIVE_INFINITY;
  const overrideActive = mode === "MANUAL" || (mode === "SCHEDULED" && now >= startsAt && now <= endsAt);
  return {
    config: {
      ...HOME_ENGINE_CONFIG,
      engineVersion: safeString(remote.engineVersion, HOME_ENGINE_CONFIG.engineVersion),
      recentDays: clamp(remote.recentDays, 7, 90, HOME_ENGINE_CONFIG.recentDays),
      explorationRatio: clamp(remote.explorationRatio, 0.1, 0.5, HOME_ENGINE_CONFIG.explorationRatio),
      mix: {
        personalized: clamp(remote.mix?.personalized, 0.65, 0.75, HOME_ENGINE_CONFIG.mix.personalized),
        adjacent: clamp(remote.mix?.adjacent, 0.2, 0.25, HOME_ENGINE_CONFIG.mix.adjacent),
        serendipity: clamp(remote.mix?.serendipity, 0.05, 0.1, HOME_ENGINE_CONFIG.mix.serendipity)
      },
      recommendationCount: clamp(remote.recommendationCount, 3, 16, HOME_ENGINE_CONFIG.recommendationCount),
      heroCount: clamp(remote.heroCount, 1, 8, HOME_ENGINE_CONFIG.heroCount),
      journeyPreviewCount: clamp(remote.journeyPreviewCount, 3, 8, HOME_ENGINE_CONFIG.journeyPreviewCount),
      weights: {
        ...HOME_ENGINE_CONFIG.weights,
        ...safeWeights(remote.weights)
      }
    },
    overrides: overrideActive ? {
      artworkId: cleanId(remote.dailyArtworkId),
      artistId: cleanId(remote.dailyArtistId),
      storyId: cleanId(remote.dailyStoryId),
      challenge: remote.dailyChallenge
    } : {}
  };
}

function defaultRuntimeConfig(): HomeRuntimeConfig {
  return { config: HOME_ENGINE_CONFIG, overrides: {} };
}

function clamp(value: number | undefined, minimum: number, maximum: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(minimum, value));
}

function safeString(value: string | undefined, fallback: string) {
  const clean = value?.trim();
  return clean && clean.length <= 40 ? clean : fallback;
}

function cleanId(value: string | undefined) {
  const clean = value?.trim();
  return clean && clean.length <= 160 ? clean : undefined;
}

function safeWeights(weights: RemoteHomeConfig["weights"]) {
  if (!weights) return {};
  return Object.fromEntries(Object.entries(weights).filter(([, value]) => typeof value === "number" && Number.isFinite(value) && value >= -100 && value <= 100));
}
