export type ProfileHydrationState<T> = {
  routeKey: string;
  status: "loading" | "cached" | "hydrated" | "missing";
  profile: T | null;
};

export function reconcileProfileHydration<T>(
  current: ProfileHydrationState<T>,
  activeRequestId: number,
  update: ProfileHydrationState<T> & { requestId: number }
) {
  if (update.requestId !== activeRequestId) return current;
  return {
    routeKey: update.routeKey,
    status: update.status,
    profile: update.profile
  };
}
