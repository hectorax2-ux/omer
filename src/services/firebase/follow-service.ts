import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
  type Unsubscribe
} from "firebase/firestore";
import { firestoreDb } from "./core";
import { followDocId } from "./messaging-settings";

export type UserFollowRecord = {
  id: string;
  followerId: string;
  followedId: string;
  followerUsername: string;
  followedUsername: string;
  createdAtMs: number;
};

function timestampMs(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  return 0;
}

function mapFollowDoc(id: string, data: Record<string, unknown>): UserFollowRecord {
  return {
    id,
    followerId: typeof data.followerId === "string" ? data.followerId : "",
    followedId: typeof data.followedId === "string" ? data.followedId : "",
    followerUsername: typeof data.followerUsername === "string" ? data.followerUsername : "",
    followedUsername: typeof data.followedUsername === "string" ? data.followedUsername : "",
    createdAtMs: timestampMs(data.createdAt)
  };
}

export async function createUserFollow(input: {
  followerId: string;
  followedId: string;
  followerUsername: string;
  followedUsername: string;
}) {
  if (!input.followerId || !input.followedId || input.followerId === input.followedId) {
    throw new Error("Geçersiz takip isteği.");
  }

  await setDoc(doc(firestoreDb, "userFollows", followDocId(input.followerId, input.followedId)), {
    followerId: input.followerId,
    followedId: input.followedId,
    followerUsername: input.followerUsername.trim(),
    followedUsername: input.followedUsername.trim(),
    createdAt: serverTimestamp()
  });
}

export async function deleteUserFollow(followerId: string, followedId: string) {
  await deleteDoc(doc(firestoreDb, "userFollows", followDocId(followerId, followedId)));
}

export function subscribeFollowing(
  followerId: string,
  onChange: (records: UserFollowRecord[], metadata: { fromCache: boolean }) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(firestoreDb, "userFollows"), where("followerId", "==", followerId)),
    (snapshot) => {
      onChange(snapshot.docs.map((item) => mapFollowDoc(item.id, item.data() as Record<string, unknown>)), { fromCache: snapshot.metadata.fromCache });
    },
    () => onChange([], { fromCache: false })
  );
}

export function subscribeFollowers(
  followedId: string,
  onChange: (records: UserFollowRecord[], metadata: { fromCache: boolean }) => void
): Unsubscribe {
  return onSnapshot(
    query(collection(firestoreDb, "userFollows"), where("followedId", "==", followedId)),
    (snapshot) => {
      onChange(snapshot.docs.map((item) => mapFollowDoc(item.id, item.data() as Record<string, unknown>)), { fromCache: snapshot.metadata.fromCache });
    },
    () => onChange([], { fromCache: false })
  );
}

export async function listFollowingIds(followerId: string) {
  const snapshot = await getDocs(query(collection(firestoreDb, "userFollows"), where("followerId", "==", followerId)));
  return snapshot.docs
    .map((item) => mapFollowDoc(item.id, item.data() as Record<string, unknown>).followedId)
    .filter(Boolean);
}

export async function listFollowerIds(followedId: string) {
  const snapshot = await getDocs(query(collection(firestoreDb, "userFollows"), where("followedId", "==", followedId)));
  return snapshot.docs
    .map((item) => mapFollowDoc(item.id, item.data() as Record<string, unknown>).followerId)
    .filter(Boolean);
}
