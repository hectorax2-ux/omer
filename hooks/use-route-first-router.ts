import { useCallback, useMemo } from "react";
import { useLocalSearchParams, usePathname, useRouter } from "expo-router";
import { beginNavigationPerformanceLock } from "@/hooks/use-runtime-performance-mode";
import { dispatchNavigationTransition, navigationLocationKey } from "@/utils/navigation-transition-store";
import { beginPerformanceMarker, markPerformanceEvent } from "@/utils/performance";

export function useRouteFirstRouter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams<Record<string, string | string[]>>();
  const currentLocation = navigationLocationKey(pathname, params);

  const commit = useCallback((key: string, action: () => void) => {
    beginPerformanceMarker("NAV_TAP");
    if (!dispatchNavigationTransition(currentLocation, key, action)) return;
    markPerformanceEvent("NAV_ACTION_DISPATCHED");
    beginNavigationPerformanceLock();
  }, [currentLocation]);

  const push = useCallback((...args: Parameters<typeof router.push>) => commit(`push:${JSON.stringify(args)}`, () => router.push(...args)), [commit, router]);
  const replace = useCallback((...args: Parameters<typeof router.replace>) => commit(`replace:${JSON.stringify(args)}`, () => router.replace(...args)), [commit, router]);
  const navigate = useCallback((...args: Parameters<typeof router.navigate>) => commit(`navigate:${JSON.stringify(args)}`, () => router.navigate(...args)), [commit, router]);
  const back = useCallback(() => { if (router.canGoBack()) commit("back", () => router.back()); }, [commit, router]);

  return useMemo(() => ({ ...router, push, replace, navigate, back }), [back, navigate, push, replace, router]);
}
