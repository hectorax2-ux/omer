import { type ReactNode } from "react";
import { type StyleProp, StyleSheet, View, type ViewStyle } from "react-native";
import { type AppTheme, getThemeColors, isBrightTheme } from "@/constants/theme";
import { elevation, hexAlpha, radii, v2Colors } from "@/constants/design";

type Tint = "neutral" | "gold" | "clear";

type Props = {
  theme: AppTheme;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  radius?: number;
  level?: "low" | "mid" | "high" | "float";
  tint?: Tint;
};

// Cards share one solid surface across Android, iOS and web. Shadow remains on
// the outer view while the inner view owns clipping, fill and border, avoiding
// native gradient layers that can escape rounded corners.
export function GlassSurface({ theme, children, style, contentStyle, radius = radii.md, level = "mid", tint = "neutral" }: Props) {
  const colors = getThemeColors(theme);
  const light = isBrightTheme(theme);

  return (
    <View style={[{ borderRadius: radius }, elevation(theme, level), style]}>
      <View style={[styles.clip, { borderRadius: radius }, surfaceStyle(tint, colors, light)]}>
        <View style={contentStyle}>{children}</View>
      </View>
    </View>
  );
}

function surfaceStyle(tint: Tint, colors: ReturnType<typeof getThemeColors>, light: boolean): ViewStyle {
  if (tint === "gold") {
    return {
      backgroundColor: light ? "#f1e2bb" : "rgba(72,55,24,0.96)",
      borderWidth: 1,
      borderColor: hexAlpha(colors.gold, light ? 0.58 : 0.48)
    };
  }
  return {
    backgroundColor: tint === "clear"
      ? light ? "#fffaf1" : colors.panelSoft
      : light ? "#fffaf2" : colors.panel,
    borderWidth: 1,
    borderColor: light ? "rgba(99,102,241,0.16)" : v2Colors.border
  };
}

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
    position: "relative"
  }
});
