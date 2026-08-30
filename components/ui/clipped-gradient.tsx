import { type ComponentProps } from "react";
import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type GradientColors = ComponentProps<typeof LinearGradient>["colors"];

type Props = Omit<ComponentProps<typeof LinearGradient>, "colors"> & {
  colors: GradientColors;
  androidColors?: GradientColors;
  radius: number;
};

// Image scrims use one full-surface composition on every platform. The legacy
// Android palette prop remains source-compatible but no longer changes cards.
export function ClippedGradient({ androidColors: _androidColors, colors, locations, radius, style, ...props }: Props) {
  return (
    <LinearGradient
      {...props}
      colors={colors}
      locations={locations?.length === colors.length ? locations : undefined}
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }, style]}
    />
  );
}
