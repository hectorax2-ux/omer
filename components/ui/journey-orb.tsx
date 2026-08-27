import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { PressableScale } from "@/components/ui/pressable-scale";
import { HomeImage } from "@/features/home/components/home-image";
import type { JourneyEraId, JourneyStageView } from "@/features/home/types";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useRuntimePerformanceMode } from "@/hooks/use-runtime-performance-mode";

export function JourneyOrb({ stage, eraId, size, onPress, fallbackImageUri }: {
  stage: JourneyStageView;
  eraId?: JourneyEraId;
  size: number;
  onPress: () => void;
  fallbackImageUri?: string;
}) {
  const reducedMotion = useReducedMotion();
  const performanceMode = useRuntimePerformanceMode();
  const pulse = useRef(new Animated.Value(0)).current;
  const current = stage.state === "current";
  const palette = journeyEraPalette(eraId ?? stage.activity.eraId);
  const resolvedImage = stage.activity.image || fallbackImageUri;

  useEffect(() => {
    pulse.stopAnimation();
    if (!current || reducedMotion || performanceMode !== "full") {
      pulse.setValue(0);
      return undefined;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 1700, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 1700, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
    ]));
    animation.start();
    return () => animation.stop();
  }, [current, performanceMode, pulse, reducedMotion]);

  const orbSize = current ? size + 7 : size;
  return (
    <View style={[styles.frame, { width: orbSize + 20, height: orbSize + 20 }]}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.pulse,
          {
            width: orbSize + 17,
            height: orbSize + 17,
            borderRadius: (orbSize + 17) / 2,
            backgroundColor: palette.glow,
            opacity: current ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.16, 0.38] }) : 0.1,
            transform: [{ scale: current ? pulse.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.08] }) : 1 }]
          }
        ]}
      />
      <LinearGradient colors={palette.gradient} style={[styles.ring, { width: orbSize, height: orbSize, borderRadius: orbSize / 2, opacity: stage.state === "locked" ? 0.42 : 1 }]}>
        <PressableScale
          onPress={onPress}
          disabled={stage.state === "locked"}
          wrapStyle={styles.buttonWrap}
          style={styles.button}
          accessibilityState={{ disabled: stage.state === "locked", selected: current }}
        >
          <View style={styles.innerLight} pointerEvents="none" />
          {resolvedImage ? <HomeImage uri={resolvedImage} style={styles.image} contentFit="cover" transition={160} /> : <Ionicons name="sparkles" size={orbSize * 0.34} color="#F8FAFC" />}
          <View style={[styles.state, stage.state === "completed" && { backgroundColor: palette.end }]}>
            <Ionicons name={stateIcon(stage)} size={10} color="#F8FAFC" />
          </View>
        </PressableScale>
      </LinearGradient>
    </View>
  );
}

export function journeyEraPalette(eraId?: JourneyEraId) {
  return {
    prehistoric: { gradient: ["#059669", "#34D399"] as [string, string], glow: "rgba(52,211,153,0.45)", end: "#10B981" },
    ancient: { gradient: ["#D97706", "#F6C453"] as [string, string], glow: "rgba(246,196,83,0.4)", end: "#D9A934" },
    medieval: { gradient: ["#A16207", "#EAB308"] as [string, string], glow: "rgba(234,179,8,0.34)", end: "#CA8A04" },
    renaissance: { gradient: ["#C08457", "#F6C453"] as [string, string], glow: "rgba(246,196,83,0.38)", end: "#D9A441" },
    baroque: { gradient: ["#6D28D9", "#D946EF"] as [string, string], glow: "rgba(217,70,239,0.4)", end: "#A855F7" },
    romantic: { gradient: ["#BE185D", "#FB7185"] as [string, string], glow: "rgba(251,113,133,0.38)", end: "#EC4899" },
    modern: { gradient: ["#2563EB", "#8B5CF6"] as [string, string], glow: "rgba(59,130,246,0.42)", end: "#6366F1" },
    contemporary: { gradient: ["#0891B2", "#D946EF"] as [string, string], glow: "rgba(34,211,238,0.38)", end: "#22D3EE" },
    editorial: { gradient: ["#475569", "#8B5CF6"] as [string, string], glow: "rgba(139,92,246,0.3)", end: "#7C3AED" }
  }[eraId ?? "editorial"];
}

function stateIcon(stage: JourneyStageView): keyof typeof Ionicons.glyphMap {
  if (stage.state === "completed") return "checkmark";
  if (stage.state === "locked") return "lock-closed";
  if (stage.state === "current") return "play";
  return "sparkles";
}

const styles = StyleSheet.create({
  frame: { alignItems: "center", justifyContent: "center", position: "relative" },
  pulse: { position: "absolute", shadowColor: "#8B5CF6", shadowOpacity: 0.7, shadowRadius: 14, shadowOffset: { width: 0, height: 0 } },
  ring: { padding: 2.5, shadowColor: "#7C3AED", shadowOpacity: 0.58, shadowRadius: 11, shadowOffset: { width: 0, height: 0 }, elevation: 7 },
  buttonWrap: { flex: 1, width: "100%" },
  button: { flex: 1, borderRadius: 999, overflow: "visible", backgroundColor: "#0B1020", padding: 2 },
  image: { ...StyleSheet.absoluteFillObject, borderRadius: 999, opacity: 0.88 },
  innerLight: { position: "absolute", zIndex: 2, left: "18%", top: "12%", width: "42%", height: "18%", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.16)" },
  state: { position: "absolute", right: -3, bottom: -3, width: 21, height: 21, borderRadius: 11, borderWidth: 2, borderColor: "#0B1020", backgroundColor: "#4338CA", alignItems: "center", justifyContent: "center", zIndex: 4 }
});
