import { useSyncExternalStore } from "react";
import { InteractionManager, Platform } from "react-native";

export type RuntimePerformanceMode = "balanced" | "full" | "reduced";

const listeners = new Set<() => void>();
let mode: RuntimePerformanceMode = Platform.OS === "web" ? "full" : "balanced";
let scheduled = false;

function emit(next: RuntimePerformanceMode) {
  if (mode === next) return;
  mode = next;
  listeners.forEach((listener) => listener());
}

function measure() {
  if (scheduled || Platform.OS === "web") return;
  scheduled = true;
  InteractionManager.runAfterInteractions(() => {
    const samples: number[] = [];
    let previous = performance.now();
    const sample = (now: number) => {
      samples.push(now - previous);
      previous = now;
      if (samples.length < 12) {
        requestAnimationFrame(sample);
        return;
      }
      const sorted = [...samples].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)] ?? 16;
      const longFrames = samples.filter((duration) => duration > 34).length;
      emit(median > 23 || longFrames >= 3 ? "reduced" : "full");
    };
    requestAnimationFrame(sample);
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  measure();
  return () => listeners.delete(listener);
}

export function useRuntimePerformanceMode() {
  return useSyncExternalStore(subscribe, () => mode, () => "balanced" as RuntimePerformanceMode);
}
