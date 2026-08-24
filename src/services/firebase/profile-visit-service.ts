import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, doc, getDocsFromServer, limit, orderBy, query, serverTimestamp, setDoc, Timestamp, updateDoc, where } from "firebase/firestore";
import { firebaseAuth, firestoreDb } from "./core";

const CACHE_PREFIX = "art-atlas:profile-visits:v1";
const LOCAL_RECORD_COOLDOWN_MS = 30 * 1000;
const PROFILE_VISIT_LIMIT = 50;
const PROFILE_VISIT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const recentRecords = new Map<string, number>();
const memorySnapshots = new Map<string, ProfileVisitSnapshot>();

export type ProfileVisitVisibility = "visible" | "anonymous";

export type ProfileVisitSummary = {
  id: string;
  firstVisitedAt: number;
  lastVisitedAt: number;
  visitCount: number;
  anonymous: boolean;
};

export type ProfileVisitIdentity = {
  id: string;
  visibilityMode: ProfileVisitVisibility;
  visitorUid?: string;
  visitorName?: string;
  visitorUsername?: string;
  visitorPhotoURL?: string;
};

export type ProfileVisitSnapshot = {
  ownerUid: string;
  summaries: ProfileVisitSummary[];
  identities: ProfileVisitIdentity[];
  lastViewedAt: number;
};

export async function recordProfileVisit(ownerUid: string) {
  const visitorUid = firebaseAuth.currentUser?.uid;
  if (!visitorUid || !ownerUid || visitorUid === ownerUid) return;
  const key = `${ownerUid}:${visitorUid}`;
  const lastRecordedAt = recentRecords.get(key) ?? 0;
  if (Date.now() - lastRecordedAt < LOCAL_RECORD_COOLDOWN_MS) return;

  await setDoc(doc(firestoreDb, "profileVisitSignals", `${ownerUid}_${visitorUid}`), {
    ownerUid,
    visitorUid,
    requestedAt: serverTimestamp()
  }, { merge: true });
  recentRecords.set(key, Date.now());
}

export async function saveProfileVisitVisibility(uid: string, visibility: ProfileVisitVisibility) {
  await updateDoc(doc(firestoreDb, "users", uid), {
    profileVisitVisibility: visibility,
    updatedAt: serverTimestamp()
  });
}

export async function loadProfileVisitCache(ownerUid: string) {
  const memory = memorySnapshots.get(ownerUid);
  if (memory?.ownerUid === ownerUid) return memory;
  const raw = await AsyncStorage.getItem(cacheKey(ownerUid));
  const parsed = raw ? safeJson<ProfileVisitSnapshot>(raw) : null;
  if (!parsed || !Array.isArray(parsed.summaries) || !Array.isArray(parsed.identities)) return null;
  if (parsed.ownerUid && parsed.ownerUid !== ownerUid) return null;
  const snapshot = { ...parsed, ownerUid };
  memorySnapshots.set(ownerUid, snapshot);
  return snapshot;
}

export async function fetchProfileVisits(ownerUid: string, includeIdentities: boolean) {
  if (!ownerUid || firebaseAuth.currentUser?.uid !== ownerUid) {
    throw new ProfileVisitServiceError("auth/not-ready", "Profile visits require the active owner's session.");
  }
  const sevenDaysAgo = Timestamp.fromMillis(Date.now() - PROFILE_VISIT_WINDOW_MS);
  const summaryQuery = query(
    collection(firestoreDb, "profileVisitSummaries", ownerUid, "visitors"),
    where("lastVisitedAt", ">=", sevenDaysAgo),
    orderBy("lastVisitedAt", "desc"),
    limit(PROFILE_VISIT_LIMIT)
  );
  const identityQuery = query(
    collection(firestoreDb, "profileVisitViews", ownerUid, "visitors"),
    where("lastVisitedAt", ">=", sevenDaysAgo),
    orderBy("lastVisitedAt", "desc"),
    limit(PROFILE_VISIT_LIMIT)
  );
  const summarySnapshot = await getDocsFromServer(summaryQuery);
  const identitySnapshot = includeIdentities
    ? await getDocsFromServer(identityQuery).catch((error) => {
      console.warn("[Profile visits] Identity view query failed; summary data remains available.", profileVisitErrorDetails(error));
      return null;
    })
    : null;
  const cached = await loadProfileVisitCache(ownerUid);
  const snapshot: ProfileVisitSnapshot = {
    ownerUid,
    summaries: summarySnapshot.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        firstVisitedAt: timestampToMillis(data.firstVisitedAt),
        lastVisitedAt: timestampToMillis(data.lastVisitedAt),
        visitCount: typeof data.visitCount === "number" ? Math.max(1, data.visitCount) : 1,
        anonymous: data.anonymous === true
      };
    }),
    identities: identitySnapshot?.docs.map((item) => {
      const data = item.data();
      return {
        id: item.id,
        visibilityMode: data.visibilityMode === "anonymous" ? "anonymous" : "visible",
        visitorUid: typeof data.visitorUid === "string" ? data.visitorUid : undefined,
        visitorName: typeof data.visitorName === "string" ? data.visitorName : undefined,
        visitorUsername: typeof data.visitorUsername === "string" ? data.visitorUsername : undefined,
        visitorPhotoURL: typeof data.visitorPhotoURL === "string" ? data.visitorPhotoURL : undefined
      };
    }) ?? cached?.identities ?? [],
    lastViewedAt: cached?.lastViewedAt ?? 0
  };
  await saveProfileVisitSnapshot(snapshot);
  return snapshot;
}

export async function markProfileVisitsViewed(ownerUid: string, snapshot: ProfileVisitSnapshot) {
  const next = { ...snapshot, lastViewedAt: Date.now() };
  await saveProfileVisitSnapshot(next);
  return next.lastViewedAt;
}

export function profileVisitErrorDetails(error: unknown) {
  if (!error || typeof error !== "object") return { code: "unknown" };
  const code = "code" in error && typeof error.code === "string" ? error.code : "unknown";
  const message = "message" in error && typeof error.message === "string" ? error.message : undefined;
  return { code, message };
}

class ProfileVisitServiceError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "ProfileVisitServiceError";
  }
}

async function saveProfileVisitSnapshot(snapshot: ProfileVisitSnapshot) {
  memorySnapshots.set(snapshot.ownerUid, snapshot);
  await AsyncStorage.setItem(cacheKey(snapshot.ownerUid), JSON.stringify(snapshot));
}

function cacheKey(ownerUid: string) {
  return `${CACHE_PREFIX}:${ownerUid}`;
}

function timestampToMillis(value: unknown) {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  return 0;
}

function safeJson<T>(raw: string) {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
