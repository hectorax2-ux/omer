import { createContext, PropsWithChildren, useEffect, useMemo, useRef, useState } from "react";
import { Alert } from "react-native";
import { usePathname } from "expo-router";
import { Language } from "@/types/content";
import {
  buildBlockedLanguageMessage,
  buildCommentCooldownMessage,
  buildCooldownMessage,
  COMMENT_COOLDOWN_MS,
  containsBlockedLanguage,
  getRateLimitStatus,
  POST_COOLDOWN_MS,
  pruneRateLimitTimestamps,
  RateLimitStatus,
  SafetyActionResult,
  throttleAction,
  withinBurstLimit
} from "@/utils/safety";
import { canCommentOnDiscoverPost, canDeleteComment } from "@/utils/comment-permissions";
import { msg, systemMessages } from "@/app/i18n/system-messages";
import { useAccount } from "@/hooks/use-account";
import { useLanguage } from "@/hooks/use-language";
import { useRegisterRefresh } from "@/providers/refresh-provider";
import { useSocial } from "@/hooks/use-social";
import { CommunityImageCommentDocument, CommunityImageDocument } from "@/src/types/firestore";
import { createCommunityImageComment, listCommunityImageComments, updateCommunityImageComment } from "@/src/services/firebase/community-image-comment-service";
import { getRewardedBoostCredit, listOwnPendingCommunityImages, listProfileGalleryImages, listPublishedCommunityImages, saveRewardedBoostCredit, submitCommunityImage, subscribePublishedCommunityImages, updateCommunityImage } from "@/src/services/firebase/community-image-service";
import { resolveActiveWeekId, resolveUploadLimit, subscribeCompetitionSettings, extractWeekPeriodId, type CompetitionSettings } from "@/src/services/firebase/competition-week-service";
import { hasActiveUserRestriction } from "@/utils/user-restrictions";
import { listUserReactions, removeReaction, setReaction } from "@/src/services/firebase/like-service";
import { listUserFavorites, removeFavorite, setFavorite } from "@/src/services/firebase/favorite-service";
import { addSuperLike, removeSuperLike, listUserSuperLikes, subscribeSuperLikeSummaries, SUPER_LIKE_WEEKLY_LIMIT } from "@/src/services/firebase/super-like-service";
import { canDeleteArtworkFromProfile as canDeleteArtworkFromProfileByItem } from "@/utils/user-identity";
import { useStartupPhase } from "@/hooks/use-startup-phase";
import { isResourceArray, loadResourceCache, peekResourceCache, saveResourceCache } from "@/src/services/cache/resource-cache";

const WEEKLY_COMPETITION_LIMIT = 2;
const COMMUNITY_IMAGE_CACHE_KEY = "community-images:published:first-page";
const WEEKLY_RANK_REFRESH_MS = 15 * 60 * 1000;
const MANUAL_BOOST_COOLDOWN_MS = 30 * 60 * 1000;
const PREMIUM_AUTO_BOOST_MS = 4 * 60 * 60 * 1000;
const REWARDED_BOOST_COOLDOWN_MS = 30 * 60 * 1000;

export type CommunityArtwork = {
  id: string;
  language: Language;
  ownerId?: string;
  source?: "competition" | "profile";
  image: string;
  artistName: string;
  title: string;
  story: string;
  age?: string;
  uploaderUsername?: string;
  ownerCountry?: string;
  likes: number;
  dislikes: number;
  superLikes?: number;
  approved: boolean;
  submittedAt?: number;
  approvedAt?: number;
  boostedAt?: number;
  deleted?: boolean;
  deletedAt?: number;
  deletedByUser?: boolean;
  profileVisible?: boolean;
  competitionWeekArchived?: boolean;
  weekId?: string;
  quotaGeneration?: number;
  rankingHidden?: boolean;
};

export type ArtworkVote = "like" | "dislike";

export type ArtworkComment = {
  id: string;
  communityImageId: string;
  authorId?: string;
  author: string;
  username: string;
  text: string;
  createdAt: number;
  isPremium?: boolean;
};

type CommunityArtContextValue = {
  items: CommunityArtwork[];
  loading: boolean;
  votes: Record<string, ArtworkVote>;
  favoriteIds: string[];
  commentsByArtwork: Record<string, ArtworkComment[]>;
  activeWeekId: string;
  submitArtwork: (artwork: Omit<CommunityArtwork, "id" | "likes" | "dislikes" | "approved">, language?: Language) => SafetyActionResult;
  addProfileArtwork: (artwork: Omit<CommunityArtwork, "id" | "likes" | "dislikes" | "approved" | "source">, language?: Language) => SafetyActionResult;
  deleteSubmittedArtwork: (id: string) => SafetyActionResult;
  canDeleteArtworkFromProfile: (id: string) => boolean;
  approveArtwork: (id: string) => SafetyActionResult;
  getArtworkLimitStatus: (username: string) => RateLimitStatus;
  getWeeklyArtworkQuota: (username: string) => { used: number; limit: number; remaining: number; approved: number; pending: number };
  getRankedCompetitionItems: (language: Language | "all", mode?: "smart" | "liked" | "new") => CommunityArtwork[];
  boostArtwork: (id: string) => SafetyActionResult;
  getBoostStatus: (id: string) => { canBoost: boolean; nextBoostAt?: number; needsRewardAd: boolean; rewardCredits: number; isPremiumBoost: boolean };
  getRewardedBoostStatus: () => { canWatchAd: boolean; nextRewardAt?: number; rewardCredits: number };
  watchRewardedBoostAd: () => SafetyActionResult;
  voteArtwork: (id: string, vote: ArtworkVote) => void;
  superLiked: Record<string, boolean>;
  superLikeArtwork: (id: string) => SafetyActionResult;
  getSuperLikeStatus: (id: string) => { isPremium: boolean; alreadySuperLiked: boolean; used: number; limit: number; remaining: number; canSuperLike: boolean };
  toggleFavoriteArtwork: (id: string) => void;
  addArtworkComment: (artworkId: string, comment: Omit<ArtworkComment, "id" | "communityImageId" | "createdAt">, language?: Language) => SafetyActionResult;
  deleteArtworkComment: (artworkId: string, commentId: string) => SafetyActionResult;
  resetWeeklyVotes: () => void;
  refreshArtworks: () => void;
};

type ArtworkValidationResult =
  | SafetyActionResult & { ok: false }
  | { ok: true; status: RateLimitStatus; key: string; current: number[]; now: number };

