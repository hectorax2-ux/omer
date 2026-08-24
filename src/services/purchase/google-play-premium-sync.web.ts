import { syncPremiumStatusRemote } from "@/src/services/firebase/premium-purchase-service";

export function restoreGooglePlayPremiumAtLaunch() {
  return syncPremiumStatusRemote();
}
