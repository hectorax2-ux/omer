import { ReactNode, useEffect, useRef } from "react";
import { Animated, StyleProp, ViewStyle } from "react-native";
import { motion } from "@/constants/design";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useRuntimePerformanceMode } from "@/hooks/use-runtime-performance-mode";

type Props = {
  children: ReactNode;
  delay?: number;
  offset?: number;
  style?: StyleProp<ViewStyle>;
};

// Mount reveal: content fades and rises into place. Staggering `delay` across a
// list makes a screen feel like it is composing itself as the user arrives.
export function Reveal({ children, delay = 0, offset = 16, style }: Props) {
  const progress = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();
  const performanceMode = useRuntimePerformanceMode();
  const lightweight = reducedMotion || performanceMode !== "full";

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: lightweight ? 1 : motion.reveal,
      delay: lightweight ? 0 : delay,
      useNativeDriver: true
    });
    animation.start();
    return () => animation.stop();
  }, [delay, lightweight, progress]);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [offset, 0] }) }]
        }
      ]}
    >
      {children}
    </Animated.View>
  );
}
