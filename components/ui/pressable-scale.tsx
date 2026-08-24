import { ReactNode, useRef } from "react";
import { AccessibilityRole, AccessibilityState, Animated, GestureResponderEvent, Pressable, StyleProp, ViewStyle } from "react-native";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

type Props = {
  children: ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  onLongPress?: (event: GestureResponderEvent) => void;
  onPressIn?: (event: GestureResponderEvent) => void;
  onPressOut?: (event: GestureResponderEvent) => void;
  style?: StyleProp<ViewStyle>;
  wrapStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  dimTo?: number;
  disabled?: boolean;
  hitSlop?: number;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  testID?: string;
};

// Rich tactile press feedback: a spring-driven scale + subtle dim so every tap
// feels physical. Used app-wide in place of bare Pressable for interactive cards.
export function PressableScale({
  children,
  onPress,
  onLongPress,
  onPressIn,
  onPressOut,
  style,
  wrapStyle,
  scaleTo = 0.96,
  dimTo = 0.92,
  disabled = false,
  hitSlop,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole,
  accessibilityState,
  testID
}: Props) {
  const value = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  const spring = (toValue: number) => {
    if (reducedMotion) {
      value.setValue(toValue ? 0.35 : 0);
      return;
    }
    Animated.spring(value, { toValue, useNativeDriver: true, speed: 42, bounciness: 5 }).start();
  };

  const animatedStyle = {
    transform: [{ scale: value.interpolate({ inputRange: [0, 1], outputRange: [1, scaleTo] }) }],
    opacity: value.interpolate({ inputRange: [0, 1], outputRange: [1, dimTo] })
  };

  return (
    <Animated.View style={[wrapStyle, animatedStyle]}>
      <Pressable
        accessibilityHint={accessibilityHint}
        accessibilityLabel={accessibilityLabel}
        accessibilityRole={accessibilityRole ?? (onPress ? "button" : undefined)}
        accessibilityState={{ ...accessibilityState, disabled }}
        disabled={disabled}
        hitSlop={hitSlop}
        onPress={onPress}
        onLongPress={onLongPress}
        style={style}
        onPressIn={(event) => {
          spring(1);
          onPressIn?.(event);
        }}
        onPressOut={(event) => {
          spring(0);
          onPressOut?.(event);
        }}
        testID={testID}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
