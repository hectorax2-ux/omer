import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import type { Artist, LocalizedText } from "@/types/content";
import type { ArtistDocument, LocalizedString } from "@/src/types/firestore";
import { getArtistDocument, listPublishedArtists } from "@/src/services/firebase/artist-service";
import { useRegisterRefresh } from "@/providers/refresh-provider";
import { isResourceArray, loadResourceCache, peekLargestResourceArray, peekResourceCache, refreshResourceCache } from "@/src/services/cache/resource-cache";
import { markPerformanceEvent, startPerformanceSpan } from "@/utils/performance";
import { parseImageFocus } from "@/firebase/shared/image-focus";
import { artists as bundledArtists } from "@/data/content";

function localized(value: LocalizedString | undefined, fallback: string): LocalizedText {
  return {
    tr: value?.tr || value?.en || value?.ru || value?.uz || fallback,
    en: value?.en || value?.tr || value?.ru || value?.uz || fallback,
    ru: value?.ru || value?.tr || value?.en || value?.uz || fallback,
    uz: value?.uz || value?.tr || value?.en || value?.ru || fallback
  };
}

function imageFromDocument(document: ArtistDocument) {
  const legacy = document as ArtistDocument & { image?: string; imageUrl?: string; coverImage?: string; photoURL?: string };
  return document.imageURL || legacy.image || legacy.imageUrl || legacy.coverImage || legacy.photoURL || "";
}

export function mapArtistDocument(document: ArtistDocument): Artist {
  return {
    id: document.id,
    image: imageFromDocument(document),
    imageFocus: parseImageFocus(document.imageFocus),
    name: localized(document.name, "Art Atlas"),
    life: document.lifeYears || "",
    country: localized(document.country, ""),
    movement: localized(document.movement, ""),
    biography: localized(document.biography, ""),
    featuredArtworkIds: document.featuredArtworkIds ?? []
  };
}

export function useArtists(maxResults = 100) {
  const cacheKey = `artists:${maxResults}`;
  const initialCached = peekResourceCache<Artist[]>(cacheKey) ?? peekLargestResourceArray<Artist>("artists:");
  const initial = (initialCached ?? bundledArtists).slice(0, maxResults);
  const [remoteArtists, setRemoteArtists] = useState<Artist[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const lastFocusRefreshAt = useRef(Date.now());

  useRegisterRefresh(() => setRefreshCounter((value) => value + 1));
  useFocusEffect(useCallback(() => {
    if (Date.now() - lastFocusRefreshAt.current < 2 * 60 * 1000) return;
    lastFocusRefreshAt.current = Date.now();
    setRefreshCounter((value) => value + 1);
  }, []));

  useEffect(() => {
    let mounted = true;
    let hasCachedData = false;
    const memoryResource = peekResourceCache<Artist[]>(cacheKey) ?? peekLargestResourceArray<Artist>("artists:");
    const memoryValue = memoryResource?.slice(0, maxResults);
    if (memoryValue) {
      hasCachedData = true;
      setRemoteArtists(memoryValue);
      markPerformanceEvent("CACHE_CONTENT_VISIBLE", { resource: "artists", source: "memory", count: memoryValue.length });
    }
    setLoading(false);
    setError(false);

    async function load() {
      const cached = memoryValue ?? await loadResourceCache(cacheKey, isArtistArray);
      if (!mounted) return;
      if (cached) {
        hasCachedData = true;
        setRemoteArtists(cached);
        setLoading(false);
        if (!memoryValue) markPerformanceEvent("CACHE_CONTENT_VISIBLE", { resource: "artists", source: "disk", count: cached.length });
      }
      const span = startPerformanceSpan(`catalog.artists.${maxResults}`);
      try {
        const next = await refreshResourceCache(cacheKey, async () => {
          const documents = await listPublishedArtists(maxResults);
          return [...documents]
            .sort((a, b) => {
              const pinnedDelta = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
              if (pinnedDelta) return pinnedDelta;
              return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);
            })
            .map(mapArtistDocument);
        }, refreshCounter > 0);
        if (!mounted) return;
        setRemoteArtists(next.length ? next : bundledArtists.slice(0, maxResults));
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
  }, [cacheKey, maxResults, refreshCounter]);

  return { artists: remoteArtists, loading, error, isRemote: remoteArtists.length > 0 };
}

export function useArtist(id?: string) {
  const [remoteArtist, setRemoteArtist] = useState<Artist | null>(() => id
    ? peekResourceCache<Artist>(`artist:${id}`) ?? peekLargestResourceArray<Artist>("artists:")?.find((item) => item.id === id) ?? bundledArtists.find((item) => item.id === id) ?? null
    : null);
  const [detailLoading, setDetailLoading] = useState(Boolean(id));

  useEffect(() => {
    let mounted = true;
    if (!id) {
      setRemoteArtist(null);
      setDetailLoading(false);
      return undefined;
    }
    const cacheKey = `artist:${id}`;
    const cached = peekResourceCache<Artist>(cacheKey)
      ?? peekLargestResourceArray<Artist>("artists:")?.find((item) => item.id === id)
      ?? bundledArtists.find((item) => item.id === id)
      ?? null;
    setRemoteArtist(cached);
    setDetailLoading(!cached);
    void loadResourceCache(cacheKey, isArtist)
      .then((diskValue) => {
        if (mounted && diskValue) {
          setRemoteArtist(diskValue);
          setDetailLoading(false);
        }
        return refreshResourceCache(cacheKey, async () => {
          const document = await getArtistDocument(id);
          if (!document) throw new Error("Artist not found");
          return mapArtistDocument(document);
        });
      })
      .then((artist) => {
        if (mounted) setRemoteArtist(artist);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setDetailLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  return { artist: remoteArtist, loading: !remoteArtist && detailLoading };
}

function isArtist(value: unknown): value is Artist {
  if (!value || typeof value !== "object") return false;
  const artist = value as Partial<Artist>;
  return typeof artist.id === "string" && typeof artist.image === "string" && Boolean(artist.name);
}

function isArtistArray(value: unknown): value is Artist[] {
  return isResourceArray(value, isArtist);
}
