import { describe, expect, test } from "bun:test";
import { reconcileProfileHydration, type ProfileHydrationState } from "./profile-hydration";

type TestProfile = { uid: string };

describe("profile hydration reconciliation", () => {
  test("a late profile A response cannot replace profile B", () => {
    const profileBLoading: ProfileHydrationState<TestProfile> = { routeKey: "b", status: "loading", profile: null };
    const next = reconcileProfileHydration(profileBLoading, 2, {
      requestId: 1,
      routeKey: "a",
      status: "hydrated",
      profile: { uid: "a" }
    });

    expect(next).toBe(profileBLoading);
  });

  test("loading remains distinct from a real hydrated profile", () => {
    const loading: ProfileHydrationState<TestProfile> = { routeKey: "a", status: "loading", profile: null };
    const hydrated = reconcileProfileHydration(loading, 1, {
      requestId: 1,
      routeKey: "a",
      status: "hydrated",
      profile: { uid: "a" }
    });

    expect(loading.profile).toBeNull();
    expect(hydrated).toEqual({ routeKey: "a", status: "hydrated", profile: { uid: "a" } });
  });

  test("a response for another route cannot replace the active route even with the same generation", () => {
    const profileBLoading: ProfileHydrationState<TestProfile> = { routeKey: "b", status: "loading", profile: null };
    const next = reconcileProfileHydration(profileBLoading, 2, {
      requestId: 2,
      routeKey: "a",
      status: "hydrated",
      profile: { uid: "a" }
    });

    expect(next).toBe(profileBLoading);
  });

  test("repeated A and B navigation only accepts the latest generation", () => {
    const final = Array.from({ length: 10 }).reduce<ProfileHydrationState<TestProfile>>((current, _, index) => {
      const requestId = index + 1;
      const routeKey = requestId % 2 ? "a" : "b";
      const loading = { routeKey, status: "loading", profile: null } satisfies ProfileHydrationState<TestProfile>;
      const stale = reconcileProfileHydration(loading, requestId, {
        requestId: requestId - 1,
        routeKey: routeKey === "a" ? "b" : "a",
        status: "hydrated",
        profile: current.profile
      });
      return reconcileProfileHydration(stale, requestId, {
        requestId,
        routeKey,
        status: "hydrated",
        profile: { uid: routeKey }
      });
    }, { routeKey: "", status: "loading", profile: null });

    expect(final).toEqual({ routeKey: "b", status: "hydrated", profile: { uid: "b" } });
  });
});
