import { limit, where } from "firebase/firestore";
import { LanguageCode, RewardInfoDocument } from "@/src/types/firestore";
import { listDocuments } from "./firestore-helpers";

export async function listPublishedRewardInfos(language?: LanguageCode, maxResults = 80): Promise<RewardInfoDocument[]> {
  const rewards = await listDocuments<RewardInfoDocument>("rewardInfos", [
    where("status", "==", "published"),
    limit(maxResults)
  ]);

  return rewards
    .filter((reward) => reward.language === "all" || !language || reward.language === language)
    .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || (a.order ?? 0) - (b.order ?? 0));
}
