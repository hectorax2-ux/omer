import { PropsWithChildren, ReactNode, useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { ArtAtlasLoader } from "@/components/art-atlas-loader";
import { getThemeColors } from "@/constants/theme";
import { motion } from "@/constants/design";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

type DetailScreenStateProps = PropsWithChildren<{
  emptyLabel: string;
  hasContent: boolean;
  loading: boolean;
  loadingLabel: string;
  emptyAction?: ReactNode;
}>;

export function DetailScreenState({ children, emptyAction, emptyLabel, hasContent, loading, loadingLabel }: DetailScreenStateProps) {
  const { height } = useWindowDimensions();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const reducedMotion = useReducedMotion();
  const loaderOpacity = useRef(new Animated.Value(loading ? 1 : 0)).current;
  const contentProgress = useRef(new Animated.Value(loading ? 0 : 1)).current;
  const [loaderVisible, setLoaderVisible] = useState(loading);

  useEffect(() => {
    if (loading) {
      setLoaderVisible(true);
      loaderOpacity.setValue(1);
      contentProgress.setValue(0);
      return;
    }

    if (!hasContent || reducedMotion || !loaderVisible) {
      loaderOpacity.setValue(0);
      contentProgress.setValue(1);
      setLoaderVisible(false);
      return;
    }

    const transition = Animated.parallel([
      Animated.timing(loaderOpacity, {
        toValue: 0,
        duration: motion.base,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      }),
      Animated.timing(contentProgress, {
        toValue: 1,
        duration: motion.base,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true
      })
    ]);
    transition.start(({ finished }) => {
      if (finished) setLoaderVisible(false);
    });
    return () => transition.stop();
  }, [contentProgress, hasContent, loaderOpacity, loaderVisible, loading, reducedMotion]);

  const minimumHeight = Math.min(560, Math.max(320, height * 0.58));
  const translateY = contentProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [reducedMotion ? 0 : 4, 0]
  });

  return (
    <View style={[styles.root, !hasContent && { minHeight: minimumHeight }]}>
      {hasContent ? (
        <Animated.View style={[styles.content, { opacity: contentProgress, transform: [{ translateY }] }]}>
          {children}
        </Animated.View>
      ) : null}
      {loaderVisible ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.loaderLayer, { opacity: loaderOpacity }]}>
          <ArtAtlasLoader visible label={loadingLabel} variant="detail" />
        </Animated.View>
      ) : null}
      {!loading && !hasContent ? (
        <View style={styles.emptyState}>
          <Ionicons name="images-outline" size={30} color={colors.gold} />
          <Text style={[styles.emptyText, { color: colors.muted }]}>{emptyLabel}</Text>
          {emptyAction}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: "relative",
    width: "100%"
  },
  content: {
    width: "100%"
  },
  loaderLayer: {
    zIndex: 2,
    alignItems: "center",
    justifyContent: "center"
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24
  },
  emptyText: {
    maxWidth: 320,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "800",
    textAlign: "center"
  }
});
