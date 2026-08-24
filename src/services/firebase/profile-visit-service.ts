import AsyncStorage from "@react-native-async-storage/async-storage";
import { collection, doc, getDocs, getDocsFromServer, limit, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { firebaseAuth, firestoreDb } from "./core";

const CACHE_PREFIX = "art-atlas:profile-visits:v1";
const LOCAL_RECORD_COOLDOWN_MS = 30 * 1000;
const PROFILE_VISIT_LIMIT = 50;
const recentRecords = new Map<string, number>();

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
  const raw = await AsyncStorage.getItem(cacheKey(ownerUid));
  const parsed = raw ? safeJson<ProfileVisitSnapshot>(raw) : null;
  if (!parsed || !Array.isArray(parsed.summaries) || !Array.isArray(parsed.identities)) return null;
  return parsed;
}

export async function fetchProfileVisits(ownerUid: string, includeIdentities: boolean) {
  const summaryQuery = query(
    collection(firestoreDb, "profileVisitSummaries", ownerUid, "visitors"),
    orderBy("lastVisitedAt", "desc"),
    limit(PROFILE_VISIT_LIMIT)
  );
  const identityQuery = query(
    collection(firestoreDb, "profileVisitViews", ownerUid, "visitors"),
    orderBy("lastVisitedAt", "desc"),
    limit(PROFILE_VISIT_LIMIT)
  );
  const [summarySnapshot, identitySnapshot] = await Promise.all([
    getDocsFromServer(summaryQuery).catch(() => getDocs(summaryQuery)),
    includeIdentities ? getDocsFromServer(identityQuery).catch(() => getDocs(identityQuery)) : Promise.resolve(null)
  ]);
  const cached = await loadProfileVisitCache(ownerUid);
  const snapshot: ProfileVisitSnapshot = {
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
    }) ?? [],
    lastViewedAt: cached?.lastViewedAt ?? 0
  };
  await AsyncStorage.setItem(cacheKey(ownerUid), JSON.stringify(snapshot));
  return snapshot;
}

export async function markProfileVisitsViewed(ownerUid: string, snapshot: ProfileVisitSnapshot) {
  const next = { ...snapshot, lastViewedAt: Date.now() };
  await AsyncStorage.setItem(cacheKey(ownerUid), JSON.stringify(next));
  return next.lastViewedAt;
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
