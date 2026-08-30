import { collection, documentId, getDocsFromServer, limit, orderBy, query, startAfter, type QueryDocumentSnapshot } from "firebase/firestore";
import { BadgeId, UserRoleId } from "@/constants/profile-taxonomy";
import { firestoreDb } from "./core";
import { findCountryByCode, findCountryByInput } from "@/utils/country-utils";
import { isPremiumDataActive } from "@/utils/premium-status";

export const PROFILE_DISCOVERY_PAGE_SIZE = 20;
export const PROFILE_DISCOVERY_SESSION_LIMIT = 100;

export type SuggestedUser = {
  uid?: string;
  name: string;
  username: string;
  image: string;
  role: UserRoleId;
  badges?: BadgeId[];
  isPremium?: boolean;
  isDisabled?: boolean;
  isAdmin?: boolean;
  isProfileVisible?: boolean;
  showInCountryExplore?: boolean;
  country?: string;
  countryId?: string;
  countryCode?: string;
  language?: "tr" | "en" | "ru" | "uz";
  lastActiveMinutesAgo?: number;
  followersCount?: number;
  followingCount?: number;
  bio?: string;
  interests?: string[];
  createdAtMs?: number;
};

export type ProfileDiscoveryPage = {
  users: SuggestedUser[];
  cursor: QueryDocumentSnapshot | null;
  hasMore: boolean;
};

export async function fetchProfileDiscoveryPage(cursor?: QueryDocumentSnapshot | null): Promise<ProfileDiscoveryPage> {
  const snapshot = await getDocsFromServer(cursor
    ? query(collection(firestoreDb, "users"), orderBy(documentId()), startAfter(cursor), limit(PROFILE_DISCOVERY_PAGE_SIZE))
    : query(collection(firestoreDb, "users"), orderBy(documentId()), limit(PROFILE_DISCOVERY_PAGE_SIZE)));
  return {
    users: snapshot.docs
      .map((item) => mapProfileDiscoveryUser(item.id, item.data()))
      .filter((item): item is SuggestedUser => Boolean(item)),
    cursor: snapshot.docs[snapshot.docs.length - 1] ?? null,
    hasMore: snapshot.docs.length === PROFILE_DISCOVERY_PAGE_SIZE
  };
}

export function mapProfileDiscoveryUser(uid: string, data: Record<string, unknown>): SuggestedUser | undefined {
  const username = typeof data.username === "string" ? data.username.trim().replace(/^@+/, "") : "";
  if (!uid || !username || data.deleted === true || data.accountDeleted === true || data.isDeleted === true) return undefined;
  const country = typeof data.country === "string" && data.country.trim() ? data.country.trim() : undefined;
  const countryCode = typeof data.countryCode === "string" && data.countryCode.trim() ? data.countryCode.trim().toUpperCase() : undefined;
  const countryMatch = findCountryByCode(countryCode) ?? (country ? findCountryByInput(country) : null)
    ?? (typeof data.countryId === "string" ? findCountryByInput(data.countryId) : null);
  const badges = Array.from(new Set([
    ...readBadges(data.badges),
    ...readBadges(data.systemBadges),
    ...readBadges(data.adminBadges)
  ]));
  return {
    uid,
    name: typeof data.displayName === "string" && data.displayName.trim() ? data.displayName.trim() : username,
    username,
    image: typeof data.photoURL === "string" ? data.photoURL.trim() : "",
    role: mapFirestoreRole(data.appRole ?? data.role),
    badges,
    isPremium: isPremiumDataActive(data),
    isDisabled: data.isDisabled === true,
    isAdmin: data.role === "admin",
    isProfileVisible: data.isProfileVisible !== false,
    showInCountryExplore: data.showInCountryExplore !== false,
    country,
    countryId: countryMatch?.id,
    countryCode: countryMatch?.code,
    language: mapFirestoreLanguage(data.language),
    lastActiveMinutesAgo: timestampAgeMinutes(data.lastActiveAt ?? data.updatedAt),
    followersCount: typeof data.followersCount === "number" ? Math.max(0, data.followersCount) : 0,
    followingCount: typeof data.followingCount === "number" ? Math.max(0, data.followingCount) : 0,
    bio: typeof data.bio === "string" ? data.bio.trim() : "",
    interests: Array.isArray(data.interests) ? data.interests.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).map((item) => item.trim()) : [],
    createdAtMs: timestampToMillis(data.createdAt)
  };
}

export function profileDiscoveryErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") return { code: "unknown" };
  return {
    code: "code" in error && typeof error.code === "string" ? error.code : "unknown",
    message: "message" in error && typeof error.message === "string" ? error.message : undefined,
    collection: "users",
    query: "orderBy(__name__) + cursor + limit(20)"
  };
}

function readBadges(value: unknown) {
  return Array.isArray(value) ? value.filter(isBadgeId) : [];
}

function isBadgeId(value: unknown): value is BadgeId {
  return value === "premium" || value === "weekly_winner" || value === "quiz_master" || value === "museum_explorer" || value === "editor_pick" || value === "trusted_member" || value === "top_writer" || value === "duel_champion" || value === "lucky_one";
}

function mapFirestoreRole(value: unknown): UserRoleId {
  if (value === "artist" || value === "curator" || value === "art_patron" || value === "verified_gallery" || value === "museum" || value === "critic" || value === "collector" || value === "researcher" || value === "educator") return value;
  return "art_lover";
}

function mapFirestoreLanguage(value: unknown): SuggestedUser["language"] {
  return value === "tr" || value === "en" || value === "ru" || value === "uz" ? value : undefined;
}

function timestampAgeMinutes(value: unknown) {
  const milliseconds = timestampToMillis(value);
  return milliseconds ? Math.max(0, Math.floor((Date.now() - milliseconds) / 60_000)) : undefined;
}

function timestampToMillis(value: unknown) {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") return value.toMillis();
  return 0;
}
