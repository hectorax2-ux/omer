import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "@/hooks/use-language";
import { loadResourceCache, peekResourceCache, refreshResourceCache, saveResourceCache } from "@/src/services/cache/resource-cache";
import { getPublishedNews, listHeadlineNews, listNewsCategories, listPinnedNews, listPublishedNewsPage, listTickerNews } from "@/src/services/firebase/news-service";
import { ArtNewsCategoryDocument, ArtNewsDocument } from "@/src/types/firestore";
import { DocumentData, QueryDocumentSnapshot } from "firebase/firestore";

type NewsSnapshot = {
  headlines: ArtNewsDocument[];
  pinned: ArtNewsDocument[];
  items: ArtNewsDocument[];
  categories: ArtNewsCategoryDocument[];
  ticker: ArtNewsDocument | null;
  hasMore: boolean;
};

const EMPTY_SNAPSHOT: NewsSnapshot = { headlines: [], pinned: [], items: [], categories: [], ticker: null, hasMore: false };

function isNewsSnapshot(value: unknown): value is NewsSnapshot {
  if (!value || typeof value !== "object") return false;
  const snapshot = value as Partial<NewsSnapshot>;
  return Array.isArray(snapshot.headlines) && Array.isArray(snapshot.pinned) && Array.isArray(snapshot.items) && Array.isArray(snapshot.categories) && typeof snapshot.hasMore === "boolean" && (snapshot.ticker === null || typeof snapshot.ticker === "object");
}

export function useArtNews(categoryId = "") {
  const { language } = useLanguage();
  const cacheKey = `art-news:${language}:feed-v2:${categoryId || "all"}`;
  const cached = peekResourceCache<NewsSnapshot>(cacheKey);
  const [snapshot, setSnapshot] = useState<NewsSnapshot>(cached ?? EMPTY_SNAPSHOT);
  const [status, setStatus] = useState<"loading" | "success" | "error">(cached ? "success" : "loading");
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState(false);
  const pageCursor = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const activeCacheKey = useRef(cacheKey);
  activeCacheKey.current = cacheKey;

  const refresh = useCallback((force = false) => {
    if (!peekResourceCache<NewsSnapshot>(cacheKey)) setStatus("loading");
    return refreshResourceCache(cacheKey, async () => {
      const [headlines, pinnedItems, categories, ticker] = await Promise.all([
        listHeadlineNews(),
        listPinnedNews(4),
        listNewsCategories().catch(() => []),
        listTickerNews().catch(() => null)
      ]);
      const categoryLabels = new Map(categories.map((category) => [category.id, category.label]));
      const headlineIds = new Set(headlines.map((item) => item.id));
      const pinned = uniqueNews(pinnedItems).filter((item) => !headlineIds.has(item.id));
      const editorialFallback = pinned.length < 4
        ? await listPublishedNewsPage(4 - pinned.length, null, { excludedIds: new Set([...headlineIds, ...pinned.map((item) => item.id)]) })
        : { items: [] as ArtNewsDocument[] };
      const featured = uniqueNews([...pinned, ...editorialFallback.items]).filter((item) => !headlineIds.has(item.id)).slice(0, 4);
      const page = await listPublishedNewsPage(12, null, {
        categoryId: categoryId || undefined,
        excludedIds: new Set([...headlineIds, ...featured.map((item) => item.id)]),
        feedOnly: true
      });
      if (activeCacheKey.current === cacheKey) {
        pageCursor.current = page.cursor;
        setHasMore(page.hasMore);
        setLoadMoreError(false);
      }
      const next = {
        items: page.items.map((item) => ({ ...item, categoryLabel: item.categoryLabel ?? categoryLabels.get(item.categoryId) })),
        headlines: headlines.map((item) => ({ ...item, categoryLabel: item.categoryLabel ?? categoryLabels.get(item.categoryId) })),
        pinned: featured.map((item) => ({ ...item, categoryLabel: item.categoryLabel ?? categoryLabels.get(item.categoryId) })),
        categories,
        ticker: ticker ? { ...ticker, categoryLabel: ticker.categoryLabel ?? categoryLabels.get(ticker.categoryId) } : null,
        hasMore: page.hasMore
      };
      void saveResourceCache(`art-news:${language}:headlines`, next.headlines);
      return next;
    }, force).then((next) => {
      if (activeCacheKey.current !== cacheKey) return next;
      setSnapshot(next);
      setHasMore(next.hasMore);
      setStatus("success");
      return next;
    }).catch((error) => {
      if (activeCacheKey.current === cacheKey) setStatus("error");
      throw error;
    });
  }, [cacheKey, categoryId, language]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(false);
    const excludedIds = new Set([...snapshot.headlines, ...snapshot.pinned, ...snapshot.items].map((item) => item.id));
    try {
      const page = await listPublishedNewsPage(12, pageCursor.current, { categoryId: categoryId || undefined, excludedIds, feedOnly: true });
      if (activeCacheKey.current !== cacheKey) return;
      pageCursor.current = page.cursor;
      setHasMore(page.hasMore);
      setSnapshot((current) => {
        const categoryLabels = new Map(current.categories.map((category) => [category.id, category.label]));
        const items = uniqueNews([...current.items, ...page.items.map((item) => ({ ...item, categoryLabel: item.categoryLabel ?? categoryLabels.get(item.categoryId) }))]);
        const next = { ...current, items, hasMore: page.hasMore };
        void saveResourceCache(cacheKey, next);
        return next;
      });
    } catch {
      if (activeCacheKey.current === cacheKey) setLoadMoreError(true);
    } finally {
      if (activeCacheKey.current === cacheKey) setLoadingMore(false);
    }
  }, [cacheKey, categoryId, hasMore, loadingMore, snapshot.headlines, snapshot.items, snapshot.pinned]);
  const forceRefresh = useCallback(() => refresh(true), [refresh]);

  useEffect(() => {
    let active = true;
    pageCursor.current = null;
    setHasMore(true);
    setLoadingMore(false);
    setLoadMoreError(false);
    const memory = peekResourceCache<NewsSnapshot>(cacheKey);
    if (memory) {
      setSnapshot(memory);
      setHasMore(memory.hasMore);
      setStatus("success");
    } else {
      setSnapshot(EMPTY_SNAPSHOT);
      setStatus("loading");
      void loadResourceCache(cacheKey, isNewsSnapshot).then((disk) => {
        if (!active || !disk) return;
        setSnapshot(disk);
        setHasMore(disk.hasMore);
        setStatus("success");
      });
    }
    void refresh().catch(() => undefined);
    return () => {
      active = false;
    };
  }, [cacheKey, refresh]);

  return useMemo(() => {
    const fallbackHeadlines = snapshot.items.filter((item) => item.featured);
    const headlines = uniqueNews(snapshot.headlines.length ? snapshot.headlines : fallbackHeadlines).slice(0, 5);
    const headlineIds = new Set(headlines.map((item) => item.id));
    const pinned = uniqueNews(snapshot.pinned).filter((item) => !headlineIds.has(item.id));
    const reservedIds = new Set([...headlines, ...pinned].map((item) => item.id));
    const items = uniqueNews(snapshot.items).filter((item) => item.showInFeed !== false && !reservedIds.has(item.id));
    return {
      language,
      headlines,
      ticker: snapshot.ticker,
      pinned,
      latest: items.filter((item) => item.showInLatest !== false).slice(0, 9),
      items,
      allItems: snapshot.items,
      categories: snapshot.categories,
      status,
      hasMore,
      loadingMore,
      loadMoreError,
      loadMore,
      revalidate: refresh,
      refresh: forceRefresh
    };
  }, [forceRefresh, hasMore, language, loadMore, loadMoreError, loadingMore, refresh, snapshot, status]);
}