export const CommunityArtContext = createContext<CommunityArtContextValue>({
  items: [],
  loading: true,
  votes: {},
  favoriteIds: [],
  commentsByArtwork: {},
  activeWeekId: "",
  submitArtwork: () => ({ ok: false }),
  addProfileArtwork: () => ({ ok: false }),
  deleteSubmittedArtwork: () => ({ ok: false }),
  canDeleteArtworkFromProfile: () => false,
  approveArtwork: () => ({ ok: false }),
  getArtworkLimitStatus: () => getRateLimitStatus([]),
  getWeeklyArtworkQuota: () => ({ used: 0, approved: 0, pending: 0, limit: WEEKLY_COMPETITION_LIMIT, remaining: WEEKLY_COMPETITION_LIMIT }),
  getRankedCompetitionItems: () => [],
  boostArtwork: () => ({ ok: false }),
  getBoostStatus: () => ({ canBoost: false, needsRewardAd: false, rewardCredits: 0, isPremiumBoost: false }),
  getRewardedBoostStatus: () => ({ canWatchAd: false, rewardCredits: 0 }),
  watchRewardedBoostAd: () => ({ ok: false }),
  voteArtwork: () => undefined,
  superLiked: {},
  superLikeArtwork: () => ({ ok: false }),
  getSuperLikeStatus: () => ({ isPremium: false, alreadySuperLiked: false, used: 0, limit: SUPER_LIKE_WEEKLY_LIMIT, remaining: SUPER_LIKE_WEEKLY_LIMIT, canSuperLike: false }),
  toggleFavoriteArtwork: () => undefined,
  addArtworkComment: () => ({ ok: false }),
  deleteArtworkComment: () => ({ ok: false }),
  resetWeeklyVotes: () => undefined,
  refreshArtworks: () => undefined
});

