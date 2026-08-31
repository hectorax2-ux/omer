import { afterEach, expect, test } from "bun:test";
import { beginNavigationTransition, completeNavigationTransition, dispatchNavigationTransition, getNavigationTransitionSnapshot } from "../utils/navigation-transition-store";

afterEach(() => completeNavigationTransition());

test("route dispatch happens immediately while destination data takes 5 seconds", async () => {
  let route = "home";
  let dataReady = false;
  const network = new Promise<void>((resolve) => setTimeout(() => { dataReady = true; resolve(); }, 5000));
  dispatchNavigationTransition("/", "feed", () => { route = "feed"; });
  expect(route).toBe("feed");
  expect(dataReady).toBe(false);
  completeNavigationTransition(getNavigationTransitionSnapshot().requestId);
  expect(getNavigationTransitionSnapshot().visible).toBe(false);
  expect(dataReady).toBe(false);
  await network;
}, 7000);

test("rapid duplicate taps dispatch once; latest different destination wins", () => {
  const dispatched: string[] = [];
  dispatchNavigationTransition("/", "feed", () => dispatched.push("feed"));
  const old = getNavigationTransitionSnapshot().requestId;
  expect(dispatchNavigationTransition("/", "feed", () => dispatched.push("duplicate"))).toBe(false);
  dispatchNavigationTransition("/", "account", () => dispatched.push("account"));
  const latest = getNavigationTransitionSnapshot().requestId;
  completeNavigationTransition(old);
  expect(getNavigationTransitionSnapshot().visible).toBe(true);
  expect(getNavigationTransitionSnapshot().requestId).toBe(latest);
  completeNavigationTransition(latest);
  expect(dispatched).toEqual(["feed", "account"]);
});

test("dispatch failure clears only its own loader and permits retry", () => {
  expect(() => dispatchNavigationTransition("/", "news", () => { throw new Error("router"); })).toThrow("router");
  expect(getNavigationTransitionSnapshot().visible).toBe(false);
  expect(dispatchNavigationTransition("/", "news", () => undefined)).toBe(true);
});

test("stale failure cannot clear a newer transition", () => {
  expect(() => dispatchNavigationTransition("/", "news", () => {
    beginNavigationTransition("/", "Games", "games");
    throw new Error("old route");
  })).toThrow();
  expect(getNavigationTransitionSnapshot().visible).toBe(true);
  expect(getNavigationTransitionSnapshot().targetKey).toBe("games");
});
