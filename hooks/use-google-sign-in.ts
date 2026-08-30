import { useMemo } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { authErrorCode } from "@/utils/auth-lifecycle";
import { logAuthStage } from "@/utils/auth-diagnostics";

WebBrowser.maybeCompleteAuthSession();

const nativeGoogleRuntime = {
  configuredClientId: ""
};

function isExpoGoRuntime() {
  return Constants.executionEnvironment === "storeClient";
}

function usesNativeGoogleSignIn() {
  return Platform.OS !== "web" && !isExpoGoRuntime();
}

export function getGoogleOAuthRedirectUri() {
  if (isExpoGoRuntime()) {
    return AuthSession.getRedirectUrl("redirect");
  }

  return AuthSession.makeRedirectUri({ scheme: "artatlas", path: "oauth/google" });
}

export function getGoogleOAuthConfig() {
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim() ?? "";
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim() ?? "";
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID?.trim() ?? "";

  return {
    webClientId,
    iosClientId,
    androidClientId
  };
}

export function isGoogleSignInConfigured() {
  const config = getGoogleOAuthConfig();

  if (!config.webClientId) return false;
  if (Platform.OS === "android" && !config.androidClientId) return false;
  if (Platform.OS === "ios" && !config.iosClientId) return false;
  return true;
}

export function getGoogleSignInConfigError(): string | undefined {
  const config = getGoogleOAuthConfig();

  if (!config.webClientId) {
    return "Google girişi için EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID tanımlanmalıdır.";
  }

  if (Platform.OS === "android" && !config.androidClientId) {
    return "Google girişi için EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID tanımlanmalıdır.";
  }

  if (Platform.OS === "ios" && !config.iosClientId) {
    return "Google girişi için EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID tanımlanmalıdır.";
  }

  return undefined;
}

export function useGoogleSignIn() {
  const config = useMemo(() => getGoogleOAuthConfig(), []);
  const redirectUri = useMemo(() => getGoogleOAuthRedirectUri(), []);
  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    clientId: config.webClientId,
    redirectUri,
    selectAccount: true
  });

  return {
    ready: isGoogleSignInConfigured() && (Platform.OS === "web" || usesNativeGoogleSignIn() || Boolean(request)),
    configError: getGoogleSignInConfigError(),
    signIn: async (): Promise<{ idToken?: string; cancelled?: boolean; error?: string; code?: string }> => {
      const configError = getGoogleSignInConfigError();
      if (configError) return { error: configError, code: "auth/operation-not-allowed" };

      if (Platform.OS === "web") {
        return { error: "web-popup" };
      }

      if (usesNativeGoogleSignIn()) {
        return signInWithNativeGoogle(config.webClientId, config.iosClientId);
      }

      if (!request) {
        return { error: "Google oturum isteği hazırlanamadı. Lütfen tekrar deneyin." };
      }

      const result = await promptAsync();
      if (result.type === "cancel" || result.type === "dismiss") {
        return { cancelled: true };
      }

      if (result.type !== "success") {
        console.warn("[Google Sign In] Expo AuthSession failed.", result.type);
        return { error: "Google ile giriş tamamlanamadı. Lütfen tekrar deneyin." };
      }

      const idToken = result.params.id_token;
      if (!idToken) {
        console.error("[Google Sign In] Expo AuthSession returned no ID token.");
        return { error: "Google kimliği alınamadı. Lütfen tekrar deneyin." };
      }

      return { idToken };
    }
  };
}

export async function signOutGoogleNativeSession() {
  if (!usesNativeGoogleSignIn()) return;

  const config = getGoogleOAuthConfig();
  if (!config.webClientId) return;

  const google = await import("react-native-nitro-google-signin");
  configureNativeGoogle(google.GoogleOneTapSignIn, config.webClientId, config.iosClientId);
  await google.GoogleOneTapSignIn.signOut();
  console.info("[Google Sign In] Native Google session signed out.");
}

async function signInWithNativeGoogle(webClientId: string, iosClientId: string) {
  logAuthStage("native-provider", "google", "start");
  try {
    const google = await import("react-native-nitro-google-signin");
    configureNativeGoogle(google.GoogleOneTapSignIn, webClientId, iosClientId);
    if (Platform.OS === "android") await google.GoogleOneTapSignIn.checkPlayServices(true);

    console.info("[Google Sign In] Starting native create-or-sign-in flow.");
    const savedCredentialResponse = await google.GoogleOneTapSignIn.signIn().catch((error: unknown) => {
      if ((error as { code?: string }).code === google.statusCodes.SIGN_IN_REQUIRED) return null;
      throw error;
    });
    const accountResponse = !savedCredentialResponse || google.isNoSavedCredentialFoundResponse(savedCredentialResponse)
      ? await google.GoogleOneTapSignIn.createAccount()
      : savedCredentialResponse;
    const response = google.isNoSavedCredentialFoundResponse(accountResponse)
      ? await google.GoogleOneTapSignIn.presentExplicitSignIn()
      : accountResponse;
    if (google.isCancelledResponse(response)) {
      console.info("[Google Sign In] Native account picker cancelled.");
      return { cancelled: true };
    }

    if (!google.isSuccessResponse(response)) {
      console.error("[Google Sign In] Native provider returned an unsuccessful response.", response.type);
      return { error: "Google kimliği alınamadı. Lütfen tekrar deneyin." };
    }

    const responseIdToken = response.data.idToken?.trim();
    if (responseIdToken) {
      console.info("[Google Sign In] Native Google ID token received.");
      logAuthStage("native-provider", "google", "success");
      return { idToken: responseIdToken };
    }

    console.warn("[Google Sign In] Sign-in succeeded without an ID token; refreshing the native token session.");
    const refreshedTokens = await google.GoogleOneTapSignIn.getTokens();
    const refreshedIdToken = refreshedTokens.idToken?.trim();
    if (!refreshedIdToken) {
      console.error("[Google Sign In] Native token refresh returned no ID token.");
      return { error: "Google kimliği alınamadı. Lütfen tekrar deneyin." };
    }

    console.info("[Google Sign In] Refreshed Google ID token received.");
    return { idToken: refreshedIdToken };
  } catch (error) {
    console.error("[Google Sign In] Native sign-in failed.", authErrorCode(error));
    logAuthStage("native-provider", "google", "error", error);
    const googleError = error as { code?: string };

    if (googleError.code === "SIGN_IN_CANCELLED") {
      return { cancelled: true };
    }

    if (googleError.code === "PLAY_SERVICES_NOT_AVAILABLE") {
      return { error: "Google Play Hizmetleri kullanılamıyor. Lütfen güncelleyip tekrar deneyin.", code: googleError.code };
    }

    if (googleError.code === "DEVELOPER_ERROR") {
      return { error: "Google giriş yapılandırması doğrulanamadı. Lütfen uygulamayı güncelleyip tekrar deneyin.", code: googleError.code };
    }

    return { error: "Google ile giriş tamamlanamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.", code: authErrorCode(error) };
  }
}

function configureNativeGoogle(
  nativeGoogle: { configure: (options: { webClientId: string; iosClientId?: string }) => void },
  webClientId: string,
  iosClientId: string
) {
  const configurationKey = `${webClientId}:${iosClientId}`;
  if (nativeGoogleRuntime.configuredClientId === configurationKey) return;

  nativeGoogle.configure({
    webClientId,
    iosClientId: iosClientId || undefined
  });
  nativeGoogleRuntime.configuredClientId = configurationKey;
  console.info("[Google Sign In] Native provider configured.");
}
