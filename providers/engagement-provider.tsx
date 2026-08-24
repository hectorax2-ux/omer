import { createContext, PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "@/hooks/use-account";
import { useRegisterRefresh } from "@/providers/refresh-provider";
import { listUserFavorites, removeFavorite, setFavorite } from "@/src/services/firebase/favorite-service";
import { listUserReactions, removeReaction, setReaction } from "@/src/services/firebase/like-service";
import { listUserReads, markRead, removeRead } from "@/src/services/firebase/read-service";

type Vote = "like" | "dislike";

type Report = {
  id: string;
  type: "profile" | "content";
  targetId: string;
  reason: string;
};

type EngagementContextValue = {
  favoriteArtworkIds: string[];
  readArtworkIds: string[];
  artworkVotes: Record<string, Vote>;
  reports: Report[];
  markArtworkRead: (artworkId: string) => void;
  toggleArtworkRead: (artworkId: string) => void;
  resetReadArtworks: () => void;
  toggleFavorite: (artworkId: string) => void;
  voteArtwork: (artworkId: string, vote: Vote) => void;
  reportProfile: (targetId: string, reason: string) => void;
  reportContent: (targetId: string, reason: string) => void;
};

export const EngagementContext = createContext<EngagementContextValue>({
  favoriteArtworkIds: [],
  readArtworkIds: [],
  artworkVotes: {},
  reports: [],
  markArtworkRead: () => undefined,
  toggleArtworkRead: () => undefined,
  resetReadArtworks: () => undefined,
  toggleFavorite: () => undefined,
  voteArtwork: () => undefined,
  reportProfile: () => undefined,
  reportContent: () => undefined
});

export function EngagementProvider({ children }: PropsWithChildren) {
  const { account, canUseMemberFeatures } = useAccount();
  const [favoriteArtworkIds, setFavoriteArtworkIds] = useState<string[]>([]);
  const [readArtworkIds, setReadArtworkIds] = useState<string[]>([]);
  const [artworkVotes, setArtworkVotes] = useState<Record<string, Vote>>({});
  const [reports, setReports] = useState<Report[]>([]);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const pendingMutations = useRef(new Set<string>());

  useRegisterRefresh(() => setRefreshCounter((value) => value + 1), { scope: ["/", "/gallery", "/artwork", "/favorites", "/my-museum"] });

  useEffect(() => {
    let active = true;
    if (!account.uid) {
      setFavoriteArtworkIds([]);
      setReadArtworkIds([]);
      setArtworkVotes({});
      return;
    }

    Promise.all([
      listUserFavorites(account.uid),
      listUserReactions(account.uid),
      listUserReads(account.uid)
    ]).then(([favorites, reactions, reads]) => {
      if (!active) return;
      setFavoriteArtworkIds(favorites.filter((item) => item.targetType === "artwork").map((item) => item.targetId));
      setReadArtworkIds(reads.filter((item) => item.targetType === "artwork").map((item) => item.targetId));
      setArtworkVotes(reactions
        .filter((item) => item.targetType === "artwork")
        .reduce<Record<string, Vote>>((acc, item) => {
          acc[item.targetId] = item.value;
          return acc;
        }, {}));
    }).catch(() => undefined);

    return () => {
      active = false;
    };
  }, [account.uid, refreshCounter]);

  const value = useMemo(
    () => ({
      favoriteArtworkIds,
      readArtworkIds,
      artworkVotes,
      reports,
      markArtworkRead: (artworkId: string) => {
        if (!account.uid || readArtworkIds.includes(artworkId)) return;
        const mutationKey = `read:${artworkId}`;
        if (pendingMutations.current.has(mutationKey)) return;
        pendingMutations.current.add(mutationKey);
        setReadArtworkIds((current) => current.includes(artworkId) ? current : [artworkId, ...current]);
        void markRead(account.uid, "artwork", artworkId)
          .catch(() => setReadArtworkIds((current) => current.filter((id) => id !== artworkId)))
          .finally(() => pendingMutations.current.delete(mutationKey));
      },
      toggleArtworkRead: (artworkId: string) => {
        if (!account.uid) return;
        const mutationKey = `read:${artworkId}`;
        if (pendingMutations.current.has(mutationKey)) return;
        const existed = readArtworkIds.includes(artworkId);
        pendingMutations.current.add(mutationKey);
        setReadArtworkIds((current) => existed ? current.filter((id) => id !== artworkId) : [artworkId, ...current]);
        void (existed ? removeRead(account.uid, "artwork", artworkId) : markRead(account.uid, "artwork", artworkId))
          .catch(() => setReadArtworkIds((current) => existed
            ? current.includes(artworkId) ? current : [artworkId, ...current]
            : current.filter((id) => id !== artworkId)))
          .finally(() => pendingMutations.current.delete(mutationKey));
      },
      resetReadArtworks: () => {
        setReadArtworkIds([]);
        if (!account.uid) return;
        listUserReads(account.uid)
          .then((reads) => Promise.all(
            reads
              .filter((item) => item.targetType === "artwork")
              .map((item) => removeRead(account.uid, "artwork", item.targetId))
          ))
          .catch(() => undefined);
      },
      toggleFavorite: (artworkId: string) => {
        if (!canUseMemberFeatures || !account.uid) return;
        const mutationKey = `favorite:${artworkId}`;
        if (pendingMutations.current.has(mutationKey)) return;
        const existed = favoriteArtworkIds.includes(artworkId);
        pendingMutations.current.add(mutationKey);
        setFavoriteArtworkIds((current) => existed ? current.filter((id) => id !== artworkId) : [artworkId, ...current]);
        void (existed ? removeFavorite(account.uid, "artwork", artworkId) : setFavorite(account.uid, "artwork", artworkId))
          .catch(() => setFavoriteArtworkIds((current) => existed
            ? current.includes(artworkId) ? current : [artworkId, ...current]
            : current.filter((id) => id !== artworkId)))
          .finally(() => pendingMutations.current.delete(mutationKey));
      },
      voteArtwork: (artworkId: string, vote: Vote) => {
        if (!canUseMemberFeatures || !account.uid) return;
        const mutationKey = `vote:${artworkId}`;
        if (pendingMutations.current.has(mutationKey)) return;
        const previousVote = artworkVotes[artworkId];
        const nextVote = previousVote === vote ? undefined : vote;
        pendingMutations.current.add(mutationKey);
        setArtworkVotes((current) => {
          const next = { ...current };
          if (nextVote) next[artworkId] = nextVote;
          else delete next[artworkId];
          return next;
        });
        void (nextVote
          ? setReaction(account.uid, "artwork", artworkId, nextVote)
          : removeReaction(account.uid, "artwork", artworkId))
          .catch(() => setArtworkVotes((current) => {
            const next = { ...current };
            if (previousVote) next[artworkId] = previousVote;
            else delete next[artworkId];
            return next;
          }))
          .finally(() => pendingMutations.current.delete(mutationKey));
      },
      reportProfile: (targetId: string, reason: string) => {
        if (!canUseMemberFeatures) return;
        setReports((current) => [{ id: `profile-report-${Date.now()}`, type: "profile", targetId, reason }, ...current]);
      },
      reportContent: (targetId: string, reason: string) => {
        if (!canUseMemberFeatures) return;
        setReports((current) => [{ id: `content-report-${Date.now()}`, type: "content", targetId, reason }, ...current]);
      }
    }),
    [account.uid, artworkVotes, canUseMemberFeatures, favoriteArtworkIds, readArtworkIds, reports]
  );

  return <EngagementContext.Provider value={value}>{children}</EngagementContext.Provider>;
}
