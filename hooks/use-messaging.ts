import { useContext } from "react";
import { MessagingContext } from "@/providers/messaging-provider";

export function useMessaging() {
  return useContext(MessagingContext);
}
