import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from "react-native-svg";
import { AppTheme } from "@/constants/theme";

type SceneTone = { wall0: string; wall1: string; floor: string; nicheGlow: string; warm: string };

const scenes: Record<AppTheme, SceneTone> = {
  dark: { wall0: "#1a1611", wall1: "#0c0a07", floor: "#070605", nicheGlow: "#e8c987", warm: "#d2b879" },
  light: { wall0: "#efe6d3", wall1: "#d8c9ad", floor: "#cdb99a", nicheGlow: "#f6e6bd", warm: "#caa14d" },
  vangogh: { wall0: "#123b67", wall1: "#091628", floor: "#08182e", nicheGlow: "#f6dd8f", warm: "#f2c85b" },
  monet: { wall0: "#dcefe8", wall1: "#a8cfc7", floor: "#7aa89c", nicheGlow: "#fff2c6", warm: "#c99db4" },
  dali: { wall0: "#6e471f", wall1: "#17110b", floor: "#0b1324", nicheGlow: "#f1c06d", warm: "#d9b56a" },
  picasso: { wall0: "#d8d2c7", wall1: "#8d9aaa", floor: "#5d6170", nicheGlow: "#f0c88f", warm: "#b06e4d" }
};

function MuseumScene({ tone }: { tone: SceneTone }) {
  return (
    <Svg width="100%" height="100%" viewBox="0 0 320 168" preserveAspectRatio="xMidYMid slice">
      <Defs>
        <LinearGradient id="wall" x1="0" y1="0" x2="0.4" y2="1">
          <Stop offset="0" stopColor={tone.wall0} />
          <Stop offset="1" stopColor={tone.wall1} />
        </LinearGradient>
        <RadialGradient id="spot" cx="72%" cy="38%" r="55%">
          <Stop offset="0" stopColor={tone.nicheGlow} stopOpacity={0.42} />
          <Stop offset="0.55" stopColor={tone.warm} stopOpacity={0.14} />
          <Stop offset="1" stopColor={tone.warm} stopOpacity={0} />
        </RadialGradient>
        <RadialGradient id="spot2" cx="22%" cy="28%" r="40%">
          <Stop offset="0" stopColor={tone.warm} stopOpacity={0.12} />
          <Stop offset="1" stopColor={tone.warm} stopOpacity={0} />
        </RadialGradient>
        <LinearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={tone.floor} stopOpacity={0} />
          <Stop offset="1" stopColor={tone.floor} stopOpacity={0.82} />
        </LinearGradient>
        <RadialGradient id="vig" cx="50%" cy="42%" r="78%">
          <Stop offset="0.55" stopColor="#000000" stopOpacity={0} />
          <Stop offset="1" stopColor="#000000" stopOpacity={0.48} />
        </RadialGradient>
      </Defs>
      <Rect x="0" y="0" width="320" height="168" fill="url(#wall)" />
      <Rect x="0" y="0" width="320" height="168" fill="url(#spot)" />
      <Rect x="0" y="0" width="320" height="168" fill="url(#spot2)" />
      <Rect x="16" y="0" width="1.5" height="168" fill={tone.warm} opacity={0.08} />
      <Rect x="302" y="0" width="1.5" height="168" fill={tone.warm} opacity={0.06} />
      <Rect x="0" y="118" width="320" height="50" fill="url(#floor)" />
      <Rect x="0" y="0" width="320" height="168" fill="url(#vig)" />
    </Svg>
  );
}

export function MuseumWelcomeBackdrop({ theme }: { theme: AppTheme }) {
  const tone = scenes[theme] ?? scenes.dark;
  const parallax = useRef(new Animated.Value(0)).current;
  const beam = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loops = [
      Animated.loop(Animated.sequence([
        Animated.timing(parallax, { toValue: 1, duration: 32000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(parallax, { toValue: 0, duration: 32000, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(beam, { toValue: 1, duration: 22000, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(beam, { toValue: 0, duration: 22000, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
      ]))
    ];
    loops.forEach((loop) => loop.start());
    return () => loops.forEach((loop) => loop.stop());
  }, [beam, parallax]);

  const sceneStyle = {
    transform: [
      { translateX: parallax.interpolate({ inputRange: [0, 1], outputRange: [-4, 4] }) },
      { scale: 1.06 }
    ]
  };

  const beamStyle = {
    transform: [
      { translateX: beam.interpolate({ inputRange: [0, 1], outputRange: [-120, 160] }) },
      { rotate: "16deg" }
    ],
    opacity: beam.interpolate({ inputRange: [0, 1], outputRange: [0.08, 0.18] })
  };

  return (
    <View style={styles.wrap} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, sceneStyle]}>
        <MuseumScene tone={tone} />
      </Animated.View>
      <Animated.View style={[styles.beam, beamStyle]} />
      <Dust delay={0} startX="18%" />
      <Dust delay={5000} startX="42%" />
      <Dust delay={9000} startX="63%" />
      <Dust delay={3000} startX="80%" />
    </View>
  );
}

function Dust({ delay, startX }: { delay: number; startX: `${number}%` }) {
  const rise = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(rise, { toValue: 1, duration: 17000, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(rise, { toValue: 0, duration: 0, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [delay, rise]);
  const style = {
    transform: [
      { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [120, -30] }) },
      { translateX: rise.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 10, 0] }) }
    ],
    opacity: rise.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0.6, 0] })
  };
  return <Animated.View style={[styles.dust, { left: startX }, style]} />;
}

const styles = StyleSheet.create({
  wrap: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  beam: {
    position: "absolute",
    top: -40,
    left: 0,
    width: 64,
    height: 240,
    backgroundColor: "rgba(255,244,214,0.45)",
    borderRadius: 40
  },
  dust: { position: "absolute", bottom: 0, width: 3, height: 3, borderRadius: 2, backgroundColor: "rgba(255,238,196,0.9)" }
});
