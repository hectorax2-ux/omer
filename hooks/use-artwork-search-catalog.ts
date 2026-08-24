import { useCallback, useEffect, useRef, useState } from "react";
import type { Artwork } from "@/types/content";
import { mapArtworkDocument } from "@/hooks/use-artworks";
import { listAllPublishedArtworks } from "@/src/services/firebase/artwork-service";
import { sortArtworkDocuments } from "@/utils/artwork-gallery-filters";
import { isResourceArray, loadResourceCache, peekLargestResourceArray, peekResourceCache, refreshResourceCache } from "@/src/services/cache/resource-cache";
import { startPerformanceSpan } from "@/utils/performance";

const CACHE_KEY = "artworks:search-all";

export function useArtworkSearchCatalog(active: boolean) {
  const [catalog, setCatalog] = useState<Artwork[]>(() => peekResourceCache<Artwork[]>(CACHE_KEY) ?? peekLargestResourceArray<Artwork>("artworks:") ?? []);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const startedRef = useRef(false);

  const loadCatalog = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    const cached = peekResourceCache<Artwork[]>(CACHE_KEY) ?? peekLargestResourceArray<Artwork>("artworks:") ?? await loadResourceCache(CACHE_KEY, isArtworkArray);
    if (cached) {
      setCatalog(cached);
      setReady(true);
    }
    setLoading(!cached);
    setError(false);
    const span = startPerformanceSpan("catalog.artworks.search-all");
    try {
      const next = await refreshResourceCache(CACHE_KEY, async () => {
        const documents = sortArtworkDocuments(await listAllPublishedArtworks());
        return documents.map(mapArtworkDocument);
      });
      setCatalog(next);
      setReady(true);
      span.end({ count: next.length, cached: Boolean(cached) });
    } catch {
      setError(true);
      span.end({ failed: true, cached: Boolean(cached) });
      startedRef.current = false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    void loadCatalog();
  }, [active, loadCatalog]);

  return { catalog, loading, error, ready };
}

function isArtwork(value: unknown): value is Artwork {
  if (!value || typeof value !== "object") return false;
  const artwork = value as Partial<Artwork>;
  return typeof artwork.id === "string" && Boolean(artwork.title);
}

function isArtworkArray(value: unknown): value is Artwork[] {
  return isResourceArray(value, isArtwork);
}
