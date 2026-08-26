import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

const creationLoader = require("../assets/images/navigation-creation-loader.gif");

type NavigationTransitionProps = {
  visible: boolean;
  label?: string;
  bottomInset?: number;
};

export function NavigationTransition({ visible, label, bottomInset = 0 }: NavigationTransitionProps) {
  const { width } = useWindowDimensions();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const [rendered, setRendered] = useState(visible);
  const artworkWidth = Math.min(440, Math.max(176, width * 0.64));

  useEffect(() => {
    opacity.stopAnimation();
    if (visible) {
      setRendered(true);
      opacity.setValue(1);
      return;
    }
    if (reducedMotion) {
      opacity.setValue(0);
      setRendered(false);
      return;
    }
    Animated.timing(opacity, {
      toValue: 0,
      duration: 120,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true
    }).start(({ finished }) => {
      if (finished) setRendered(false);
    });
  }, [opacity, reducedMotion, visible]);

  return (
    <Animated.View
      pointerEvents={visible ? "auto" : "none"}
      accessibilityRole="progressbar"
      accessibilityLabel={label ? `Art Atlas · ${label}` : "Art Atlas"}
      style={[styles.overlay, { bottom: bottomInset, display: rendered ? "flex" : "none", backgroundColor: colors.ink, opacity }]}
    >
      <View style={[styles.artworkField, { width: artworkWidth, height: artworkWidth * 0.75 }]}>
        <Image source={creationLoader} style={styles.artwork} contentFit="contain" autoplay={rendered && !reducedMotion} cachePolicy="memory" priority="high" transition={0} />
      </View>
      <Text style={[styles.brand, { color: colors.ivory }]}>ART ATLAS</Text>
      {label ? <Text style={[styles.label, { color: colors.muted }]}>{label}</Text> : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9000,
    elevation: 9000,
    alignItems: "center",
    justifyContent: "center"
  },
  artworkField: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "#ECEDE5"
  },
  artwork: { width: "100%", height: "100%" },
  brand: { marginTop: 13, fontSize: 9, lineHeight: 12, fontWeight: "800", letterSpacing: 1.8 },
  label: { marginTop: 4, fontSize: 10.5, lineHeight: 14, fontWeight: "600" }
});
