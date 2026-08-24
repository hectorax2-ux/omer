import { ReactNode } from "react";
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppTheme, getThemeColors, isBrightTheme } from "@/constants/theme";
import { elevation, hairline, hexAlpha, radii, v2Colors } from "@/constants/design";

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

// The single card surface used across the whole app. Depth comes from a soft
// gradient + a hairline light edge + shadow, never from a hard 1px border, so
// screens read as floating panes instead of a boxy wireframe.
export function GlassSurface({ theme, children, style, contentStyle, radius = radii.md, level = "mid", tint = "neutral" }: Props) {
  const c = getThemeColors(theme);
  const light = isBrightTheme(theme);
  const android = Platform.OS === "android";
  const fill = surfaceFill(tint, theme, c, light);
  const androidSurface = androidSurfaceStyle(tint, c, light);

  return (
    <View style={[{ borderRadius: radius }, elevation(theme, level), style]}>
      <View style={[styles.clip, { borderRadius: radius }, android && androidSurface]}>
        {android ? null : <LinearGradient colors={fill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} pointerEvents="none" />}
        <View style={[styles.hairline, { backgroundColor: hairline(theme) }]} pointerEvents="none" />
        {tint === "gold" && !android ? (
          <View style={[styles.goldEdge, { borderColor: hexAlpha(c.gold, light ? 0.4 : 0.4), borderRadius: radius }]} pointerEvents="none" />
        ) : null}
        <View style={contentStyle}>{children}</View>
      </View>
    </View>
  );
}

function androidSurfaceStyle(tint: Tint, colors: ReturnType<typeof getThemeColors>, light: boolean): ViewStyle {
  return {
    backgroundColor: tint === "gold"
      ? light ? "#f1e2bb" : "rgba(246,196,83,0.10)"
      : tint === "clear"
        ? light ? "#fffaf1" : colors.panelSoft
        : light ? "#fffaf2" : colors.panel,
    borderWidth: 1,
    borderColor: tint === "gold"
      ? hexAlpha(colors.gold, light ? 0.58 : 0.48)
      : light ? "rgba(99,102,241,0.16)" : v2Colors.border
  };
}

function surfaceFill(tint: Tint, theme: AppTheme, c: ReturnType<typeof getThemeColors>, light: boolean): [string, string] {
  if (tint === "gold") {
    return [hexAlpha(c.gold, light ? 0.2 : 0.18), hexAlpha(c.gold, light ? 0.05 : 0.045)];
  }
  if (tint === "clear") {
    return light ? ["rgba(255,255,255,0.6)", "rgba(255,250,241,0.4)"] : ["rgba(255,255,255,0.06)", "rgba(255,255,255,0.02)"];
  }
  if (light) {
    return ["rgba(255,255,255,0.94)", hexAlpha(c.panelSoft, 0.72)];
  }
  return [hexAlpha(c.panelSoft, 0.96), hexAlpha(c.panel, 0.9)];
}

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
    position: "relative"
  },
  hairline: {
    position: "absolute",
    top: 0,
    left: 14,
    right: 14,
    height: 1
  },
  goldEdge: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 1
  }
});
