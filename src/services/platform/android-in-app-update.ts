import { NativeModules, Platform } from "react-native";

type AndroidInAppUpdateModule = {
  startImmediateUpdate: () => Promise<boolean>;
  resumeImmediateUpdate: () => Promise<boolean>;
};

function nativeModule() {
  return NativeModules.ArtAtlasInAppUpdate as AndroidInAppUpdateModule | undefined;
}

export async function startAndroidImmediateUpdate() {
  if (Platform.OS !== "android") return false;
  return nativeModule()?.startImmediateUpdate().catch(() => false) ?? false;
}

export async function resumeAndroidImmediateUpdate() {
  if (Platform.OS !== "android") return false;
  return nativeModule()?.resumeImmediateUpdate().catch(() => false) ?? false;
}
