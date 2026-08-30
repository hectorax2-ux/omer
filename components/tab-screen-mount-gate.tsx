import { type ReactNode } from "react";

// Expo Router mounts a lazy tab when it becomes the active route and retains
// that screen afterwards. Deferring children by another animation frame left
// the selected tab pointing at a placeholder and delayed its first data effect.
export function TabScreenMountGate({ children }: { title: string; eyebrow?: string; children: ReactNode }) {
  return children;
}
