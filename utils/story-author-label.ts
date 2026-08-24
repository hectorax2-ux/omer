import type { ArtStory } from "@/types/content";

export function storyAuthorLabel(story: Pick<ArtStory, "authorDisplayName" | "authorUsername" | "source">) {
  const custom = story.authorDisplayName?.trim() || story.authorUsername?.trim();
  if (custom) return custom;
  return "";
}
