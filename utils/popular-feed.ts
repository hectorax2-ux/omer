import type { DiscoveryPost } from "@/providers/discovery-post-provider";

/** Popüler sekmede öncelikli pencere: son 6 saat. */
export const POPULAR_PRIMARY_WINDOW_MS = 6 * 60 * 60 * 1000;

function sortByLikesDesc(a: DiscoveryPost, b: DiscoveryPost) {
  return b.likes - a.likes || b.createdAt - a.createdAt;
}

/**
 * Popüler Keşfet listesi:
 * - Son 6 saatte paylaşılan yazılar beğeni sayısına göre en üstte
 * - Kalan aktif yazılar altta yine beğeniye göre sıralanır (sekme boş kalmaz)
 * - Dil filtresi çağıran tarafında uygulanır (activePosts)
 */
export function buildPopularFeedPosts(posts: DiscoveryPost[], now = Date.now()): DiscoveryPost[] {
  if (!posts.length) return [];

  const primary = posts
    .filter((post) => now - post.createdAt <= POPULAR_PRIMARY_WINDOW_MS)
    .sort(sortByLikesDesc);

  const primaryIds = new Set(primary.map((post) => post.id));
  const rest = posts
    .filter((post) => !primaryIds.has(post.id))
    .sort(sortByLikesDesc);

  return [...primary, ...rest];
}
