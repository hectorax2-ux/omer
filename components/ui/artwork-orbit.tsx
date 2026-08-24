import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Defs, Ellipse, LinearGradient as SvgGradient, Stop } from "react-native-svg";
import { PressableScale } from "@/components/ui/pressable-scale";
import { v2Colors } from "@/constants/design";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { HomeArtworkItem } from "@/features/home/types";
import { HomeImage } from "@/features/home/components/home-image";
import { useRuntimePerformanceMode } from "@/hooks/use-runtime-performance-mode";

export function ArtworkOrbit({ items, activeIndex, size, onOpen }: {
  items: HomeArtworkItem[];
  activeIndex: number;
  size: number;
  onOpen: (id: string) => void;
}) {
  const reducedMotion = useReducedMotion();
  const performanceMode = useRuntimePerformanceMode();
  const lightweight = reducedMotion || performanceMode !== "full";
  const rotations = useRef([new Animated.Value(0), new Animated.Value(0), new Animated.Value(0)]).current;
  const active = items[activeIndex] ?? items[0];
  const satellites = useMemo(() => items.filter((item) => item.id !== active?.id).slice(0, 3), [active?.id, items]);

  useEffect(() => {
    rotations.forEach((rotation) => rotation.stopAnimation());
    if (lightweight) {
      rotations.forEach((rotation) => rotation.setValue(0));
      return undefined;
    }
    const animations = rotations.map((rotation, index) => Animated.loop(Animated.timing(rotation, {
      toValue: 1,
      duration: [24000, 33000, 41000][index],
      easing: Easing.linear,
      useNativeDriver: true
    })));
    animations.forEach((animation, index) => {
      if (index === 1) rotations[index].setValue(0.5);
      animation.start();
    });
    return () => animations.forEach((animation) => animation.stop());
  }, [lightweight, rotations]);

  if (!active) return <View style={{ width: size, height: size }} />;

  return (
    <View style={[styles.root, { width: size, height: size }]} pointerEvents="box-none">
      <View style={styles.ambient} pointerEvents="none" />
      {rotations.map((rotation, index) => {
        const orbitScale = [1, 0.88, 1.08][index];
        const rotationRange = index === 1 ? ["360deg", "0deg"] : ["0deg", "360deg"];
        return (
          <Animated.View
            key={`orbit-${index}`}
            pointerEvents="none"
            style={[
              styles.orbit,
              {
                width: size * orbitScale,
                height: size * orbitScale,
                marginLeft: -(size * orbitScale) / 2,
                marginTop: -(size * orbitScale) / 2,
                transform: [
                  { rotate: `${[-13, 21, -31][index]}deg` },
                  { scaleY: [0.72, 0.82, 0.62][index] },
                  { rotate: rotation.interpolate({ inputRange: [0, 1], outputRange: rotationRange }) }
                ]
              }
            ]}
          >
            <Svg width="100%" height="100%" viewBox="0 0 100 100">
              <Defs>
                <SvgGradient id={`art-orbit-${index}`} x1="0" y1="0" x2="1" y2="1">
                  <Stop offset="0" stopColor={index === 2 ? v2Colors.magenta : v2Colors.cyan} stopOpacity="0.95" />
                  <Stop offset="0.48" stopColor={v2Colors.primary} stopOpacity="0.72" />
                  <Stop offset="1" stopColor={index === 0 ? v2Colors.magenta : v2Colors.brightViolet} stopOpacity="0.92" />
                </SvgGradient>
              </Defs>
              <Ellipse
                cx="50"
                cy="50"
                rx="47"
                ry="47"
                fill="none"
                stroke={`url(#art-orbit-${index})`}
                strokeWidth={index === 2 ? 1.1 : 0.72}
                strokeDasharray={index === 0 ? "42 7 12 8" : index === 1 ? "19 8 54 12" : "8 9 28 13"}
                strokeLinecap="round"
                opacity={index === 1 ? 0.6 : 0.82}
              />
            </Svg>
          </Animated.View>
        );
      })}

      {satellites.map((item, index) => {
        const rotation = rotations[index];
        const orbitSize = size * [0.96, 0.8, 1.04][index];
        const satelliteSize = size * [0.235, 0.19, 0.215][index];
        const spin = rotation.interpolate({ inputRange: [0, 1], outputRange: index === 1 ? ["360deg", "0deg"] : ["0deg", "360deg"] });
        const counterSpin = rotation.interpolate({ inputRange: [0, 1], outputRange: index === 1 ? ["0deg", "360deg"] : ["0deg", "-360deg"] });
        return (
          <Animated.View
            key={item.id}
            pointerEvents="box-none"
            style={[
              styles.satelliteOrbit,
              {
                width: orbitSize,
                height: orbitSize,
                marginLeft: -orbitSize / 2,
                marginTop: -orbitSize / 2,
                transform: [{ rotate: `${[25, 156, 248][index]}deg` }, { scaleY: [0.72, 0.82, 0.62][index] }, { rotate: spin }]
              }
            ]}
          >
            <Animated.View style={[styles.satelliteAnchor, { width: satelliteSize, height: satelliteSize, borderRadius: satelliteSize / 2, marginLeft: -satelliteSize / 2, transform: [{ scaleY: 1 / [0.72, 0.82, 0.62][index] }, { rotate: counterSpin }] }]}>
              <PressableScale onPress={() => onOpen(item.id)} wrapStyle={styles.satelliteWrap} style={styles.satelliteButton} accessibilityLabel={item.title}>
                <HomeImage uri={item.image} style={styles.satelliteImage} contentFit="cover" transition={lightweight ? 0 : 180} />
              </PressableScale>
            </Animated.View>
          </Animated.View>
        );
      })}

      <PressableScale
        onPress={() => onOpen(active.id)}
        wrapStyle={[styles.mainWrap, { width: size * 0.69, height: size * 0.69, marginLeft: -(size * 0.345), marginTop: -(size * 0.345) }]}
        style={styles.mainButton}
        scaleTo={0.97}
        accessibilityLabel={`${active.title}, ${active.artist}`}
      >
        <View style={styles.mainRing}>
          <HomeImage uri={active.image} style={styles.mainImage} contentFit="cover" transition={lightweight ? 0 : 260} />
        </View>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { position: "relative", alignItems: "center", justifyContent: "center" },
  ambient: { position: "absolute", width: "72%", height: "72%", borderRadius: 999, backgroundColor: "rgba(61,82,255,0.18)", shadowColor: v2Colors.brightViolet, shadowOpacity: 0.8, shadowRadius: 34, shadowOffset: { width: 0, height: 0 } },
  orbit: { position: "absolute", left: "50%", top: "50%" },
  satelliteOrbit: { position: "absolute", left: "50%", top: "50%" },
  satelliteAnchor: { position: "absolute", left: "50%", top: 0, marginTop: -7, borderWidth: 1.5, borderColor: "rgba(126,184,255,0.9)", backgroundColor: v2Colors.background, padding: 2, shadowColor: v2Colors.cyan, shadowOpacity: 0.74, shadowRadius: 10, shadowOffset: { width: 0, height: 0 }, elevation: 8 },
  satelliteWrap: { flex: 1 },
  satelliteButton: { flex: 1, borderRadius: 999, overflow: "hidden" },
  satelliteImage: { width: "100%", height: "100%", borderRadius: 999 },
  mainWrap: { position: "absolute", left: "50%", top: "50%", zIndex: 5 },
  mainButton: { flex: 1, borderRadius: 999 },
  mainRing: { flex: 1, borderRadius: 999, padding: 3, borderWidth: 2, borderColor: "rgba(137,116,255,0.95)", backgroundColor: v2Colors.backgroundSecondary, shadowColor: v2Colors.brightViolet, shadowOpacity: 0.82, shadowRadius: 22, shadowOffset: { width: 0, height: 0 }, elevation: 12 },
  mainImage: { width: "100%", height: "100%", borderRadius: 999 }
});
