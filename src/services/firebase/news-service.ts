import { ArtNewsCategoryDocument, ArtNewsDocument, ArtNewsTranslation, LanguageCode, LocalizedString } from "@/src/types/firestore";
import { firestoreQuery, getDocument, listDocuments } from "@/src/services/firebase/firestore-helpers";
import { collection, DocumentData, getDocs, limit, orderBy, query, QueryDocumentSnapshot, startAfter, where } from "firebase/firestore";
import { firestoreDb } from "@/src/services/firebase/core";

export async function listPublishedNewsPage(
  maxResults = 12,
  cursor?: QueryDocumentSnapshot<DocumentData> | null,
  options?: { categoryId?: string; excludedIds?: ReadonlySet<string>; feedOnly?: boolean }
) {
  const items: ArtNewsDocument[] = [];
  const batchSize = 13;
  const maxBatches = Math.max(10, Math.ceil(((options?.excludedIds?.size ?? 0) + maxResults) / batchSize) + 1);
  let nextCursor = cursor ?? null;
  let hasMore = true;
  let batches = 0;

  while (items.length < maxResults && hasMore && batches < maxBatches) {
    const constraints = [
      where("status", "==", "published"),
      ...(options?.categoryId ? [where("categoryId", "==", options.categoryId)] : []),
      orderBy("publishedAt", "desc")
    ];
    const snapshot = await getDocs(query(collection(firestoreDb, "news"), ...constraints, ...(nextCursor ? [startAfter(nextCursor)] : []), limit(batchSize)));
    batches += 1;
    let consumedAll = true;
    for (const document of snapshot.docs) {
      nextCursor = document;
      if (options?.excludedIds?.has(document.id)) continue;
      const item = normalizeNewsDocument(document.id, document.data());
      if (options?.feedOnly && item.showInFeed === false) continue;
      items.push(item);
      if (items.length === maxResults) {
        consumedAll = document.id === snapshot.docs.at(-1)?.id;
        break;
      }
    }
    hasMore = !consumedAll || snapshot.size === batchSize;
    if (!snapshot.size) hasMore = false;
  }

  return { items, cursor: nextCursor, hasMore };
}

export async function listHeadlineNews(maxResults = 5) {
  const items = await listDocuments<ArtNewsDocument>("news", [
    firestoreQuery.where("status", "==", "published"),
    firestoreQuery.where("featured", "==", true),
    firestoreQuery.orderBy("headlineOrder", "asc"),
    firestoreQuery.limit(maxResults)
  ]);
  return items.map((item) => normalizeNewsDocument(item.id, item)).slice(0, maxResults);
}

export async function listPinnedNews(maxResults = 2) {
  const items = await listDocuments<ArtNewsDocument>("news", [
    firestoreQuery.where("status", "==", "published"),
    firestoreQuery.where("pinned", "==", true),
    firestoreQuery.orderBy("pinOrder", "asc"),
    firestoreQuery.limit(maxResults)
  ]);
  return items.map((item) => normalizeNewsDocument(item.id, item));
}

export async function listTickerNews() {
  const items = await listDocuments<ArtNewsDocument>("news", [
    firestoreQuery.where("status", "==", "published"),
    firestoreQuery.where("ticker", "==", true),
    firestoreQuery.limit(1)
  ]);
  return items.map((item) => normalizeNewsDocument(item.id, item))[0] ?? null;
}

export async function listNewsCategories() {
  return listDocuments<ArtNewsCategoryDocument>("newsCategories", [
    firestoreQuery.where("active", "==", true),
    firestoreQuery.orderBy("order", "asc")
  ]);
}

export async function getPublishedNews(id: string) {
  const item = await getDocument<ArtNewsDocument>("news", id);
  return item?.status === "published" ? normalizeNewsDocument(item.id, item) : null;
}

function normalizeNewsDocument(id: string, value: DocumentData) {
  const translations = readTranslations(value.translations);
  const localized = (field: keyof ArtNewsTranslation, legacy: unknown): LocalizedString => {
    if (legacy && typeof legacy === "object") return legacy as LocalizedString;
    return Object.fromEntries(Object.entries(translations).map(([language, translation]) => [language, translation[field]])) as LocalizedString;
  };
  return {
    ...value,
    id,
    translations,
    title: localized("title", value.title),
    headlineTitle: localized("headlineTitle", value.headlineTitle),
    spot: localized("excerpt", value.spot),
    body: localized("content", value.body),
    coverImage: typeof value.coverImage === "string" ? value.coverImage : "",
    coverThumbnail: typeof value.coverThumbnail === "string" ? value.coverThumbnail : typeof value.thumbnailImage === "string" ? value.thumbnailImage : "",
    coverMedium: typeof value.coverMedium === "string" ? value.coverMedium : "",
    thumbnailImage: typeof value.thumbnailImage === "string" ? value.thumbnailImage : typeof value.coverThumbnail === "string" ? value.coverThumbnail : "",
    featured: value.featured === true,
    headlineOrder: Number(value.headlineOrder) || 0,
    readingMinutes: Math.max(1, Number(value.readingMinutes ?? value.readingTime) || 1)
  } as ArtNewsDocument;
}

function readTranslations(value: unknown) {
  if (!value || typeof value !== "object") return {} as Partial<Record<LanguageCode, ArtNewsTranslation>>;
  const record = value as Record<string, unknown>;
  return Object.fromEntries((["tr", "en", "ru", "uz"] as const).flatMap((language) => {
    const raw = record[language];
    if (!raw || typeof raw !== "object") return [];
    const item = raw as Record<string, unknown>;
    return [[language, {
      title: typeof item.title === "string" ? item.title : "",
      headlineTitle: typeof item.headlineTitle === "string" ? item.headlineTitle : "",
      excerpt: typeof item.excerpt === "string" ? item.excerpt : "",
      content: typeof item.content === "string" ? item.content : ""
    }]];
  })) as Partial<Record<LanguageCode, ArtNewsTranslation>>;
}

export function localizeNews(value: LocalizedString | undefined, language: LanguageCode) {
  if (!value) return "";
  return value[language] ?? value.tr ?? value.en ?? value.ru ?? value.uz ?? "";
}
