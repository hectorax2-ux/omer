import { Language } from "@/types/content";

export const MAX_UPLOAD_IMAGE_BYTES = 4 * 1024 * 1024;
export const MAX_UPLOAD_IMAGE_MB = 4;

type PickedImageAsset = {
  uri?: string | null;
  fileSize?: number | null;
  mimeType?: string | null;
};

const acceptedMimeTypes = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif"
]);

const acceptedExtensions = [".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"];

const errorText: Record<Language, { size: string; type: string }> = {
  tr: {
    size: `Görsel en fazla ${MAX_UPLOAD_IMAGE_MB} MB olmalı.`,
    type: "Yalnızca JPG, PNG, WEBP veya telefon fotoğraf formatları kabul edilir."
  },
  en: {
    size: `Image size must be ${MAX_UPLOAD_IMAGE_MB} MB or less.`,
    type: "Only JPG, PNG, WEBP, or phone photo formats are accepted."
  },
  ru: {
    size: `Размер изображения не должен превышать ${MAX_UPLOAD_IMAGE_MB} МБ.`,
    type: "Принимаются только JPG, PNG, WEBP или форматы фото с телефона."
  },
  uz: {
    size: `Rasm hajmi ${MAX_UPLOAD_IMAGE_MB} MB dan oshmasligi kerak.`,
    type: "Faqat JPG, PNG, WEBP yoki telefon foto formatlari qabul qilinadi."
  }
};

export const uploadFormatHint: Record<Language, string> = {
  tr: `JPG, PNG, WEBP veya telefon fotoğraf formatı; maksimum ${MAX_UPLOAD_IMAGE_MB} MB.`,
  en: `JPG, PNG, WEBP, or phone photo format; maximum ${MAX_UPLOAD_IMAGE_MB} MB.`,
  ru: `JPG, PNG, WEBP или формат фото с телефона; максимум ${MAX_UPLOAD_IMAGE_MB} МБ.`,
  uz: `JPG, PNG, WEBP yoki telefon foto formati; maksimum ${MAX_UPLOAD_IMAGE_MB} MB.`
};

export function validatePickedImageAsset(asset: PickedImageAsset, language: Language) {
  if (asset.fileSize && asset.fileSize > MAX_UPLOAD_IMAGE_BYTES) {
    return { ok: false, message: errorText[language].size };
  }

  const mime = asset.mimeType?.toLocaleLowerCase("en");
  const uri = asset.uri?.toLocaleLowerCase("en") ?? "";
  const hasAcceptedExtension = acceptedExtensions.some((extension) => uri.includes(extension));

  if (mime && !acceptedMimeTypes.has(mime) && !hasAcceptedExtension) {
    return { ok: false, message: errorText[language].type };
  }

  return { ok: true, message: "" };
}
