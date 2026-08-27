import { Image, type ImageProps } from "expo-image";
import { toExpoContentPosition, type ImageFocus } from "@/firebase/shared/image-focus";
import { isInteractionPerformanceLocked } from "@/hooks/use-runtime-performance-mode";
import { imageSource, type ImageVariant } from "@/utils/image-source";

type CoverImageProps = Omit<ImageProps, "contentFit" | "contentPosition"> & {
  imageFocus?: ImageFocus;
  imageVariant?: ImageVariant;
};

export function CoverImage({ imageFocus, imageVariant = "card", ...props }: CoverImageProps) {
  const source = props.source;
  const optimizedSource = source && typeof source === "object" && !Array.isArray(source) && "uri" in source && typeof source.uri === "string"
    ? { ...source, ...imageSource(source.uri, imageVariant) }
    : source;
  return (
    <Image
      {...props}
      source={optimizedSource}
      cachePolicy={props.cachePolicy ?? "memory-disk"}
      priority={props.priority ?? "normal"}
      allowDownscaling={props.allowDownscaling ?? true}
      transition={props.transition ?? (isInteractionPerformanceLocked() ? 0 : 140)}
      contentFit="cover"
      contentPosition={toExpoContentPosition(imageFocus)}
    />
  );
}
