import { useSyncExternalStore } from "react";
import { InteractionManager } from "react-native";

export type StartupPhase = "critical" | "background" | "idle";

const listeners = new Set<() => void>();
let phase: StartupPhase = "critical";
let scheduled = false;

function emit(next: StartupPhase) {
  if (phase === next) return;
  phase = next;
  listeners.forEach((listener) => listener());
}

function schedule() {
  if (scheduled) return;
  scheduled = true;
  InteractionManager.runAfterInteractions(() => {
    emit("background");
    setTimeout(() => emit("idle"), 900);
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  schedule();
  return () => listeners.delete(listener);
}

export function useStartupPhase() {
  return useSyncExternalStore(subscribe, () => phase, () => "critical" as StartupPhase);
}
