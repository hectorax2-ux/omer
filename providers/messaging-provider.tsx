import { createContext, PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAccount } from "@/hooks/use-account";
import {
  blockDirectMessageUserRemote,
  confirmDirectMessageRemote,
  conversationActionRemote,
  ConversationRecord,
  conversationHasInboxThread,
  DirectMessageRecord,
  reportDirectMessageRemote,
  sendDirectMessageRemote,
  subscribeConversations,
  subscribeUserBlocks,
  unblockDirectMessageUserRemote,
  deleteConversationForUser,
  subscribeDeletedConversations,
  UserBlockRecord
} from "@/src/services/firebase/messaging-service";
import { conversationIdForParticipants, otherParticipantIdFromConversationId } from "@/src/services/firebase/messaging-settings";
import { isResourceArray, loadResourceCache, peekResourceCache, saveResourceCache } from "@/src/services/cache/resource-cache";
import { markPerformanceEvent } from "@/utils/performance";
import { usePathname } from "expo-router";
import { useStartupPhase } from "@/hooks/use-startup-phase";

export type MessageListTab = "primary" | "requests" | "archived" | "blocked";

const BLOCK_CACHE_PREFIX = "artatlas/user-blocks";

export type BlockedUserEntry = {
  uid: string;
  username: string;
  photo: string;
  premium: boolean;
  conversationId?: string;
};

type PendingMessage = {
  clientMessageId: string;
  conversationId: string;
  text: string;
  status: "sending" | "failed";
};

type MessagingContextValue = {
  conversations: ConversationRecord[];
  listTab: MessageListTab;
  setListTab: (tab: MessageListTab) => void;
  listScrollOffset: number;
  setListScrollOffset: (value: number) => void;
  visibleConversations: ConversationRecord[];
  unreadTotal: number;
  unreadConversationCount: number;
  requestCount: number;
  archivedConversationCount: number;
  getOtherParticipant: (conversation: ConversationRecord) => { uid: string; username: string; photo: string; premium: boolean };
  sendMessage: (input: { recipientId?: string; conversationId?: string; text: string; clientMessageId?: string }) => Promise<{ ok: boolean; message?: string; premiumUpsell?: boolean }>;
  acceptRequest: (conversationId: string) => Promise<void>;
  markConversationRead: (conversationId: string) => Promise<void>;
  togglePin: (conversationId: string, pinned: boolean) => Promise<void>;
  toggleArchive: (conversationId: string, archived: boolean) => Promise<void>;
  deleteConversation: (conversationId: string) => Promise<void>;
  blockUser: (targetUserId: string) => Promise<void>;
  unblockUser: (targetUserId: string) => Promise<void>;
  blockedUserIds: string[];
  blockedUsers: BlockedUserEntry[];
  blocksReady: boolean;
  hasBlockedUser: (targetUserId: string) => boolean;
  reportMessage: (conversationId: string, messageId: string, reason: string) => Promise<void>;
  getThreadMessages: (conversationId: string) => DirectMessageRecord[];
  pendingMessages: PendingMessage[];
  retryPending: (clientMessageId: string) => Promise<void>;
  startConversationWith: (recipientId: string) => string;
  syncError: string;
  clearSyncError: () => void;
  setActiveConversationId: (conversationId: string | null) => void;
  deletedConversationIds: string[];
};

export const MessagingContext = createContext<MessagingContextValue>({
  conversations: [],
  listTab: "primary",
  setListTab: () => undefined,
  listScrollOffset: 0,
  setListScrollOffset: () => undefined,
  visibleConversations: [],
  unreadTotal: 0,
  unreadConversationCount: 0,
  requestCount: 0,
  archivedConversationCount: 0,
  getOtherParticipant: () => ({ uid: "", username: "", photo: "", premium: false }),
  sendMessage: async () => ({ ok: false }),
  acceptRequest: async () => undefined,
  markConversationRead: async () => undefined,
  togglePin: async () => undefined,
  toggleArchive: async () => undefined,
  deleteConversation: async () => undefined,
  blockUser: async () => undefined,
  unblockUser: async () => undefined,
  blockedUserIds: [],
  blockedUsers: [],
  blocksReady: true,
  hasBlockedUser: () => false,
  reportMessage: async () => undefined,
  getThreadMessages: () => [],
  pendingMessages: [],
  retryPending: async () => undefined,
  startConversationWith: () => "",
  syncError: "",
  clearSyncError: () => undefined,
  setActiveConversationId: () => undefined,
  deletedConversationIds: []
});

