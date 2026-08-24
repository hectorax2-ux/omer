import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Image as NativeImage, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { commonCopy } from "@/app/i18n/common";
import { colors } from "@/constants/theme";
import { radii, v2Colors } from "@/constants/design";
import { useLanguage } from "@/hooks/use-language";
import { t } from "@/utils/localized-text";

const MIN_SCALE = 1;
const MAX_SCALE = 5;
const DOUBLE_TAP_SCALE = 2.5;

type Props = {
  image: string | null;
  footer?: ReactNode;
  onClose: () => void;
};

export function ImagePreviewModal({ image, footer, onClose }: Props) {
  const { language } = useLanguage();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const panelWidth = Math.min(width - 24, 720);
  const frameWidth = panelWidth - 20;
  const frameHeight = Math.min(height - insets.top - insets.bottom - (footer ? 150 : 96), Math.max(300, width * 1.04));
  const [sourceSize, setSourceSize] = useState({ width: frameWidth, height: frameHeight });
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const scale = useSharedValue(MIN_SCALE);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const gestureScale = useSharedValue(MIN_SCALE);
  const gestureTranslateX = useSharedValue(0);
  const gestureTranslateY = useSharedValue(0);
  const gestureFocalX = useSharedValue(0);
  const gestureFocalY = useSharedValue(0);

  const fittedSize = useMemo(() => {
    const sourceRatio = sourceSize.width / Math.max(1, sourceSize.height);
    const frameRatio = frameWidth / Math.max(1, frameHeight);
    if (sourceRatio >= frameRatio) return { width: frameWidth, height: frameWidth / sourceRatio };
    return { width: frameHeight * sourceRatio, height: frameHeight };
  }, [frameHeight, frameWidth, sourceSize.height, sourceSize.width]);
  const fittedWidth = useSharedValue(fittedSize.width);
  const fittedHeight = useSharedValue(fittedSize.height);
  const containerWidth = useSharedValue(frameWidth);
  const containerHeight = useSharedValue(frameHeight);

  const resetGesture = useCallback((animated = false) => {
    scale.value = animated ? withTiming(MIN_SCALE, { duration: 180 }) : MIN_SCALE;
    translateX.value = animated ? withTiming(0, { duration: 180 }) : 0;
    translateY.value = animated ? withTiming(0, { duration: 180 }) : 0;
  }, [scale, translateX, translateY]);

  useEffect(() => {
    fittedWidth.value = fittedSize.width;
    fittedHeight.value = fittedSize.height;
    containerWidth.value = frameWidth;
    containerHeight.value = frameHeight;
    resetGesture(false);
  }, [containerHeight, containerWidth, fittedHeight, fittedSize.height, fittedSize.width, fittedWidth, frameHeight, frameWidth, resetGesture]);

  useEffect(() => {
    resetGesture(false);
    setFailed(false);
    setLoading(Boolean(image));
    if (!image) return;
    NativeImage.getSize(
      image,
      (sourceWidth, sourceHeight) => setSourceSize({ width: Math.max(1, sourceWidth), height: Math.max(1, sourceHeight) }),
      () => undefined
    );
  }, [image, resetGesture]);

  const clampX = (value: number, nextScale: number) => {
    "worklet";
    const bound = Math.max(0, (fittedWidth.value * nextScale - containerWidth.value) / 2);
    return Math.min(bound, Math.max(-bound, value));
  };
  const clampY = (value: number, nextScale: number) => {
    "worklet";
    const bound = Math.max(0, (fittedHeight.value * nextScale - containerHeight.value) / 2);
    return Math.min(bound, Math.max(-bound, value));
  };

  const pinch = Gesture.Pinch()
    .enabled(Boolean(image) && !failed)
    .onStart((event) => {
      gestureScale.value = scale.value;
      gestureTranslateX.value = translateX.value;
      gestureTranslateY.value = translateY.value;
      gestureFocalX.value = event.focalX;
      gestureFocalY.value = event.focalY;
    })
    .onUpdate((event) => {
      const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, gestureScale.value * event.scale));
      const ratio = nextScale / gestureScale.value;
      const centerX = containerWidth.value / 2;
      const centerY = containerHeight.value / 2;
      const nextX = event.focalX - centerX - (gestureFocalX.value - centerX - gestureTranslateX.value) * ratio;
      const nextY = event.focalY - centerY - (gestureFocalY.value - centerY - gestureTranslateY.value) * ratio;
      scale.value = nextScale;
      translateX.value = clampX(nextX, nextScale);
      translateY.value = clampY(nextY, nextScale);
    })
    .onEnd(() => {
      if (scale.value <= 1.02) {
        scale.value = withTiming(MIN_SCALE, { duration: 160 });
        translateX.value = withTiming(0, { duration: 160 });
        translateY.value = withTiming(0, { duration: 160 });
        return;
      }
      translateX.value = withTiming(clampX(translateX.value, scale.value), { duration: 120 });
      translateY.value = withTiming(clampY(translateY.value, scale.value), { duration: 120 });
    });

  const pan = Gesture.Pan()
    .enabled(Boolean(image) && !failed)
    .maxPointers(1)
    .onStart(() => {
      gestureTranslateX.value = translateX.value;
      gestureTranslateY.value = translateY.value;
    })
    .onUpdate((event) => {
      if (scale.value <= MIN_SCALE) return;
      translateX.value = clampX(gestureTranslateX.value + event.translationX, scale.value);
      translateY.value = clampY(gestureTranslateY.value + event.translationY, scale.value);
    });

  const doubleTap = Gesture.Tap()
    .enabled(Boolean(image) && !failed)
    .numberOfTaps(2)
    .maxDuration(260)
    .onEnd((event, success) => {
      if (!success) return;
      if (scale.value > MIN_SCALE + 0.05) {
        scale.value = withTiming(MIN_SCALE, { duration: 180 });
        translateX.value = withTiming(0, { duration: 180 });
        translateY.value = withTiming(0, { duration: 180 });
        return;
      }
      const centerX = containerWidth.value / 2;
      const centerY = containerHeight.value / 2;
      const nextX = clampX((event.x - centerX) * (1 - DOUBLE_TAP_SCALE), DOUBLE_TAP_SCALE);
      const nextY = clampY((event.y - centerY) * (1 - DOUBLE_TAP_SCALE), DOUBLE_TAP_SCALE);
      scale.value = withTiming(DOUBLE_TAP_SCALE, { duration: 180 });
      translateX.value = withTiming(nextX, { duration: 180 });
      translateY.value = withTiming(nextY, { duration: 180 });
    });

  const gesture = Gesture.Exclusive(doubleTap, Gesture.Simultaneous(pinch, pan));
  const animatedImageStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value }
    ]
  }));

  const close = useCallback(() => {
    resetGesture(false);
    onClose();
  }, [onClose, resetGesture]);

  function zoomBy(amount: number) {
    const nextScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale.value + amount));
    scale.value = withTiming(nextScale, { duration: 150 });
    translateX.value = withTiming(clampX(translateX.value, nextScale), { duration: 150 });
    translateY.value = withTiming(clampY(translateY.value, nextScale), { duration: 150 });
  }

  return (
    <Modal visible={image !== null} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel="Kapat" />
        <Pressable onPress={close} style={[styles.closeButton, { top: insets.top + 10 }]} accessibilityRole="button" accessibilityLabel="Kapat">
          <Ionicons name="close" size={25} color={colors.ivory} />
        </Pressable>
        <View pointerEvents="box-none" style={[styles.panel, { width: panelWidth }]}>
          <GestureDetector gesture={gesture}>
            <View style={[styles.imageFrame, { width: frameWidth, height: frameHeight }]}>
              <Animated.View style={[styles.imageSurface, animatedImageStyle]}>
                {image ? (
                  <Image
                    source={{ uri: image }}
                    style={{ width: fittedSize.width, height: fittedSize.height }}
                    contentFit="contain"
                    cachePolicy="memory-disk"
                    transition={120}
                    onLoadStart={() => {
                      setLoading(true);
                      setFailed(false);
                    }}
                    onLoad={() => setLoading(false)}
                    onError={() => {
                      setLoading(false);
                      setFailed(true);
                      resetGesture(false);
                    }}
                  />
                ) : null}
              </Animated.View>
              {loading ? <ActivityIndicator style={styles.loading} size="large" color={colors.gold} /> : null}
              {failed ? (
                <View style={styles.failure}>
                  <Ionicons name="image-outline" size={34} color={colors.muted} />
                  <Text style={styles.failureText}>{language === "tr" ? "Görsel yüklenemedi." : language === "ru" ? "Не удалось загрузить изображение." : language === "uz" ? "Rasmni yuklab bo'lmadi." : "Image could not be loaded."}</Text>
                </View>
              ) : null}
            </View>
          </GestureDetector>
          <View style={styles.zoomControls}>
            <Pressable onPress={() => zoomBy(-0.5)} style={styles.zoomButton} accessibilityRole="button" accessibilityLabel={t(commonCopy.zoomOut, language)}>
              <Ionicons name="remove" size={18} color={colors.ivory} />
            </Pressable>
            <Pressable onPress={() => resetGesture(true)} style={styles.resetButton} accessibilityRole="button" accessibilityLabel="Reset">
              <Ionicons name="contract-outline" size={17} color={colors.ivory} />
            </Pressable>
            <Pressable onPress={() => zoomBy(0.5)} style={styles.zoomButton} accessibilityRole="button" accessibilityLabel={t(commonCopy.zoomIn, language)}>
              <Ionicons name="add" size={18} color={colors.ivory} />
            </Pressable>
          </View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "rgba(3, 5, 12, 0.96)", alignItems: "center", justifyContent: "center", paddingHorizontal: 12, paddingVertical: 18 },
  closeButton: { position: "absolute", right: 16, zIndex: 20, width: 46, height: 46, borderRadius: 23, backgroundColor: "rgba(17,24,42,0.9)", borderWidth: 1, borderColor: "rgba(255,255,255,0.16)", alignItems: "center", justifyContent: "center", shadowColor: v2Colors.primary, shadowOpacity: 0.48, shadowRadius: 18, shadowOffset: { width: 0, height: 0 } },
  panel: { borderRadius: radii.lg, borderWidth: 1, borderColor: "rgba(139,92,246,0.28)", backgroundColor: "rgba(7,10,18,0.96)", padding: 10, gap: 9, shadowColor: v2Colors.violet, shadowOpacity: 0.38, shadowRadius: 28, shadowOffset: { width: 0, height: 0 } },
  imageFrame: { borderRadius: radii.md, borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", backgroundColor: "#03050C", overflow: "hidden", alignItems: "center", justifyContent: "center" },
  imageSurface: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  loading: { position: "absolute" },
  failure: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: "#050505" },
  failureText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  zoomControls: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10 },
  zoomButton: { width: 38, height: 38, borderRadius: 19, backgroundColor: v2Colors.surface2, borderWidth: 1, borderColor: "rgba(139,92,246,0.36)", alignItems: "center", justifyContent: "center" },
  resetButton: { width: 42, height: 38, borderRadius: 19, backgroundColor: "rgba(99,102,241,0.4)", borderWidth: 1, borderColor: "rgba(139,92,246,0.42)", alignItems: "center", justifyContent: "center" },
  footer: { width: "100%" }
});
