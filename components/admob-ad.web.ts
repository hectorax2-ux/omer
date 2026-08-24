import { getAdMobUnitId, isAdMobDelivery } from "./admob-ad.shared";

export { getAdMobUnitId, isAdMobDelivery };

export function isAdMobAvailable() {
  return false;
}

export function AdMobBannerView(_props: { unitId: string; compact?: boolean; onUnavailable?: () => void }) {
  return null;
}

export async function showAdMobInterstitial(_unitId: string): Promise<boolean> {
  return false;
}

export async function showAdMobRewarded(_unitId: string): Promise<boolean> {
  return false;
}

export async function initializeAdMob(): Promise<void> {
  return;
}
