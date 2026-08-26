import { InteractionManager } from "react-native";
import { isInteractionPerformanceLocked } from "@/hooks/use-runtime-performance-mode";

type PerformanceSpan = {
  end: (details?: Record<string, string | number | boolean>) => void;
};

export type PerformanceEvent = {
  name: string;
  atMs: number;
  details?: Record<string, string | number | boolean>;
};

const MAX_EVENTS = 200;
const events: PerformanceEvent[] = [];
const markers = new Map<string, { startedAt: number; details?: PerformanceEvent["details"] }>();

export function markPerformanceEvent(name: string, details?: PerformanceEvent["details"]) {
  const event = { name, atMs: Math.round(performance.now() * 10) / 10, details };
  events.push(event);
  if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
  if (__DEV__) console.info(`[perf] ${name}`, details ?? {});
  return event.atMs;
}

export function beginPerformanceMarker(name: string, details?: PerformanceEvent["details"]) {
  markers.set(name, { startedAt: performance.now(), details });
  markPerformanceEvent(`${name}_START`, details);
}

export function endPerformanceMarker(name: string, details?: PerformanceEvent["details"]) {
  const marker = markers.get(name);
  if (!marker) return null;
  markers.delete(name);
  const durationMs = Math.round((performance.now() - marker.startedAt) * 10) / 10;
  markPerformanceEvent(`${name}_END`, { ...marker.details, ...details, durationMs });
  return durationMs;
}

export function getPerformanceEvents() {
  return [...events];
}

export function startPerformanceSpan(name: string): PerformanceSpan {
  const startedAt = performance.now();
  markPerformanceEvent(`${name}.started`);
  return {
    end(details) {
      const durationMs = Math.round((performance.now() - startedAt) * 10) / 10;
      markPerformanceEvent(name, { durationMs, ...details });
    }
  };
}

export function runAfterInteractions<T>(task: () => T | Promise<T>) {
  return new Promise<T>((resolve, reject) => {
    const execute = () => {
      if (isInteractionPerformanceLocked()) {
        setTimeout(execute, 80);
        return;
      }
      Promise.resolve(task()).then(resolve, reject);
    };
    InteractionManager.runAfterInteractions(execute);
  });
}
