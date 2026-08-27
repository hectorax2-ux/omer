import { useEffect, useState } from "react";
import { StyleProp, StyleSheet, View, ViewStyle } from "react-native";
import { Image, type ImageContentFit } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { toExpoContentPosition, type ImageFocus } from "@/firebase/shared/image-focus";
import { isInteractionPerformanceLocked } from "@/hooks/use-runtime-performance-mode";
import { imageSource, type ImageVariant } from "@/utils/image-source";

export function HomeImage({ uri, style, contentFit = "cover", transition = 180, imageFocus, showFallbackIcon = true, imageVariant = "card" }: {
  uri?: string;
  style: StyleProp<ViewStyle>;
  contentFit?: ImageContentFit;
  transition?: number;
  imageFocus?: ImageFocus;
  showFallbackIcon?: boolean;
  imageVariant?: ImageVariant;
}) {
  const [failed, setFailed] = useState(false);

  useEffect(() => setFailed(false), [uri]);

  return (
    <View style={[styles.container, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {uri && !failed ? (
        <Image source={imageSource(uri, imageVariant)} recyclingKey={`${imageVariant}:${uri}`} style={StyleSheet.absoluteFill} contentFit={contentFit} contentPosition={toExpoContentPosition(imageFocus)} cachePolicy="memory-disk" priority="normal" allowDownscaling transition={isInteractionPerformanceLocked() ? 0 : transition} onError={() => setFailed(true)} />
      ) : (
        <View style={styles.fallback}>
          {showFallbackIcon ? <Ionicons name="image-outline" size={24} color="rgba(237,226,205,0.55)" /> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: "hidden", backgroundColor: "#171A31" },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#171A31" }
});
