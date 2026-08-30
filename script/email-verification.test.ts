import { describe, expect, test } from "bun:test";
import type { User } from "firebase/auth";
import { isEmailVerifiedForApp } from "../utils/email-verification";

function authUser(emailVerified: boolean, providerId: string) {
  return {
    emailVerified,
    providerData: [{ providerId }]
  } as User;
}

describe("application email verification", () => {
  test("accepts Google users without a second verification gate", () => {
    expect(isEmailVerifiedForApp(authUser(false, "google.com"))).toBe(true);
  });

  test("accepts Firebase-verified password users", () => {
    expect(isEmailVerifiedForApp(authUser(true, "password"))).toBe(true);
  });

  test("keeps unverified password users unverified", () => {
    expect(isEmailVerifiedForApp(authUser(false, "password"))).toBe(false);
  });
});
