import { doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import type { JourneyProgress } from "@/features/home/types";
import { firestoreDb } from "./core";

type JourneyProgressDocument = {
  userId: string;
  journeyId: string;
  journeyVersion: number;
  completedStageIds: string[];
  activeStageId: string;
  openedStageIds: string[];
  updatedAt?: { toMillis?: () => number } | null;
};

export function subscribeJourneyProgress(uid: string, onValue: (progress: Partial<JourneyProgress> | null) => void) {
  return onSnapshot(
    doc(firestoreDb, "journeyProgress", uid),
    (snapshot) => {
      if (!snapshot.exists()) {
        onValue(null);
        return;
      }
      const data = snapshot.data() as JourneyProgressDocument;
      onValue({
        journeyId: data.journeyId,
        journeyVersion: data.journeyVersion,
        completedStageIds: data.completedStageIds ?? [],
        activeStageId: data.activeStageId ?? "",
        openedStageIds: data.openedStageIds ?? [],
        updatedAtMs: data.updatedAt?.toMillis?.() ?? 0
      });
    },
    () => onValue(null)
  );
}

export async function saveJourneyProgress(uid: string, progress: JourneyProgress) {
  await setDoc(doc(firestoreDb, "journeyProgress", uid), {
    userId: uid,
    journeyId: progress.journeyId,
    journeyVersion: progress.journeyVersion,
    completedStageIds: progress.completedStageIds.slice(0, 1000),
    activeStageId: progress.activeStageId,
    openedStageIds: progress.openedStageIds.slice(0, 1000),
    updatedAt: serverTimestamp()
  }, { merge: true });
}
