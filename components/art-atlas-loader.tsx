import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, useWindowDimensions } from "react-native";
import { Image } from "expo-image";
import { getThemeColors } from "@/constants/theme";
import { hexAlpha, v2Colors } from "@/constants/design";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const logo = require("../assets/images/art-atlas-loader.jpg");

type ArtAtlasLoaderProps = {
  visible: boolean;
  label?: string;
  variant?: "splash" | "overlay" | "detail";
  bottomInset?: number;
};

export function ArtAtlasLoader({ visible, label, variant = "overlay", bottomInset = 0 }: ArtAtlasLoaderProps) {
  const { width } = useWindowDimensions();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const reducedMotion = useReducedMotion();
  const spin = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      spin.stopAnimation();
      spin.setValue(0);
      return;
    }
    if (reducedMotion) {
      spin.setValue(0);
      return;
    }
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1900,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );
    spinLoop.start();
    return () => spinLoop.stop();
  }, [reducedMotion, spin, visible]);

  if (!visible) return null;

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"]
  });

  const splash = variant === "splash";
  const detail = variant === "detail";
  const detailLogoSize = Math.min(width >= 720 ? 112 : 94, Math.max(78, width * 0.24));
  const logoSize = splash ? 118 : detail ? detailLogoSize : 96;
  const haloSize = splash ? 158 : detail ? detailLogoSize + 34 : 132;

  return (
    <Animated.View
      pointerEvents={detail ? "none" : "auto"}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[
        styles.container,
        detail ? styles.detailContainer : styles.overlay,
        !detail && (splash ? styles.splashOverlay : styles.loadingOverlay),
        !detail && { bottom: bottomInset }
      ]}
    >
      <Animated.View
        style={[
          styles.halo,
          { width: haloSize, height: haloSize, borderColor: hexAlpha(colors.plum, 0.42), borderTopColor: colors.gold, borderRightColor: hexAlpha(v2Colors.cyan, 0.52) },
          { transform: [{ rotate: reducedMotion ? "0deg" : rotate }] }
        ]}
      />
      <Animated.View
        style={[
          styles.logoShell,
          {
            width: logoSize,
            height: logoSize,
            borderColor: hexAlpha(colors.gold, 0.72),
            backgroundColor: colors.navy,
            shadowColor: colors.plum
          }
        ]}
      >
        <Image source={logo} style={styles.logo} contentFit="cover" transition={0} cachePolicy="memory" />
      </Animated.View>
      {!detail ? <Text style={[styles.brand, { color: colors.ivory }]}>ART ATLAS</Text> : null}
      {label ? <Text style={[styles.label, detail && styles.detailLabel, { color: colors.muted }]}>{label}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden"
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999
  },
  detailContainer: {
    flex: 1,
    width: "100%",
    minHeight: 260
  },
  splashOverlay: {
    backgroundColor: "#070A12"
  },
  loadingOverlay: {
    backgroundColor: "#070A12"
  },
  halo: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.78)",
    borderTopColor: "rgba(34, 211, 238, 0.18)",
    borderRightColor: "rgba(217, 70, 239, 0.24)"
  },
  logoShell: {
    borderRadius: 34,
    borderWidth: 1,
    borderColor: "rgba(139, 92, 246, 0.72)",
    backgroundColor: "#0B1020",
    shadowColor: "#7C3AED",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    overflow: "hidden"
  },
  logo: {
    width: "100%",
    height: "100%"
  },
  brand: {
    color: "#F8FAFC",
    fontSize: 11,
    lineHeight: 14,
    fontWeight: "800",
    marginTop: 16,
    letterSpacing: 1.8
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 5
  },
  detailLabel: {
    marginTop: 22,
    letterSpacing: 0.2
  },
});
