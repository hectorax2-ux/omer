import { useCallback, useMemo } from "react";
import { useGlobalSearchParams, usePathname, useRouter } from "expo-router";
import { beginNavigationPerformanceLock } from "@/hooks/use-runtime-performance-mode";
import { beginNavigationTransition, completeNavigationTransition, navigationLocationKey } from "@/utils/navigation-transition-store";

export function useRouteFirstRouter() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useGlobalSearchParams<Record<string, string | string[]>>();
  const currentLocation = navigationLocationKey(pathname, params);

  const commit = useCallback((action: () => void) => {
    beginNavigationPerformanceLock();
    const requestId = beginNavigationTransition(currentLocation);
    try {
      action();
    } catch (error) {
      completeNavigationTransition(requestId);
      throw error;
    }
  }, [currentLocation]);

  const push = useCallback((...args: Parameters<typeof router.push>) => commit(() => router.push(...args)), [commit, router]);
  const replace = useCallback((...args: Parameters<typeof router.replace>) => commit(() => router.replace(...args)), [commit, router]);
  const navigate = useCallback((...args: Parameters<typeof router.navigate>) => commit(() => router.navigate(...args)), [commit, router]);
  const back = useCallback(() => commit(() => router.back()), [commit, router]);

  return useMemo(() => ({ ...router, push, replace, navigate, back }), [back, navigate, push, replace, router]);
}
