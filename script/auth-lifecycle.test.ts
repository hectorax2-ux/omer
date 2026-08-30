import { describe, expect, test } from "bun:test";
import { authErrorCode, createAuthActionLock, createAuthNavigationIntent, createAuthSessionScope, profileNeedsCompletion } from "../utils/auth-lifecycle";
import { getAuthErrorMessage } from "../utils/auth-error-message";

describe("auth session boundaries", () => {
  test("Auth observer can hand off before credential promise/form cleanup", () => {
    const intent = createAuthNavigationIntent();
    intent.begin();
    expect(intent.consume(false, true)).toBe(false);
    expect(intent.consume(true, true)).toBe(true);
    expect(intent.consume(true, true)).toBe(false);
  });
  test("leaving, errors and an older request cannot override the latest route", () => {
    const intent = createAuthNavigationIntent();
    const old = intent.begin();
    expect(intent.consume(false, false)).toBe(false);
    expect(intent.consume(true, true)).toBe(false);
    const latest = intent.begin();
    intent.cancel(old);
    expect(intent.consume(true, true)).toBe(true);
    intent.begin();
    intent.cancel(latest);
    expect(intent.consume(true, true)).toBe(true);
    const failed = intent.begin();
    intent.cancel(failed);
    expect(intent.consume(true, true)).toBe(false);
  });
  test("late A response cannot commit to B or a later A session", async () => {
    const scope = createAuthSessionScope();
    scope.begin("A");
    const firstA = scope.capture("A");
    scope.begin("B");
    const b = scope.capture("B");
    expect(firstA()).toBe(false);
    expect(b()).toBe(true);
    scope.begin("A");
    expect(firstA()).toBe(false);
    expect(b()).toBe(false);
    const newA = scope.capture("A");
    expect(newA()).toBe(true);
    scope.invalidate();
    expect(newA()).toBe(false);
  });

  test("account picker and credential submit share a lock; rejection releases it", async () => {
    const run = createAuthActionLock();
    const pending = Promise.withResolvers<string>();
    let calls = 0;
    const first = run(() => { calls += 1; return pending.promise; });
    expect(await run(async () => { calls += 1; return "duplicate"; })).toBeUndefined();
    expect(calls).toBe(1);
    pending.reject(new Error("network"));
    await expect(first).rejects.toThrow("network");
    expect(await run(async () => "retry")).toBe("retry");
    expect(await run(async () => "cancelled")).toBe("cancelled");
    expect(await run(async () => "next")).toBe("next");
  });
});

describe("server onboarding flag and legacy country compatibility", () => {
  test("completed server flag wins over incomplete/missing/legacy fields", () => {
    for (const country of ["", "Türkiye", "turkiye", "UZ", "United Kingdom", undefined]) {
      expect(profileNeedsCompletion({ profileOnboardingCompleted: true, country })).toBe(false);
      expect(profileNeedsCompletion({ profileOnboardingCompleted: false, country })).toBe(true);
    }
    expect(profileNeedsCompletion({ role: "admin", profileOnboardingCompleted: false })).toBe(false);
  });
  test("legacy complete profile is preserved; generated blank account needs onboarding", () => {
    expect(profileNeedsCompletion({ username: "mona", displayName: "Mona Lisa", country: "", bio: "Art" })).toBe(false);
    expect(profileNeedsCompletion({ username: "user123456", displayName: "user123456" })).toBe(true);
    expect(profileNeedsCompletion({})).toBe(true);
  });
});

describe("safe localized authentication errors", () => {
  test("all four languages distinguish credentials/network/provider/cancellation/storage", () => {
    for (const language of ["tr", "en", "ru", "uz"] as const) {
      const network = getAuthErrorMessage({ code: "auth/network-request-failed" }, language);
      const credentials = getAuthErrorMessage({ code: "auth/invalid-credential" }, language);
      expect(network).not.toBe(credentials);
      expect(getAuthErrorMessage({ code: "auth/invalid-credential" }, language, true)).not.toBe(credentials);
      expect(getAuthErrorMessage({ code: "auth/persistence-unavailable" }, language)).not.toBe(network);
      expect(getAuthErrorMessage({ code: "auth/popup-closed-by-user" }, language)).toBe("");
      expect(getAuthErrorMessage({ code: "auth/account-exists-with-different-credential" }, language)).not.toBe(credentials);
    }
  });
  test("logs expose only bounded error codes, never provider data", () => {
    expect(authErrorCode({ code: "auth/network-request-failed", accessToken: "secret", email: "private" })).toBe("auth/network-request-failed");
    expect(authErrorCode({ code: "token: PRIVATE VALUE" })).toBe("unknown");
    expect(authErrorCode(new Error("private payload"))).toBe("unknown");
  });
});
