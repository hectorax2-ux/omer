import { useSyncExternalStore } from "react";

type NavigationTransitionState = {
  visible: boolean;
  requestId: number;
  originLocation: string;
  label?: string;
};

const listeners = new Set<() => void>();
let requestId = 0;
let state: NavigationTransitionState = {
  visible: false,
  requestId,
  originLocation: ""
};

function emit() {
  listeners.forEach((listener) => listener());
}

export function navigationLocationKey(pathname: string, params: Record<string, string | string[] | undefined> = {}) {
  const query = Object.entries(params)
    .filter((entry): entry is [string, string | string[]] => entry[1] !== undefined)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${Array.isArray(value) ? value.join(",") : value}`)
    .join("&");
  return query ? `${pathname}?${query}` : pathname;
}

export function beginNavigationTransition(originLocation: string, label?: string) {
  requestId += 1;
  state = {
    visible: true,
    requestId,
    originLocation,
    label
  };
  emit();
  return requestId;
}

export function completeNavigationTransition(completedRequestId?: number) {
  if (!state.visible || (completedRequestId !== undefined && completedRequestId !== state.requestId)) return;
  state = { ...state, visible: false };
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useNavigationTransitionState() {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
