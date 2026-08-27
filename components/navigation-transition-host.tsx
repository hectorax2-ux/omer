import { useEffect } from "react";
import { useGlobalSearchParams, usePathname, useSegments } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NavigationTransition } from "@/components/navigation-transition";
import { navigationLayout } from "@/constants/design";
import { completeNavigationTransition, navigationLocationKey, useNavigationTransitionState } from "@/utils/navigation-transition-store";

export function NavigationTransitionHost() {
  const pathname = usePathname();
  const params = useGlobalSearchParams<Record<string, string | string[]>>();
  const segments = useSegments();
  const insets = useSafeAreaInsets();
  const transition = useNavigationTransitionState();
  const currentLocation = navigationLocationKey(pathname, params);

  useEffect(() => {
    if (!transition.visible) return;
    if (currentLocation !== transition.originLocation) {
      const frame = requestAnimationFrame(() => completeNavigationTransition(transition.requestId));
      return () => cancelAnimationFrame(frame);
    }

    // A prevented or failed router action must not leave a global overlay mounted.
    // Successful route changes clear on the pathname branch above, without waiting for data.
    const safetyCleanup = setTimeout(() => completeNavigationTransition(transition.requestId), 1800);
    return () => clearTimeout(safetyCleanup);
  }, [currentLocation, transition.originLocation, transition.requestId, transition.visible]);

  const bottomInset = segments[0] === "(tabs)"
    ? navigationLayout.floatingBarHeight + Math.max(insets.bottom, navigationLayout.minimumBottomInset)
    : 0;

  return (
    <NavigationTransition
      visible={transition.visible}
      label={transition.label}
      bottomInset={bottomInset}
    />
  );
}
