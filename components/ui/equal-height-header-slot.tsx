import { ReactNode } from "react";
import { StyleProp, View, ViewStyle, useWindowDimensions } from "react-native";

type Props = {
  children: ReactNode;
  lineHeight: number;
  lines?: number;
  maxFontSizeMultiplier?: number;
  style?: StyleProp<ViewStyle>;
};

/** Reserves a shared number of text lines without truncating the rendered heading. */
export function EqualHeightHeaderSlot({ children, lineHeight, lines = 2, maxFontSizeMultiplier = 1.25, style }: Props) {
  const { fontScale } = useWindowDimensions();
  const scaledLineHeight = lineHeight * Math.min(fontScale, maxFontSizeMultiplier);

  return <View style={[{ minHeight: Math.ceil(scaledLineHeight * lines) }, style]}>{children}</View>;
}
