import { CommunityImageDocument, LanguageCode } from "@/src/types/firestore";
import { createDocument, deleteDocument, firestoreQuery, getDocument, listDocuments, updateDocument } from "@/src/services/firebase/firestore-helpers";
import { collection, limit as firestoreLimit, onSnapshot, query, where } from "firebase/firestore";
import { firestoreDb } from "./core";

type CommunityImageCreateInput = Omit<CommunityImageDocument, "id" | "createdAt" | "updatedAt" | "status" | "likeCount" | "dislikeCount" | "netScore" | "reviewedBy" | "reviewedAt"> & {
  status?: CommunityImageDocument["status"];
};

export async function submitCommunityImage(input: CommunityImageCreateInput): Promise<string> {
  return createDocument<CommunityImageDocument>("communityImages", {
    ...input,
    status: input.status ?? "pending",
    likeCount: 0,
    dislikeCount: 0,
    netScore: 0,
    reviewedBy: "",
    reviewedAt: null
  });
}

export async function getCommunityImage(id: string): Promise<CommunityImageDocument | null> {
  return getDocument<CommunityImageDocument>("communityImages", id);
}

export async function listPublishedCommunityImages(language?: LanguageCode, maxResults = 50, weekId?: string): Promise<CommunityImageDocument[]> {
  const queryLimit = weekId ? Math.max(maxResults, 150) : maxResults;
  const constraints = [
    ...(language ? [firestoreQuery.where("language", "==", language)] : []),
    firestoreQuery.limit(queryLimit)
  ];

  return filterPublishedCommunityImages(await listDocuments<CommunityImageDocument>("communityImages", [
    firestoreQuery.where("status", "==", "published"),
    ...constraints
  ]), maxResults, weekId);
}

export function subscribePublishedCommunityImages(
  language: LanguageCode | undefined,
  maxResults: number,
  weekId: string | undefined,
  onChange: (items: CommunityImageDocument[], metadata: { fromCache: boolean }) => void,
  onError?: (error: Error) => void
) {
  const queryLimit = weekId ? Math.max(maxResults, 150) : maxResults;
  const constraints = [
    where("status", "==", "published"),
    ...(language ? [where("language", "==", language)] : []),
    firestoreLimit(queryLimit)
  ];

  return onSnapshot(query(collection(firestoreDb, "communityImages"), ...constraints), (snapshot) => {
    onChange(
      filterPublishedCommunityImages(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as CommunityImageDocument), maxResults, weekId),
      { fromCache: snapshot.metadata.fromCache }
    );
  }, onError);
}

function filterPublishedCommunityImages(items: CommunityImageDocument[], maxResults: number, weekId?: string) {
  const visibleItems = items.filter((item) => {
    const record = item as CommunityImageDocument & { isDeleted?: boolean; deletedAt?: unknown };
    return record.isDeleted !== true
      && record.deletedAt == null
      && !record.deletedByAdmin
      && !record.deletedByUser
      && !record.competitionWeekArchived
      && !record.rankingHidden
      && record.archivedAt == null;
  });
  if (!weekId) return visibleItems.slice(0, maxResults);

  const weekMatches = visibleItems.filter((item) => matchesActiveWeek(item.weekId, weekId));

  return weekMatches.slice(0, maxResults);
}

function matchesActiveWeek(itemWeekId: string | undefined, activeWeekId: string) {
  if (!itemWeekId) return false;
  if (itemWeekId === activeWeekId) return true;
  return extractWeekPeriod(itemWeekId) === extractWeekPeriod(activeWeekId);
}

function extractWeekPeriod(weekId: string) {
  return weekId.split("~")[0] ?? weekId;
}

/** Profilde gösterilecek tüm onaylı görseller (yarışma haftası arşivinden bağımsız). */
export async function listProfileGalleryImages(maxResults = 300): Promise<CommunityImageDocument[]> {
  const [published, archivedCompetition] = await Promise.all([
    listDocuments<CommunityImageDocument>("communityImages", [
      firestoreQuery.where("status", "==", "published"),
      firestoreQuery.limit(maxResults)
    ]).catch(() => []),
    listDocuments<CommunityImageDocument>("communityImages", [
      firestoreQuery.where("status", "==", "archived"),
      firestoreQuery.where("competitionEntry", "==", true),
      firestoreQuery.limit(maxResults)
    ]).catch(() => [])
  ]);

  const merged = new Map<string, CommunityImageDocument>();
  published.forEach((item) => merged.set(item.id, item));
  archivedCompetition
    .filter((item) => !item.deletedByUser && !item.deletedByAdmin)
    .forEach((item) => merged.set(item.id, item));

  return Array.from(merged.values());
}

export async function listOwnPendingCommunityImages(ownerId: string, weekId?: string, maxResults = 40): Promise<CommunityImageDocument[]> {
  if (!ownerId) return [];
  const constraints = [
    firestoreQuery.where("ownerId", "==", ownerId),
    firestoreQuery.limit(Math.max(maxResults, 80))
  ];
  const items = await listDocuments<CommunityImageDocument>("communityImages", constraints);
  return items.filter((item) => {
    if (item.deletedByAdmin || item.deletedByUser || item.competitionWeekArchived || item.archivedAt != null) return false;
    if (item.status === "rejected") return false;
    if (!weekId) return true;
    return matchesActiveWeek(item.weekId, weekId);
  }).slice(0, maxResults);
}

export async function listUserCompetitionEntries(ownerId: string, maxResults = 200): Promise<CommunityImageDocument[]> {
  if (!ownerId) return [];
  const items = await listDocuments<CommunityImageDocument>("communityImages", [
    firestoreQuery.where("ownerId", "==", ownerId),
    firestoreQuery.limit(maxResults)
  ]);
  return items.filter((item) => item.competitionEntry
    && item.status !== "rejected"
    && !item.deletedByAdmin
    && !item.deletedByUser);
}

export async function updateCommunityImage(id: string, input: Partial<Omit<CommunityImageDocument, "id" | "createdAt" | "updatedAt">>): Promise<void> {
  return updateDocument<CommunityImageDocument>("communityImages", id, input);
}

export async function deleteCommunityImage(id: string): Promise<void> {
  return deleteDocument("communityImages", id);
}

export type RewardedBoostCreditDocument = {
  id: string;
  uid: string;
  username: string;
  weekId: string;
  credits: number;
  lastAdWatchedAt: number;
  createdAt: unknown;
  updatedAt: unknown;
};

export async function getRewardedBoostCredit(uid: string, weekId: string): Promise<RewardedBoostCreditDocument | null> {
  return getDocument<RewardedBoostCreditDocument>("rewardedBoostCredits", `${uid}_${weekId}`);
}

export async function saveRewardedBoostCredit(input: Omit<RewardedBoostCreditDocument, "createdAt" | "updatedAt">): Promise<string> {
  return createDocument<RewardedBoostCreditDocument>("rewardedBoostCredits", input);
}
