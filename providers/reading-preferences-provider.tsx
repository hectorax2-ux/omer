import { createContext, ReactNode, useContext, useMemo, useState } from "react";

// Reading font scale is intentionally session-only: it lives in memory so a user's
// choice survives tab switches and navigation, but a full cold start returns to the
// default. Steps start one notch below 1.0 so the default reads a touch smaller.
const SCALE_STEPS = [0.85, 0.92, 1, 1.12, 1.26, 1.42];
const DEFAULT_INDEX = 1;

type ReadingPreferencesValue = {
  scale: number;
  index: number;
  stepCount: number;
  canIncrease: boolean;
  canDecrease: boolean;
  increase: () => void;
  decrease: () => void;
  reset: () => void;
};

const ReadingPreferencesContext = createContext<ReadingPreferencesValue | null>(null);

export function ReadingPreferencesProvider({ children }: { children: ReactNode }) {
  const [index, setIndex] = useState(DEFAULT_INDEX);

  const value = useMemo<ReadingPreferencesValue>(() => ({
    scale: SCALE_STEPS[index],
    index,
    stepCount: SCALE_STEPS.length,
    canIncrease: index < SCALE_STEPS.length - 1,
    canDecrease: index > 0,
    increase: () => setIndex((current) => Math.min(SCALE_STEPS.length - 1, current + 1)),
    decrease: () => setIndex((current) => Math.max(0, current - 1)),
    reset: () => setIndex(DEFAULT_INDEX)
  }), [index]);

  return <ReadingPreferencesContext.Provider value={value}>{children}</ReadingPreferencesContext.Provider>;
}

export function useReadingScale() {
  const context = useContext(ReadingPreferencesContext);
  if (!context) {
    throw new Error("useReadingScale must be used within a ReadingPreferencesProvider");
  }
  return context;
}
