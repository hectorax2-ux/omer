import { useContext } from "react";
import { DiscoveryPostContext } from "@/providers/discovery-post-provider";

export function useDiscoveryPosts() {
  return useContext(DiscoveryPostContext);
}
