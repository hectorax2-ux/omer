import { useEffect, useMemo, useState } from "react";
import { collection, getDocs, limit, query, where } from "firebase/firestore";
import { ArtStory, Language, LocalizedText } from "@/types/content";
import { firestoreDb } from "@/src/services/firebase";
import { ArtStoryDocument, LocalizedString } from "@/src/types/firestore";
import { useSocial } from "@/hooks/use-social";
import { useRegisterRefresh } from "@/providers/refresh-provider";
import { isResourceArray, loadResourceCache, peekResourceCache, refreshResourceCache } from "@/src/services/cache/resource-cache";
import { startPerformanceSpan } from "@/utils/performance";

import { parseImageFocus } from "@/firebase/shared/image-focus";
import { artStories as bundledArtStories } from "@/data/content";

const languages: Language[] = ["tr", "en", "ru", "uz"];

function localized(value: LocalizedString | string | undefined, fallback = "", documentLanguage?: Language | "all"): LocalizedText {
  if (typeof value === "string") {
    if (documentLanguage && documentLanguage !== "all") {
      return languages.reduce((next, language) => {
        next[language] = language === documentLanguage ? value : "";
        return next;
      }, {} as LocalizedText);
    }
    return { tr: value, en: value, ru: value, uz: value };
  }
  return languages.reduce((next, language) => {
    next[language] = value?.[language] || (documentLanguage && documentLanguage !== "all" ? "" : value?.tr || value?.en || fallback);
    return next;
  }, {} as LocalizedText);
}

function mapStory(id: string, doc: ArtStoryDocument): ArtStory {
  const documentLanguage = doc.language || "all";
  return {
    id,
    language: documentLanguage,
    translationGroupId: doc.translationGroupId,
    image: doc.imageURL || doc.image || "",
    imageFocus: parseImageFocus(doc.imageFocus),
    readTime: localized(doc.readTime, "3 dk", documentLanguage),
    title: localized(doc.title, "", documentLanguage),
    excerpt: localized(doc.excerpt, "", documentLanguage),
    body: localized(doc.body, "", documentLanguage),
    createdAt: doc.createdAt,
    publishedAt: doc.publishedAt,
    source: doc.source === "member" ? "member" : "art_atlas",
    category: doc.category,
    authorId: doc.authorId,
    authorUsername: doc.authorUsername,
    authorDisplayName: doc.authorDisplayName
  };
}

function mergeLocalizedText(current: LocalizedText, next: LocalizedText) {
  return languages.reduce((merged, language) => {
    merged[language] = next[language] || current[language] || "";
    return merged;
  }, {} as LocalizedText);
}

function completeLocalizedText(value: LocalizedText, fallback = "") {
  const firstValue = languages.map((language) => value[language]).find(Boolean) || fallback;
  return languages.reduce((completed, language) => {
    completed[language] = value[language] || firstValue;
    return completed;
  }, {} as LocalizedText);
}

function storyTime(story: ArtStory) {
  return story.publishedAt?.toMillis?.() ?? story.createdAt?.toMillis?.() ?? 0;
}

function legacyTranslationKey(story: ArtStory) {
  if (story.translationGroupId) return story.translationGroupId;
  const timeBucket = Math.floor(storyTime(story) / 60000);
  if (story.source === "art_atlas" && story.image && story.authorUsername && timeBucket) {
    return `${story.image}|${story.authorUsername}|${timeBucket}`;
  }
  return story.id;
}

function mergeStory(current: ArtStory, next: ArtStory): ArtStory {
  return {
    ...current,
    image: current.image || next.image,
    imageFocus: current.imageFocus || next.imageFocus,
    title: mergeLocalizedText(current.title, next.title),
    excerpt: mergeLocalizedText(current.excerpt, next.excerpt),
    body: mergeLocalizedText(current.body, next.body),
    readTime: mergeLocalizedText(current.readTime, next.readTime),
    publishedAt: current.publishedAt || next.publishedAt,
    createdAt: current.createdAt || next.createdAt
  };
}

function mergeStoryTranslations(stories: ArtStory[]) {
  const groups = new Map<string, ArtStory>();
  const usedLanguages = new Map<string, Set<string>>();

  stories.forEach((story) => {
    const key = legacyTranslationKey(story);
    const language = story.language && story.language !== "all" ? story.language : "all";
    const used = usedLanguages.get(key) || new Set<string>();

    if (!story.translationGroupId && language !== "all" && used.has(language)) {
      groups.set(story.id, completeStory(story));
      return;
    }

    used.add(language);
    usedLanguages.set(key, used);
    const existing = groups.get(key);
    groups.set(key, existing ? mergeStory(existing, story) : story);
  });

  return [...groups.values()].map(completeStory);
}

function completeStory(story: ArtStory): ArtStory {
  return {
    ...story,
    title: completeLocalizedText(story.title),
    excerpt: completeLocalizedText(story.excerpt),
    body: completeLocalizedText(story.body),
    readTime: completeLocalizedText(story.readTime, "3 dk")
  };
}

export function useArtStories() {
  const cacheKey = "art-stories:100";
  const initial = peekResourceCache<ArtStory[]>(cacheKey) ?? bundledArtStories;
  const [stories, setStories] = useState<ArtStory[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const { isUserBlocked, isUserSuspended } = useSocial();

  useRegisterRefresh(() => setRefreshCounter((value) => value + 1));

  useEffect(() => {
    let mounted = true;
    let hasCachedData = false;
    const memoryValue = peekResourceCache<ArtStory[]>(cacheKey);
    if (memoryValue) {
      hasCachedData = true;
      setStories(memoryValue);
    }
    setLoading(false);
    setError(false);
    const storiesQuery = query(
      collection(firestoreDb, "artStories"),
      where("status", "==", "published"),
      limit(100)
    );

    async function load() {
      const cached = memoryValue ?? await loadResourceCache(cacheKey, isArtStoryArray);
      if (!mounted) return;
      if (cached) {
        hasCachedData = true;
        setStories(cached);
        setLoading(false);
      }
      const span = startPerformanceSpan("catalog.artStories.100");
      try {
        const next = await refreshResourceCache(cacheKey, async () => {
          const snapshot = await getDocs(storiesQuery);
          return mergeStoryTranslations(snapshot.docs.map((item) => mapStory(item.id, item.data() as ArtStoryDocument)));
        }, refreshCounter > 0);
        if (!mounted) return;
        setStories(next.length ? next : bundledArtStories);
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
  }, [refreshCounter]);

  const visibleStories = useMemo(
    () => stories.filter((story) => !isUserSuspended({
      uid: story.authorId,
      username: story.authorUsername,
      author: story.authorDisplayName
    }) && !isUserBlocked({
      uid: story.authorId,
      username: story.authorUsername,
      author: story.authorDisplayName
    })),
    [isUserBlocked, isUserSuspended, stories]
  );

  return { stories: visibleStories, loading, error };
}

function isArtStory(value: unknown): value is ArtStory {
  if (!value || typeof value !== "object") return false;
  const story = value as Partial<ArtStory>;
  return typeof story.id === "string" && typeof story.image === "string" && Boolean(story.title);
}

function isArtStoryArray(value: unknown): value is ArtStory[] {
  return isResourceArray(value, isArtStory);
}
