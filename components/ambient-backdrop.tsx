import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";
import { AppTheme, isBrightTheme } from "@/constants/theme";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useRuntimePerformanceMode } from "@/hooks/use-runtime-performance-mode";

type GlowTone = { warm: string; cool: string; accent: string; vignette: string };

const tones: Record<AppTheme, GlowTone> = {
  dark: { warm: "#7C3AED", cool: "#3B82F6", accent: "#D946EF", vignette: "#02040B" },
  light: { warm: "#D6B36C", cool: "#7186A8", accent: "#B58C9D", vignette: "#171D2B" },
  vangogh: { warm: "#7C3AED", cool: "#1f5f91", accent: "#22D3EE", vignette: "#05101f" },
  monet: { warm: "#B9A3C8", cool: "#77B7AE", accent: "#D49CB3", vignette: "#0C2429" },
  dali: { warm: "#7C3AED", cool: "#14243a", accent: "#D946EF", vignette: "#090712" },
  picasso: { warm: "#D96550", cool: "#4769B0", accent: "#F0BC54", vignette: "#11182A" }
};

// Living museum atmosphere: very slow light currents that drift behind all content.
// Motion cycles run 24-40s so the screen feels alive without ever calling attention to itself.
export function AmbientBackdrop({ theme, active = true }: { theme: AppTheme; active?: boolean }) {
  const tone = tones[theme] ?? tones.dark;
  const reducedMotion = useReducedMotion();
  const performanceMode = useRuntimePerformanceMode();
  const lightweight = performanceMode !== "full";
  const animate = active && !reducedMotion && !lightweight;
  const drift = useRef(new Animated.Value(0)).current;
  const sweep = useRef(new Animated.Value(0)).current;
  const breath = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate) {
      drift.stopAnimation();
      sweep.stopAnimation();
      breath.stopAnimation();
      drift.setValue(0);
      sweep.setValue(0);
      breath.setValue(0);
      return undefined;
    }
    const loops = [
      Animated.loop(Animated.sequence([
        Animated.timing(drift, { toValue: 1, duration: 38000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(drift, { toValue: 0, duration: 38000, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(sweep, { toValue: 1, duration: 29000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(sweep, { toValue: 0, duration: 29000, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 24000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(breath, { toValue: 0, duration: 24000, easing: Easing.inOut(Easing.quad), useNativeDriver: true })
      ]))
    ];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [animate, breath, drift, sweep]);

  const warmStyle = {
    transform: [
      { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-40, 40] }) },
      { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [30, -30] }) },
      { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }
    ],
    opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.28, 0.42] })
  };

  const coolStyle = {
    transform: [
      { translateX: sweep.interpolate({ inputRange: [0, 1], outputRange: [60, -50] }) },
      { translateY: sweep.interpolate({ inputRange: [0, 1], outputRange: [-20, 50] }) },
      { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1.05, 0.97] }) }
    ],
    opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.34, 0.22] })
  };

  const isLight = isBrightTheme(theme);

  return (
    <View style={styles.wrap} pointerEvents="none">
      {lightweight ? (
        <View style={[styles.glow, styles.staticLightweight]}><Glow color={tone.cool} opacity={isLight ? 0.16 : 0.22} /></View>
      ) : (
        <>
          <Animated.View style={[styles.glow, styles.warm, warmStyle]}><Glow color={tone.warm} opacity={isLight ? 0.26 : 0.34} /></Animated.View>
          <Animated.View style={[styles.glow, styles.cool, coolStyle]}><Glow color={tone.cool} opacity={isLight ? 0.22 : 0.3} /></Animated.View>
          <View style={[styles.glow, styles.accent]}><Glow color={tone.accent} opacity={isLight ? 0.14 : 0.2} /></View>
        </>
      )}
      <Vignette color={tone.vignette} opacity={isLight ? 0.12 : 0.42} />
    </View>
  );
}

function Glow({ color, opacity }: { color: string; opacity: number }) {
  const id = useMemo(() => `g${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <Svg width="100%" height="100%" viewBox="0 0 100 100">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="0.55" stopColor={color} stopOpacity={opacity * 0.32} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="100" fill={`url(#${id})`} />
    </Svg>
  );
}

function Vignette({ color, opacity }: { color: string; opacity: number }) {
  const id = useMemo(() => `v${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <Svg style={StyleSheet.absoluteFill} width="100%" height="100%" viewBox="0 0 100 140" preserveAspectRatio="none">
      <Defs>
        <RadialGradient id={id} cx="50%" cy="42%" r="75%">
          <Stop offset="0.5" stopColor={color} stopOpacity={0} />
          <Stop offset="1" stopColor={color} stopOpacity={opacity} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="100" height="140" fill={`url(#${id})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  glow: { position: "absolute", width: "120%", height: "66%" },
  warm: { top: "-12%", right: "-34%" },
  cool: { top: "28%", left: "-42%" },
  accent: { bottom: "-28%", right: "-38%", opacity: 0.72 },
  staticLightweight: { top: "2%", right: "-24%", opacity: 0.7 }
});
