export type ImageVariant = "avatar" | "thumbnail" | "card" | "large" | "detail" | "zoom";

const imageWidths: Record<Exclude<ImageVariant, "zoom">, number> = {
  avatar: 256,
  thumbnail: 400,
  card: 600,
  large: 800,
  detail: 1080
};

export function resolveImageUri(uri: string, variant: ImageVariant = "card") {
  const normalized = uri.trim();
  if (!normalized || variant === "zoom") return normalized;
  const width = imageWidths[variant];

  if (/^https:\/\/(images|plus)\.unsplash\.com\//i.test(normalized)) {
    try {
      const url = new URL(normalized);
      url.searchParams.set("auto", "format");
      url.searchParams.set("fit", url.searchParams.get("fit") || "crop");
      url.searchParams.set("w", String(width));
      url.searchParams.set("q", variant === "detail" ? "82" : "78");
      return url.toString();
    } catch {
      return normalized;
    }
  }

  if (/^https:\/\/res\.cloudinary\.com\//i.test(normalized) && normalized.includes("/upload/")) {
    return normalized.replace("/upload/", `/upload/f_auto,q_auto:eco,w_${width},c_limit/`);
  }

  if (/^https:\/\/lh\d+\.googleusercontent\.com\//i.test(normalized)) {
    if (/=s\d+(-c)?$/i.test(normalized)) return normalized.replace(/=s\d+(-c)?$/i, `=s${width}-c`);
    return `${normalized}=s${width}-c`;
  }

  return normalized;
}

export function imageSource(uri: string, variant: ImageVariant = "card") {
  const resolvedUri = resolveImageUri(uri, variant);
  return {
    uri: resolvedUri,
    cacheKey: `${variant}:${resolvedUri}`
  };
}

export function avatarVariantForSize(size: number): ImageVariant {
  return size <= 96 ? "avatar" : "thumbnail";
}
