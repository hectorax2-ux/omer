import { ReactNode, useState } from "react";
import { Pressable, StyleSheet, View, ViewStyle } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { ImagePreviewModal } from "@/components/image-preview-modal";
import { toExpoContentPosition, type ImageFocus } from "@/firebase/shared/image-focus";

type ZoomableHeroImageProps = {
  uri: string;
  imageFocus?: ImageFocus;
  containerStyle?: ViewStyle;
  children?: ReactNode;
};

export function ZoomableHeroImage({ uri, imageFocus, containerStyle, children }: ZoomableHeroImageProps) {
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  return (
    <>
      <Pressable onPress={() => setPreviewImage(uri)} style={[styles.container, containerStyle]} accessibilityRole="button" accessibilityLabel="Görseli büyüt">
        <Image source={{ uri }} style={StyleSheet.absoluteFillObject} contentFit="cover" contentPosition={toExpoContentPosition(imageFocus)} />
        {children}
        <View style={styles.expandBadge} pointerEvents="none">
          <Ionicons name="expand-outline" size={15} color="#fff8eb" />
        </View>
      </Pressable>
      <ImagePreviewModal image={previewImage} onClose={() => setPreviewImage(null)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    position: "relative"
  },
  expandBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(8, 8, 8, 0.72)",
    borderWidth: 1,
    borderColor: "rgba(217, 184, 101, 0.45)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2
  }
});
