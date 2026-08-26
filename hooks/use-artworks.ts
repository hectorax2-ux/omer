import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { Artwork, Language, LocalizedText } from "@/types/content";
import type { ArtworkDocument, LocalizedString } from "@/src/types/firestore";
import { getArtworkDocument, listPublishedArtworks } from "@/src/services/firebase/artwork-service";
import { useRegisterRefresh } from "@/providers/refresh-provider";
import { isResourceArray, loadResourceCache, peekLargestResourceArray, peekResourceCache, refreshResourceCache } from "@/src/services/cache/resource-cache";
import { markPerformanceEvent, runAfterInteractions, startPerformanceSpan } from "@/utils/performance";
import { parseImageFocus } from "@/firebase/shared/image-focus";
import { artworks as bundledArtworks } from "@/data/content";

function localized(value: LocalizedString | undefined, fallback: string): LocalizedText {
  return {
    tr: value?.tr || value?.en || value?.ru || value?.uz || fallback,
    en: value?.en || value?.tr || value?.ru || value?.uz || fallback,
    ru: value?.ru || value?.tr || value?.en || value?.uz || fallback,
    uz: value?.uz || value?.tr || value?.en || value?.ru || fallback
  };
}

function imageFromDocument(document: ArtworkDocument) {
  const legacy = document as ArtworkDocument & { image?: string; imageUrl?: string; coverImage?: string };
  return document.imageURL || legacy.image || legacy.imageUrl || legacy.coverImage || "";
}

export function mapArtworkDocument(document: ArtworkDocument): Artwork {
  const tags = document.tags ?? [];
  return {
    id: document.id,
    year: document.year || "",
    createdAt: document.createdAt,
    publishedAt: document.publishedAt,
    pinned: document.pinned,
    origin: localized(document.museumName, "").tr || "",
    country: localized(document.country, ""),
    tags: tags.map((tag) => localized({ tr: tag, en: tag, ru: tag, uz: tag }, tag)),
    image: imageFromDocument(document),
    imageFocus: parseImageFocus(document.imageFocus),
    title: localized(document.title, "Art Atlas"),
    artist: localized(document.artistName, ""),
    period: localized(document.period, ""),
    description: localized(document.description, ""),
    detail: localized(document.detail || document.description, "")
  };
}

export function useArtworks(maxResults = 100, enabled = true) {
  const cacheKey = `artworks:${maxResults}`;
  const initialCached = peekResourceCache<Artwork[]>(cacheKey) ?? peekLargestResourceArray<Artwork>("artworks:");
  const initial = (initialCached ?? bundledArtworks).slice(0, maxResults);
  const [remoteArtworks, setRemoteArtworks] = useState<Artwork[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const lastFocusRefreshAt = useRef(Date.now());

  useRegisterRefresh(() => setRefreshCounter((value) => value + 1));
  useFocusEffect(useCallback(() => {
    if (!enabled) return;
    if (Date.now() - lastFocusRefreshAt.current < 2 * 60 * 1000) return;
    lastFocusRefreshAt.current = Date.now();
    setRefreshCounter((value) => value + 1);
  }, [enabled]));

  useEffect(() => {
    let mounted = true;
    let hasCachedData = false;
    const memoryResource = peekResourceCache<Artwork[]>(cacheKey) ?? peekLargestResourceArray<Artwork>("artworks:");
    const memoryValue = memoryResource?.slice(0, maxResults);
    if (memoryValue) {
      hasCachedData = true;
      setRemoteArtworks(memoryValue);
      markPerformanceEvent("CACHE_CONTENT_VISIBLE", { resource: "artworks", source: "memory", count: memoryValue.length });
    }
    setLoading(false);
    setError(false);
    if (!enabled) return undefined;

    async function load() {
      const cached = memoryValue ?? await loadResourceCache(cacheKey, isArtworkArray);
      if (!mounted) return;
      if (cached) {
        hasCachedData = true;
        setRemoteArtworks(cached);
        setLoading(false);
        if (!memoryValue) markPerformanceEvent("CACHE_CONTENT_VISIBLE", { resource: "artworks", source: "disk", count: cached.length });
      }
      const span = startPerformanceSpan(`catalog.artworks.${maxResults}`);
      try {
        const next = await refreshResourceCache(cacheKey, async () => {
          const documents = await listPublishedArtworks(maxResults);
          return runAfterInteractions(() => [...documents]
            .sort((a, b) => {
              const pinnedDelta = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
              if (pinnedDelta) return pinnedDelta;
              const bTime = b.publishedAt?.toMillis?.() ?? b.createdAt?.toMillis?.() ?? 0;
              const aTime = a.publishedAt?.toMillis?.() ?? a.createdAt?.toMillis?.() ?? 0;
              return bTime - aTime;
            })
            .map(mapArtworkDocument));
        }, refreshCounter > 0);
        if (!mounted) return;
        setRemoteArtworks(next.length ? next : bundledArtworks.slice(0, maxResults));
        setError(false);
        span.end({ count: next.length, cached: Boolean(cached) });
      } catch {
        if (!mounted) return;
        setError(true);
        span.end({ failed: true, cached: hasCachedData });
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => {
      mounted = false;
    };
  }, [cacheKey, enabled, maxResults, refreshCounter]);

  const artworks = useMemo(() => remoteArtworks, [remoteArtworks]);
  return { artworks, loading, error, isRemote: remoteArtworks.length > 0 };
}

export function useArtwork(id?: string) {
  const [remoteArtwork, setRemoteArtwork] = useState<Artwork | null>(() => id
    ? peekResourceCache<Artwork>(`artwork:${id}`) ?? peekLargestResourceArray<Artwork>("artworks:")?.find((item) => item.id === id) ?? bundledArtworks.find((item) => item.id === id) ?? null
    : null);
  const [detailLoading, setDetailLoading] = useState(Boolean(id));

  useEffect(() => {
    let mounted = true;
    if (!id) {
      setRemoteArtwork(null);
      setDetailLoading(false);
      return undefined;
    }
    const cacheKey = `artwork:${id}`;
    const cached = peekResourceCache<Artwork>(cacheKey)
      ?? peekLargestResourceArray<Artwork>("artworks:")?.find((item) => item.id === id)
      ?? bundledArtworks.find((item) => item.id === id)
      ?? null;
    setRemoteArtwork(cached);
    setDetailLoading(!cached);
    void loadResourceCache(cacheKey, isArtwork)
      .then((diskValue) => {
        if (mounted && diskValue) {
          setRemoteArtwork(diskValue);
          setDetailLoading(false);
        }
        return refreshResourceCache(cacheKey, async () => {
          const document = await getArtworkDocument(id);
          if (!document) throw new Error("Artwork not found");
          return mapArtworkDocument(document);
        });
      })
      .then((artwork) => {
        if (mounted) setRemoteArtwork(artwork);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setDetailLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  return { artwork: remoteArtwork, loading: !remoteArtwork && detailLoading };
}

export function textForLanguage(text: LocalizedText, language: Language) {
  return text[language] || text.tr || text.en || text.ru || text.uz;
}

function isArtwork(value: unknown): value is Artwork {
  if (!value || typeof value !== "object") return false;
  const artwork = value as Partial<Artwork>;
  return typeof artwork.id === "string" && typeof artwork.image === "string" && Boolean(artwork.title);
}

function isArtworkArray(value: unknown): value is Artwork[] {
  return isResourceArray(value, isArtwork);
}
