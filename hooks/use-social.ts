import { useContext } from "react";
import { SocialContext } from "@/providers/social-provider";

export function useSocial() {
  return useContext(SocialContext);
}
