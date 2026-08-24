import { AppTheme, isBrightTheme } from "@/constants/theme";

// Shared visual language tokens. Everything presentational (radius, depth, motion)
// lives here so every screen speaks the same design dialect. No data/logic here.

export const radii = {
  xs: 12,
  sm: 16,
  md: 18,
  lg: 22,
  xl: 28,
  hero: 32,
  pill: 999
};

export const v2Colors = {
  background: "#070A12",
  backgroundSecondary: "#0B1020",
  elevated: "#11182A",
  surface: "#151D31",
  surface1: "rgba(255,255,255,0.04)",
  surface2: "rgba(255,255,255,0.07)",
  glass: "rgba(8,12,24,0.82)",
  border: "rgba(255,255,255,0.08)",
  primary: "#6366F1",
  violet: "#7C3AED",
  brightViolet: "#8B5CF6",
  magenta: "#D946EF",
  pink: "#EC4899",
  blue: "#3B82F6",
  cyan: "#22D3EE",
  premium: "#F6C453",
  success: "#34D399",
  warning: "#FBBF24",
  danger: "#FB7185",
  text: "#F8FAFC",
  textSecondary: "#CBD5E1",
  textMuted: "#94A3B8",
  textFaint: "#64748B"
} as const;

export const motion = {
  fast: 130,
  base: 240,
  slow: 420,
  reveal: 520
};

export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
  xxl: 32
};

export const homeLayout = {
  compactMaxWidth: 359,
  smallMaxWidth: 389,
  regularMaxWidth: 429,
  tabletMinWidth: 720,
  tabletContentMaxWidth: 920,
  minimumTouchTarget: 44,
  railGap: 12,
  smallScreenPadding: 16,
  screenPadding: 18,
  largeScreenPadding: 22,
  sectionGap: 32
};

export const navigationLayout = {
  floatingBarHeight: 62,
  minimumBottomInset: 10,
  floatingActionSize: 44,
  floatingActionGap: 10,
  floatingActionDockGap: 10,
  floatingContentGap: 20
} as const;

export const typeScale = {
  hero: { compact: 27, regular: 32 },
  section: { compact: 19, regular: 22 },
  card: { compact: 15, regular: 17 },
  body: { compact: 13, regular: 15 },
  caption: { compact: 11, regular: 12 }
};

type ElevationLevel = "low" | "mid" | "high" | "float";

export function elevation(theme: AppTheme, level: ElevationLevel = "mid") {
  const light = isBrightTheme(theme);
  const presets: Record<ElevationLevel, { height: number; opacity: number; radius: number; elevation: number }> = {
    low: { height: 4, opacity: light ? 0.08 : 0.26, radius: 10, elevation: 3 },
    mid: { height: 10, opacity: light ? 0.12 : 0.38, radius: 20, elevation: 7 },
    high: { height: 18, opacity: light ? 0.16 : 0.5, radius: 30, elevation: 12 },
    float: { height: 24, opacity: light ? 0.2 : 0.6, radius: 42, elevation: 18 }
  };
  const preset = presets[level];
  return {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: preset.height },
    shadowOpacity: preset.opacity,
    shadowRadius: preset.radius,
    elevation: preset.elevation
  };
}

// Thin top highlight that fakes a light catching a glass edge; replaces hard borders.
export function hairline(theme: AppTheme) {
  return isBrightTheme(theme) ? "rgba(74,56,34,0.10)" : "rgba(255,255,255,0.09)";
}

export function hexAlpha(hex: string, alpha: number) {
  if (!hex.startsWith("#")) return hex;
  const value = hex.slice(1);
  const full = value.length === 3 ? value.split("").map((ch) => ch + ch).join("") : value;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
