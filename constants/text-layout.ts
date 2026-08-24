import { Platform, type TextStyle } from "react-native";

export const safeTextLayout = {
  minWidth: 0,
  flexShrink: 1,
  ...(Platform.OS === "web" ? {
    wordBreak: "normal",
    overflowWrap: "normal",
    hyphens: "none",
    whiteSpace: "normal"
  } : {})
} as TextStyle;
