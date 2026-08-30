import { createContext, PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Language } from "@/types/content";
import { useAccount } from "@/hooks/use-account";
import { useLanguage } from "@/hooks/use-language";
import { useSocial } from "@/hooks/use-social";
import { useRegisterRefresh } from "@/providers/refresh-provider";
import { PostCommentDocument, PostDocument } from "@/src/types/firestore";
import { DocumentData, QueryDocumentSnapshot, serverTimestamp } from "firebase/firestore";
import { createPostDocument, getPostDocument, listAllFeedPostsFallback, listAuthorPosts, listPublishedPostsPage, promoteAuthorPendingPosts, PUBLISHED_POSTS_PAGE_SIZE, subscribePublishedPosts, updatePostDocument } from "@/src/services/firebase/post-service";
import { createPostComment, editPostComment, subscribePostComments, updatePostComment } from "@/src/services/firebase/post-comment-service";
import { listUserFavorites, removeFavorite, setFavorite } from "@/src/services/firebase/favorite-service";
import { countTargetReactions, listUserReactions, removeReaction, setReaction } from "@/src/services/firebase/like-service";
import { msg, systemMessages } from "@/app/i18n/system-messages";
import { canCommentOnDiscoverPost, canDeleteComment, canEditDiscoverComment } from "@/utils/comment-permissions";
import { getUserProfile } from "@/src/services/firebase/core";
import { hasActiveUserRestriction } from "@/utils/user-restrictions";
import { Alert } from "react-native";
import { usePathname } from "expo-router";
import { isResourceArray, loadResourceCache, peekResourceCache, saveResourceCache } from "@/src/services/cache/resource-cache";
import { markPerformanceEvent } from "@/utils/performance";
import { useStartupPhase } from "@/hooks/use-startup-phase";

const PUBLIC_POST_CACHE_KEY = "discovery-posts:published-first-page";

export type PostKind = "quote" | "own" | "knowledge" | "note";

export type DiscoveryPost = {
  id: string;
  language: Language;
  authorId?: string;
  author: string;
  username: string;
  authorPhotoURL?: string;
  text: string;
  kind: PostKind;
  likes: number;
  createdAt: number;
  image?: string;
  isPremium?: boolean;
  hidden?: boolean;
  pendingReview?: boolean;
  profileLinkDisabled?: boolean;
  publishedByAdmin?: boolean;
};

export type DiscoveryComment = {
  id: string;
  postId: string;
  authorId?: string;
  author: string;
  username: string;
  text: string;
  createdAt: number;
  isPremium?: boolean;
  editedAt?: number;
};

function sameDiscoveryPost(left: DiscoveryPost, right: DiscoveryPost) {
  return left.id === right.id
    && left.language === right.language
    && left.authorId === right.authorId
    && left.author === right.author
    && left.username === right.username
    && left.authorPhotoURL === right.authorPhotoURL
    && left.text === right.text
    && left.kind === right.kind
    && left.likes === right.likes
    && left.createdAt === right.createdAt
    && left.image === right.image
    && left.isPremium === right.isPremium
    && left.hidden === right.hidden
    && left.pendingReview === right.pendingReview
    && left.profileLinkDisabled === right.profileLinkDisabled
    && left.publishedByAdmin === right.publishedByAdmin;
}

type NewPost = Omit<DiscoveryPost, "id" | "language" | "likes" | "createdAt"> & { skipLimits?: boolean };

type DiscoveryPostContextValue = {
  posts: DiscoveryPost[];
  feedStatus: "loading" | "success" | "error";
  retryFeed: () => void;
  commentsByPost: Record<string, DiscoveryComment[]>;
  likedIds: string[];
  favoriteIds: string[];
  hasMorePosts: boolean;
  loadingMorePosts: boolean;
  loadMorePosts: () => Promise<boolean>;
  addComment: (postId: string, comment: Omit<DiscoveryComment, "id" | "postId" | "createdAt">, language?: "tr" | "en" | "ru" | "uz") => SafetyActionResult;
  deleteComment: (postId: string, commentId: string) => SafetyActionResult;
  editComment: (postId: string, commentId: string, text: string, language?: "tr" | "en" | "ru" | "uz") => SafetyActionResult;
  addPost: (post: NewPost, language?: "tr" | "en" | "ru" | "uz") => SafetyActionResult;
  deletePost: (id: string) => void;
  getPostLimitStatus: (username: string) => RateLimitStatus;
  toggleFavorite: (id: string) => void;
  toggleHidden: (id: string) => void;
  toggleLike: (id: string) => void;
  updatePost: (id: string, next: Pick<DiscoveryPost, "text" | "kind">, language?: "tr" | "en" | "ru" | "uz") => SafetyActionResult;
};

