import { useEffect, useState } from "react";
import type { LocalizedText, Museum } from "@/types/content";
import type { LocalizedString, MuseumDocument } from "@/src/types/firestore";
import { getMuseumDocument, listPublishedMuseums } from "@/src/services/firebase/museum-service";
import { useRegisterRefresh } from "@/providers/refresh-provider";
import { isResourceArray, loadResourceCache, peekResourceCache, refreshResourceCache } from "@/src/services/cache/resource-cache";
import { startPerformanceSpan } from "@/utils/performance";
import { parseImageFocus } from "@/firebase/shared/image-focus";

function localized(value: LocalizedString | undefined, fallback: string): LocalizedText {
  return {
    tr: value?.tr || value?.en || value?.ru || value?.uz || fallback,
    en: value?.en || value?.tr || value?.ru || value?.uz || fallback,
    ru: value?.ru || value?.tr || value?.en || value?.uz || fallback,
    uz: value?.uz || value?.tr || value?.en || value?.ru || fallback
  };
}

function imageFromDocument(document: MuseumDocument) {
  const legacy = document as MuseumDocument & { image?: string; imageUrl?: string; coverImage?: string };
  return document.imageURL || legacy.image || legacy.imageUrl || legacy.coverImage || "";
}

export function mapMuseumDocument(document: MuseumDocument): Museum {
  return {
    id: document.id,
    image: imageFromDocument(document),
    imageFocus: parseImageFocus(document.imageFocus),
    name: localized(document.name, "Art Atlas"),
    city: localized(document.city, ""),
    country: localized(document.country, ""),
    description: localized(document.description, ""),
    artworkIds: document.artworkIds ?? []
  };
}

export function useMuseums(maxResults = 100) {
  const cacheKey = `museums:${maxResults}`;
  const initial = peekResourceCache<Museum[]>(cacheKey);
  const [remoteMuseums, setRemoteMuseums] = useState<Museum[]>(initial ?? []);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useRegisterRefresh(() => setRefreshCounter((value) => value + 1));

  useEffect(() => {
    let mounted = true;
    let hasCachedData = false;
    const memoryValue = peekResourceCache<Museum[]>(cacheKey);
    if (memoryValue) {
      hasCachedData = true;
      setRemoteMuseums(memoryValue);
    }
    setLoading(!hasCachedData);
    setError(false);

    async function load() {
      const cached = memoryValue ?? await loadResourceCache(cacheKey, isMuseumArray);
      if (!mounted) return;
      if (cached) {
        hasCachedData = true;
        setRemoteMuseums(cached);
        setLoading(false);
      }
      const span = startPerformanceSpan(`catalog.museums.${maxResults}`);
      try {
        const next = await refreshResourceCache(cacheKey, async () => {
          const documents = await listPublishedMuseums(maxResults);
          return [...documents]
            .sort((a, b) => {
              const pinnedDelta = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
              if (pinnedDelta) return pinnedDelta;
              return (b.createdAt?.toMillis?.() ?? 0) - (a.createdAt?.toMillis?.() ?? 0);
            })
            .map(mapMuseumDocument);
        }, refreshCounter > 0);
        if (!mounted) return;
        setRemoteMuseums(next);
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

  return { museums: remoteMuseums, loading, error, isRemote: remoteMuseums.length > 0 };
}

export function useMuseum(id?: string) {
  const { museums, loading } = useMuseums();
  const [remoteMuseum, setRemoteMuseum] = useState<Museum | null>(null);
  const [detailLoading, setDetailLoading] = useState(Boolean(id));

  useEffect(() => {
    let mounted = true;
    if (!id) {
      setRemoteMuseum(null);
      setDetailLoading(false);
      return undefined;
    }
    const cacheKey = `museum:${id}`;
    const cached = peekResourceCache<Museum>(cacheKey);
    setRemoteMuseum(cached);
    setDetailLoading(!cached);
    void loadResourceCache(cacheKey, isMuseum)
      .then((diskValue) => {
        if (mounted && diskValue) {
          setRemoteMuseum(diskValue);
          setDetailLoading(false);
        }
        return refreshResourceCache(cacheKey, async () => {
          const document = await getMuseumDocument(id);
          if (!document) throw new Error("Museum not found");
          return mapMuseumDocument(document);
        });
      })
      .then((museum) => {
        if (mounted) setRemoteMuseum(museum);
      })
      .catch(() => undefined)
      .finally(() => {
        if (mounted) setDetailLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [id]);

  const museum = remoteMuseum ?? museums.find((item) => item.id === id);
  return { museum, loading: !museum && (loading || detailLoading) };
}

function isMuseum(value: unknown): value is Museum {
  if (!value || typeof value !== "object") return false;
  const museum = value as Partial<Museum>;
  return typeof museum.id === "string" && typeof museum.image === "string" && Boolean(museum.name);
}

function isMuseumArray(value: unknown): value is Museum[] {
  return isResourceArray(value, isMuseum);
}
