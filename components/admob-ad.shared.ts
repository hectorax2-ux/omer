import type { AdDocument } from "@/src/types/firestore";

export function getAdMobUnitId(ad?: AdDocument) {
  return ad?.admobUnitId?.trim() ?? "";
}

export function isAdMobDelivery(ad?: AdDocument) {
  if (!ad) return false;
  return ad.deliveryType === "admob" || ad.type === "admob" || Boolean(ad.admobUnitId);
}
