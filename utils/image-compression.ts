import * as ImageManipulator from "expo-image-manipulator";

export async function compressProfileImage(uri: string) {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 512 } }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}

export async function compressArtworkImage(uri: string, width?: number, height?: number) {
  const resize = width && height && height > width
    ? { height: 1080 }
    : { width: 1080 };
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize }],
    { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
  );
  return result.uri;
}