export function CommunityArtProvider({ children }: PropsWithChildren) {
  const { account, canUseMemberFeatures } = useAccount();
  const { language } = useLanguage();
  const { suggestedUsers, isUserBlocked, isUserSuspended } = useSocial();
  const pathname = usePathname();
  const needsCommunityDetails = pathname.startsWith("/ranking")
    || pathname.startsWith("/profile")
    || pathname.startsWith("/upload-artwork")
    || pathname.startsWith("/weekly-winners");
  const needsCommunitySummary = pathname === "/" || needsCommunityDetails;
  const startupPhase = useStartupPhase();
  const communityNetworkReady = startupPhase !== "critical" || needsCommunityDetails;
  const initialItems = peekResourceCache<CommunityArtwork[]>(COMMUNITY_IMAGE_CACHE_KEY);
  const [items, setItems] = useState<CommunityArtwork[]>(initialItems ?? []);
  const [loading, setLoading] = useState(!initialItems);
  const [votes, setVotes] = useState<Record<string, ArtworkVote>>({});
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [commentsByArtwork, setCommentsByArtwork] = useState<Record<string, ArtworkComment[]>>({});
  const [commentTimestamps, setCommentTimestamps] = useState<Record<string, number>>({});
  const [artworkTimestamps, setArtworkTimestamps] = useState<Record<string, number[]>>({});
  const [rewardedBoosts, setRewardedBoosts] = useState<Record<string, { lastAdWatchedAt?: number; credits: number }>>({});
  const [rankBucket, setRankBucket] = useState(() => getRankBucket());
  const [firebaseEnabled, setFirebaseEnabled] = useState(false);
  const [competitionSettings, setCompetitionSettings] = useState<CompetitionSettings | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [superLiked, setSuperLiked] = useState<Record<string, boolean>>({});
  const [superLikeCounts, setSuperLikeCounts] = useState<Record<string, number>>({});
  const pendingVoteDeltasRef = useRef(new Map<string, { baseLikes: number; baseDislikes: number; likesDelta: number; dislikesDelta: number }>());
  const voteInFlightRef = useRef(new Set<string>());
  const [superLikeOverride, setSuperLikeOverride] = useState<Record<string, number>>({});
  const [superLikeWeekUsed, setSuperLikeWeekUsed] = useState(0);

  useEffect(() => {
    let active = true;
    void loadResourceCache(COMMUNITY_IMAGE_CACHE_KEY, isCommunityArtworkArray).then((cached) => {
      if (!active || !cached) return;
      setItems(cached);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!communityNetworkReady) return;
    const unsubscribe = subscribeCompetitionSettings((settings) => {
      setCompetitionSettings(settings);
    });
    return () => unsubscribe();
  }, [communityNetworkReady]);

  useEffect(() => {
    const timer = setInterval(() => setRankBucket(getRankBucket()), WEEKLY_RANK_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!needsCommunitySummary || !communityNetworkReady) return;
    let active = true;
    setLoading(true);
    const activeWeekId = resolveActiveWeekId(competitionSettings ?? undefined);

    const unsubscribe = subscribePublishedCommunityImages(undefined, 100, activeWeekId, (remoteItems, metadata) => {
        const ownPendingPromise = account.uid
          ? listOwnPendingCommunityImages(account.uid, activeWeekId)
          : Promise.resolve([]);
        Promise.all([
          ownPendingPromise.catch(() => []),
          needsCommunityDetails ? listProfileGalleryImages(300).catch(() => []) : Promise.resolve([])
        ])
          .then(([pendingItems, profileItems]) => {
          if (!active) return;
          const merged = new Map<string, CommunityImageDocument>();
          profileItems.forEach((item) => merged.set(item.id, item));
          remoteItems.forEach((item) => merged.set(item.id, item));
          pendingItems.forEach((item) => merged.set(item.id, item));
          const mappedItems = Array.from(merged.values())
            .map(mapCommunityImageDocument)
            .map((item) => {
              const pending = pendingVoteDeltasRef.current.get(item.id);
              if (!pending) return item;
              const likesApplied = pending.likesDelta >= 0 ? item.likes >= pending.baseLikes + pending.likesDelta : item.likes <= pending.baseLikes + pending.likesDelta;
              const dislikesApplied = pending.dislikesDelta >= 0 ? item.dislikes >= pending.baseDislikes + pending.dislikesDelta : item.dislikes <= pending.baseDislikes + pending.dislikesDelta;
              if (likesApplied && dislikesApplied) {
                pendingVoteDeltasRef.current.delete(item.id);
                return item;
              }
              return {
                ...item,
                likes: Math.max(0, item.likes + pending.likesDelta),
                dislikes: Math.max(0, item.dislikes + pending.dislikesDelta)
              };
            })
            .sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes));
          setItems(mappedItems);
          void saveResourceCache(COMMUNITY_IMAGE_CACHE_KEY, mappedItems);
          setFirebaseEnabled(true);
          if (!metadata.fromCache) setLoading(false);
          })
          .catch(() => {
            if (!active) return;
            setFirebaseEnabled(false);
            setLoading(false);
          });
      }, () => {
        if (!active) return;
        listPublishedCommunityImages(undefined, 100)
          .then((remoteItems) => {
            if (!active || !remoteItems.length) {
              setFirebaseEnabled(false);
              setItems([]);
              setLoading(false);
              return;
            }
            const mappedItems = remoteItems.map(mapCommunityImageDocument).sort((a, b) => (b.likes - b.dislikes) - (a.likes - a.dislikes));
            setItems(mappedItems);
            void saveResourceCache(COMMUNITY_IMAGE_CACHE_KEY, mappedItems);
            setFirebaseEnabled(true);
            setLoading(false);
          })
          .catch(() => {
            if (!active) return;
            setFirebaseEnabled(false);
            setLoading(false);
          });
      });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [account.uid, communityNetworkReady, competitionSettings, needsCommunityDetails, needsCommunitySummary, refreshCounter]);

  useEffect(() => {
    if (!needsCommunityDetails) return;
    let active = true;
    if (!account.uid) {
      setRewardedBoosts({});
      return () => {
        active = false;
      };
    }

    getRewardedBoostCredit(account.uid, resolveActiveWeekId(competitionSettings ?? undefined))
      .then((credit) => {
        if (!active) return;
        setRewardedBoosts(credit ? {
          [account.username]: {
            lastAdWatchedAt: credit.lastAdWatchedAt,
            credits: credit.credits
          }
        } : {});
      })
      .catch(() => undefined);

    return () => {
      active = false;
    };
  }, [account.uid, account.username, competitionSettings, needsCommunityDetails]);

  useEffect(() => {
    if (!needsCommunityDetails) return;
    let active = true;

    (account.uid ? listUserFavorites(account.uid) : Promise.resolve([]))
      .then((favorites) => {
        if (!active) return;
        setFavoriteIds(favorites.filter((item) => item.targetType === "communityImage").map((item) => item.targetId));
      })
      .catch(() => {
        if (!active) return;
        setFavoriteIds([]);
      });

    return () => {
      active = false;
    };
  }, [account.uid, needsCommunityDetails, refreshCounter]);

  useEffect(() => {
    if (!needsCommunityDetails) return;
    let active = true;

    listCommunityImageComments(500)
      .then((remoteComments) => {
        if (!active) return;
        const grouped = remoteComments
          .filter((comment) => comment.status === "published")
          .reduce<Record<string, ArtworkComment[]>>((acc, comment) => {
            const mapped = mapArtworkCommentDocument(comment);
            acc[mapped.communityImageId] = [...(acc[mapped.communityImageId] ?? []), mapped];
            return acc;
          }, {});
        Object.keys(grouped).forEach((key) => {
          grouped[key].sort((a, b) => b.createdAt - a.createdAt);
        });
        setCommentsByArtwork(grouped);
      })
      .catch(() => {
        if (active) setCommentsByArtwork({});
      });

    return () => {
      active = false;
    };
  }, [firebaseEnabled, needsCommunityDetails, refreshCounter]);

  useEffect(() => {
    if (!needsCommunityDetails) return;
    let active = true;

    (account.uid ? listUserReactions(account.uid) : Promise.resolve([]))
      .then((userReactions) => {
        if (!active) return;
        const nextVotes: Record<string, ArtworkVote> = {};
        userReactions
          .filter((reaction) => reaction.targetType === "communityImage")
          .forEach((reaction) => {
            nextVotes[reaction.targetId] = reaction.value;
          });
        setVotes(nextVotes);
      })
      .catch(() => {
        if (!active) return;
        setVotes({});
      });

    return () => {
      active = false;
    };
  }, [account.uid, needsCommunityDetails, refreshCounter]);

  useRegisterRefresh(() => setRefreshCounter((value) => value + 1), { scope: ["/ranking", "/upload-artwork", "/weekly-winners", "/profile", "/account"] });

  useEffect(() => {
    if (!account.uid) return;
    setItems((current) => current.map((item) => (
      item.ownerId === account.uid
        ? { ...item, uploaderUsername: account.username, artistName: account.displayName }
        : item
    )));
  }, [account.displayName, account.uid, account.username]);

  useEffect(() => {
    if (!needsCommunityDetails) return;
    const unsubscribe = subscribeSuperLikeSummaries(setSuperLikeCounts);
    return () => unsubscribe();
  }, [needsCommunityDetails]);

  // Drop optimistic super-like overrides once the live summary has caught up, so the count
  // never flickers back to the server value while a write is still in flight.
  useEffect(() => {
    setSuperLikeOverride((current) => {
      const ids = Object.keys(current);
      if (!ids.length) return current;
      const next = { ...current };
      let changed = false;
      ids.forEach((id) => {
        if ((superLikeCounts[id] ?? 0) === current[id]) {
          delete next[id];
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [superLikeCounts]);

  useEffect(() => {
    let active = true;
    if (!account.uid || !needsCommunityDetails) {
      setSuperLiked({});
      setSuperLikeWeekUsed(0);
      return () => {
        active = false;
      };
    }
    const activeWeekId = resolveActiveWeekId(competitionSettings ?? undefined);
    listUserSuperLikes(account.uid)
      .then((records) => {
        if (!active) return;
        setSuperLiked(Object.fromEntries(records.map((item) => [item.targetId, true])));
        setSuperLikeWeekUsed(records.filter((item) => item.weekId === activeWeekId).length);
      })
      .catch(() => {
        if (!active) return;
        setSuperLiked({});
        setSuperLikeWeekUsed(0);
      });
    return () => {
      active = false;
    };
  }, [account.uid, competitionSettings, needsCommunityDetails, refreshCounter]);

  function validateArtworkAction(artwork: { title: string; story: string; artistName: string; uploaderUsername?: string }, language: Language): ArtworkValidationResult {
    if (containsBlockedLanguage(`${artwork.title} ${artwork.story} ${artwork.artistName}`)) {
      return { ok: false, reason: "blocked_language" as const, message: buildBlockedLanguageMessage(language) };
    }

    const now = Date.now();
    const key = artwork.uploaderUsername || artwork.artistName;
    const current = pruneRateLimitTimestamps(artworkTimestamps[key] ?? [], now);
    const status = getRateLimitStatus(current, now);
    if (status.blocked) {
      return { ok: false, reason: "rate_limit" as const, status };
    }
    if (current.length && now - current[current.length - 1] < POST_COOLDOWN_MS) {
      return { ok: false, reason: "cooldown" as const, status, message: buildCooldownMessage(status, language) };
    }

    return { ok: true, status: getRateLimitStatus([...current, now], now), key, current, now };
  }

  function ownerKey(artwork: Pick<CommunityArtwork, "artistName" | "uploaderUsername">) {
    const suggested = suggestedUsers.find((user) => user.name.toLocaleLowerCase("tr") === artwork.artistName.toLocaleLowerCase("tr"));
    return artwork.uploaderUsername || suggested?.username || artwork.artistName.toLocaleLowerCase("tr");
  }

  function getWeeklyArtworkQuota(username: string) {
    const activeWeekId = resolveActiveWeekId(competitionSettings ?? undefined);
    const quotaGeneration = competitionSettings?.uploadQuotaGeneration ?? 0;
    const isPremiumUser = username === account.username
      ? account.isPremium || account.isAdmin
      : suggestedUsers.some((user) => user.username === username && user.isPremium);
    const limit = resolveUploadLimit(competitionSettings ?? undefined, isPremiumUser);
    const competitionItems = items.filter((item) => {
      const key = ownerKey(item);
      const itemWeekId = item.weekId || activeWeekId;
      const itemGeneration = item.quotaGeneration ?? quotaGeneration;
      const matchesOwner = username === account.username
        ? item.ownerId === account.uid || key === username
        : key === username;
      return !item.deleted
        && matchesOwner
        && (item.source ?? "competition") === "competition"
        && matchesCompetitionWeek(itemWeekId, activeWeekId)
        && !item.competitionWeekArchived
        && !item.rankingHidden
        && itemGeneration === quotaGeneration;
    });
    const approved = competitionItems.filter((item) => item.approved).length;
    const pending = competitionItems.filter((item) => !item.approved).length;
    const used = approved + pending;
    return { used, approved, pending, limit, remaining: Math.max(0, limit - used) };
  }

  function getBoostStatus(id: string) {
    const artwork = items.find((item) => item.id === id);
    if (!artwork || ownerKey(artwork) !== account.username) {
      return { canBoost: false, needsRewardAd: false, rewardCredits: 0, isPremiumBoost: false };
    }

    const nextBoostAt = (artwork.boostedAt ?? 0) + MANUAL_BOOST_COOLDOWN_MS;
    const isPremiumBoost = account.isPremium || account.isAdmin;
    const rewardStatus = getRewardedBoostStatus();
    return {
      canBoost: Date.now() >= nextBoostAt && (isPremiumBoost || rewardStatus.rewardCredits > 0),
      nextBoostAt,
      needsRewardAd: !isPremiumBoost && rewardStatus.rewardCredits <= 0,
      rewardCredits: rewardStatus.rewardCredits,
      isPremiumBoost
    };
  }

  function getRewardedBoostStatus() {
    if (account.isPremium || account.isAdmin) {
      return { canWatchAd: false, rewardCredits: 0 };
    }
    const state = rewardedBoosts[account.username] ?? { credits: 0 };
    const nextRewardAt = (state.lastAdWatchedAt ?? 0) + REWARDED_BOOST_COOLDOWN_MS;
    return {
      canWatchAd: Date.now() >= nextRewardAt,
      nextRewardAt,
      rewardCredits: state.credits
    };
  }

  function isPremiumOwner(owner: string) {
    if (owner === account.username) return account.isPremium || account.isAdmin;
    return suggestedUsers.some((user) => user.username === owner && user.isPremium);
  }

  function getSuperLikeStatus(id: string) {
    const isPremium = account.isPremium || account.isAdmin;
    const alreadySuperLiked = Boolean(superLiked[id]);
    const remaining = Math.max(0, SUPER_LIKE_WEEKLY_LIMIT - superLikeWeekUsed);
    return {
      isPremium,
      alreadySuperLiked,
      used: superLikeWeekUsed,
      limit: SUPER_LIKE_WEEKLY_LIMIT,
      remaining,
      canSuperLike: isPremium && !alreadySuperLiked && remaining > 0
    };
  }

  function scoreArtwork(artwork: CommunityArtwork, all: CommunityArtwork[]) {
    const owner = ownerKey(artwork);
    const social = suggestedUsers.find((user) => user.username === owner);
    const isCurrentAccount = owner === account.username;
    const lastActiveMinutes = isCurrentAccount ? 0 : social?.lastActiveMinutesAgo ?? 9999;
    const ownerCompetition = all.filter((item) => ownerKey(item) === owner);
    const bestNet = Math.max(...ownerCompetition.map((item) => item.likes - item.dislikes), -9999);
    const bestItems = ownerCompetition.filter((item) => item.likes - item.dislikes === bestNet);
    const selectedActiveItem = bestNet > 0 ? bestItems[0] : ownerCompetition[stableIndex(`${owner}-${rankBucket}`, ownerCompetition.length)];
    const activeBonus = lastActiveMinutes <= 15 && selectedActiveItem?.id === artwork.id ? (16 - lastActiveMinutes) * 900 : 0;
    const manualBoost = artwork.boostedAt && Date.now() - artwork.boostedAt < MANUAL_BOOST_COOLDOWN_MS ? 24000 - Math.floor((Date.now() - artwork.boostedAt) / 60000) : 0;
    const premiumAutoReady = !artwork.boostedAt || Date.now() - artwork.boostedAt >= PREMIUM_AUTO_BOOST_MS;
    const premiumAutoBoost = isPremiumOwner(owner) && premiumAutoReady ? 42000 + (stableHash(`${owner}-${Math.floor(Date.now() / PREMIUM_AUTO_BOOST_MS)}`) % 600) : 0;
    const freshnessBonus = artwork.approvedAt ? Math.max(0, 600 - Math.floor((Date.now() - artwork.approvedAt) / 60000)) : 0;
    const discoveryNoise = stableHash(`${artwork.id}-${rankBucket}`) % 180;
    return (artwork.likes - artwork.dislikes + (artwork.superLikes ?? 0)) * 100 + activeBonus + premiumAutoBoost + manualBoost + freshnessBonus + discoveryNoise;
  }

  function artworkDeleteAllowed(artwork: CommunityArtwork) {
    const activeWeekId = resolveActiveWeekId(competitionSettings ?? undefined);
    return canDeleteArtworkFromProfileByItem(artwork, activeWeekId);
  }

  const activeWeekId = resolveActiveWeekId(competitionSettings ?? undefined);

  const userIdentityByUid = useMemo(() => {
    const index = new Map<string, { artistName: string; uploaderUsername: string }>();
    suggestedUsers.forEach((user) => {
      if (!user.uid) return;
      index.set(user.uid, { artistName: user.name, uploaderUsername: user.username });
    });
    if (account.uid) {
      index.set(account.uid, { artistName: account.displayName, uploaderUsername: account.username });
    }
    return index;
  }, [account.displayName, account.uid, account.username, suggestedUsers]);

  const userIdentityByUsername = useMemo(() => {
    const index = new Map<string, { artistName: string; uploaderUsername: string }>();
    suggestedUsers.forEach((user) => {
      const identity = { artistName: user.name, uploaderUsername: user.username };
      index.set(normalizeIdentity(user.username), identity);
      index.set(normalizeIdentity(user.name), identity);
    });
    if (account.uid) {
      const identity = { artistName: account.displayName, uploaderUsername: account.username };
      index.set(normalizeIdentity(account.username), identity);
      index.set(normalizeIdentity(account.displayName), identity);
    }
    return index;
  }, [account.displayName, account.uid, account.username, suggestedUsers]);

  const visibleItems = useMemo(
    () => items
      .filter((item) => !isUserSuspended({
        uid: item.ownerId,
        uploaderUsername: item.uploaderUsername,
        artistName: item.artistName
      }) && !isUserBlocked({
        uid: item.ownerId,
        uploaderUsername: item.uploaderUsername,
        artistName: item.artistName
      }))
      .map((item) => {
        const identity = (item.ownerId ? userIdentityByUid.get(item.ownerId) : undefined)
          ?? userIdentityByUsername.get(normalizeIdentity(item.uploaderUsername))
          ?? userIdentityByUsername.get(normalizeIdentity(item.artistName));
        return {
          ...item,
          artistName: identity?.artistName ?? item.artistName,
          uploaderUsername: identity?.uploaderUsername ?? item.uploaderUsername,
          superLikes: superLikeOverride[item.id] ?? superLikeCounts[item.id] ?? 0
        };
      }),
    [isUserBlocked, isUserSuspended, items, superLikeCounts, superLikeOverride, userIdentityByUid, userIdentityByUsername]
  );

  const visibleCommentsByArtwork = useMemo(() => {
    return Object.fromEntries(
      Object.entries(commentsByArtwork).map(([artworkId, comments]) => [
        artworkId,
        comments.filter((comment) => !isUserSuspended({
          uid: comment.authorId,
          username: comment.username,
          author: comment.author
        }) && !isUserBlocked({
          uid: comment.authorId,
          username: comment.username,
          author: comment.author
        }))
      ])
    );
  }, [commentsByArtwork, isUserBlocked, isUserSuspended]);

  const value = {
      items: visibleItems,
      loading,
      votes,
      favoriteIds,
      commentsByArtwork: visibleCommentsByArtwork,
      activeWeekId,
      submitArtwork: (artwork: Omit<CommunityArtwork, "id" | "likes" | "dislikes" | "approved">, language: Language = "tr") => {
        if (!canUseMemberFeatures) {
          return { ok: false, message: msg(systemMessages.verification.uploadImageRequired, language) };
        }
        if (hasActiveUserRestriction(account.restrictions, artwork.source === "profile" ? "image_upload" : "contest_entry")) {
          return {
            ok: false,
            message: language === "tr"
              ? "Görsel yükleme geçici olarak kısıtlandı."
              : language === "ru"
                ? "Загрузка изображений временно ограничена."
                : language === "uz"
                  ? "Rasm yuklash vaqtincha cheklangan."
                  : "Image uploads are temporarily restricted."
          };
        }
        const safety = validateArtworkAction(artwork, language);
        if (!safety.ok) {
          return safety;
        }
        const quota = getWeeklyArtworkQuota(artwork.uploaderUsername || account.username);
        if (quota.remaining <= 0) {
          return { ok: false, message: msg(systemMessages.community.uploadQuotaFull, language) };
        }

        setArtworkTimestamps((currentMap) => ({
          ...currentMap,
          [safety.key]: [...safety.current, safety.now]
        }));
        const localId = `pending-${Date.now()}`;
        const localArtwork: CommunityArtwork = {
            ...artwork,
            id: localId,
            source: artwork.source ?? "competition",
            likes: 0,
            dislikes: 0,
            approved: false,
            submittedAt: safety.now,
            weekId: resolveActiveWeekId(competitionSettings ?? undefined),
            quotaGeneration: competitionSettings?.uploadQuotaGeneration ?? 0
          };
        setItems((current) => [localArtwork, ...current]);
        if (account.uid) {
          submitCommunityImage({
            ownerId: account.uid,
            ownerUsername: artwork.uploaderUsername || account.username,
            ownerDisplayName: artwork.artistName,
            language,
            imageURL: artwork.image,
            title: artwork.title,
            story: artwork.story,
            age: Number(artwork.age) || 0,
            country: account.country,
            weekId: resolveActiveWeekId(competitionSettings ?? undefined),
            quotaGeneration: competitionSettings?.uploadQuotaGeneration ?? 0,
            competitionEntry: true
          }).then((remoteId) => {
            setItems((current) => current.map((item) => item.id === localId ? { ...item, id: remoteId } : item));
          }).catch((error) => {
            if (__DEV__) console.warn("[communityImages] competition submission failed", error);
            setItems((current) => current.filter((item) => item.id !== localId));
            showImageSaveError(language);
          });
        }
        return { ok: true, status: safety.status };
      },
      addProfileArtwork: (artwork: Omit<CommunityArtwork, "id" | "likes" | "dislikes" | "approved" | "source">, language: Language = "tr") => {
        if (!canUseMemberFeatures) {
          return { ok: false, message: msg(systemMessages.verification.uploadProfileRequired, language) };
        }
        const safety = validateArtworkAction(artwork, language);
        if (!safety.ok) {
          return safety;
        }

        setArtworkTimestamps((currentMap) => ({
          ...currentMap,
          [safety.key]: [...safety.current, safety.now]
        }));
        const localId = `profile-${Date.now()}`;
        const localArtwork: CommunityArtwork = {
            ...artwork,
            id: localId,
            source: "profile",
            likes: 0,
            dislikes: 0,
            approved: true,
            submittedAt: safety.now,
            approvedAt: safety.now
          };
        setItems((current) => [localArtwork, ...current]);
        if (account.uid) {
          submitCommunityImage({
            ownerId: account.uid,
            ownerUsername: artwork.uploaderUsername || account.username,
            ownerDisplayName: artwork.artistName,
            language,
            imageURL: artwork.image,
            title: artwork.title,
            story: artwork.story,
            age: Number(artwork.age) || 0,
            country: account.country,
            weekId: resolveActiveWeekId(competitionSettings ?? undefined),
            quotaGeneration: competitionSettings?.uploadQuotaGeneration ?? 0,
            competitionEntry: false,
            status: "published"
          })
            .then((remoteId) => {
              setItems((current) => current.map((item) => item.id === localId ? { ...item, id: remoteId } : item));
            })
            .catch((error) => {
              if (__DEV__) console.warn("[communityImages] profile image submission failed", error);
              setItems((current) => current.filter((item) => item.id !== localId));
              showImageSaveError(language);
            });
        }
        return { ok: true, status: safety.status };
      },
      deleteSubmittedArtwork: (id: string) => {
        const artwork = items.find((item) => item.id === id);
        if (!artwork || ownerKey(artwork) !== account.username || artwork.deleted) {
          return { ok: false };
        }
        if (!artworkDeleteAllowed(artwork)) {
          return { ok: false, message: msg(systemMessages.community.activeCompetitionDeleteBlocked, language) };
        }
        setItems((current) => current.map((item) => item.id === id ? {
          ...item,
          deleted: true,
          deletedAt: Date.now(),
          deletedByUser: true,
          profileVisible: false,
          approved: false
        } : item));
        if (firebaseEnabled) {
          updateCommunityImage(id, { status: "archived", deletedByUser: true }).catch(() => undefined);
        }
        return { ok: true };
      },
      canDeleteArtworkFromProfile: (id: string) => {
        const artwork = items.find((item) => item.id === id);
        if (!artwork || artwork.deleted) return false;
        return artworkDeleteAllowed(artwork);
      },
      approveArtwork: (id: string) => {
        const artwork = items.find((item) => item.id === id);
        if (!artwork || artwork.deleted) return { ok: false };
        const owner = ownerKey(artwork);
        const quota = getWeeklyArtworkQuota(owner);
        if ((artwork.source ?? "competition") === "competition" && !artwork.approved && quota.approved >= quota.limit) {
          return { ok: false, message: msg(systemMessages.community.ownerQuotaFull, language) };
        }
        setItems((current) => current.map((item) => item.id === id ? { ...item, approved: true, approvedAt: item.approvedAt ?? Date.now() } : item));
        if (firebaseEnabled) {
          updateCommunityImage(id, { status: "published" }).catch(() => undefined);
        }
        return { ok: true };
      },
      getWeeklyArtworkQuota,
      getArtworkLimitStatus: (username: string) => getRateLimitStatus(artworkTimestamps[username] ?? []),
      getRankedCompetitionItems: (selectedLanguage: Language | "all", mode: "smart" | "liked" | "new" = "smart") => {
        const weekId = resolveActiveWeekId(competitionSettings ?? undefined);
        const approved = visibleItems.filter((item) => !item.deleted && item.approved && !item.rankingHidden && !item.competitionWeekArchived && (item.source ?? "competition") === "competition" && matchesCompetitionWeek(item.weekId, weekId) && (selectedLanguage === "all" || item.language === selectedLanguage));
        if (mode === "liked") {
          return [...approved].sort((a, b) => (b.likes - b.dislikes + (b.superLikes ?? 0)) - (a.likes - a.dislikes + (a.superLikes ?? 0)));
        }
        if (mode === "new") {
          return [...approved].sort((a, b) => (b.approvedAt ?? b.submittedAt ?? 0) - (a.approvedAt ?? a.submittedAt ?? 0));
        }
        return [...approved].sort((a, b) => scoreArtwork(b, approved) - scoreArtwork(a, approved));
      },
      boostArtwork: (id: string) => {
        const status = getBoostStatus(id);
        if (!status.canBoost) {
          return {
            ok: false,
            message: status.needsRewardAd
              ? msg(systemMessages.community.boostWatchAd, language)
              : msg(systemMessages.community.boostCooldown, language)
          };
        }
        const boostedAt = Date.now();
        setItems((current) => current.map((item) => item.id === id ? { ...item, boostedAt } : item));
        if (firebaseEnabled) {
          updateCommunityImage(id, { boostedAt: new Date(boostedAt) } as unknown as Partial<CommunityImageDocument>).catch(() => undefined);
        }
        if (!status.isPremiumBoost) {
          let nextCreditState: { lastAdWatchedAt?: number; credits: number } | undefined;
          setRewardedBoosts((current) => {
            const state = current[account.username] ?? { credits: 0 };
            nextCreditState = {
              ...state,
              credits: Math.max(0, state.credits - 1)
            };
            return {
              ...current,
              [account.username]: nextCreditState
            };
          });
          if (account.uid && nextCreditState) {
            saveRewardedBoostCredit({
              id: `${account.uid}_${resolveActiveWeekId(competitionSettings ?? undefined)}`,
              uid: account.uid,
              username: account.username,
              weekId: resolveActiveWeekId(competitionSettings ?? undefined),
              credits: nextCreditState.credits,
              lastAdWatchedAt: nextCreditState.lastAdWatchedAt ?? 0
            }).catch(() => undefined);
          }
        }
        setRankBucket(getRankBucket());
        return { ok: true, message: msg(systemMessages.community.boosted, language) };
      },
      getBoostStatus,
      getRewardedBoostStatus,
      watchRewardedBoostAd: () => {
        if (!canUseMemberFeatures) {
          return { ok: false, message: msg(systemMessages.verification.boostEmailRequired, language) };
        }
        if (account.isPremium || account.isAdmin) {
          return { ok: false, message: msg(systemMessages.community.boostPremiumBlocked, language) };
        }
        const status = getRewardedBoostStatus();
        if (!status.canWatchAd) {
          return { ok: false, message: msg(systemMessages.community.boostCooldown, language) };
        }
        const nextCreditState = {
          lastAdWatchedAt: Date.now(),
          credits: Math.min(1, status.rewardCredits + 1)
        };
        setRewardedBoosts((current) => ({
          ...current,
          [account.username]: nextCreditState
        }));
        if (account.uid) {
          saveRewardedBoostCredit({
            id: `${account.uid}_${resolveActiveWeekId(competitionSettings ?? undefined)}`,
            uid: account.uid,
            username: account.username,
            weekId: resolveActiveWeekId(competitionSettings ?? undefined),
            credits: nextCreditState.credits,
            lastAdWatchedAt: nextCreditState.lastAdWatchedAt
          }).catch(() => undefined);
        }
        return { ok: true, message: msg(systemMessages.community.boostReady, language) };
      },
      voteArtwork: (id: string, vote: ArtworkVote) => {
        if (!canUseMemberFeatures || !account.uid) return;
        if (voteInFlightRef.current.has(id)) return;
        if (!throttleAction(`vote_artwork_${id}`, 900)) return;
        if (!withinBurstLimit(`vote_artwork_${account.uid}`, 40, 60 * 1000)) return;
        const previousVote = votes[id];
        const previousItems = items;
        const togglingOff = previousVote === vote;
        const currentItem = items.find((item) => item.id === id);
        const likesDelta = (previousVote === "like" ? -1 : 0) + (togglingOff ? 0 : vote === "like" ? 1 : 0);
        const dislikesDelta = (previousVote === "dislike" ? -1 : 0) + (togglingOff ? 0 : vote === "dislike" ? 1 : 0);
        voteInFlightRef.current.add(id);
        if (currentItem) {
          pendingVoteDeltasRef.current.set(id, {
            baseLikes: currentItem.likes,
            baseDislikes: currentItem.dislikes,
            likesDelta,
            dislikesDelta
          });
        }

        setVotes((current) => {
          const next = { ...current };
          if (togglingOff) delete next[id];
          else next[id] = vote;
          return next;
        });

        setItems(items.map((item) => {
          if (item.id !== id) return item;
          const removeLike = previousVote === "like" ? 1 : 0;
          const removeDislike = previousVote === "dislike" ? 1 : 0;
          const addLike = togglingOff ? 0 : vote === "like" ? 1 : 0;
          const addDislike = togglingOff ? 0 : vote === "dislike" ? 1 : 0;
          return {
            ...item,
            likes: Math.max(0, item.likes - removeLike + addLike),
            dislikes: Math.max(0, item.dislikes - removeDislike + addDislike)
          };
        }));

        (togglingOff ? removeReaction(account.uid, "communityImage", id) : setReaction(account.uid, "communityImage", id, vote)).then(() => {
          voteInFlightRef.current.delete(id);
          if (togglingOff || vote !== "like") return;
        }).catch(() => {
          pendingVoteDeltasRef.current.delete(id);
          voteInFlightRef.current.delete(id);
          setVotes(votes);
          setItems(previousItems);
        });
      },
      superLiked,
      getSuperLikeStatus,
      superLikeArtwork: (id: string) => {
        const status = getSuperLikeStatus(id);
        if (!canUseMemberFeatures || !account.uid) {
          return { ok: false, message: msg(systemMessages.verification.emailRequired, language) };
        }
        if (!status.isPremium) {
          return { ok: false, message: superLikePremiumMessage(language) };
        }
        if (!throttleAction(`superlike_${id}`, 800)) return { ok: false };

        if (status.alreadySuperLiked) {
          const targetCount = Math.max(0, (superLikeCounts[id] ?? 1) - 1);
          setSuperLiked((current) => {
            const next = { ...current };
            delete next[id];
            return next;
          });
          setSuperLikeWeekUsed((value) => Math.max(0, value - 1));
          setSuperLikeOverride((current) => ({ ...current, [id]: targetCount }));
          removeSuperLike(account.uid, id).catch(() => {
            setSuperLiked((current) => ({ ...current, [id]: true }));
            setSuperLikeWeekUsed((value) => value + 1);
            setSuperLikeOverride((current) => {
              const next = { ...current };
              delete next[id];
              return next;
            });
          });
          return { ok: true, message: superLikeRemovedMessage(status.remaining + 1, language) };
        }

        if (status.remaining <= 0) {
          return { ok: false, message: superLikeQuotaMessage(language) };
        }

        const weekId = resolveActiveWeekId(competitionSettings ?? undefined);
        const targetCount = (superLikeCounts[id] ?? 0) + 1;
        setSuperLiked((current) => ({ ...current, [id]: true }));
        setSuperLikeWeekUsed((value) => value + 1);
        setSuperLikeOverride((current) => ({ ...current, [id]: targetCount }));
        addSuperLike(account.uid, id, weekId).catch(() => {
          setSuperLiked((current) => {
            const next = { ...current };
            delete next[id];
            return next;
          });
          setSuperLikeWeekUsed((value) => Math.max(0, value - 1));
          setSuperLikeOverride((current) => {
            const next = { ...current };
            delete next[id];
            return next;
          });
        });
        return { ok: true, message: superLikeSuccessMessage(status.remaining - 1, language) };
      },
      toggleFavoriteArtwork: (id: string) => {
        if (!canUseMemberFeatures || !account.uid) return;
        if (!throttleAction(`fav_artwork_${id}`, 700)) return;
        const exists = favoriteIds.includes(id);
        setFavoriteIds(exists ? favoriteIds.filter((item) => item !== id) : [id, ...favoriteIds]);
        (exists ? removeFavorite(account.uid, "communityImage", id) : setFavorite(account.uid, "communityImage", id)).catch(() => {
          setFavoriteIds(favoriteIds);
        });
      },
      addArtworkComment: (artworkId: string, comment: Omit<ArtworkComment, "id" | "communityImageId" | "createdAt">, commentLanguage: Language = language) => {
        if (!canUseMemberFeatures) {
          return { ok: false, message: msg(systemMessages.verification.emailRequired, commentLanguage) };
        }
        if (!canCommentOnDiscoverPost(account)) {
          return {
            ok: false,
            message: commentLanguage === "tr"
              ? "Yorum yapmak için Premium üyelik gerekir."
              : commentLanguage === "ru"
                ? "Для комментариев нужен Premium."
                : commentLanguage === "uz"
                  ? "Izoh yozish uchun Premium kerak."
                  : "Premium membership is required to comment."
          };
        }
        const text = comment.text.trim();
        if (text.length < 2) return { ok: false, message: msg(systemMessages.verification.commentTooShort, commentLanguage) };
        if (containsBlockedLanguage(text)) {
          return { ok: false, reason: "blocked_language" as const, message: buildBlockedLanguageMessage(commentLanguage) };
        }
        const now = Date.now();
        const lastCommentAt = commentTimestamps[comment.username] ?? 0;
        if (now - lastCommentAt < COMMENT_COOLDOWN_MS) {
          const remainingMs = COMMENT_COOLDOWN_MS - (now - lastCommentAt);
          return { ok: false, reason: "cooldown" as const, message: buildCommentCooldownMessage(remainingMs, commentLanguage) };
        }
        const localId = `artwork-comment-${Date.now()}`;
        const localComment: ArtworkComment = {
          ...comment,
          authorId: account.uid,
          text,
          communityImageId: artworkId,
          id: localId,
          createdAt: now
        };
        setCommentsByArtwork((current) => ({
          ...current,
          [artworkId]: [localComment, ...(current[artworkId] ?? [])]
        }));
        if (account.uid) {
          createCommunityImageComment({
            communityImageId: artworkId,
            authorId: account.uid,
            authorUsername: comment.username,
            authorDisplayName: comment.author,
            text,
            status: "published",
            isPremium: Boolean(comment.isPremium)
          }).then((remoteId) => {
            setCommentsByArtwork((current) => ({
              ...current,
              [artworkId]: (current[artworkId] ?? []).map((item) => item.id === localId ? { ...item, id: remoteId } : item)
            }));
          }).catch(() => undefined);
        }
        setCommentTimestamps((current) => ({ ...current, [comment.username]: now }));
        return { ok: true };
      },
      deleteArtworkComment: (artworkId: string, commentId: string) => {
        const artwork = items.find((item) => item.id === artworkId);
        const comment = (commentsByArtwork[artworkId] ?? []).find((item) => item.id === commentId);
        if (!artwork || !comment) return { ok: false };
        if (!canDeleteComment(
          comment,
          {
            kind: "artwork",
            ownerId: artwork.ownerId,
            uploaderUsername: artwork.uploaderUsername,
            artistName: artwork.artistName
          },
          account
        )) {
          return {
            ok: false,
            message: language === "tr"
              ? "Bu yorumu silme yetkiniz yok."
              : language === "ru"
                ? "У вас нет прав удалить этот комментарий."
                : language === "uz"
                  ? "Bu izohni o'chirish huquqingiz yo'q."
                  : "You cannot delete this comment."
          };
        }
        setCommentsByArtwork((current) => ({
          ...current,
          [artworkId]: (current[artworkId] ?? []).filter((item) => item.id !== commentId)
        }));
        if (firebaseEnabled) {
          updateCommunityImageComment(commentId, { status: "archived" }).catch(() => undefined);
        }
        return { ok: true };
      },
      resetWeeklyVotes: () => {
        setVotes({});
      },
      refreshArtworks: () => {
        setRefreshCounter((value) => value + 1);
      }
  };

  return <CommunityArtContext.Provider value={value}>{children}</CommunityArtContext.Provider>;
}

function showImageSaveError(language: Language) {
  const copy = {
    tr: ["Görsel kaydedilemedi", "Bağlantınızı kontrol edip tekrar deneyin."],
    en: ["Image could not be saved", "Check your connection and try again."],
    ru: ["Не удалось сохранить изображение", "Проверьте подключение и повторите попытку."],
    uz: ["Rasm saqlanmadi", "Internet aloqasini tekshirib, qayta urinib ko'ring."]
  }[language];
  Alert.alert(copy[0], copy[1]);
}

function superLikePremiumMessage(language: Language) {
  return {
    tr: "Super Like yalnızca Premium üyeler içindir. Premium'a geçerek haftada 5 esere Super Like verebilirsin.",
    en: "Super Like is for Premium members only. Go Premium to give 5 Super Likes per week.",
    ru: "Super Like доступен только для Premium. Оформите Premium, чтобы ставить 5 Super Like в неделю.",
    uz: "Super Like faqat Premium a'zolar uchun. Premiumga o'ting va haftasiga 5 ta Super Like bering."
  }[language];
}

function superLikeRemovedMessage(remaining: number, language: Language) {
  return {
    tr: `Super Like geri alındı. Bu hafta ${remaining} hakkın var.`,
    en: `Super Like removed. You have ${remaining} left this week.`,
    ru: `Super Like убран. Осталось ${remaining} на этой неделе.`,
    uz: `Super Like qaytarib olindi. Bu hafta ${remaining} ta qoldi.`
  }[language];
}

function superLikeQuotaMessage(language: Language) {
  return {
    tr: "Bu haftaki 5 Super Like hakkını kullandın. Önümüzdeki hafta yenilenecek.",
    en: "You've used all 5 Super Likes this week. They reset next week.",
    ru: "Вы использовали все 5 Super Like на этой неделе. Они обновятся на следующей.",
    uz: "Bu haftadagi 5 ta Super Like'ni ishlatib bo'ldingiz. Keyingi hafta yangilanadi."
  }[language];
}

function superLikeSuccessMessage(remaining: number, language: Language) {
  return {
    tr: `Super Like verildi! Bu hafta ${remaining} hakkın kaldı.`,
    en: `Super Like sent! You have ${remaining} left this week.`,
    ru: `Super Like отправлен! Осталось ${remaining} на этой неделе.`,
    uz: `Super Like yuborildi! Bu hafta ${remaining} ta qoldi.`
  }[language];
}

function matchesCompetitionWeek(itemWeekId: string | undefined, activeWeekId: string) {
  if (!itemWeekId) return false;
  if (itemWeekId === activeWeekId) return true;
  return extractWeekPeriodId(itemWeekId) === extractWeekPeriodId(activeWeekId);
}

function mapCommunityImageDocument(item: CommunityImageDocument): CommunityArtwork {
  const legacy = item as CommunityImageDocument & { image?: string; imageUrl?: string; coverImage?: string };
  const deletedByUser = Boolean(item.deletedByUser);
  const deletedByAdmin = Boolean(item.deletedByAdmin);
  const isPublished = item.status === "published";
  const isLegacyWeekArchive = item.status === "archived" && item.competitionEntry && !deletedByUser && !deletedByAdmin;
  const profileVisible = isPublished || isLegacyWeekArchive;

  return {
    id: item.id,
    language: item.language,
    ownerId: item.ownerId,
    source: item.competitionEntry ? "competition" : "profile",
    image: item.imageURL || legacy.image || legacy.imageUrl || legacy.coverImage || "",
    artistName: item.ownerDisplayName,
    title: item.title,
    story: item.story,
    age: item.age ? String(item.age) : "",
    uploaderUsername: item.ownerUsername,
    ownerCountry: item.country,
    likes: item.likeCount ?? 0,
    dislikes: item.dislikeCount ?? 0,
    approved: profileVisible,
    profileVisible,
    submittedAt: timestampToMillis(item.createdAt),
    approvedAt: timestampToMillis(item.reviewedAt),
    boostedAt: timestampToMillis(item.boostedAt),
    deleted: deletedByUser || deletedByAdmin,
    deletedByUser,
    competitionWeekArchived: Boolean(item.competitionWeekArchived),
    weekId: item.weekId,
    quotaGeneration: item.quotaGeneration,
    rankingHidden: Boolean(item.rankingHidden)
  };
}

function isCommunityArtworkArray(value: unknown): value is CommunityArtwork[] {
  return isResourceArray(value, (item): item is CommunityArtwork => {
    if (!item || typeof item !== "object") return false;
    const artwork = item as Partial<CommunityArtwork>;
    return typeof artwork.id === "string" && typeof artwork.image === "string" && typeof artwork.title === "string";
  });
}

function mapArtworkCommentDocument(comment: CommunityImageCommentDocument): ArtworkComment {
  return {
    id: comment.id,
    communityImageId: comment.communityImageId,
    authorId: comment.authorId,
    author: comment.authorDisplayName,
    username: comment.authorUsername,
    text: comment.text,
    createdAt: timestampToMillis(comment.createdAt) || Date.now(),
    isPremium: comment.isPremium
  };
}

function timestampToMillis(value: unknown) {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  return undefined;
}

function getRankBucket() {
  return Math.floor(Date.now() / WEEKLY_RANK_REFRESH_MS);
}

function normalizeIdentity(value?: string) {
  return (value ?? "").replace(/^@+/, "").trim().toLocaleLowerCase("tr");
}

function stableHash(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function stableIndex(seed: string, length: number) {
  if (!length) return 0;
  return stableHash(seed) % length;
}
