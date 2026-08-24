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
});
