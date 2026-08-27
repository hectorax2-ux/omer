import { type ComponentProps } from "react";
import { Platform, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type GradientColors = ComponentProps<typeof LinearGradient>["colors"];

type Props = Omit<ComponentProps<typeof LinearGradient>, "colors"> & {
  colors: GradientColors;
  androidColors?: GradientColors;
  radius: number;
};

// Android can expose the rectangular native gradient layer even when an
// ancestor clips rounded corners. Giving the gradient its own radius keeps the
// render surface bounded; callers may also provide a simpler two-stop Android
// palette without changing the iOS composition.
export function ClippedGradient({ androidColors, colors, locations, radius, style, ...props }: Props) {
  const resolvedColors = Platform.OS === "android" && androidColors ? androidColors : colors;
  return (
    <LinearGradient
      {...props}
      colors={resolvedColors}
      locations={locations?.length === resolvedColors.length ? locations : undefined}
      style={[StyleSheet.absoluteFill, { borderRadius: radius, overflow: "hidden" }, style]}
    />
  );
}
