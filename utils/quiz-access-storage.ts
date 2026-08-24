import AsyncStorage from "@react-native-async-storage/async-storage";
import { areRewardedAdRequirementsEnabled } from "@/constants/ad-feature-flags";
import { getLocalDayKey } from "../firebase/shared/rankings";

const PREFIX = "artAtlasQuizAccess";

function weeklyEntryKey(weekId: string) {
  return `${PREFIX}/weeklyEntry/${weekId}`;
}

function weeklyScoreAdKey(weekId: string) {
  return `${PREFIX}/weeklyScoreAd/${weekId}`;
}

function dailyEntryKey(dayKey: string) {
  return `${PREFIX}/dailyEntry/${dayKey}`;
}

export async function isWeeklyEntryGranted(weekId: string) {
  return (await AsyncStorage.getItem(weeklyEntryKey(weekId))) === "1";
}

export async function grantWeeklyEntry(weekId: string) {
  await AsyncStorage.setItem(weeklyEntryKey(weekId), "1");
}

export async function isWeeklyScoreAdDone(weekId: string) {
  return (await AsyncStorage.getItem(weeklyScoreAdKey(weekId))) === "1";
}

export async function markWeeklyScoreAdDone(weekId: string) {
  await AsyncStorage.setItem(weeklyScoreAdKey(weekId), "1");
}

export async function isDailyEntryGranted(dayKey = getLocalDayKey()) {
  return (await AsyncStorage.getItem(dailyEntryKey(dayKey))) === "1";
}

export async function grantDailyEntry(dayKey = getLocalDayKey()) {
  await AsyncStorage.setItem(dailyEntryKey(dayKey), "1");
}

export async function needsWeeklyEntryAd(input: {
  weekId: string;
  isPremium: boolean;
  adsEnabled: boolean;
  canEarnScore: boolean;
}) {
  if (!areRewardedAdRequirementsEnabled()) return false;
  if (!input.canEarnScore || input.isPremium || !input.adsEnabled) return false;
  if (await isWeeklyScoreAdDone(input.weekId)) return false;
  if (await isWeeklyEntryGranted(input.weekId)) return false;
  return true;
}

export async function needsDailyEntryAd(input: {
  isPremium: boolean;
  adsEnabled: boolean;
  dayKey?: string;
}) {
  if (!areRewardedAdRequirementsEnabled()) return false;
  if (input.isPremium || !input.adsEnabled) return false;
  return !(await isDailyEntryGranted(input.dayKey));
}
