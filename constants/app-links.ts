import { Platform } from "react-native";
import * as Linking from "expo-linking";

export const APP_WEB_ORIGIN = "https://artatlas.app";
export const APP_STORE_URL = "https://apps.apple.com/us/app/art-atlas-art-history/id6792671640";
export const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.artatlas.app";
export const APP_DOWNLOAD_URL = `${APP_WEB_ORIGIN}/download/`;
export const APP_INVITE_URL = APP_DOWNLOAD_URL;

export function artStoryDeepLink(storyId: string) {
  return Linking.createURL(`/story/${storyId}`);
}

export function artStoryWebLink(storyId: string) {
  return `${APP_WEB_ORIGIN}/story/${storyId}`;
}

export function appStoreLinkForPlatform() {
  return Platform.OS === "ios" ? APP_STORE_URL : PLAY_STORE_URL;
}

export function storeLinkForUserAgent(userAgent: string) {
  if (/android/i.test(userAgent)) return PLAY_STORE_URL;
  if (/iPad|iPhone|iPod/i.test(userAgent)) return APP_STORE_URL;
  return "";
}
