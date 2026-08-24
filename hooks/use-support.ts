import { useContext } from "react";
import { SupportContext } from "@/providers/support-provider";

export function useSupport() {
  return useContext(SupportContext);
}
