import { useCallback, useEffect, useMemo, useState } from "react";
import type { ArtJourney, JourneyProgress } from "./types";
import {
  completeJourneyStage,
  normalizeJourneyProgress,
  openJourneyStage,
  resolveJourneyStages
} from "./journey-engine";
import { loadLocalJourneyProgress, saveLocalJourneyProgress } from "./cache";
import { saveJourneyProgress, subscribeJourneyProgress } from "@/src/services/firebase/journey-progress-service";

export function useJourneyExperience(journey: ArtJourney, uid: string, uidScope: string) {
  const [storedProgress, setStoredProgress] = useState<JourneyProgress | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    setLoaded(false);
    loadLocalJourneyProgress(uidScope)
      .then((value) => {
        if (!active) return;
        setStoredProgress(value);
        setLoaded(true);
      })
      .catch(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [uidScope]);

  useEffect(() => {
    if (!uid) return undefined;
    return subscribeJourneyProgress(uid, (remote) => {
      if (!remote) return;
      setStoredProgress(normalizeJourneyProgress(journey, remote));
      setLoaded(true);
    });
  }, [journey, uid]);

  const progress = useMemo(
    () => normalizeJourneyProgress(journey, storedProgress),
    [journey, storedProgress]
  );
  const stages = useMemo(() => resolveJourneyStages(journey, progress), [journey, progress]);

  const persist = useCallback((next: JourneyProgress) => {
    setStoredProgress(next);
    void saveLocalJourneyProgress(uidScope, next).catch(() => undefined);
    if (uid) void saveJourneyProgress(uid, next).catch(() => undefined);
  }, [uid, uidScope]);

  const openStage = useCallback((stageId: string) => {
    const next = openJourneyStage(journey, progress, stageId);
    if (next === progress) return false;
    persist(next);
    return true;
  }, [journey, persist, progress]);

  const completeStage = useCallback((stageId: string) => {
    const next = completeJourneyStage(journey, progress, stageId);
    if (next === progress) return false;
    persist(next);
    return true;
  }, [journey, persist, progress]);

  return { progress, stages, loaded, openStage, completeStage };
}
