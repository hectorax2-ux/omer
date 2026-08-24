import { createContext, PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { useAccount } from "@/hooks/use-account";
import { listUserArtStoryReadIds, subscribeUserArtStoryEngagement } from "@/src/services/firebase/art-story-engagement-service";
import { markRead, removeRead } from "@/src/services/firebase/read-service";
import { firebaseAuth } from "@/src/services/firebase/core";

type ArtStoryEngagementContextValue = {
  favoriteIds: string[];
  readIds: string[];
  toggleRead: (storyId: string) => Promise<boolean>;
};

export const ArtStoryEngagementContext = createContext<ArtStoryEngagementContextValue>({
  favoriteIds: [],
  readIds: [],
  toggleRead: async () => false
});

function mergeReadIds(serverIds: string[], pending: Map<string, boolean>) {
  let merged = [...serverIds];
  pending.forEach((shouldRead, storyId) => {
    if (shouldRead && !merged.includes(storyId)) merged = [storyId, ...merged];
    if (!shouldRead) merged = merged.filter((id) => id !== storyId);
  });
  return merged;
}

function reconcilePending(serverIds: string[], pending: Map<string, boolean>) {
  pending.forEach((shouldRead, storyId) => {
    if (serverIds.includes(storyId) === shouldRead) pending.delete(storyId);
  });
}

export function ArtStoryEngagementProvider({ children }: PropsWithChildren) {
  const { account } = useAccount();
  const [authUid, setAuthUid] = useState(firebaseAuth.currentUser?.uid ?? "");
  const uid = authUid || account.uid;
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [readIds, setReadIds] = useState<string[]>([]);
  const pendingReadRef = useRef(new Map<string, boolean>());

  useEffect(() => onAuthStateChanged(firebaseAuth, (user) => {
    setAuthUid(user?.uid ?? "");
  }), []);

  useEffect(() => {
    if (!uid) {
      setFavoriteIds([]);
      setReadIds([]);
      pendingReadRef.current.clear();
      return;
    }

    return subscribeUserArtStoryEngagement(uid, (engagement) => {
      reconcilePending(engagement.readIds, pendingReadRef.current);
      setFavoriteIds(engagement.favoriteIds);
      setReadIds(mergeReadIds(engagement.readIds, pendingReadRef.current));
    });
  }, [uid]);

  const toggleRead = useCallback(async (storyId: string) => {
    if (!uid) return false;

    const wasRead = pendingReadRef.current.has(storyId)
      ? pendingReadRef.current.get(storyId)!
      : readIds.includes(storyId);
    const nextRead = !wasRead;

    pendingReadRef.current.set(storyId, nextRead);
    setReadIds((current) => mergeReadIds(
      nextRead
        ? [...current.filter((id) => id !== storyId), storyId]
        : current.filter((id) => id !== storyId),
      pendingReadRef.current
    ));

    try {
      if (nextRead) await markRead(uid, "artStory", storyId);
      else await removeRead(uid, "artStory", storyId);
      const freshReadIds = await listUserArtStoryReadIds(uid);
      reconcilePending(freshReadIds, pendingReadRef.current);
      setReadIds(mergeReadIds(freshReadIds, pendingReadRef.current));
      return true;
    } catch {
      pendingReadRef.current.delete(storyId);
      setReadIds((current) => wasRead
        ? [...current.filter((id) => id !== storyId), storyId]
        : current.filter((id) => id !== storyId));
      return false;
    }
  }, [readIds, uid]);

  const value = useMemo(
    () => ({ favoriteIds, readIds, toggleRead }),
    [favoriteIds, readIds, toggleRead]
  );

  return (
    <ArtStoryEngagementContext.Provider value={value}>
      {children}
    </ArtStoryEngagementContext.Provider>
  );
}
