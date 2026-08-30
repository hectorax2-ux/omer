import { collection, doc, getDocFromServer, getDocsFromServer, limit, onSnapshot, query, serverTimestamp, setDoc, Unsubscribe, updateDoc, where } from "firebase/firestore";
import { firestoreDb } from "./core";
import { UserProfileDocument } from "@/src/types/firestore";
import { getDocument, listDocuments, firestoreQuery, withId } from "@/src/services/firebase/firestore-helpers";
import { getCountryProfileFields } from "@/utils/country-utils";

export type EditableUserProfile = Pick<UserProfileDocument, "username" | "displayName" | "photoURL" | "country" | "countryCode" | "city" | "bio" | "interests" | "socialLinks" | "showInCountryExplore">;

export async function createUserDocument(input: Omit<UserProfileDocument, "id" | "createdAt" | "updatedAt" | "role" | "systemBadges" | "adminBadges" | "followersCount" | "followingCount" | "isDisabled">): Promise<void> {
  await setDoc(doc(firestoreDb, "users", input.uid), {
    ...input,
    ...getCountryProfileFields(input),
    role: "user",
    systemBadges: [],
    adminBadges: [],
    followersCount: 0,
    followingCount: 0,
    isDisabled: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function getUserDocument(uid: string): Promise<UserProfileDocument | null> {
  return getDocument<UserProfileDocument>("users", uid);
}

export async function getUserDocumentFromServer(uid: string): Promise<UserProfileDocument | null> {
  const snapshot = await getDocFromServer(doc(firestoreDb, "users", uid));
  return snapshot.exists() ? withId<UserProfileDocument>(snapshot.id, snapshot.data()) : null;
}

export async function updateOwnUserProfile(uid: string, input: Partial<EditableUserProfile>): Promise<void> {
  await updateDoc(doc(firestoreDb, "users", uid), {
    ...input,
    ...(input.country !== undefined || input.countryCode !== undefined ? getCountryProfileFields(input) : {}),
    updatedAt: serverTimestamp()
  });
}

export async function setUserSuspensionStatus(uid: string, suspended: boolean): Promise<void> {
  await updateDoc(doc(firestoreDb, "users", uid), {
    isDisabled: suspended,
    updatedAt: serverTimestamp()
  });
}

export async function findUserByUsername(username: string): Promise<UserProfileDocument | null> {
  const normalized = username.trim().replace(/^@+/, "");
  if (!normalized) return null;
  return findNewestUserByFieldFromServer("username", normalized);
}

export async function findUserByIdentity(slug: string): Promise<UserProfileDocument | null> {
  const trimmed = slug.trim().replace(/^@+/, "");
  if (!trimmed) return null;

  if (trimmed.length >= 20 && !trimmed.includes(" ")) {
    const byUid = await getUserDocumentFromServer(trimmed);
    if (byUid) return byUid;
  }

  const lowered = trimmed.toLocaleLowerCase("tr");
  const [byUsername, loweredUsername, byDisplayName] = await Promise.all([
    findUserByUsername(trimmed),
    lowered !== trimmed ? findUserByUsername(lowered) : Promise.resolve(null),
    findNewestUserByFieldFromServer("displayName", trimmed)
  ]);
  return byUsername ?? loweredUsername ?? byDisplayName;
}

async function findNewestUserByFieldFromServer(field: "username" | "displayName", value: string) {
  const snapshot = await getDocsFromServer(query(collection(firestoreDb, "users"), where(field, "==", value), limit(20)));
  return snapshot.docs
    .map((item) => withId<UserProfileDocument>(item.id, item.data()))
    .sort((left, right) => timestampToMillis(right.updatedAt) - timestampToMillis(left.updatedAt))[0] ?? null;
}

function timestampToMillis(value: unknown) {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  return 0;
}

export function subscribeUserProfile(uid: string, onChange: (profile: UserProfileDocument | null) => void): Unsubscribe {
  return onSnapshot(doc(firestoreDb, "users", uid), (snapshot) => {
    if (!snapshot.exists()) {
      onChange(null);
      return;
    }
    if (snapshot.metadata.fromCache) return;
    onChange(withId<UserProfileDocument>(snapshot.id, snapshot.data()));
  });
}

export async function searchUsersByUsername(usernamePrefix: string, maxResults = 20): Promise<UserProfileDocument[]> {
  const end = `${usernamePrefix}\uf8ff`;
  return listDocuments<UserProfileDocument>("users", [
    firestoreQuery.where("username", ">=", usernamePrefix),
    firestoreQuery.where("username", "<=", end),
    firestoreQuery.limit(maxResults)
  ]);
}

export async function listAdminRankingKeys(): Promise<Set<string>> {
  const snapshot = await getDocsFromServer(query(collection(firestoreDb, "users"), where("role", "==", "admin"), limit(100)));
  return new Set(snapshot.docs.flatMap((profile) => {
    const username = profile.data().username;
    return [profile.id, typeof username === "string" ? username.replace(/^@+/, "") : ""].filter(Boolean);
  }));
}
