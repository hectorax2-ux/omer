import { syncPremiumStatusRemote } from "@/src/services/firebase/premium-purchase-service";

// TypeScript/web fallback. Native Android resolves google-play-premium-sync.native.ts.
export function restoreGooglePlayPremiumAtLaunch() {
  return syncPremiumStatusRemote();
}