function sortConversations(items: ConversationRecord[], uid: string) {
  return [...items].sort((a, b) => {
    const aPinned = a.pinnedBy[uid] ? 1 : 0;
    const bPinned = b.pinnedBy[uid] ? 1 : 0;
    if (aPinned !== bPinned) return bPinned - aPinned;
    return b.lastMessageAtMs - a.lastMessageAtMs;
  });
}

export function MessagingProvider({ children }: PropsWithChildren) {
  const { account, isAuthenticated, canUseMemberFeatures, isEmailVerified } = useAccount();
  const pathname = usePathname();
  const startupPhase = useStartupPhase();
  const messagingNetworkReady = startupPhase !== "critical" || pathname.startsWith("/messages");
  const [conversations, setConversations] = useState<ConversationRecord[]>([]);
  const [listTab, setListTab] = useState<MessageListTab>("primary");
  const [listScrollOffset, setListScrollOffset] = useState(0);
  const [threadMessages, setThreadMessages] = useState<Record<string, DirectMessageRecord[]>>({});
  const [pendingMessages, setPendingMessages] = useState<PendingMessage[]>([]);
  const [syncError, setSyncError] = useState("");
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [userBlocks, setUserBlocks] = useState<UserBlockRecord[]>([]);
  const [blocksLoadedForUid, setBlocksLoadedForUid] = useState("");
  const [deletedConversationIds, setDeletedConversationIds] = useState<string[]>([]);

  useEffect(() => {
    if (!isAuthenticated || !account.uid) {
      setConversations([]);
      setThreadMessages({});
      setUserBlocks([]);
      setDeletedConversationIds([]);
      return;
    }
    const uid = account.uid;
    const cacheKey = `messages:conversations:${uid}`;
    let active = true;
    const memoryValue = peekResourceCache<ConversationRecord[]>(cacheKey);
    if (memoryValue) setConversations(memoryValue);
    void loadResourceCache(cacheKey, isConversationArray).then((cached) => {
      if (active && cached && !memoryValue) setConversations(cached);
    });
    if (!messagingNetworkReady) return () => {
      active = false;
    };
    const unsubscribe = subscribeConversations(uid, (items) => {
      if (!active) return;
      const visible = items.filter((item) => conversationHasInboxThread(item, uid));
      setConversations(visible);
      void saveResourceCache(cacheKey, visible);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [account.uid, isAuthenticated, messagingNetworkReady]);

  useEffect(() => {
    if (!isAuthenticated || !account.uid) {
      setDeletedConversationIds([]);
      return;
    }
    if (!messagingNetworkReady) return;
    return subscribeDeletedConversations(account.uid, setDeletedConversationIds);
  }, [account.uid, isAuthenticated, messagingNetworkReady]);

  useEffect(() => {
    if (!isAuthenticated || !account.uid) {
      setUserBlocks([]);
      setBlocksLoadedForUid("");
      return;
    }
    const userId = account.uid;
    let active = true;
    let unsubscribe: (() => void) | undefined;
    setUserBlocks([]);
    setBlocksLoadedForUid("");
    AsyncStorage.getItem(`${BLOCK_CACHE_PREFIX}/${userId}`)
      .then((value) => {
        if (!active) return;
        if (value) {
          const parsed = JSON.parse(value) as UserBlockRecord[];
          setUserBlocks(Array.isArray(parsed) ? parsed : []);
        }
        setBlocksLoadedForUid(userId);
        if (!messagingNetworkReady) return;
        unsubscribe = subscribeUserBlocks(userId, (items) => {
          if (!active) return;
          setUserBlocks(items);
          setBlocksLoadedForUid(userId);
        }, () => {
          if (active) setBlocksLoadedForUid(userId);
        });
      })
      .catch(() => {
        if (!active) return;
        setBlocksLoadedForUid(userId);
        if (!messagingNetworkReady) return;
        unsubscribe = subscribeUserBlocks(userId, (items) => {
          if (!active) return;
          setUserBlocks(items);
        });
      });
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [account.uid, isAuthenticated, messagingNetworkReady]);

  useEffect(() => {
    if (!account.uid || blocksLoadedForUid !== account.uid) return;
    AsyncStorage.setItem(`${BLOCK_CACHE_PREFIX}/${account.uid}`, JSON.stringify(userBlocks)).catch(() => undefined);
  }, [account.uid, blocksLoadedForUid, userBlocks]);

  const blockedUserIds = useMemo(
    () => userBlocks.map((item) => item.blockedId).filter(Boolean),
    [userBlocks]
  );

  const blockedUsers = useMemo<BlockedUserEntry[]>(() => blockedUserIds.map((blockedId) => {
    const conversation = conversations.find((item) => item.participantIds.includes(blockedId));
    const block = userBlocks.find((item) => item.blockedId === blockedId);
    return {
      uid: blockedId,
      username: conversation?.participantUsernames[blockedId] ?? block?.blockedUsername ?? block?.blockedDisplayName ?? "kullanici",
      photo: conversation?.participantPhotos[blockedId] ?? "",
      premium: Boolean(conversation?.participantPremium[blockedId]),
      conversationId: conversation?.id
    };
  }), [blockedUserIds, conversations, userBlocks]);

  const sendMessage = useCallback(async (input: { recipientId?: string; conversationId?: string; text: string; clientMessageId?: string }) => {
    if (!canUseMemberFeatures) return { ok: false, message: "Mesaj göndermek için giriş yapmalısın." };
    if (!isEmailVerified) return { ok: false, message: "Mesaj göndermek için e-postanı doğrulamalısın." };
    const text = input.text.trim();
    if (!text) return { ok: false, message: "Mesaj boş olamaz." };
    const clientMessageId = input.clientMessageId || `client-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const recipientId = input.recipientId
      || (input.conversationId && account.uid ? otherParticipantIdFromConversationId(account.uid, input.conversationId) : "");
    const conversationId = input.conversationId ?? (recipientId ? conversationIdForParticipants(account.uid, recipientId) : "");
    setPendingMessages((current) => [...current, { clientMessageId, conversationId, text, status: "sending" }]);
    markPerformanceEvent("MESSAGE_OPTIMISTIC_RENDER", { conversationId });
    setSyncError("");
    try {
      await sendDirectMessageRemote({
        recipientId: recipientId || undefined,
        conversationId: conversationId || undefined,
        text,
        clientMessageId
      });
      setDeletedConversationIds((current) => current.filter((item) => item !== conversationId));
      setPendingMessages((current) => current.filter((item) => item.clientMessageId !== clientMessageId));
      markPerformanceEvent("MESSAGE_SERVER_CONFIRM", { conversationId });
      return { ok: true };
    } catch (error) {
      const wasCommitted = await confirmDirectMessageRemote(conversationId, clientMessageId).catch(() => false);
      if (wasCommitted) {
        setDeletedConversationIds((current) => current.filter((item) => item !== conversationId));
        setPendingMessages((current) => current.filter((item) => item.clientMessageId !== clientMessageId));
        setSyncError("");
        return { ok: true };
      }
      const firebaseError = error as { code?: string; message?: string; details?: unknown };
      const firebaseCode = firebaseError.code ?? "";
      const firebaseMessage = firebaseError.message ?? "";
      const message = firebaseMessage.includes("Konuşma bulunamadı")
        ? "Konuşma bulunamadı."
        : firebaseMessage && firebaseMessage !== "internal"
          ? firebaseMessage
          : error instanceof Error && error.message && error.message !== "internal"
            ? error.message
            : firebaseCode.includes("not-found")
              ? "Konuşma bulunamadı."
              : "Mesaj gönderilemedi.";
      const premiumUpsell = message.includes("Premium") || message.includes("ücretsiz");
      setPendingMessages((current) => current.map((item) => item.clientMessageId === clientMessageId ? { ...item, status: "failed" } : item));
      setSyncError(message);
      return { ok: false, message, premiumUpsell };
    }
  }, [account.uid, canUseMemberFeatures, isEmailVerified]);

  const retryPending = useCallback(async (clientMessageId: string) => {
    const pending = pendingMessages.find((item) => item.clientMessageId === clientMessageId);
    if (!pending) return;
    setPendingMessages((current) => current.filter((item) => item.clientMessageId !== clientMessageId));
    await sendMessage({
      conversationId: pending.conversationId,
      recipientId: account.uid ? otherParticipantIdFromConversationId(account.uid, pending.conversationId) : undefined,
      text: pending.text,
      clientMessageId: pending.clientMessageId
    });
  }, [account.uid, pendingMessages, sendMessage]);

  const toggleArchive = useCallback(async (conversationId: string, archived: boolean) => {
    let snapshot: ConversationRecord[] = [];
    setConversations((current) => {
      snapshot = current;
      return current.map((item) => item.id === conversationId
        ? { ...item, archivedBy: { ...item.archivedBy, [account.uid]: archived } }
        : item);
    });
    try {
      await conversationActionRemote(conversationId, archived ? "archive" : "unarchive");
    } catch (error) {
      setConversations(snapshot);
      throw error;
    }
  }, [account.uid]);

  const deleteConversation = useCallback(async (conversationId: string) => {
    let snapshot: ConversationRecord[] = [];
    setConversations((current) => {
      snapshot = current;
      return current.filter((item) => item.id !== conversationId);
    });
    setDeletedConversationIds((current) => current.filter((item) => item !== conversationId));
    try {
      await deleteConversationForUser(conversationId);
    } catch (error) {
      setConversations(snapshot);
      throw error;
    }
  }, []);

  const blockUser = useCallback(async (targetUserId: string) => {
    let blocksSnapshot: UserBlockRecord[] = [];
    let conversationsSnapshot: ConversationRecord[] = [];
    setUserBlocks((current) => {
      blocksSnapshot = current;
      if (current.some((item) => item.blockedId === targetUserId)) return current;
      return [...current, {
        id: `${account.uid}_${targetUserId}`,
        blockerId: account.uid,
        blockedId: targetUserId,
        createdAtMs: Date.now()
      }];
    });
    setConversations((current) => {
      conversationsSnapshot = current;
      return current.map((item) => {
        if (!item.participantIds.includes(targetUserId)) return item;
        return { ...item, status: "blocked" };
      });
    });
    try {
      await blockDirectMessageUserRemote(targetUserId);
    } catch (error) {
      setUserBlocks(blocksSnapshot);
      setConversations(conversationsSnapshot);
      throw error;
    }
  }, [account.uid]);

  const unblockUser = useCallback(async (targetUserId: string) => {
    let blocksSnapshot: UserBlockRecord[] = [];
    let conversationsSnapshot: ConversationRecord[] = [];
    setUserBlocks((current) => {
      blocksSnapshot = current;
      return current.filter((item) => item.blockedId !== targetUserId);
    });
    setConversations((current) => {
      conversationsSnapshot = current;
      return current.map((item) => {
        if (!item.participantIds.includes(targetUserId) || item.status !== "blocked") return item;
        return { ...item, status: "active" };
      });
    });
    try {
      await unblockDirectMessageUserRemote(targetUserId);
    } catch (error) {
      setUserBlocks(blocksSnapshot);
      setConversations(conversationsSnapshot);
      throw error;
    }
  }, []);

  const value = useMemo<MessagingContextValue>(() => ({
    conversations,
    listTab,
    setListTab,
    listScrollOffset,
    setListScrollOffset,
    visibleConversations: sortConversations(
      conversations.filter((conversation) => {
        if (!conversationHasInboxThread(conversation, account.uid)) return false;
        if (listTab === "blocked") return false;
        if (listTab === "requests") return conversation.status === "request" && conversation.requestBy !== account.uid;
        if (listTab === "archived") return conversation.archivedBy[account.uid];
        if (conversation.archivedBy[account.uid]) return false;
        if (conversation.status === "request" && conversation.requestBy !== account.uid) return false;
        return conversation.status !== "blocked" && conversation.status !== "closed";
      }),
      account.uid
    ),
    unreadTotal: conversations.reduce((sum, conversation) => {
      if (!conversationHasInboxThread(conversation, account.uid)) return sum;
      if (conversation.status === "blocked" || conversation.status === "closed" || conversation.archivedBy[account.uid]) return sum;
      return sum + (conversation.unreadCount[account.uid] ?? 0);
    }, 0),
    unreadConversationCount: conversations.filter((conversation) => {
      if (!conversationHasInboxThread(conversation, account.uid)) return false;
      if (conversation.status === "blocked" || conversation.status === "closed" || conversation.archivedBy[account.uid]) return false;
      return (conversation.unreadCount[account.uid] ?? 0) > 0;
    }).length,
    requestCount: conversations.filter((conversation) => conversation.status === "request" && conversation.requestBy !== account.uid).length,
    archivedConversationCount: conversations.filter((conversation) => conversation.archivedBy[account.uid]).length,
    getOtherParticipant(conversation) {
      const uid = conversation.participantIds.find((item) => item !== account.uid) ?? "";
      return {
        uid,
        username: conversation.participantUsernames[uid] ?? "kullanici",
        photo: conversation.participantPhotos[uid] ?? "",
        premium: Boolean(conversation.participantPremium[uid])
      };
    },
    sendMessage,
    acceptRequest: async (conversationId) => {
      await conversationActionRemote(conversationId, "accept_request");
    },
    markConversationRead: async (conversationId) => {
      if (activeConversationId !== conversationId) return;
      try {
        await conversationActionRemote(conversationId, "mark_read");
      } catch {
        return;
      }
    },
    togglePin: async (conversationId, pinned) => {
      await conversationActionRemote(conversationId, pinned ? "pin" : "unpin");
    },
    toggleArchive,
    deleteConversation,
    blockUser,
    unblockUser,
    blockedUserIds,
    blockedUsers,
    blocksReady: !account.uid || blocksLoadedForUid === account.uid,
    hasBlockedUser: (targetUserId) => blockedUserIds.includes(targetUserId),
    reportMessage: async (conversationId, messageId, reason) => {
      await reportDirectMessageRemote(conversationId, messageId, reason);
    },
    getThreadMessages: (conversationId) => threadMessages[conversationId] ?? [],
    pendingMessages,
    retryPending,
    startConversationWith: (recipientId) => conversationIdForParticipants(account.uid, recipientId),
    syncError,
    clearSyncError: () => setSyncError(""),
    setActiveConversationId,
    deletedConversationIds
  }), [account.uid, activeConversationId, blockUser, blockedUserIds, blockedUsers, blocksLoadedForUid, conversations, deleteConversation, deletedConversationIds, listScrollOffset, listTab, pendingMessages, retryPending, sendMessage, syncError, threadMessages, toggleArchive, unblockUser]);

  return <MessagingContext.Provider value={value}>{children}</MessagingContext.Provider>;
}

function isConversationArray(value: unknown): value is ConversationRecord[] {
  return isResourceArray(value, (item): item is ConversationRecord => {
    if (!item || typeof item !== "object") return false;
    const conversation = item as Partial<ConversationRecord>;
    return typeof conversation.id === "string" && Array.isArray(conversation.participantIds);
  });
}
