import { useCallback, useEffect, useMemo, useState } from "react";
import { AppState } from "react-native";
import { useAccount } from "@/hooks/use-account";
import { useArtists } from "@/hooks/use-artists";
import { useArtStories } from "@/hooks/use-art-stories";
import { useArtStoryEngagement } from "@/hooks/use-art-story-engagement";
import { useArtSystems } from "@/hooks/use-art-systems";
import { useArtworks } from "@/hooks/use-artworks";
import { useCommunityArt } from "@/hooks/use-community-art";
import { useDiscoveryPosts } from "@/hooks/use-discovery-posts";
import { useEngagement } from "@/hooks/use-engagement";
import { useLanguage } from "@/hooks/use-language";
import { useSocial } from "@/hooks/use-social";
import { rankProfileDiscoveryUsers } from "@/features/profile/profile-discovery-ranking";
import { resolveCountryId } from "@/utils/country-utils";
import { buildHomeFeed } from "./content-engine";
import { buildArtJourney } from "./journey-engine";
import { loadHomeExposures, loadHomeFeedCache, recordHomeExposures, saveHomeFeedCache } from "./cache";
import { useJourneyExperience } from "./use-journey-experience";
import type { HomeExposure, HomeFeedModel } from "./types";
import { useHomeRuntimeConfig } from "./use-home-runtime-config";

const sessionShownByUser = new Map<string, string[]>();
const sessionRotationByUser = new Map<string, number>();
const emptySessionIds: string[] = [];