export function useArtNewsHeadlines() {
  const { language } = useLanguage();
  const cacheKey = `art-news:${language}:headlines`;
  const cached = peekResourceCache<ArtNewsDocument[]>(cacheKey);
  const [items, setItems] = useState<ArtNewsDocument[]>(cached ?? []);

  useEffect(() => {
    let active = true;
    const memory = peekResourceCache<ArtNewsDocument[]>(cacheKey);
    if (memory) setItems(memory);
    if (!memory) {
      void loadResourceCache(cacheKey, isNewsArray).then((disk) => {
        if (active && disk) setItems(disk);
      });
    }
    void refreshResourceCache(cacheKey, async () => {
      const [headlines, categories] = await Promise.all([listHeadlineNews(5), listNewsCategories().catch(() => [])]);
      const categoryLabels = new Map(categories.map((category) => [category.id, category.label]));
      return uniqueNews(headlines).slice(0, 5).map((item) => ({ ...item, categoryLabel: item.categoryLabel ?? categoryLabels.get(item.categoryId) }));
    }).then((next) => {
      if (active) setItems(next);
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, [cacheKey]);

  return items;
}

function uniqueNews(items: ArtNewsDocument[]) {
  const known = new Set<string>();
  return items.filter((item) => {
    if (!item.id || known.has(item.id)) return false;
    known.add(item.id);
    return true;
  });
}

function isNewsArray(value: unknown): value is ArtNewsDocument[] {
  return Array.isArray(value) && value.every((item) => Boolean(item && typeof item === "object" && "id" in item));
}

export function useArtNewsDetail(id: string) {
  const cacheKey = `art-news:item:${id}`;
  const cached = peekResourceCache<ArtNewsDocument>(cacheKey);
  const [item, setItem] = useState<ArtNewsDocument | null>(cached);
  const [status, setStatus] = useState<"loading" | "success" | "error">(cached ? "success" : "loading");

  useEffect(() => {
    let active = true;
    void loadResourceCache(cacheKey, (value): value is ArtNewsDocument => Boolean(value && typeof value === "object" && "id" in value)).then((disk) => {
      if (!active || !disk) return;
      setItem(disk);
      setStatus("success");
    });
    void refreshResourceCache(cacheKey, () => getPublishedNews(id)).then((next) => {
      if (!active) return;
      setItem(next);
      setStatus(next ? "success" : "error");
    }).catch(() => {
      if (active) setStatus("error");
    });
    return () => {
      active = false;
    };
  }, [cacheKey, id]);

  return { item, status };
}