export const DiscoveryPostContext = createContext<DiscoveryPostContextValue>({
  posts: [],
  feedStatus: "loading",
  retryFeed: () => undefined,
  commentsByPost: {},
  likedIds: [],
  favoriteIds: [],
  hasMorePosts: false,
  loadingMorePosts: false,
  loadMorePosts: async () => false,
  addComment: () => ({ ok: false }),
  deleteComment: () => ({ ok: false }),
  editComment: () => ({ ok: false }),
  addPost: () => ({ ok: false }),
  deletePost: () => undefined,
  getPostLimitStatus: () => getRateLimitStatus([]),
  toggleFavorite: () => undefined,
  toggleHidden: () => undefined,
  toggleLike: () => undefined,
  updatePost: () => ({ ok: false })
});

export function DiscoveryPostProvider({ children }: PropsWithChildren) {
  const { account, canUseMemberFeatures } = useAccount();
  const { language } = useLanguage();
  const { suggestedUsers, isUserBlocked, isUserSuspended } = useSocial();
  const pathname = usePathname();
  const startupPhase = useStartupPhase();
  const feedNetworkReady = startupPhase !== "critical" || pathname.startsWith("/feed") || pathname.startsWith("/post");
  const needsPostDetails = pathname.startsWith("/feed") || pathname.startsWith("/post") || pathname.startsWith("/profile");
  const [posts, setPosts] = useState<DiscoveryPost[]>(() => peekResourceCache<DiscoveryPost[]>(PUBLIC_POST_CACHE_KEY) ?? []);
  const [feedStatus, setFeedStatus] = useState<"loading" | "success" | "error">(() => peekResourceCache<DiscoveryPost[]>(PUBLIC_POST_CACHE_KEY) ? "success" : "loading");
  const [feedRetry, setFeedRetry] = useState(0);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, DiscoveryComment[]>>({});
  const [commentTimestamps, setCommentTimestamps] = useState<Record<string, number>>({});
  const [likedIds, setLikedIds] = useState<string[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const [postTimestamps, setPostTimestamps] = useState<Record<string, number[]>>({});
  const [firebaseEnabled, setFirebaseEnabled] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(false);
  const [loadingMorePosts, setLoadingMorePosts] = useState(false);
  const postsPageCursorRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);
  const hydratedPhotoUidsRef = useRef(new Set<string>());
  const pendingLikeDeltaRef = useRef(new Map<string, number>());
  const likeInFlightRef = useRef(new Set<string>());

  const mergeRemotePosts = useCallback((remotePosts: DiscoveryPost[]) => {
    setPosts((current) => {
      const merged = new Map<string, DiscoveryPost>();
      current.forEach((post) => merged.set(post.id, post));
      let changed = false;
      remotePosts.forEach((post) => {
        const pendingDelta = pendingLikeDeltaRef.current.get(post.id) ?? 0;
        const next = pendingDelta ? { ...post, likes: Math.max(0, post.likes + pendingDelta) } : post;
        const previous = merged.get(post.id);
        if (!previous || !sameDiscoveryPost(previous, next)) {
          merged.set(post.id, next);
          changed = true;
        }
      });
      if (!changed) return current;
      return [...merged.values()].sort((a, b) => b.createdAt - a.createdAt);
    });
  }, []);

  const refreshPostLikeCount = useCallback(async (id: string) => {
    const postDoc = await getPostDocument(id).catch(() => null);
    const reactionCount = await countTargetReactions("post", id, "like").catch(() => null);
    const likes = Math.max(0, (reactionCount ?? postDoc?.likeCount ?? 0) + (pendingLikeDeltaRef.current.get(id) ?? 0));
    setPosts((current) => current.map((post) => post.id === id ? { ...post, likes } : post));
  }, []);

  const loadMorePosts = useCallback(async () => {
    if (loadingMorePosts || !hasMorePosts) return false;
    setLoadingMorePosts(true);
    try {
      const page = await listPublishedPostsPage(PUBLISHED_POSTS_PAGE_SIZE, postsPageCursorRef.current);
      postsPageCursorRef.current = page.cursor;
      setHasMorePosts(page.hasMore);
      if (page.posts.length) {
        mergeRemotePosts(page.posts.map(mapPostDocument));
        setFirebaseEnabled(true);
      }
      return page.posts.length > 0;
    } catch {
      setHasMorePosts(false);
      return false;
    } finally {
      setLoadingMorePosts(false);
    }
  }, [hasMorePosts, loadingMorePosts, mergeRemotePosts]);

  useEffect(() => {
    let active = true;
    void loadResourceCache(PUBLIC_POST_CACHE_KEY, isDiscoveryPostArray).then((cached) => {
      if (active && cached) {
        mergeRemotePosts(cached);
        setFeedStatus("success");
        markPerformanceEvent("CACHE_CONTENT_VISIBLE", { resource: "discover", source: "disk", count: cached.length });
      }
    });
    return () => {
      active = false;
    };
  }, [mergeRemotePosts]);

  useEffect(() => {
    if (!feedNetworkReady) return;
    const unsubscribe = subscribePublishedPosts(
      PUBLISHED_POSTS_PAGE_SIZE,
      (page) => {
        setFeedStatus("success");
        postsPageCursorRef.current = page.cursor;
        setHasMorePosts(page.hasMore);
        const mapped = page.posts.map(mapPostDocument);
        mergeRemotePosts(mapped);
        void saveResourceCache(PUBLIC_POST_CACHE_KEY, mapped).catch(() => undefined);
        setFirebaseEnabled(true);
      },
      (error) => {
        if (__DEV__) console.warn("[posts] realtime feed subscription failed", error);
        listAllFeedPostsFallback(200)
          .then((remotePosts) => {
            setFeedStatus("success");
            if (!remotePosts.length) return;
            const mapped = remotePosts.map(mapPostDocument);
            mergeRemotePosts(mapped);
            void saveResourceCache(PUBLIC_POST_CACHE_KEY, mapped).catch(() => undefined);
            setFirebaseEnabled(true);
            setHasMorePosts(remotePosts.length >= PUBLISHED_POSTS_PAGE_SIZE);
          })
          .catch((fallbackError) => {
            if (__DEV__) console.warn("[posts] realtime fallback failed", fallbackError);
            setFeedStatus((current) => current === "success" ? "success" : "error");
          });
      }
    );
    return unsubscribe;
  }, [feedNetworkReady, feedRetry, mergeRemotePosts]);

  useEffect(() => {
    if (feedStatus !== "error" || !feedNetworkReady) return undefined;
    const retry = setTimeout(() => setFeedRetry((current) => current + 1), 8000);
    return () => clearTimeout(retry);
  }, [feedNetworkReady, feedStatus]);

  useEffect(() => {
    if (!account.uid) return;
    promoteAuthorPendingPosts(account.uid).catch((error) => {
      if (__DEV__) console.warn("[posts] pending post sync failed", error);
    });
    listAuthorPosts(account.uid)
      .then((ownPosts) => mergeRemotePosts(ownPosts.map(mapPostDocument)))
      .catch((error) => {
        if (__DEV__) console.warn("[posts] author posts load failed", error);
      });
  }, [account.isPremium, account.uid, mergeRemotePosts]);

  useEffect(() => {
    if (!account.uid || !needsPostDetails) {
      setCommentsByPost({});
      return undefined;
    }

    const unsubscribe = subscribePostComments(
      (remoteComments) => {
        const grouped = remoteComments
          .filter((comment) => comment.status === "published")
          .reduce<Record<string, DiscoveryComment[]>>((acc, comment) => {
            const mapped = mapCommentDocument(comment);
            acc[mapped.postId] = sortDiscoveryComments([...(acc[mapped.postId] ?? []), mapped]);
            return acc;
          }, {});
        setCommentsByPost((current) => mergeCommentState(current, grouped));
      },
      () => {
        setCommentsByPost({});
      }
    );

    return unsubscribe;
  }, [account.uid, needsPostDetails]);

  useEffect(() => {
    if (!account.uid) {
      setLikedIds([]);
      setFavoriteIds([]);
      return;
    }
    let active = true;
    Promise.all([
      listUserReactions(account.uid),
      listUserFavorites(account.uid)
    ])
      .then(([userReactions, userFavorites]) => {
        if (!active) return;
        setLikedIds(userReactions.filter((item) => item.targetType === "post" && item.value === "like").map((item) => item.targetId));
        setFavoriteIds(userFavorites.filter((item) => item.targetType === "post").map((item) => item.targetId));
      })
      .catch(() => {
        if (!active) return;
        setLikedIds([]);
        setFavoriteIds([]);
      });
    return () => {
      active = false;
    };
  }, [account.uid]);

  // Sayfa değişimi / pull-to-refresh ile akışı tazeler. Yayından kaldırılan (admin/kullanıcı
  // silmesi) gönderiler realtime merge'de düşmediği için burada uzak küme yeniden kurulur;
  // yalnızca yerel iyimser gönderiler (post-<ts>) korunur.
  const reloadFeed = useCallback(async () => {
    const remotePosts = await listAllFeedPostsFallback(200).catch((error) => {
      if (__DEV__) console.warn("[posts] refresh failed", error);
      return null;
    });
    if (remotePosts) {
      setPosts((current) => {
        const merged = new Map<string, DiscoveryPost>();
        remotePosts.map(mapPostDocument).forEach((post) => merged.set(post.id, post));
        current.filter((post) => post.id.startsWith("post-")).forEach((post) => merged.set(post.id, post));
        return [...merged.values()].sort((a, b) => b.createdAt - a.createdAt);
      });
      setFirebaseEnabled(true);
    }
    if (!account.uid) return;
    await Promise.allSettled([
      listAuthorPosts(account.uid).then((ownPosts) => mergeRemotePosts(ownPosts.map(mapPostDocument))),
      Promise.all([listUserReactions(account.uid), listUserFavorites(account.uid)]).then(([userReactions, userFavorites]) => {
        setLikedIds(userReactions.filter((item) => item.targetType === "post" && item.value === "like").map((item) => item.targetId));
        setFavoriteIds(userFavorites.filter((item) => item.targetType === "post").map((item) => item.targetId));
      })
    ]);
  }, [account.uid, mergeRemotePosts]);

  useRegisterRefresh(reloadFeed, { scope: ["/feed", "/post"] });

  useEffect(() => {
    if (!needsPostDetails) return;
    const authorIds = [...new Set(
      posts
        .filter((post) => post.authorId && !post.authorPhotoURL?.trim())
        .map((post) => post.authorId!)
        .filter((uid) => !hydratedPhotoUidsRef.current.has(uid))
    )].slice(0, 8);
    if (!authorIds.length) return;

    authorIds.forEach((uid) => hydratedPhotoUidsRef.current.add(uid));
    Promise.all(authorIds.map((uid) => getUserProfile(uid).catch(() => null)))
      .then((profiles) => {
        const photos = new Map<string, string>();
        profiles.forEach((profile) => {
          if (profile?.photoURL?.trim()) photos.set(profile.uid, profile.photoURL.trim());
        });
        if (!photos.size) return;
        setPosts((current) => current.map((post) => {
          const photo = post.authorId ? photos.get(post.authorId) : undefined;
          if (!photo || post.authorPhotoURL?.trim()) return post;
          return { ...post, authorPhotoURL: photo };
        }));
      })
      .catch(() => undefined);
  }, [needsPostDetails, posts]);

  useEffect(() => {
    if (!account.uid) return;
    setPosts((current) => current.map((post) => (
      post.authorId === account.uid
        ? { ...post, username: account.username, author: account.displayName, authorPhotoURL: account.avatar, isPremium: account.isPremium }
        : post
    )));
    setCommentsByPost((current) => {
      let changed = false;
      const next = Object.fromEntries(Object.entries(current).map(([postId, comments]) => {
        const mapped = comments.map((comment) => {
          if (comment.authorId === account.uid) {
            changed = true;
            return { ...comment, username: account.username, author: account.displayName };
          }
          return comment;
        });
        return [postId, mapped];
      }));
      return changed ? next : current;
    });
  }, [account.avatar, account.displayName, account.isPremium, account.uid, account.username]);

  const userIdentityByUid = useMemo(() => {
    const index = new Map<string, { author: string; username: string; authorPhotoURL?: string; isPremium?: boolean }>();
    suggestedUsers.forEach((user) => {
      if (!user.uid) return;
      index.set(user.uid, { author: user.name, username: user.username, authorPhotoURL: user.image || undefined, isPremium: user.isPremium });
    });
    if (account.uid) {
      index.set(account.uid, { author: account.displayName, username: account.username, authorPhotoURL: account.avatar || undefined, isPremium: account.isPremium });
    }
    return index;
  }, [account.avatar, account.displayName, account.isPremium, account.uid, account.username, suggestedUsers]);

  const userIdentityByUsername = useMemo(() => {
    const index = new Map<string, { author: string; username: string; authorPhotoURL?: string; isPremium?: boolean }>();
    suggestedUsers.forEach((user) => {
      index.set(normalizeIdentity(user.username), { author: user.name, username: user.username, authorPhotoURL: user.image || undefined, isPremium: user.isPremium });
      index.set(normalizeIdentity(user.name), { author: user.name, username: user.username, authorPhotoURL: user.image || undefined, isPremium: user.isPremium });
    });
    if (account.uid) {
      const identity = { author: account.displayName, username: account.username, authorPhotoURL: account.avatar || undefined, isPremium: account.isPremium };
      index.set(normalizeIdentity(account.username), identity);
      index.set(normalizeIdentity(account.displayName), identity);
    }
    return index;
  }, [account.avatar, account.displayName, account.isPremium, account.uid, account.username, suggestedUsers]);

  const visiblePosts = useMemo(() => posts
    .filter((post) => !isUserSuspended({ uid: post.authorId, username: post.username, author: post.author })
      && !isUserBlocked({ uid: post.authorId, username: post.username, author: post.author }))
    .map((post) => {
      const identity = (post.authorId ? userIdentityByUid.get(post.authorId) : undefined)
        ?? userIdentityByUsername.get(normalizeIdentity(post.username))
        ?? userIdentityByUsername.get(normalizeIdentity(post.author));
      if (!identity) return post;
      return {
        ...post,
        author: identity.author,
        username: identity.username,
        authorPhotoURL: identity.authorPhotoURL ?? post.authorPhotoURL,
        isPremium: identity.isPremium ?? post.isPremium
      };
    }), [isUserBlocked, isUserSuspended, posts, userIdentityByUid, userIdentityByUsername]);

  const visibleCommentsByPost = useMemo(() => {
    return Object.fromEntries(
      Object.entries(commentsByPost).map(([postId, comments]) => [
        postId,
        comments
          .map((comment) => {
            const identity = (comment.authorId ? userIdentityByUid.get(comment.authorId) : undefined)
              ?? userIdentityByUsername.get(normalizeIdentity(comment.username))
              ?? userIdentityByUsername.get(normalizeIdentity(comment.author));
            if (!identity) return comment;
            return { ...comment, author: identity.author, username: identity.username };
          })
          .filter((comment) => !isUserSuspended({ uid: comment.authorId, username: comment.username, author: comment.author })
            && !isUserBlocked({ uid: comment.authorId, username: comment.username, author: comment.author }))
      ])
    );
  }, [commentsByPost, isUserBlocked, isUserSuspended, userIdentityByUid, userIdentityByUsername]);

  const value = useMemo(
    () => ({
      posts: visiblePosts,
      feedStatus,
      retryFeed: () => {
        setFeedStatus(posts.length ? "success" : "loading");
        setFeedRetry((current) => current + 1);
      },
      commentsByPost: visibleCommentsByPost,
      likedIds,
      favoriteIds,
      hasMorePosts,
      loadingMorePosts,
      loadMorePosts,
      addComment: (postId: string, comment: Omit<DiscoveryComment, "id" | "postId" | "createdAt">, language: "tr" | "en" | "ru" | "uz" = "tr") => {
        if (!canUseMemberFeatures) {
          return { ok: false, message: msg(systemMessages.verification.emailRequired, language) };
        }
        if (!canCommentOnDiscoverPost(account)) {
          return {
            ok: false,
            message: language === "tr"
              ? "Yorum yapmak için Premium üyelik gerekir."
              : language === "ru"
                ? "Для комментариев нужен Premium."
                : language === "uz"
                  ? "Izoh yozish uchun Premium kerak."
                  : "Premium membership is required to comment."
          };
        }
        const text = comment.text.trim();
        if (text.length < 2) return { ok: false, message: msg(systemMessages.verification.commentTooShort, language) };
        if (containsBlockedLanguage(text)) {
          return { ok: false, reason: "blocked_language" as const, message: buildBlockedLanguageMessage(language) };
        }
        const now = Date.now();
        const lastCommentAt = commentTimestamps[comment.username] ?? 0;
        if (now - lastCommentAt < COMMENT_COOLDOWN_MS) {
          const remainingMs = COMMENT_COOLDOWN_MS - (now - lastCommentAt);
          return { ok: false, reason: "cooldown" as const, message: buildCommentCooldownMessage(remainingMs, language) };
        }
        const localId = `comment-${Date.now()}`;
        const localComment = {
          ...comment,
          authorId: account.uid,
          text,
          postId,
          id: localId,
          createdAt: now
        };
        setCommentsByPost((current) => ({
          ...current,
          [postId]: sortDiscoveryComments([localComment, ...(current[postId] ?? [])])
        }));
        if (firebaseEnabled && account.uid) {
          createPostComment({
            postId,
            authorId: account.uid,
            authorUsername: comment.username,
            authorDisplayName: comment.author,
            text,
            status: "published",
            isPremium: Boolean(comment.isPremium)
          }).then((remoteId) => {
            setCommentsByPost((current) => ({
              ...current,
              [postId]: (current[postId] ?? []).map((item) => item.id === localId ? { ...item, id: remoteId } : item)
            }));
          }).catch(() => undefined);
        }
        setCommentTimestamps((current) => ({ ...current, [comment.username]: now }));
        return { ok: true };
      },
      editComment: (postId: string, commentId: string, text: string, language: "tr" | "en" | "ru" | "uz" = "tr") => {
        const comment = (commentsByPost[postId] ?? []).find((item) => item.id === commentId);
        if (!comment) return { ok: false };
        if (!canEditDiscoverComment(comment, account)) {
          return {
            ok: false,
            message: language === "tr"
              ? comment.editedAt
                ? "Bu yorum zaten bir kez düzenlendi."
                : "Yorum yalnızca ilk 3 dakika içinde ve bir kez düzenlenebilir."
              : language === "ru"
                ? comment.editedAt
                  ? "Этот комментарий уже редактировался."
                  : "Редактирование доступно один раз в первые 3 минуты."
                : language === "uz"
                  ? comment.editedAt
                    ? "Bu izoh allaqachon tahrirlangan."
                    : "Izoh faqat dastlabki 3 daqiqada va bir marta tahrirlanadi."
                  : comment.editedAt
                    ? "This comment was already edited once."
                    : "Comments can be edited once within the first 3 minutes."
          };
        }
        const trimmed = text.trim();
        if (trimmed.length < 2) return { ok: false, message: msg(systemMessages.verification.commentTooShort, language) };
        if (containsBlockedLanguage(trimmed)) {
          return { ok: false, reason: "blocked_language" as const, message: buildBlockedLanguageMessage(language) };
        }
        const editedAt = Date.now();
        setCommentsByPost((current) => ({
          ...current,
          [postId]: sortDiscoveryComments((current[postId] ?? []).map((item) => item.id === commentId ? { ...item, text: trimmed, editedAt } : item))
        }));
        if (firebaseEnabled && !commentId.startsWith("comment-")) {
          editPostComment(commentId, trimmed).catch(() => undefined);
        }
        return { ok: true };
      },
      deleteComment: (postId: string, commentId: string) => {
        const post = posts.find((item) => item.id === postId);
        const comment = (commentsByPost[postId] ?? []).find((item) => item.id === commentId);
        if (!post || !comment) return { ok: false };
        if (!canDeleteComment(comment, { kind: "post", authorId: post.authorId, username: post.username }, account)) {
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
        setCommentsByPost((current) => ({
          ...current,
          [postId]: (current[postId] ?? []).filter((item) => item.id !== commentId)
        }));
        if (firebaseEnabled) {
          updatePostComment(commentId, { status: "archived" }).catch(() => undefined);
        }
        return { ok: true };
      },
      addPost: (post: NewPost, language: "tr" | "en" | "ru" | "uz" = "tr") => {
        if (!canUseMemberFeatures) {
          return { ok: false, message: msg(systemMessages.verification.discoverPostRequired, language) };
        }
        if (hasActiveUserRestriction(account.restrictions, "discover_post")) {
          return {
            ok: false,
            message: language === "tr"
              ? "Keşfet paylaşımınız geçici olarak kısıtlandı."
              : language === "ru"
                ? "Публикации в Discover временно ограничены."
                : language === "uz"
                  ? "Keşfetda ulashish vaqtincha cheklangan."
                  : "Discover posting is temporarily restricted."
          };
        }
        if (containsBlockedLanguage(post.text)) {
          return { ok: false, reason: "blocked_language" as const, message: buildBlockedLanguageMessage(language) };
        }

        const now = Date.now();
        const key = post.username || post.author;
        const current = pruneRateLimitTimestamps(postTimestamps[key] ?? [], now);
        if (!post.skipLimits) {
          const status = getRateLimitStatus(current, now);
          if (status.blocked) {
            return { ok: false, reason: "rate_limit" as const, status };
          }
          if (current.length && now - current[current.length - 1] < POST_COOLDOWN_MS) {
            return { ok: false, reason: "cooldown" as const, status, message: buildCooldownMessage(status, language) };
          }

          setPostTimestamps((currentMap) => ({
            ...currentMap,
            [key]: [...current, now]
          }));
        }
        const { skipLimits: _skipLimits, ...cleanPost } = post;
        const localId = `post-${Date.now()}`;
        const localPost = { ...cleanPost, id: localId, language, likes: 0, createdAt: now, pendingReview: false, authorPhotoURL: account.avatar };
        setPosts((current) => [localPost, ...current]);
        if (account.uid) {
          const published = !cleanPost.hidden;
          createPostDocument({
            authorId: account.uid,
            authorUsername: cleanPost.username,
            authorDisplayName: cleanPost.author,
            authorPhotoURL: account.avatar ?? "",
            language,
            text: cleanPost.text,
            kind: cleanPost.kind,
            status: cleanPost.hidden ? "hidden" : "published",
            isPremium: account.isPremium,
            pinned: false,
            scheduledAt: null,
            publishedAt: published ? serverTimestamp() : null
          }).then((remoteId) => {
            setPosts((current) => current.map((item) => item.id === localId ? { ...item, id: remoteId } : item));
            setFirebaseEnabled(true);
            void getPostDocument(remoteId).then((verified) => {
              if (verified) mergeRemotePosts([mapPostDocument(verified)]);
            }).catch((error) => {
              if (__DEV__) console.warn("[posts] post verification read failed", remoteId, error);
            });
          }).catch((error) => {
            if (__DEV__) console.warn("[posts] post create failed", error);
            setPosts((current) => current.filter((item) => item.id !== localId));
            Alert.alert(
              language === "tr" ? "Gönderi kaydedilemedi" : "Post could not be saved",
              language === "tr" ? "Bağlantınızı kontrol edip tekrar deneyin." : "Check your connection and try again."
            );
          });
        }
        return { ok: true, status: getRateLimitStatus(post.skipLimits ? current : [...current, now], now) };
      },
      deletePost: (id: string) => {
        setPosts((current) => current.filter((post) => post.id !== id));
        setLikedIds((current) => current.filter((item) => item !== id));
        setFavoriteIds((current) => current.filter((item) => item !== id));
        if (account.uid) {
          updatePostDocument(id, { status: "archived" }).catch(() => undefined);
        }
      },
      getPostLimitStatus: (username: string) => getRateLimitStatus(postTimestamps[username] ?? []),
      toggleFavorite: (id: string) => {
        if (!canUseMemberFeatures || !account.uid) return;
        const exists = favoriteIds.includes(id);
        setFavoriteIds(exists ? favoriteIds.filter((item) => item !== id) : [id, ...favoriteIds]);
        (exists ? removeFavorite(account.uid, "post", id) : setFavorite(account.uid, "post", id)).catch(() => {
          setFavoriteIds(favoriteIds);
        });
      },
      toggleHidden: (id: string) => {
        if (!canUseMemberFeatures) return;
        setPosts((current) => current.map((post) => {
          if (post.id !== id) return post;
          const hidden = !post.hidden;
          if (account.uid) {
            updatePostDocument(id, {
              status: hidden ? "hidden" : "published",
              publishedAt: hidden ? null : serverTimestamp()
            }).catch(() => undefined);
          }
          return { ...post, hidden };
        }));
      },
      toggleLike: (id: string) => {
        if (!canUseMemberFeatures || !account.uid) return;
        if (likeInFlightRef.current.has(id)) return;
        if (!throttleAction(`like_post_${id}`, 900)) return;
        if (!withinBurstLimit(`like_post_${account.uid}`, 40, 60 * 1000)) return;
        const exists = likedIds.includes(id);
        const optimisticDelta = exists ? -1 : 1;
        likeInFlightRef.current.add(id);
        pendingLikeDeltaRef.current.set(id, (pendingLikeDeltaRef.current.get(id) ?? 0) + optimisticDelta);
        setLikedIds(exists ? likedIds.filter((item) => item !== id) : [id, ...likedIds]);
        setPosts((current) => current.map((post) => post.id === id ? { ...post, likes: Math.max(0, post.likes + optimisticDelta) } : post));
        (exists ? removeReaction(account.uid, "post", id) : setReaction(account.uid, "post", id, "like")).then(async () => {
          pendingLikeDeltaRef.current.delete(id);
          await refreshPostLikeCount(id);
          likeInFlightRef.current.delete(id);
          if (exists) return;
        }).catch(() => {
          pendingLikeDeltaRef.current.delete(id);
          setLikedIds((current) => exists ? [id, ...current.filter((item) => item !== id)] : current.filter((item) => item !== id));
          setPosts((current) => current.map((post) => post.id === id ? { ...post, likes: Math.max(0, post.likes - optimisticDelta) } : post));
          likeInFlightRef.current.delete(id);
        });
      },
      updatePost: (id: string, next: Pick<DiscoveryPost, "text" | "kind">, language: "tr" | "en" | "ru" | "uz" = "tr") => {
        if (!canUseMemberFeatures) {
          return { ok: false, message: msg(systemMessages.verification.discoverEditRequired, language) };
        }
        if (containsBlockedLanguage(next.text)) {
          return { ok: false, reason: "blocked_language" as const, message: buildBlockedLanguageMessage(language) };
        }

        setPosts((current) => current.map((post) => post.id === id ? { ...post, ...next } : post));
        if (firebaseEnabled) {
          updatePostDocument(id, { text: next.text, kind: next.kind }).catch(() => undefined);
        }
        return { ok: true };
      }
    }),
    [account, canUseMemberFeatures, commentTimestamps, commentsByPost, favoriteIds, feedStatus, firebaseEnabled, hasMorePosts, language, likedIds, loadMorePosts, loadingMorePosts, mergeRemotePosts, postTimestamps, posts, refreshPostLikeCount, visibleCommentsByPost, visiblePosts]
  );

  return <DiscoveryPostContext.Provider value={value}>{children}</DiscoveryPostContext.Provider>;
}

function isDiscoveryPost(value: unknown): value is DiscoveryPost {
  if (!value || typeof value !== "object") return false;
  const post = value as Partial<DiscoveryPost>;
  return typeof post.id === "string" && typeof post.text === "string" && typeof post.createdAt === "number";
}

function isDiscoveryPostArray(value: unknown): value is DiscoveryPost[] {
  return isResourceArray(value, isDiscoveryPost);
}

function mapPostDocument(post: PostDocument): DiscoveryPost {
  const legacy = post as PostDocument & { imageURL?: string; image?: string; imageUrl?: string; coverImage?: string; authorPhoto?: string; photoURL?: string };
  const authorPhotoURL = post.authorPhotoURL?.trim() || legacy.authorPhoto?.trim() || legacy.photoURL?.trim() || undefined;
  return {
    id: post.id,
    language: post.language,
    authorId: post.authorId,
    author: post.authorDisplayName?.trim() || post.authorUsername?.trim() || "Art Atlas Üyesi",
    username: post.authorUsername?.trim() || post.authorId?.slice(0, 12) || "artatlas.user",
    authorPhotoURL,
    text: post.text,
    kind: post.kind,
    likes: post.likeCount ?? 0,
    createdAt: timestampToMillis(post.publishedAt) || timestampToMillis(post.createdAt) || Date.now(),
    image: legacy.imageURL || legacy.image || legacy.imageUrl || legacy.coverImage || undefined,
    isPremium: post.isPremium,
    hidden: post.status === "hidden",
    pendingReview: false,
    profileLinkDisabled: Boolean((post as PostDocument & { profileLinkDisabled?: boolean }).profileLinkDisabled)
  };
}

function mapCommentDocument(comment: PostCommentDocument): DiscoveryComment {
  return {
    id: comment.id,
    postId: comment.postId,
    authorId: comment.authorId,
    author: comment.authorDisplayName,
    username: comment.authorUsername,
    text: comment.text,
    createdAt: timestampToMillis(comment.createdAt) || Date.now(),
    isPremium: comment.isPremium,
    editedAt: timestampToMillis(comment.editedAt) || undefined
  };
}

function sortDiscoveryComments(comments: DiscoveryComment[]) {
  return [...comments].sort((left, right) => right.createdAt - left.createdAt);
}

function mergeCommentState(current: Record<string, DiscoveryComment[]>, remote: Record<string, DiscoveryComment[]>) {
  const mergedPosts = new Set([...Object.keys(current), ...Object.keys(remote)]);
  const next: Record<string, DiscoveryComment[]> = {};
  mergedPosts.forEach((postId) => {
    const remoteComments = remote[postId] ?? [];
    const pendingLocal = (current[postId] ?? []).filter((comment) => comment.id.startsWith("comment-"));
    const byId = new Map<string, DiscoveryComment>();
    remoteComments.forEach((comment) => byId.set(comment.id, comment));
    pendingLocal.forEach((comment) => {
      if (![...byId.values()].some((item) => item.text === comment.text && item.authorId === comment.authorId && Math.abs(item.createdAt - comment.createdAt) < 5000)) {
        byId.set(comment.id, comment);
      }
    });
    next[postId] = sortDiscoveryComments([...byId.values()]);
  });
  return next;
}

function normalizeIdentity(value?: string) {
  return (value ?? "").replace(/^@+/, "").trim().toLocaleLowerCase("tr");
}

function timestampToMillis(value: unknown) {
  if (value && typeof value === "object" && "toMillis" in value && typeof value.toMillis === "function") {
    return value.toMillis();
  }
  return 0;
}
