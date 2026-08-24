import { useContext } from "react";
import { CommunityArtContext } from "@/providers/community-art-provider";

export function useCommunityArt() {
  return useContext(CommunityArtContext);
}
