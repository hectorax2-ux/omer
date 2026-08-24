import Constants from "expo-constants";
import { requireOptionalNativeModule } from "expo-modules-core";
import { Platform } from "react-native";

export function isStorePurchaseSupported() {
  if (Platform.OS !== "ios" && Platform.OS !== "android") return false;
  if (Constants.appOwnership === "expo") return false;
  return Boolean(requireOptionalNativeModule("ExpoIap"));
}
