export type ImageFocus = {
  x: number;
  y: number;
};

export const DEFAULT_IMAGE_FOCUS: ImageFocus = { x: 50, y: 50 };

export function parseImageFocus(value: unknown): ImageFocus | undefined {
  if (!value || typeof value !== "object") return undefined;
  const record = value as Record<string, unknown>;
  const x = typeof record.x === "number" ? record.x : Number(record.x);
  const y = typeof record.y === "number" ? record.y : Number(record.y);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return undefined;
  return {
    x: Math.min(100, Math.max(0, x)),
    y: Math.min(100, Math.max(0, y))
  };
}

export function resolveImageFocus(value: unknown, fallback = DEFAULT_IMAGE_FOCUS): ImageFocus {
  return parseImageFocus(value) ?? fallback;
}

export function imageFocusPayload(focus?: ImageFocus) {
  return { imageFocus: resolveImageFocus(focus) };
}

export function withImageFields(image: string, focus?: ImageFocus) {
  return {
    image,
    imageURL: image,
    imageFocus: resolveImageFocus(focus)
  };
}

export function toCssObjectPosition(focus?: ImageFocus) {
  const point = resolveImageFocus(focus);
  return `${point.x}% ${point.y}%`;
}

export function toExpoContentPosition(focus?: ImageFocus) {
  const point = resolveImageFocus(focus);
  return { top: `${point.y}%`, left: `${point.x}%` } as const;
}
