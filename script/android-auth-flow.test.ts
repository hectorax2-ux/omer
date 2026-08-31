import { describe, expect, test } from "bun:test";
import { requestGoogleIdToken } from "../utils/google-sign-in-flow";
import { getAuthErrorMessage } from "../utils/auth-error-message";
import { authErrorDetails } from "../utils/auth-diagnostics";

describe("native Google adapter contract (not a device OAuth test)", () => {
  test("Android button uses explicit account UI for both new and existing accounts", async () => {
    for (const token of ["existing-id-token", "new-id-token"]) {
      const calls: string[] = [];
      const result = await requestGoogleIdToken({
        signIn: async () => { throw new Error("Authorized-account probe must not run on Android button tap"); },
        createAccount: async () => { throw new Error("Do not open a second picker"); },
        presentExplicitSignIn: async () => { calls.push("explicit"); return { type: "success", data: { idToken: token } }; }
      }, "android");
      expect(result.idToken).toBe(token);
      expect(calls).toEqual(["explicit"]);
    }
  });

  test("cancellation has a visible message in all languages and never reopens picker", async () => {
    const result = await requestGoogleIdToken({
      signIn: async () => { throw new Error("wrong flow"); },
      createAccount: async () => { throw new Error("wrong flow"); },
      presentExplicitSignIn: async () => ({ type: "cancelled" })
    }, "android");
    expect(result.cancelled).toBe(true);
    expect(result.idToken).toBeUndefined();
    for (const language of ["tr", "en", "ru", "uz"] as const) {
      expect(getAuthErrorMessage({ code: result.code }, language, true).length).toBeGreaterThan(15);
    }
  });

  test("empty token and missing credential are explicit failures", async () => {
    for (const response of [{ type: "success", data: { idToken: "  " } }, { type: "success", data: null }, { type: "noSavedCredentialFound" }]) {
      await expect(requestGoogleIdToken({
        signIn: async () => response,
        createAccount: async () => response,
        presentExplicitSignIn: async () => response
      }, "android")).rejects.toThrow();
    }
  });

  test("native configuration failure retains the real exception", async () => {
    const error = Object.assign(new Error("Android OAuth configuration rejected"), { code: "DEVELOPER_ERROR" });
    await expect(requestGoogleIdToken({
      signIn: async () => { throw error; }, createAccount: async () => { throw error; }, presentExplicitSignIn: async () => { throw error; }
    }, "android")).rejects.toBe(error);
  });

  test("iOS existing restoration and new-account fallback remain intact", async () => {
    for (const existing of [true, false]) {
      const calls: string[] = [];
      const result = await requestGoogleIdToken({
        signIn: async () => { calls.push("restore"); return existing ? { type: "success", data: { idToken: "ios-token" } } : { type: "noSavedCredentialFound" }; },
        createAccount: async () => { calls.push("create"); return { type: "success", data: { idToken: "ios-token" } }; },
        presentExplicitSignIn: async () => { throw new Error("unnecessary extra picker"); }
      }, "ios");
      expect(result.idToken).toBe("ios-token");
      expect(calls).toEqual(existing ? ["restore"] : ["restore", "create"]);
    }
  });

  test("diagnostics retain stack but redact credentials", () => {
    const error = new Error("password=secret-value user@example.test");
    error.stack = "Error: idToken=secret-token\n    at login (hooks/use-google-sign-in.ts:123:4)";
    const details = authErrorDetails(error);
    expect(details.stack).toContain("hooks/use-google-sign-in.ts:123:4");
    expect(JSON.stringify(details)).not.toContain("secret-value");
    expect(JSON.stringify(details)).not.toContain("secret-token");
    expect(JSON.stringify(details)).not.toContain("user@example.test");
  });
});

test("checked-in Android client config matches package, web client and upload signer", async () => {
  const app = await Bun.file("../app.json").json();
  const google = await Bun.file("../google-services.json").json();
  const workflow = await Bun.file("../codemagic.yaml").text();
  const client = google.client.find((item: { client_info: { android_client_info: { package_name: string } } }) => item.client_info.android_client_info.package_name === app.expo.android.package);
  expect(client).toBeDefined();
  expect(google.project_info.project_id).toBe("artco-62499");
  expect(client.oauth_client.some((item: { client_type: number; android_info?: { certificate_hash: string } }) => item.client_type === 1 && item.android_info?.certificate_hash.toLowerCase() === "4eed3ac645fdf02ce718180ffc670172b493b1d5")).toBe(true);
  const web = client.oauth_client.find((item: { client_type: number }) => item.client_type === 3);
  expect(workflow).toContain(`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: "${web.client_id}"`);
});
