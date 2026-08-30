import { describe, expect, test } from "bun:test";
import { authErrorDetails, traceAuthStep } from "../utils/auth-diagnostics";

describe("sanitized auth diagnostics", () => {
  test("preserves actual runtime type and Firebase code", () => {
    expect(authErrorDetails(new TypeError("profile.country.trim is not a function"))).toEqual({
      code: "unknown", name: "TypeError", message: "profile.country.trim is not a function"
    });
    expect(authErrorDetails({ name: "FirebaseError", code: "auth/invalid-credential", message: "Firebase: Error (auth/invalid-credential)." }).code).toBe("auth/invalid-credential");
  });
  test("redacts sensitive named fields, quoted values, email and URL", () => {
    const details = authErrorDetails(new Error('password="two secret words" {"idToken":"sensitive-token"} nonce=private-nonce person@example.test https://example.test/?token=private'));
    for (const secret of ["two secret words", "sensitive-token", "private-nonce", "person@example.test", "token=private"]) expect(details.message).not.toContain(secret);
  });
  test("tracing never turns a successful credential into failure or changes errors", async () => {
    const credential = { user: { uid: "test" } };
    expect(await traceAuthStep("firebase-auth", "email", async () => credential)).toBe(credential);
    const failure = new TypeError("original failure");
    await expect(traceAuthStep("firebase-auth", "email", async () => { throw failure; })).rejects.toBe(failure);
  });
});
