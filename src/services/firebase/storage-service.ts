import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { firebaseStorage } from "./core";
import { ALLOWED_IMAGE_MIME_TYPES, IMAGE_UPLOAD_LIMITS } from "@/src/types/firestore";

export type UploadImageKind = keyof typeof IMAGE_UPLOAD_LIMITS;

export type ImageUploadMetadata = {
  mimeType: string;
  sizeBytes: number;
  width?: number;
  height?: number;
};

export function validateImageUpload(kind: UploadImageKind, metadata: ImageUploadMetadata): string | null {
  const limits = IMAGE_UPLOAD_LIMITS[kind];
  if (!ALLOWED_IMAGE_MIME_TYPES.includes(metadata.mimeType as (typeof ALLOWED_IMAGE_MIME_TYPES)[number])) {
    return "Yalnızca JPEG, PNG veya WEBP görsel yüklenebilir.";
  }
  if (metadata.sizeBytes > limits.maxBytes) {
    return "Görsel dosyası izin verilen boyuttan büyük.";
  }
  if (metadata.width && metadata.width < limits.minWidth) return "Görsel genişliği çok düşük.";
  if (metadata.height && metadata.height < limits.minHeight) return "Görsel yüksekliği çok düşük.";
  if (metadata.width && metadata.width > limits.maxWidth) return "Görsel genişliği çok yüksek.";
  if (metadata.height && metadata.height > limits.maxHeight) return "Görsel yüksekliği çok yüksek.";
  return null;
}

export async function uploadImage(path: string, blob: Blob, metadata: ImageUploadMetadata): Promise<string> {
  const storageRef = ref(firebaseStorage, path);
  await uploadBytes(storageRef, blob, { contentType: metadata.mimeType });
  return getDownloadURL(storageRef);
}

export function museumCoverPath(userId: string, fileName: string) {
  return `users/${userId}/museumCover/${fileName}`;
}

export function profileAvatarPath(userId: string, fileName: string) {
  return `users/${userId}/profile/${fileName}`;
}

export function communityImagePath(userId: string, fileName: string) {
  return `users/${userId}/communityImages/${fileName}`;
}

export function artStoryImagePath(userId: string, fileName: string) {
  return `users/${userId}/artStories/${fileName}`;
}

export function adminAssetPath(assetType: "artworks" | "artists" | "museums" | "ads" | "events", fileName: string) {
  return `admin/${assetType}/${fileName}`;
}