export function useHomeExperience() {
  const { language } = useLanguage();
  const { account, isAuthenticated, authLoading, canUseMemberFeatures } = useAccount();
  const { artworks, loading: artworksLoading, error: artworksError } = useArtworks(60);
  const { artists, loading: artistsLoading, error: artistsError } = useArtists(40);
  const { stories, loading: storiesLoading, error: storiesError } = useArtStories();
  const { favoriteArtworkIds, readArtworkIds, artworkVotes } = useEngagement();
  const { readIds: readStoryIds } = useArtStoryEngagement(account.uid);
  const { personalMuseums, seerLevels, seerPoints } = useArtSystems();
  const social = useSocial();
  const { items: communityItems } = useCommunityArt();
  const { posts } = useDiscoveryPosts();
  const [now, setNow] = useState(() => new Date());
  const [cachedFeed, setCachedFeed] = useState<HomeFeedModel | null>(null);
  const [cacheHydrated, setCacheHydrated] = useState(false);
  const [exposures, setExposures] = useState<HomeExposure[]>([]);
  const [rotationKey, setRotationKey] = useState(() => sessionRotationByUser.get(account.uid || "guest") ?? 0);
  const runtimeConfig = useHomeRuntimeConfig();
  const uidScope = account.uid || "guest";
  const [sessionRecentlyShownIds, setSessionRecentlyShownIds] = useState(() => sessionShownByUser.get(uidScope) ?? emptySessionIds);

  useEffect(() => {
    setSessionRecentlyShownIds(sessionShownByUser.get(uidScope) ?? emptySessionIds);
    setRotationKey(sessionRotationByUser.get(uidScope) ?? 0);
  }, [uidScope]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      const nextRotation = (sessionRotationByUser.get(uidScope) ?? 0) + 1;
      sessionRotationByUser.set(uidScope, nextRotation);
      setSessionRecentlyShownIds(sessionShownByUser.get(uidScope) ?? emptySessionIds);
      setRotationKey(nextRotation);
      setNow(new Date());
    });
    return () => subscription.remove();
  }, [uidScope]);

  useEffect(() => {
    let active = true;
    setCachedFeed(null);
    setCacheHydrated(false);
    Promise.all([loadHomeFeedCache(uidScope), loadHomeExposures(uidScope)])
      .then(([feed, history]) => {
        if (!active) return;
        setCachedFeed(feed?.locale === language ? feed : null);
        setExposures(history);
      })
      .catch(() => undefined)
      .finally(() => {
        if (active) setCacheHydrated(true);
      });
    return () => {
      active = false;
    };
  }, [language, uidScope]);

  const museumArtworkIds = useMemo(() => personalMuseums
    .filter((museum) => museum.active && (
      museum.ownerId === account.uid || normalizeIdentity(museum.ownerUsername) === normalizeIdentity(account.username)
    ))
    .flatMap((museum) => museum.artworkIds), [account.uid, account.username, personalMuseums]);
  const likedArtworkIds = useMemo(() => Object.entries(artworkVotes).filter(([, value]) => value === "like").map(([id]) => id), [artworkVotes]);
  const dislikedArtworkIds = useMemo(() => Object.entries(artworkVotes).filter(([, value]) => value === "dislike").map(([id]) => id), [artworkVotes]);
  const journey = useMemo(() => buildArtJourney({ artworks, artists, stories, language }), [artists, artworks, language, stories]);
  const journeyExperience = useJourneyExperience(journey, account.uid, uidScope);

  const generatedFeed = useMemo(() => buildHomeFeed({
    artworks,
    artists,
    stories,
    language,
    now,
    userKey: uidScope,
    interests: account.interests,
    favoriteArtworkIds,
    readArtworkIds,
    likedArtworkIds,
    dislikedArtworkIds,
    museumArtworkIds,
    readStoryIds,
    exposures,
    sessionRecentlyShownIds,
    rotationKey,
    isReturningUser: isAuthenticated && (readArtworkIds.length > 0 || favoriteArtworkIds.length > 0 || account.totalScore > 0),
    journeyCompletedCount: journeyExperience.progress.completedStageIds.length,
    loading: {
      artworks: artworksLoading,
      artists: artistsLoading,
      stories: storiesLoading
    },
    errors: {
      artworks: artworksError,
      artists: artistsError,
      stories: storiesError
    },
    dailyOverrides: runtimeConfig.overrides
  }, runtimeConfig.config), [
    account.interests,
    account.totalScore,
    artists,
    artistsError,
    artistsLoading,
    artworks,
    artworksLoading,
    artworksError,
    dislikedArtworkIds,
    exposures,
    favoriteArtworkIds,
    isAuthenticated,
    journeyExperience.progress.completedStageIds.length,
    language,
    likedArtworkIds,
    museumArtworkIds,
    now,
    readArtworkIds,
    readStoryIds,
    rotationKey,
    runtimeConfig,
    sessionRecentlyShownIds,
    stories,
    storiesLoading,
    storiesError,
    uidScope
  ]);
  const feed = useMemo(() => {
    const useCached = !artworks.length && Boolean(cachedFeed) && (artworksLoading || artworksError);
    if (!useCached || !cachedFeed) return generatedFeed;
    return {
      ...cachedFeed,
      locale: language,
      states: { ...cachedFeed.states, artworks: "stale" as const }
    };
  }, [artworks.length, artworksError, artworksLoading, cachedFeed, generatedFeed, language]);

  useEffect(() => {
    if (!feed.hero.length || feed.states.artworks === "loading") return;
    void saveHomeFeedCache(uidScope, feed).catch(() => undefined);
    sessionShownByUser.set(uidScope, [...new Set([
      ...feed.hero.map((item) => item.id),
      ...feed.recommendations.map((item) => item.id),
      ...feed.popular.map((item) => item.id),
      ...sessionRecentlyShownIds
    ])].slice(0, 40));
    const timer = setTimeout(() => {
      const visibleHeroId = feed.hero[0]?.id;
      if (visibleHeroId) void recordHomeExposures(uidScope, feed.dayKey, [visibleHeroId], "seen").catch(() => undefined);
    }, 1100);
    return () => clearTimeout(timer);
  }, [feed, sessionRecentlyShownIds, uidScope]);

  const recordDiscoveryOpen = useCallback((kind: "artwork" | "artist" | "story", id: string) => {
    const exposureId = kind === "artwork" ? id : `${kind}:${id}`;
    void recordHomeExposures(uidScope, feed.dayKey, [exposureId], "opened").catch(() => undefined);
  }, [feed.dayKey, uidScope]);

  const followedUsernameSet = useMemo(() => new Set(social.following.map(normalizeIdentity).filter(Boolean)), [social.following]);
  const followedUidSet = useMemo(() => new Set(social.followingUids), [social.followingUids]);
  const followingArtworks = useMemo(() => communityItems
    .filter((item) => {
      if (item.deleted || !item.approved || !item.image) return false;
      if (item.ownerId && followedUidSet.has(item.ownerId)) return true;
      return followedUsernameSet.has(normalizeIdentity(item.uploaderUsername || item.artistName));
    })
    .sort((a, b) => (b.approvedAt ?? b.submittedAt ?? 0) - (a.approvedAt ?? a.submittedAt ?? 0))
    .slice(0, 9), [communityItems, followedUidSet, followedUsernameSet]);
  const followingPosts = useMemo(() => posts.filter((post) => {
    if (post.hidden) return false;
    if (post.authorId && followedUidSet.has(post.authorId)) return true;
    return followedUsernameSet.has(normalizeIdentity(post.username || post.author));
  }).slice(0, 6), [followedUidSet, followedUsernameSet, posts]);
  const suggestedUsers = useMemo(() => rankProfileDiscoveryUsers(
    social.visibleSuggestedUsers.filter((user) => !(user.uid && followedUidSet.has(user.uid)) && !followedUsernameSet.has(normalizeIdentity(user.username))),
    {
      followingUids: social.followingUids,
      countryId: resolveCountryId(account.country),
      interests: account.interests,
      dayKey: feed.dayKey
    }
  ), [account.country, account.interests, feed.dayKey, followedUidSet, followedUsernameSet, social.followingUids, social.visibleSuggestedUsers]);
  const currentSeerLevel = [...seerLevels].reverse().find((level) => seerPoints >= level.requiredPoints) ?? seerLevels[0];
  const isInitialReady = cacheHydrated
    && journeyExperience.loaded
    && (Boolean(cachedFeed) || (!artworksLoading && !artistsLoading && !storiesLoading));

  return {
    account,
    isAuthenticated,
    authLoading,
    canUseMemberFeatures,
    feed,
    journey,
    journeyExperience,
    followingArtworks,
    followingPosts,
    suggestedUsers,
    social,
    currentSeerLevel,
    seerPoints,
    museumArtworkIds,
    readArtworkIds,
    favoriteArtworkIds,
    runtimeConfig,
    recordDiscoveryOpen,
    isInitialReady
  };
}

function normalizeIdentity(value: string) {
  return value.trim().toLocaleLowerCase("tr").replaceAll(" ", ".").replaceAll("ı", "i");
}
