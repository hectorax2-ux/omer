import { doc, getDoc, serverTimestamp, updateDoc } from "firebase/firestore";
import { firestoreDb } from "./core";

export type NotificationPreferences = {
  follows: boolean;
  likes: boolean;
  comments: boolean;
  messages: boolean;
  system: boolean;
  contests: boolean;
  important: boolean;
  duels: boolean;
  seer: boolean;
  badges: boolean;
  chance: boolean;
  timeCapsule: boolean;
};

export const defaultNotificationPreferences: NotificationPreferences = {
  follows: true,
  likes: true,
  comments: true,
  messages: true,
  system: true,
  contests: true,
  important: true,
  duels: true,
  seer: true,
  badges: true,
  chance: true,
  timeCapsule: true
};

export async function loadNotificationPreferences(uid: string) {
  const snapshot = await getDoc(doc(firestoreDb, "users", uid));
  const data = snapshot.data();
  const stored = data?.notificationPreferences && typeof data.notificationPreferences === "object"
    ? data.notificationPreferences as Record<string, unknown>
    : {};
  return {
    enabled: data?.notificationsEnabled !== false,
    preferences: Object.fromEntries(
      Object.entries(defaultNotificationPreferences).map(([key, fallback]) => [key, typeof stored[key] === "boolean" ? stored[key] : fallback])
    ) as NotificationPreferences
  };
}

export async function saveNotificationPreferences(uid: string, enabled: boolean, preferences: NotificationPreferences) {
  if (!uid) return;
  await updateDoc(doc(firestoreDb, "users", uid), {
    notificationsEnabled: enabled,
    notificationPreferences: preferences,
    notificationPreferencesUpdatedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}
