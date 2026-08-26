import { useSyncExternalStore } from "react";
import { InteractionManager } from "react-native";

export type RuntimePerformanceMode = "balanced" | "full" | "reduced";

const listeners = new Set<() => void>();
let measuredMode: RuntimePerformanceMode = "balanced";
let navigationLocked = false;
let scrollLocked = false;
let measurementScheduled = false;
let measurementGeneration = 0;
let goodWindows = 0;
let navigationReleaseTimer: ReturnType<typeof setTimeout> | null = null;
let scrollReleaseTimer: ReturnType<typeof setTimeout> | null = null;

function snapshot(): RuntimePerformanceMode {
  if (navigationLocked || scrollLocked) return "reduced";
  return measuredMode;
}

function notify() {
  listeners.forEach((listener) => listener());
}

function updateMeasuredMode(next: RuntimePerformanceMode) {
  if (measuredMode === next) return;
  measuredMode = next;
  notify();
}

export function scheduleRuntimePerformanceMeasurement() {
  if (measurementScheduled || navigationLocked || scrollLocked) return;
  measurementScheduled = true;
  const generation = measurementGeneration;
  InteractionManager.runAfterInteractions(() => {
    const samples: number[] = [];
    let previous = performance.now();
    const sample = (now: number) => {
      if (generation !== measurementGeneration) {
        measurementScheduled = false;
        return;
      }
      samples.push(now - previous);
      previous = now;
      if (samples.length < 18) {
        requestAnimationFrame(sample);
        return;
      }
      measurementScheduled = false;
      const sorted = [...samples].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 17;
      const p90 = sorted[Math.floor(sorted.length * 0.9)] ?? median;
      const longFrames = samples.filter((duration) => duration > 34).length;
      if (median > 22 || p90 > 38 || longFrames >= 3) {
        goodWindows = 0;
        updateMeasuredMode("reduced");
        return;
      }
      goodWindows += 1;
      if (measuredMode === "reduced") {
        if (goodWindows >= 2) updateMeasuredMode("balanced");
        return;
      }
      updateMeasuredMode(goodWindows >= 3 ? "full" : "balanced");
    };
    requestAnimationFrame(sample);
  });
}

export function beginNavigationPerformanceLock() {
  if (navigationReleaseTimer) clearTimeout(navigationReleaseTimer);
  if (!navigationLocked) {
    measurementGeneration += 1;
    navigationLocked = true;
    if (measuredMode !== "reduced") notify();
  }
  navigationReleaseTimer = setTimeout(() => {
    navigationReleaseTimer = null;
    navigationLocked = false;
    if (measuredMode !== "reduced") notify();
    scheduleRuntimePerformanceMeasurement();
  }, 650);
}

export function beginScrollPerformanceLock() {
  if (scrollReleaseTimer) clearTimeout(scrollReleaseTimer);
  scrollReleaseTimer = null;
  if (scrollLocked) return;
  measurementGeneration += 1;
  scrollLocked = true;
  if (measuredMode !== "reduced") notify();
}

export function endScrollPerformanceLock() {
  if (scrollReleaseTimer) clearTimeout(scrollReleaseTimer);
  scrollReleaseTimer = setTimeout(() => {
    scrollReleaseTimer = null;
    if (!scrollLocked) return;
    scrollLocked = false;
    if (measuredMode !== "reduced") notify();
    scheduleRuntimePerformanceMeasurement();
  }, 140);
}

export function isInteractionPerformanceLocked() {
  return navigationLocked || scrollLocked;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  scheduleRuntimePerformanceMeasurement();
  return () => listeners.delete(listener);
}

export function useRuntimePerformanceMode() {
  return useSyncExternalStore(subscribe, snapshot, () => "balanced" as RuntimePerformanceMode);
}
