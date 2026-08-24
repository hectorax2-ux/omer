import { useContext } from "react";
import { AccountContext } from "@/providers/account-provider";

export function useAccount() {
  return useContext(AccountContext);
}
