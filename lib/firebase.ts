import { firebaseApp, isFirebaseConnectionReady } from "@/src/services/firebase/core";

export { getFirebaseServices } from "@/src/services/firebase/core";

export const firebaseReady = isFirebaseConnectionReady();

export function getFirebaseApp() {
  return firebaseApp;
}
