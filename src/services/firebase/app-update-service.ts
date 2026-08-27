import AsyncStorage from "@react-native-async-storage/async-storage";
import { doc, getDocFromServer, onSnapshot } from "firebase/firestore";
import { firestoreDb } from "@/src/services/firebase/core";
import {
  parseAppUpdateConfig,
  type AppUpdateConfig,
  type AppUpdatePlatform
} from "@/firebase/shared/app-update";

const CACHE_PREFIX = "art-atlas:app-update-config";
const REMOTE_TIMEOUT_MS = 5000;

export async function loadCachedAppUpdateConfig(platform: AppUpdatePlatform) {
  const cached = await AsyncStorage.getItem(`${CACHE_PREFIX}:${platform}`).catch(() => null);
  if (!cached) return null;
  try {
    return parseAppUpdateConfig(JSON.parse(cached) as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function loadRemoteAppUpdateConfig(platform: AppUpdatePlatform) {
  const snapshot = await Promise.race([
    getDocFromServer(doc(firestoreDb, "appUpdates", platform)),
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("APP_UPDATE_CONFIG_TIMEOUT")), REMOTE_TIMEOUT_MS))
  ]);
  const config = snapshot.exists() ? parseAppUpdateConfig(snapshot.data()) : null;
  await persist(platform, config);
  return config;
}

export function subscribeAppUpdateConfig(
  platform: AppUpdatePlatform,
  onChange: (config: AppUpdateConfig | null, remoteVerified: boolean) => void,
  onError: () => void
) {
  return onSnapshot(
    doc(firestoreDb, "appUpdates", platform),
    { includeMetadataChanges: true },
    (snapshot) => {
      const config = snapshot.exists() ? parseAppUpdateConfig(snapshot.data()) : null;
      const remoteVerified = !snapshot.metadata.fromCache;
      if (remoteVerified) void persist(platform, config);
      onChange(config, remoteVerified);
    },
    onError
  );
}

async function persist(platform: AppUpdatePlatform, config: AppUpdateConfig | null) {
  if (config) {
    await AsyncStorage.setItem(`${CACHE_PREFIX}:${platform}`, JSON.stringify(config)).catch(() => undefined);
    return;
  }
  await AsyncStorage.removeItem(`${CACHE_PREFIX}:${platform}`).catch(() => undefined);
}
