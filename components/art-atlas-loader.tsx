import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { getThemeColors } from "@/constants/theme";
import { hexAlpha, v2Colors } from "@/constants/design";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const logo = require("../assets/images/art-atlas-logo.png");

type ArtAtlasLoaderProps = {
  visible: boolean;
  label?: string;
  variant?: "splash" | "overlay" | "detail";
};

export function ArtAtlasLoader({ visible, label = "Art Atlas hazırlanıyor", variant = "overlay" }: ArtAtlasLoaderProps) {
  const { width } = useWindowDimensions();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const reducedMotion = useReducedMotion();
  const pulse = useRef(new Animated.Value(0)).current;
  const spin = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      fade.setValue(0);
      return;
    }

    Animated.timing(fade, {
      toValue: 1,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();

    if (reducedMotion) {
      pulse.setValue(0.2);
      spin.setValue(0);
      return;
    }

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true
        })
      ])
    );

    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 2100,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );

    pulseLoop.start();
    spinLoop.start();

    return () => {
      pulseLoop.stop();
      spinLoop.stop();
    };
  }, [fade, pulse, reducedMotion, spin, visible]);

  if (!visible) return null;

  const logoScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, variant === "detail" ? 1.02 : 1.045]
  });
  const haloScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.92, 1.12]
  });
  const haloOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.22, 0.58]
  });
  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"]
  });

  const splash = variant === "splash";
  const detail = variant === "detail";
  const detailLogoSize = Math.min(width >= 720 ? 150 : 124, Math.max(96, width * 0.3));
  const logoSize = splash ? 152 : detail ? detailLogoSize : 124;
  const haloSize = splash ? 214 : detail ? detailLogoSize + 48 : 174;

  return (
    <Animated.View
      pointerEvents={detail ? "none" : "auto"}
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[
        styles.container,
        detail ? styles.detailContainer : styles.overlay,
        !detail && (splash ? styles.splashOverlay : styles.loadingOverlay),
        { opacity: fade }
      ]}
    >
      <View
        style={[
          styles.backdropGlow,
          detail && { width: haloSize + 118, height: haloSize + 118, borderRadius: haloSize + 118 },
          { backgroundColor: hexAlpha(colors.plum, detail ? 0.13 : 0.16) }
        ]}
      />
      <Animated.View
        style={[
          styles.halo,
          { width: haloSize, height: haloSize, borderColor: hexAlpha(colors.plum, 0.8), borderTopColor: hexAlpha(colors.gold, 0.22), borderRightColor: hexAlpha(v2Colors.cyan, 0.26) },
          {
            opacity: haloOpacity,
            transform: [{ scale: reducedMotion ? 1 : haloScale }, { rotate: reducedMotion ? "0deg" : rotate }]
          }
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
            shadowColor: colors.plum,
            transform: [{ scale: reducedMotion ? 1 : logoScale }]
          }
        ]}
      >
        <Image source={logo} style={styles.logo} contentFit="cover" transition={120} />
      </Animated.View>
      {!detail ? <Text style={[styles.brand, { color: colors.ivory }]}>Art Atlas</Text> : null}
      <Text style={[styles.label, detail && styles.detailLabel, { color: colors.muted }]}>{label}</Text>
      <View style={styles.dots}>
        <LoadingDot color={colors.gold} delay={0} reducedMotion={reducedMotion} />
        <LoadingDot color={colors.plum} delay={180} reducedMotion={reducedMotion} />
        <LoadingDot color={v2Colors.cyan} delay={360} reducedMotion={reducedMotion} />
      </View>
    </Animated.View>
  );
}

function LoadingDot({ color, delay, reducedMotion }: { color: string; delay: number; reducedMotion: boolean }) {
  const opacity = useRef(new Animated.Value(0.35)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(0.62);
      translateY.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 320,
            useNativeDriver: true
          }),
          Animated.timing(translateY, {
            toValue: -4,
            duration: 320,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true
          })
        ]),
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0.35,
            duration: 320,
            useNativeDriver: true
          }),
          Animated.timing(translateY, {
            toValue: 0,
            duration: 320,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true
          })
        ]),
        Animated.delay(420)
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, opacity, reducedMotion, translateY]);

  return <Animated.View style={[styles.dot, { backgroundColor: color, opacity, transform: [{ translateY }] }]} />;
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
    backgroundColor: "rgba(7, 10, 18, 0.96)"
  },
  backdropGlow: {
    position: "absolute",
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: "rgba(124, 58, 237, 0.16)"
  },
  halo: {
    position: "absolute",
    borderRadius: 999,
    borderWidth: 1.5,
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
    shadowOpacity: 0.35,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    overflow: "hidden"
  },
  logo: {
    width: "100%",
    height: "100%"
  },
  brand: {
    color: "#F8FAFC",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 24,
    letterSpacing: 0
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8
  },
  detailLabel: {
    marginTop: 22,
    letterSpacing: 0.2
  },
  dots: {
    flexDirection: "row",
    gap: 7,
    marginTop: 18
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4
  }
});
