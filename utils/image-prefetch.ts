import { Image } from "expo-image";
import { isInteractionPerformanceLocked } from "@/hooks/use-runtime-performance-mode";
import { resolveImageUri, type ImageVariant } from "@/utils/image-source";

export async function prefetchImageUrls(urls: (string | undefined)[], concurrency = 3, timeoutMs = 4_000, maxUrls = 12, variant: ImageVariant = "card") {
  if (isInteractionPerformanceLocked()) return;
  const queue = [...new Set(urls.filter((url): url is string => Boolean(url)).map((url) => resolveImageUri(url, variant)))].slice(0, maxUrls);
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
      if (isInteractionPerformanceLocked()) return;
      const url = queue.shift();
      if (!url) continue;
      await Promise.race([
        Image.prefetch(url, { cachePolicy: "memory-disk" }).catch(() => false),
        new Promise<boolean>((resolve) => setTimeout(() => resolve(false), timeoutMs))
      ]);
    }
  });
  await Promise.all(workers);
}
