import { useContext } from "react";
import { AdContext } from "@/providers/ad-provider";

export function useAds() {
  return useContext(AdContext);
}
