import { doc, getDoc, onSnapshot, type Unsubscribe } from "firebase/firestore";
import {
  defaultCompetitionSettings,
  createCompetitionSessionId,
  extractWeekPeriodId,
  getCompetitionWeekId,
  normalizeCompetitionSettings,
  type CompetitionSettings
} from "../../../firebase/shared/competition-week";
import { firestoreDb } from "@/src/services/firebase";

export type { CompetitionSettings };
export { extractWeekPeriodId } from "../../../firebase/shared/competition-week";

export async function getCompetitionSettings(): Promise<CompetitionSettings> {
  const snapshot = await getDoc(doc(firestoreDb, "appSettings", "competition"));
  if (!snapshot.exists()) {
    return defaultCompetitionSettings();
  }
  const settings = normalizeCompetitionSettings(snapshot.data() as Partial<CompetitionSettings>);
  if (!settings.activeWeekId.includes("~")) {
    return {
      ...settings,
      activeWeekId: createCompetitionSessionId(extractWeekPeriodId(settings.activeWeekId))
    };
  }
  return settings;
}

export function subscribeCompetitionSettings(onChange: (settings: CompetitionSettings) => void, onError?: () => void): Unsubscribe {
  return onSnapshot(
    doc(firestoreDb, "appSettings", "competition"),
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(defaultCompetitionSettings());
        return;
      }
      const settings = normalizeCompetitionSettings(snapshot.data() as Partial<CompetitionSettings>);
      if (!settings.activeWeekId.includes("~")) {
        onChange({
          ...settings,
          activeWeekId: createCompetitionSessionId(extractWeekPeriodId(settings.activeWeekId))
        });
        return;
      }
      onChange(settings);
    },
    () => {
      onError?.();
      const fallback = defaultCompetitionSettings();
      onChange({
        ...fallback,
        activeWeekId: extractWeekPeriodId(fallback.activeWeekId)
      });
    }
  );
}

export function resolveActiveWeekId(settings: CompetitionSettings | null | undefined) {
  return settings?.activeWeekId || getCompetitionWeekId();
}

export function resolveUploadLimit(settings: CompetitionSettings | null | undefined, isPremium: boolean) {
  if (!settings) return isPremium ? 2 : 2;
  return isPremium ? settings.premiumUploadLimit : settings.standardUploadLimit;
}
