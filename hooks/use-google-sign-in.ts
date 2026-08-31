import { useMemo } from "react";
import { Platform } from "react-native";
import Constants from "expo-constants";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as Google from "expo-auth-session/providers/google";
import { authErrorCode } from "@/utils/auth-lifecycle";
import { logAuthStage } from "@/utils/auth-diagnostics";
import { requestGoogleIdToken } from "@/utils/google-sign-in-flow";

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

    const result = await requestGoogleIdToken(google.GoogleOneTapSignIn, Platform.OS);
    if (result.idToken) logAuthStage("native-provider", "google", "success");
    return result;
  } catch (error) {
    console.error("[Google Sign In] Native sign-in failed.", authErrorCode(error));
    logAuthStage("native-provider", "google", "error", error);
    const googleError = error as { code?: string };

    if (googleError.code === "SIGN_IN_CANCELLED") {
      return { cancelled: true, code: "google/sign-in-not-completed" };
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
