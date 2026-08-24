import { Image } from "expo-image";

export async function prefetchImageUrls(urls: (string | undefined)[], concurrency = 3, timeoutMs = 4_000) {
  const queue = [...new Set(urls.filter((url): url is string => Boolean(url)))];
  const workers = Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (queue.length) {
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
