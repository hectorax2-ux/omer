import { Platform } from "react-native";
import { beginScrollPerformanceLock, endScrollPerformanceLock, type RuntimePerformanceMode } from "@/hooks/use-runtime-performance-mode";

const interactionProps = {
  onScrollBeginDrag: beginScrollPerformanceLock,
  onScrollEndDrag: endScrollPerformanceLock,
  onMomentumScrollBegin: beginScrollPerformanceLock,
  onMomentumScrollEnd: endScrollPerformanceLock
} as const;

export const standardListPerformanceProps = {
  initialNumToRender: 6,
  maxToRenderPerBatch: 6,
  updateCellsBatchingPeriod: 48,
  windowSize: 5,
  removeClippedSubviews: Platform.OS === "android",
  ...interactionProps
} as const;

export const artworkGridPerformanceProps = {
  initialNumToRender: 9,
  maxToRenderPerBatch: 6,
  updateCellsBatchingPeriod: 48,
  windowSize: 5,
  removeClippedSubviews: Platform.OS === "android",
  ...interactionProps
} as const;

export function getStandardListPerformanceProps(mode: RuntimePerformanceMode) {
  return {
    initialNumToRender: mode === "reduced" ? 4 : 6,
    maxToRenderPerBatch: mode === "reduced" ? 3 : mode === "balanced" ? 4 : 6,
    updateCellsBatchingPeriod: mode === "reduced" ? 72 : 48,
    windowSize: mode === "reduced" ? 3 : mode === "balanced" ? 4 : 5,
    removeClippedSubviews: Platform.OS === "android",
    ...interactionProps
  } as const;
}

export function getArtworkGridPerformanceProps(mode: RuntimePerformanceMode) {
  return {
    initialNumToRender: mode === "reduced" ? 6 : 9,
    maxToRenderPerBatch: mode === "reduced" ? 3 : mode === "balanced" ? 4 : 6,
    updateCellsBatchingPeriod: mode === "reduced" ? 72 : 48,
    windowSize: mode === "reduced" ? 3 : mode === "balanced" ? 4 : 5,
    removeClippedSubviews: Platform.OS === "android",
    ...interactionProps
  } as const;
}
