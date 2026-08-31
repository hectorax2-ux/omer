import { authErrorCode } from "@/utils/auth-lifecycle";
import { logAuthStage, traceAuthStep } from "@/utils/auth-diagnostics";

type GoogleResponse = { type: string; data?: { idToken?: string | null } | null };
type GooglePicker = {
  signIn: () => Promise<GoogleResponse>;
  createAccount: () => Promise<GoogleResponse>;
  presentExplicitSignIn: () => Promise<GoogleResponse>;
};

/** A button tap is an explicit sign-in, not an authorized-account One Tap probe. */
export async function requestGoogleIdToken(picker: GooglePicker, platform: string) {
  const response = await traceAuthStep("account-picker", "google", async () => {
    if (platform === "android") return picker.presentExplicitSignIn();
    const saved = await picker.signIn().catch((error: unknown) => {
      if (authErrorCode(error) === "SIGN_IN_REQUIRED") return null;
      throw error;
    });
    const account = !saved || saved.type === "noSavedCredentialFound" ? await picker.createAccount() : saved;
    return account.type === "noSavedCredentialFound" ? picker.presentExplicitSignIn() : account;
  });

  // Android also reports provider/configuration interruptions as cancellation.
  // Do not silently return to the form or immediately reopen a cancelled picker.
  if (response.type === "cancelled") {
    logAuthStage("account-picker-cancelled", "google", "error", { code: "google/sign-in-not-completed" });
    return { cancelled: true, code: "google/sign-in-not-completed" };
  }
  if (response.type !== "success" || !response.data) {
    throw Object.assign(new Error("Google account picker returned no credential."), { code: "google/no-credential" });
  }
  logAuthStage("account-selected", "google", "success");
  const idToken = response.data.idToken?.trim();
  logAuthStage("GOOGLE_ID_TOKEN_PRESENT", "google", idToken ? "success" : "error", undefined, { present: Boolean(idToken) });
  if (!idToken) {
    // getTokens() may return another saved account's token and request OAuth
    // access scopes. Firebase login must use this picker result's ID token only.
    throw Object.assign(new Error("Selected Google account supplied no ID token."), { code: "google/missing-id-token" });
  }
  return { idToken };
}
