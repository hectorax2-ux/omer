import { useContext } from "react";
import { LanguageContext } from "@/providers/language-provider";

export function useLanguage() {
  return useContext(LanguageContext);
}
