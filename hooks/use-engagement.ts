import { useContext } from "react";
import { EngagementContext } from "@/providers/engagement-provider";

export function useEngagement() {
  return useContext(EngagementContext);
}
