import { Image, type ImageProps } from "expo-image";
import { toExpoContentPosition, type ImageFocus } from "@/firebase/shared/image-focus";

type CoverImageProps = Omit<ImageProps, "contentFit" | "contentPosition"> & {
  imageFocus?: ImageFocus;
};

export function CoverImage({ imageFocus, ...props }: CoverImageProps) {
  return (
    <Image
      {...props}
      cachePolicy={props.cachePolicy ?? "memory-disk"}
      priority={props.priority ?? "normal"}
      allowDownscaling={props.allowDownscaling ?? true}
      contentFit="cover"
      contentPosition={toExpoContentPosition(imageFocus)}
    />
  );
}
