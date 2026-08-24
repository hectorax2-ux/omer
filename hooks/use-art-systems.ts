import { useContext } from "react";
import { ArtSystemsContext } from "@/providers/art-systems-provider";

export function useArtSystems() {
  return useContext(ArtSystemsContext);
}
