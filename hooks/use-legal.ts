import { useContext } from "react";
import { LegalContext } from "@/providers/legal-provider";

export function useLegal() {
  return useContext(LegalContext);
}
