import { createContext, PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, getDocs, limit, query, where, type QueryDocumentSnapshot } from "firebase/firestore";
import { useAccount } from "@/hooks/use-account";
import { useLanguage } from "@/hooks/use-language";
import { useMessaging } from "@/hooks/use-messaging";
import { useRegisterRefresh } from "@/providers/refresh-provider";
import { firestoreDb } from "@/src/services/firebase";
import { createUserFollow, deleteUserFollow, subscribeFollowers, subscribeFollowing, type UserFollowRecord } from "@/src/services/firebase/follow-service";
import { resolveCountryCode } from "@/utils/country-utils";
import { buildSuspendedIdentityIndex, isSuspendedIdentity, normalizeSuspensionKey, type UserIdentityRef } from "@/utils/user-suspension";
import { dedupeSuggestedUsers, isSameAccountUser } from "@/utils/user-identity";
import { commonCopy } from "@/app/i18n/common";
import { t } from "@/utils/localized-text";
import { usePathname } from "expo-router";
import { useStartupPhase } from "@/hooks/use-startup-phase";
import { isResourceArray, loadResourceCache, peekResourceCache, saveResourceCache } from "@/src/services/cache/resource-cache";
import { fetchProfileDiscoveryPage, mapProfileDiscoveryUser, PROFILE_DISCOVERY_SESSION_LIMIT, profileDiscoveryErrorDetails, type SuggestedUser } from "@/src/services/firebase/profile-discovery-service";

export type { SuggestedUser } from "@/src/services/firebase/profile-discovery-service";

const USER_DIRECTORY_CACHE_KEY = "users:directory:first-page";

export type SocialNotification = {
  id: string;
  icon: string;
  title: Record<"tr" | "en" | "ru" | "uz", string>;
  body: Record<"tr" | "en" | "ru" | "uz", string>;
  date: string;
  targetPath?: string;
};

type FollowActionResult = {
  ok: boolean;
  message?: string;
};

type SocialContextValue = {
  suggestedUsers: SuggestedUser[];
  visibleSuggestedUsers: SuggestedUser[];
  followingUids: string[];
  following: string[];
  followingReady: boolean;
  readNotificationIds: string[];
  hasMoreUsers: boolean;
  profileDiscoveryStatus: "loading" | "success" | "error";
  profileDiscoveryRefreshing: boolean;
  profileDiscoveryError: string;
  loadMoreUsers: () => Promise<boolean>;
  retryProfileDiscovery: () => void;
  followUser: (target: { uid?: string; username?: string }) => Promise<FollowActionResult>;
  unfollowUser: (target: { uid?: string; username?: string }) => Promise<FollowActionResult>;
  isFollowing: (target: { uid?: string; username?: string }) => boolean;
  getFollowingFor: (userUid: string) => SuggestedUser[];
  getFollowersFor: (userUid: string) => SuggestedUser[];
  isFollowGraphReady: (userUid: string) => boolean;
  watchFollowGraph: (userUid: string) => void;
  markNotificationRead: (id: string) => void;
  patchSuggestedUser: (uid: string, patch: Partial<SuggestedUser>) => void;
  isUserSuspended: (identity: UserIdentityRef) => boolean;
  isUserBlocked: (identity: UserIdentityRef) => boolean;
};

export const SocialContext = createContext<SocialContextValue>({
  suggestedUsers: [],
  visibleSuggestedUsers: [],
  followingUids: [],
  following: [],
  followingReady: false,
  readNotificationIds: [],
  hasMoreUsers: false,
  profileDiscoveryStatus: "loading",
  profileDiscoveryRefreshing: false,
  profileDiscoveryError: "",
  loadMoreUsers: async () => false,
  retryProfileDiscovery: () => undefined,
  followUser: async () => ({ ok: false }),
  unfollowUser: async () => ({ ok: false }),
  isFollowing: () => false,
  getFollowingFor: () => [],
  getFollowersFor: () => [],
  isFollowGraphReady: () => false,
  watchFollowGraph: () => undefined,
  markNotificationRead: () => undefined,
  patchSuggestedUser: () => undefined,
  isUserSuspended: () => false,
  isUserBlocked: () => false
});

