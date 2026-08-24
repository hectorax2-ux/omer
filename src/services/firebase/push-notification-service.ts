import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Crypto from "expo-crypto";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { arrayUnion, doc, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { firestoreDb } from "./core";

export const ART_ATLAS_NOTIFICATION_CHANNEL = "art-atlas-general";

const DEVICE_ID_KEY = "art-atlas.push-device-id.v1";
const EXPO_PUSH_TOKEN_PATTERN = /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/;

type PushLanguage = "tr" | "en" | "ru" | "uz";

export async function registerForPushNotifications(uid: string, language: PushLanguage) {
  if (Platform.OS === "web" || !uid) return null;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(ART_ATLAS_NOTIFICATION_CHANNEL, {
      name: "Art Atlas",
      description: "Art Atlas bildirimleri",
      importance: Notifications.AndroidImportance.HIGH,
      sound: "default",
      vibrationPattern: [0, 250, 250, 250],
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: true,
      showBadge: true
    });
  }

  const deviceId = await getPushDeviceId();
  const currentPermissions = await Notifications.getPermissionsAsync();
  const permissions = currentPermissions.status === Notifications.PermissionStatus.UNDETERMINED
    ? await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: true, allowSound: true } })
    : currentPermissions;

  if (permissions.status !== Notifications.PermissionStatus.GRANTED) {
    await savePushDevice({ uid, deviceId, language, token: "", permissionStatus: permissions.status, enabled: false });
    return null;
  }

  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId) throw new Error("EAS projectId is required for Expo push registration.");

  const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  if (!EXPO_PUSH_TOKEN_PATTERN.test(token)) throw new Error("Expo returned an invalid push token.");
  await savePushDevice({ uid, deviceId, language, token, permissionStatus: permissions.status, enabled: true });

  // Legacy fields stay populated while older builds/functions are active.
  // The canonical multi-device source is pushDevices.
  await updateDoc(doc(firestoreDb, "users", uid), {
    expoPushTokens: arrayUnion(token),
    expoPushToken: token,
    pushPermissionStatus: permissions.status,
    pushRegistrationStatus: "registered",
    pushPlatform: Platform.OS,
    pushTokenUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }).catch((error) => console.warn("[push] legacy user token sync failed", error));
  return token;
}

export async function disablePushDevice(uid: string) {
  if (Platform.OS === "web" || !uid) return;
  const deviceId = await getPushDeviceId();
  await updateDoc(doc(firestoreDb, "pushDevices", pushDeviceDocumentId(uid, deviceId)), {
    enabled: false,
    disabledAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }).catch(() => undefined);
}

async function savePushDevice(input: {
  uid: string;
  deviceId: string;
  language: PushLanguage;
  token: string;
  permissionStatus: string;
  enabled: boolean;
}) {
  await setDoc(doc(firestoreDb, "pushDevices", pushDeviceDocumentId(input.uid, input.deviceId)), {
    uid: input.uid,
    deviceId: input.deviceId,
    platform: Platform.OS,
    provider: "expo",
    token: input.token,
    language: input.language,
    permissionStatus: input.permissionStatus,
    enabled: input.enabled,
    appVersion: Constants.expoConfig?.version ?? "",
    buildNumber: Constants.nativeBuildVersion ?? "",
    projectId: Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId ?? "",
    lastRegisteredAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

async function getPushDeviceId() {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const deviceId = Crypto.randomUUID();
  await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

function pushDeviceDocumentId(uid: string, deviceId: string) {
  return `${uid}_${deviceId}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 240);
}
