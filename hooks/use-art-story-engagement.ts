import { useContext } from "react";
import { ArtStoryEngagementContext } from "@/providers/art-story-engagement-provider";

export function useArtStoryEngagement(_uid?: string) {
  return useContext(ArtStoryEngagementContext);
}