export function SocialProvider({ children }: PropsWithChildren) {
  const { account, canUseMemberFeatures } = useAccount();
  const { language } = useLanguage();
  const { blockedUserIds, blocksReady } = useMessaging();
  const pathname = usePathname();
  const startupPhase = useStartupPhase();
  const directoryRelevant = pathname === "/" || pathname.startsWith("/discover") || pathname.startsWith("/profile") || pathname.startsWith("/feed");
  const directoryNetworkReady = directoryRelevant || startupPhase === "idle";
  const [suggestedUsers, setSuggestedUsers] = useState<SuggestedUser[]>(() => (peekResourceCache<SuggestedUser[]>(USER_DIRECTORY_CACHE_KEY) ?? []).slice(0, PROFILE_DISCOVERY_SESSION_LIMIT));
  const [followingRecords, setFollowingRecords] = useState<UserFollowRecord[]>([]);
  const [followingReady, setFollowingReady] = useState(false);
  const [followersByUid, setFollowersByUid] = useState<Record<string, UserFollowRecord[]>>({});
  const [followingByUid, setFollowingByUid] = useState<Record<string, UserFollowRecord[]>>({});
  const [followGraphReadyByUid, setFollowGraphReadyByUid] = useState<Record<string, { followers: boolean; following: boolean }>>({});
  const [watchedFollowUids, setWatchedFollowUids] = useState<string[]>([]);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const [hasMoreUsers, setHasMoreUsers] = useState(false);
  const [profileDiscoveryStatus, setProfileDiscoveryStatus] = useState<"loading" | "success" | "error">(() => suggestedUsers.length ? "success" : "loading");
  const [profileDiscoveryRefreshing, setProfileDiscoveryRefreshing] = useState(false);
  const [profileDiscoveryError, setProfileDiscoveryError] = useState("");
  const suggestedUsersRef = useRef(suggestedUsers);
  suggestedUsersRef.current = suggestedUsers;
  const usersPageCursorRef = useRef<QueryDocumentSnapshot | null>(null);
  const usersPageLoadingRef = useRef(false);
  const pendingFollowActions = useRef(new Map<string, UserFollowRecord | null>());
  const inFlightFollowWrites = useRef(new Set<string>());

  useRegisterRefresh(() => setRefreshCounter((value) => value + 1), { scope: ["/", "/discover", "/profile"] });

  useEffect(() => {
    let active = true;
    void loadResourceCache(USER_DIRECTORY_CACHE_KEY, isSuggestedUserArray).then((cached) => {
      if (!active || !cached) return;
      setSuggestedUsers(cached.slice(0, PROFILE_DISCOVERY_SESSION_LIMIT));
      setProfileDiscoveryStatus("success");
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!directoryNetworkReady) return;
    let active = true;
    if (suggestedUsersRef.current.length) setProfileDiscoveryRefreshing(true);
    else setProfileDiscoveryStatus("loading");
    setProfileDiscoveryError("");
    fetchProfileDiscoveryPage().then((page) => {
        if (!active) return;
        const firstPage = page.users.slice(0, PROFILE_DISCOVERY_SESSION_LIMIT);
        setSuggestedUsers(firstPage);
        void saveResourceCache(USER_DIRECTORY_CACHE_KEY, firstPage);
        usersPageCursorRef.current = page.cursor;
        setHasMoreUsers(page.hasMore && firstPage.length < PROFILE_DISCOVERY_SESSION_LIMIT);
        setProfileDiscoveryStatus("success");
      })
      .catch((error) => {
        if (!active) return;
        const details = profileDiscoveryErrorDetails(error);
        console.warn("[Profile discovery] User directory query failed.", details);
        setProfileDiscoveryError(details.code);
        setProfileDiscoveryStatus(suggestedUsersRef.current.length ? "success" : "error");
      })
      .finally(() => {
        if (active) setProfileDiscoveryRefreshing(false);
      });
    return () => {
      active = false;
    };
  }, [directoryNetworkReady, refreshCounter]);

  useEffect(() => {
    if (startupPhase !== "idle") return;
    let active = true;
    getDocs(query(collection(firestoreDb, "users"), where("isDisabled", "==", true), limit(500)))
      .then((snapshot) => {
        if (!active) return;
        const suspended = snapshot.docs
          .map((item) => mapProfileDiscoveryUser(item.id, item.data()))
          .filter((item): item is SuggestedUser => Boolean(item));
        setSuggestedUsers((current) => current.map((user) => suspended.find((item) => item.uid === user.uid) ?? user));
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [startupPhase]);

  const loadMoreUsers = useCallback(async () => {
    if (usersPageLoadingRef.current || !hasMoreUsers || suggestedUsersRef.current.length >= PROFILE_DISCOVERY_SESSION_LIMIT) return false;
    usersPageLoadingRef.current = true;
    try {
      const page = await fetchProfileDiscoveryPage(usersPageCursorRef.current);
      usersPageCursorRef.current = page.cursor;
      const remaining = Math.max(0, PROFILE_DISCOVERY_SESSION_LIMIT - suggestedUsersRef.current.length);
      setHasMoreUsers(page.hasMore && remaining > page.users.length);
      setSuggestedUsers((current) => {
        const merged = new Map(current.map((user) => [user.uid || user.username, user]));
        page.users.slice(0, remaining).forEach((user) => merged.set(user.uid || user.username, user));
        const users = [...merged.values()].slice(0, PROFILE_DISCOVERY_SESSION_LIMIT);
        void saveResourceCache(USER_DIRECTORY_CACHE_KEY, users);
        return users;
      });
      return page.users.length > 0;
    } catch (error) {
      const details = profileDiscoveryErrorDetails(error);
      console.warn("[Profile discovery] Next page query failed.", details);
      setProfileDiscoveryError(details.code);
      return false;
    } finally {
      usersPageLoadingRef.current = false;
    }
  }, [hasMoreUsers]);

  useEffect(() => {
    if (!account.uid) return;
    const countryCode = account.countryCode ?? resolveCountryCode(account.country) ?? undefined;
    setSuggestedUsers((current) => current.map((user) => user.uid === account.uid
      ? {
        ...user,
        country: account.country,
        countryCode,
        name: account.displayName,
        username: account.username,
        image: account.avatar ?? ""
      }
      : user));
  }, [account.avatar, account.country, account.countryCode, account.displayName, account.uid, account.username]);

  useEffect(() => {
    if (!account.uid || !canUseMemberFeatures) {
      setFollowingRecords([]);
      setFollowingReady(true);
      return;
    }
    setFollowingReady(false);
    return subscribeFollowing(account.uid, (records, metadata) => {
      const reconciled = [...records];
      pendingFollowActions.current.forEach((optimisticRecord, followedId) => {
        const remoteIndex = reconciled.findIndex((record) => record.followedId === followedId);
        if (optimisticRecord && remoteIndex >= 0) {
          pendingFollowActions.current.delete(followedId);
          return;
        }
        if (!optimisticRecord && remoteIndex < 0) {
          pendingFollowActions.current.delete(followedId);
          return;
        }
        if (optimisticRecord) reconciled.push(optimisticRecord);
        else reconciled.splice(remoteIndex, 1);
      });
      setFollowingRecords(reconciled);
      if (!metadata.fromCache) setFollowingReady(true);
    });
  }, [account.uid, canUseMemberFeatures]);

  useEffect(() => {
    const unsubscribes = watchedFollowUids.flatMap((uid) => [
      subscribeFollowers(uid, (records, metadata) => {
        setFollowersByUid((current) => ({ ...current, [uid]: records }));
        if (!metadata.fromCache) setFollowGraphReadyByUid((current) => ({ ...current, [uid]: { followers: true, following: current[uid]?.following ?? false } }));
      }),
      subscribeFollowing(uid, (records, metadata) => {
        setFollowingByUid((current) => ({ ...current, [uid]: records }));
        if (!metadata.fromCache) setFollowGraphReadyByUid((current) => ({ ...current, [uid]: { followers: current[uid]?.followers ?? false, following: true } }));
      })
    ]);
    return () => {
      unsubscribes.forEach((unsubscribe) => unsubscribe());
    };
  }, [watchedFollowUids]);

  const usersByUid = useMemo(() => {
    const index = new Map<string, SuggestedUser>();
    suggestedUsers.forEach((user) => {
      if (user.uid) index.set(user.uid, user);
    });
    if (account.uid) {
      index.set(account.uid, {
        uid: account.uid,
        name: account.displayName,
        username: account.username,
        image: account.avatar ?? "",
        role: account.role,
        badges: account.badges,
        isPremium: account.isPremium,
        isDisabled: account.isSuspended,
        isAdmin: account.isAdmin,
        country: account.country,
        countryCode: account.countryCode ?? resolveCountryCode(account.country) ?? undefined
      });
    }
    return index;
  }, [account.avatar, account.badges, account.country, account.countryCode, account.displayName, account.isAdmin, account.isPremium, account.isSuspended, account.role, account.uid, account.username, suggestedUsers]);

  const usersByUsername = useMemo(() => {
    const index = new Map<string, SuggestedUser>();
    suggestedUsers.forEach((user) => index.set(user.username, user));
    if (account.uid) {
      index.set(account.username, {
        uid: account.uid,
        name: account.displayName,
        username: account.username,
        image: account.avatar ?? "",
        role: account.role,
        badges: account.badges,
        isPremium: account.isPremium,
        isDisabled: account.isSuspended,
        isAdmin: account.isAdmin,
        country: account.country,
        countryCode: account.countryCode ?? resolveCountryCode(account.country) ?? undefined
      });
    }
    return index;
  }, [account.avatar, account.badges, account.country, account.countryCode, account.displayName, account.isAdmin, account.isPremium, account.isSuspended, account.role, account.uid, account.username, suggestedUsers]);

  const followingUids = useMemo(
    () => followingRecords.map((record) => record.followedId).filter((uid) => Boolean(uid) && !blockedUserIds.includes(uid)),
    [blockedUserIds, followingRecords]
  );

  const following = useMemo(
    () => followingUids
      .map((uid) => usersByUid.get(uid)?.username)
      .filter((username): username is string => Boolean(username)),
    [followingUids, usersByUid]
  );

  const resolveTarget = useCallback((target: { uid?: string; username?: string }) => {
    if (target.uid) {
      const user = usersByUid.get(target.uid);
      return {
        uid: target.uid,
        username: user?.username ?? target.username ?? ""
      };
    }
    if (target.username) {
      const user = usersByUsername.get(target.username);
      return {
        uid: user?.uid,
        username: target.username
      };
    }
    return { uid: undefined, username: "" };
  }, [usersByUid, usersByUsername]);

  const mapFollowRecordsToUsers = useCallback((records: UserFollowRecord[], idKey: "followerId" | "followedId") => {
    return records
      .map((record) => {
        const uid = record[idKey];
        const cached = uid ? usersByUid.get(uid) : undefined;
        if (cached) return cached;
        const username = idKey === "followerId" ? record.followerUsername : record.followedUsername;
        if (!username) return undefined;
        return {
          uid,
          name: username,
          username,
          image: "",
          role: "art_lover" as const
        };
      })
      .filter((user): user is SuggestedUser => Boolean(user?.username))
      .filter((user) => !blockedUserIds.includes(user.uid ?? ""));
  }, [blockedUserIds, usersByUid]);

  const suspendedIndex = useMemo(() => {
    const index = buildSuspendedIdentityIndex(suggestedUsers);
    if (account.isSuspended && account.uid) {
      index.uids.add(account.uid);
      const username = normalizeSuspensionKey(account.username);
      if (username) index.usernames.add(username);
      const name = normalizeSuspensionKey(account.displayName);
      if (name) index.names.add(name);
    }
    return index;
  }, [account.displayName, account.isSuspended, account.uid, account.username, suggestedUsers]);

  const blockedIndex = useMemo(() => {
    const index = buildSuspendedIdentityIndex(suggestedUsers
      .filter((user) => Boolean(user.uid && blockedUserIds.includes(user.uid)))
      .map((user) => ({ ...user, isDisabled: true })));
    blockedUserIds.forEach((uid) => index.uids.add(uid));
    return index;
  }, [blockedUserIds, suggestedUsers]);

  const isUserBlocked = useCallback(
    (identity: UserIdentityRef) => {
      if (account.uid && !blocksReady) return true;
      return isSuspendedIdentity(blockedIndex, identity);
    },
    [account.uid, blockedIndex, blocksReady]
  );

  const unblockedSuggestedUsers = useMemo(
    () => blocksReady ? suggestedUsers.filter((user) => !isUserBlocked({ uid: user.uid, username: user.username, name: user.name })) : [],
    [blocksReady, isUserBlocked, suggestedUsers]
  );

  const visibleSuggestedUsers = useMemo(
    () => dedupeSuggestedUsers(
      unblockedSuggestedUsers.filter((user) => !user.isDisabled && !user.isAdmin && user.isProfileVisible !== false && !isSameAccountUser(user, account))
    ) as SuggestedUser[],
    [account, unblockedSuggestedUsers]
  );

  const isUserSuspended = useCallback(
    (identity: UserIdentityRef) => isSuspendedIdentity(suspendedIndex, identity),
    [suspendedIndex]
  );

  const watchFollowGraph = useCallback((userUid: string) => {
    if (!userUid) return;
    setWatchedFollowUids((current) => current.includes(userUid) ? current : [...current, userUid]);
  }, []);

  const isFollowGraphReady = useCallback((userUid: string) => {
    const ready = followGraphReadyByUid[userUid];
    return Boolean(ready?.followers && ready.following);
  }, [followGraphReadyByUid]);

  const patchSuggestedUser = useCallback((uid: string, patch: Partial<SuggestedUser>) => {
    setSuggestedUsers((current) => {
      const index = current.findIndex((user) => user.uid === uid);
      if (index === -1) {
        if (!patch.username) return current;
        return [{
          uid,
          name: patch.name ?? patch.username,
          username: patch.username,
          image: patch.image ?? "",
          role: patch.role ?? "art_lover",
          ...patch
        }, ...current];
      }
      const user = current[index];
      const changed = Object.entries(patch).some(([key, value]) => user[key as keyof SuggestedUser] !== value);
      if (!changed) return current;
      return current.map((item) => item.uid === uid ? { ...item, ...patch } : item);
    });
  }, []);

  const value = useMemo(
    () => ({
      suggestedUsers: unblockedSuggestedUsers,
      visibleSuggestedUsers,
      followingUids,
      following,
      followingReady,
      readNotificationIds,
      hasMoreUsers,
      profileDiscoveryStatus: !blocksReady && account.uid ? "loading" : profileDiscoveryStatus,
      profileDiscoveryRefreshing,
      profileDiscoveryError,
      loadMoreUsers,
      retryProfileDiscovery: () => setRefreshCounter((value) => value + 1),
      watchFollowGraph,
      followUser: async (target: { uid?: string; username?: string }) => {
        if (!canUseMemberFeatures || !account.uid) {
          return { ok: false, message: "Takip etmek için giriş yapmalısınız." };
        }

        const resolved = resolveTarget(target);
        if (!resolved.uid || resolved.uid === account.uid) {
          return { ok: false, message: "Kullanıcı bulunamadı." };
        }
        const followedId = resolved.uid;
        if (isUserBlocked({ uid: followedId, username: resolved.username })) {
          return { ok: false, message: t(commonCopy.blockedFollowUnavailable, language) };
        }
        if (followingUids.includes(followedId)) {
          return { ok: true };
        }
        if (inFlightFollowWrites.current.has(followedId)) return { ok: false };

        const optimisticRecord: UserFollowRecord = {
          id: `optimistic:${account.uid}:${followedId}`,
          followerId: account.uid,
          followedId,
          followerUsername: account.username,
          followedUsername: resolved.username,
          createdAtMs: Date.now()
        };
        inFlightFollowWrites.current.add(followedId);
        pendingFollowActions.current.set(followedId, optimisticRecord);
        setFollowingRecords((current) => current.some((record) => record.followedId === followedId) ? current : [optimisticRecord, ...current]);
        setFollowersByUid((current) => ({
          ...current,
          [followedId]: (current[followedId] ?? []).some((record) => record.followerId === account.uid)
            ? current[followedId] ?? []
            : [optimisticRecord, ...(current[followedId] ?? [])]
        }));
        try {
          await createUserFollow({
            followerId: account.uid,
            followedId,
            followerUsername: account.username,
            followedUsername: resolved.username
          });
          watchFollowGraph(followedId);
          return { ok: true };
        } catch (error) {
          pendingFollowActions.current.delete(followedId);
          setFollowingRecords((current) => current.filter((record) => record.followedId !== followedId));
          setFollowersByUid((current) => ({ ...current, [followedId]: (current[followedId] ?? []).filter((record) => record.followerId !== account.uid) }));
          const message = error instanceof Error ? error.message : "Takip işlemi kaydedilemedi.";
          return { ok: false, message };
        } finally {
          inFlightFollowWrites.current.delete(followedId);
        }
      },
      unfollowUser: async (target: { uid?: string; username?: string }) => {
        if (!canUseMemberFeatures || !account.uid) {
          return { ok: false, message: "Takibi bırakmak için giriş yapmalısınız." };
        }

        const resolved = resolveTarget(target);
        if (!resolved.uid) {
          return { ok: false, message: "Kullanıcı bulunamadı." };
        }
        const followedId = resolved.uid;
        if (inFlightFollowWrites.current.has(followedId)) return { ok: false };

        const previousRecord = followingRecords.find((record) => record.followedId === followedId) ?? null;
        inFlightFollowWrites.current.add(followedId);
        pendingFollowActions.current.set(followedId, null);
        setFollowingRecords((current) => current.filter((record) => record.followedId !== followedId));
        setFollowersByUid((current) => ({ ...current, [followedId]: (current[followedId] ?? []).filter((record) => record.followerId !== account.uid) }));
        try {
          await deleteUserFollow(account.uid, followedId);
          return { ok: true };
        } catch (error) {
          pendingFollowActions.current.delete(followedId);
          if (previousRecord) {
            setFollowingRecords((current) => current.some((record) => record.followedId === followedId) ? current : [previousRecord, ...current]);
            setFollowersByUid((current) => ({
              ...current,
              [followedId]: (current[followedId] ?? []).some((record) => record.followerId === account.uid)
                ? current[followedId] ?? []
                : [previousRecord, ...(current[followedId] ?? [])]
            }));
          }
          const message = error instanceof Error ? error.message : "Takip bırakma işlemi kaydedilemedi.";
          return { ok: false, message };
        } finally {
          inFlightFollowWrites.current.delete(followedId);
        }
      },
      isFollowing: (target: { uid?: string; username?: string }) => {
        const resolved = resolveTarget(target);
        if (resolved.uid) return followingUids.includes(resolved.uid);
        if (resolved.username) return following.includes(resolved.username);
        return false;
      },
      getFollowingFor: (userUid: string) => mapFollowRecordsToUsers(followingByUid[userUid] ?? [], "followedId"),
      getFollowersFor: (userUid: string) => mapFollowRecordsToUsers(followersByUid[userUid] ?? [], "followerId"),
      isFollowGraphReady,
      markNotificationRead: (id: string) => setReadNotificationIds((current) => current.includes(id) ? current : [id, ...current]),
      patchSuggestedUser,
      isUserSuspended,
      isUserBlocked
    }),
    [
      account.uid,
      account.username,
      blocksReady,
      canUseMemberFeatures,
      followersByUid,
      following,
      followingReady,
      followingByUid,
      followingRecords,
      followingUids,
      hasMoreUsers,
      profileDiscoveryError,
      profileDiscoveryRefreshing,
      profileDiscoveryStatus,
      isUserSuspended,
      isUserBlocked,
      isFollowGraphReady,
      language,
      loadMoreUsers,
      mapFollowRecordsToUsers,
      patchSuggestedUser,
      readNotificationIds,
      resolveTarget,
      unblockedSuggestedUsers,
      visibleSuggestedUsers,
      watchFollowGraph
    ]
  );

  return <SocialContext.Provider value={value}>{children}</SocialContext.Provider>;
}

function isSuggestedUserArray(value: unknown): value is SuggestedUser[] {
  return isResourceArray(value, (item): item is SuggestedUser => {
    if (!item || typeof item !== "object") return false;
    const user = item as Partial<SuggestedUser>;
    return typeof user.username === "string" && typeof user.name === "string";
  });
}

export function getSocialNotifications(): SocialNotification[] {
  return [];
}
