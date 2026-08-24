import { useContext } from "react";
import { ThemeContext } from "@/providers/theme-provider";

export function useAppTheme() {
  return useContext(ThemeContext);
}
