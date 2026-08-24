import { homeCopy } from "@/app/i18n/common";
import type { Language } from "@/types/content";
import { t } from "@/utils/localized-text";
import type { HomeChallenge, HomeGreetingKey, HomeRecommendationReason, JourneyDifficulty, JourneyNodeState } from "./types";

export function greetingText(key: HomeGreetingKey, language: Language) {
  const copy = {
    morningNew: homeCopy.greetingMorningNew,
    morningReturning: homeCopy.greetingMorningReturning,
    afternoon: homeCopy.greetingAfternoon,
    evening: homeCopy.greetingEvening,
    journey: homeCopy.greetingJourney,
    museum: homeCopy.greetingMuseum
  }[key];
  return t(copy, language);
}

export function reasonText(reason: HomeRecommendationReason, language: Language) {
  const copy = {
    daily: homeCopy.reasonDaily,
    museum: homeCopy.reasonMuseum,
    favorite: homeCopy.reasonFavorite,
    interest: homeCopy.reasonInterest,
    unseen: homeCopy.reasonUnseen,
    fresh: homeCopy.reasonFresh,
    explore: homeCopy.reasonExplore
  }[reason];
  return t(copy, language);
}

export function challengeTitle(challenge: HomeChallenge, language: Language) {
  if (challenge.id.endsWith(":detective")) return t(homeCopy.challengeDetective, language);
  if (challenge.params?.type === "artist") return t(homeCopy.challengeArtistTimeline, language);
  return t(homeCopy.challengeArtworkTimeline, language);
}

export function journeyStateText(state: JourneyNodeState, language: Language) {
  return t({
    completed: homeCopy.stageComplete,
    current: homeCopy.stageCurrent,
    available: homeCopy.stageAvailable,
    locked: homeCopy.stageLocked
  }[state], language);
}

export function difficultyText(difficulty: JourneyDifficulty, language: Language) {
  return t({
    beginner: homeCopy.difficultyBeginner,
    intermediate: homeCopy.difficultyIntermediate,
    advanced: homeCopy.difficultyAdvanced
  }[difficulty], language);
}
