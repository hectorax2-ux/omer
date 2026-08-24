import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "@/src/services/firebase/core";

type PurgeUserAccountResult = {
  ok: boolean;
  counts?: Record<string, number>;
};

export async function purgeUserAccountRemote(): Promise<PurgeUserAccountResult> {
  const functions = getFunctions(firebaseApp);
  const callable = httpsCallable<void, PurgeUserAccountResult>(functions, "purgeUserAccount");
  const response = await callable();
  return response.data;
}
