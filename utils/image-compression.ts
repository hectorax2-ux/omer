import * as ImageManipulator from "expo-image-manipulator";

const TARGET_PROFILE_IMAGE_BYTES = 1024 * 1024;
const PROFILE_IMAGE_MAX_WIDTH = 1280;

async function getUriByteSize(uri: string) {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob.size;
  } catch {
    return undefined;
  }
}

export async function compressProfileImage(uri: string) {
  const passes = [
    { width: PROFILE_IMAGE_MAX_WIDTH, compress: 0.82 },
    { width: 1080, compress: 0.74 },
    { width: 900, compress: 0.68 },
    { width: 720, compress: 0.62 }
  ];

  let bestUri = uri;

  for (const pass of passes) {
    const result = await ImageManipulator.manipulateAsync(
      bestUri,
      [{ resize: { width: pass.width } }],
      { compress: pass.compress, format: ImageManipulator.SaveFormat.JPEG }
    );
    bestUri = result.uri;

    const size = await getUriByteSize(result.uri);
    if (size !== undefined && size <= TARGET_PROFILE_IMAGE_BYTES) {
      return result.uri;
    }
  }

  return bestUri;
}
