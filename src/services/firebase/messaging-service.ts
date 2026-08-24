import { collection, doc, getDocs, onSnapshot, query, where, orderBy, limit, type Unsubscribe } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { firestoreDb, firebaseApp } from "./core";

export type ConversationRecord = {
  id: string;
  participantIds: string[];
  participantUsernames: Record<string, string>;
  participantPhotos: Record<string, string>;
  participantPremium: Record<string, boolean>;
  lastMessageText: string;
  lastMessageAtMs: number;
  lastSenderId: string;
  unreadCount: Record<string, number>;
  status: "request" | "active" | "blocked" | "closed" | "archived";
  requestBy: string | null;
  pinnedBy: Record<string, boolean>;
  mutedBy: Record<string, boolean>;
  archivedBy: Record<string, boolean>;
  visibleFor: Record<string, boolean>;
  historyClearedAtMs: number;
  createdBy: string;
};

export type UserBlockRecord = {
  id: string;
  blockerId: string;
  blockedId: string;
  blockedUsername?: string;
  blockedDisplayName?: string;
  createdAtMs: number;
};

export type DirectMessageRecord = {
  id: string;
  senderId: string;
  text: string;
  createdAtMs: number;
  readAtMs: number | null;
  clientMessageId: string;
  deliveryStatus: "sending" | "sent" | "failed";
};

function timestampMs(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  return 0;
}

export function mapConversation(id: string, data: Record<string, unknown>): ConversationRecord {
  return {
    id,
    participantIds: Array.isArray(data.participantIds) ? data.participantIds.filter((item): item is string => typeof item === "string") : [],
    participantUsernames: typeof data.participantUsernames === "object" && data.participantUsernames ? data.participantUsernames as Record<string, string> : {},
    participantPhotos: typeof data.participantPhotos === "object" && data.participantPhotos ? data.participantPhotos as Record<string, string> : {},
    participantPremium: typeof data.participantPremium === "object" && data.participantPremium ? data.participantPremium as Record<string, boolean> : {},
    lastMessageText: typeof data.lastMessageText === "string" ? data.lastMessageText : "",
    lastMessageAtMs: timestampMs(data.lastMessageAt),
    lastSenderId: typeof data.lastSenderId === "string" ? data.lastSenderId : "",
    unreadCount: typeof data.unreadCount === "object" && data.unreadCount ? data.unreadCount as Record<string, number> : {},
    status: data.status === "request" || data.status === "blocked" || data.status === "closed" || data.status === "archived" ? data.status : "active",
    requestBy: typeof data.requestBy === "string" ? data.requestBy : null,
    pinnedBy: typeof data.pinnedBy === "object" && data.pinnedBy ? data.pinnedBy as Record<string, boolean> : {},
    mutedBy: typeof data.mutedBy === "object" && data.mutedBy ? data.mutedBy as Record<string, boolean> : {},
    archivedBy: typeof data.archivedBy === "object" && data.archivedBy ? data.archivedBy as Record<string, boolean> : {},
    visibleFor: typeof data.visibleFor === "object" && data.visibleFor ? data.visibleFor as Record<string, boolean> : {},
    historyClearedAtMs: timestampMs(data.historyClearedAt),
    createdBy: typeof data.createdBy === "string" ? data.createdBy : ""
  };
}

export function conversationHasInboxThread(conversation: ConversationRecord, userId: string) {
  if (conversation.visibleFor[userId] === false) return false;
  if (conversation.historyClearedAtMs > 0 && conversation.lastMessageAtMs <= conversation.historyClearedAtMs) return false;
  return true;
}

export function mapDirectMessage(id: string, data: Record<string, unknown>): DirectMessageRecord {
  return {
    id,
    senderId: typeof data.senderId === "string" ? data.senderId : "",
    text: typeof data.text === "string" ? data.text : "",
    createdAtMs: timestampMs(data.createdAt),
    readAtMs: data.readAt ? timestampMs(data.readAt) : null,
    clientMessageId: typeof data.clientMessageId === "string" ? data.clientMessageId : id,
    deliveryStatus: data.deliveryStatus === "failed" ? "failed" : data.deliveryStatus === "sending" ? "sending" : "sent"
  };
}

export function mapUserBlock(id: string, data: Record<string, unknown>): UserBlockRecord {
  return {
    id,
    blockerId: typeof data.blockerId === "string" ? data.blockerId : "",
    blockedId: typeof data.blockedId === "string" ? data.blockedId : "",
    blockedUsername: typeof data.blockedUsername === "string" ? data.blockedUsername : undefined,
    blockedDisplayName: typeof data.blockedDisplayName === "string" ? data.blockedDisplayName : undefined,
    createdAtMs: timestampMs(data.createdAt)
  };
}

export function subscribeUserBlocks(userId: string, onChange: (items: UserBlockRecord[]) => void, onError?: () => void): Unsubscribe {
  return onSnapshot(
    query(collection(firestoreDb, "userBlocks"), where("blockerId", "==", userId)),
    (snapshot) => {
      onChange(snapshot.docs.map((item) => mapUserBlock(item.id, item.data() as Record<string, unknown>)));
    },
    () => onError?.()
  );
}

export function subscribeConversations(userId: string, onChange: (items: ConversationRecord[]) => void): Unsubscribe {
  return onSnapshot(
    query(collection(firestoreDb, "conversations"), where("participantIds", "array-contains", userId), orderBy("lastMessageAt", "desc"), limit(100)),
    (snapshot) => {
      onChange(snapshot.docs.map((item) => mapConversation(item.id, item.data() as Record<string, unknown>)));
    },
    () => onChange([])
  );
}

export function subscribeConversation(conversationId: string, onChange: (item: ConversationRecord | null) => void): Unsubscribe {
  return onSnapshot(
    doc(firestoreDb, "conversations", conversationId),
    (snapshot) => {
      if (!snapshot.exists()) {
        onChange(null);
        return;
      }
      onChange(mapConversation(snapshot.id, snapshot.data() as Record<string, unknown>));
    },
    () => onChange(null)
  );
}

export function subscribeConversationMessages(
  conversationId: string,
  onChange: (items: DirectMessageRecord[], meta: { fromCache: boolean; reachedStart: boolean }) => void,
  onError?: (error: { code?: string; message?: string }) => void,
  max = 40
): Unsubscribe {
  return onSnapshot(
    query(collection(firestoreDb, "conversations", conversationId, "messages"), orderBy("createdAt", "desc"), limit(max)),
    (snapshot) => {
      const items = snapshot.docs.map((item) => mapDirectMessage(item.id, item.data() as Record<string, unknown>));
      onChange(items, { fromCache: snapshot.metadata.fromCache, reachedStart: snapshot.size < max });
    },
    (error) => {
      onError?.({ code: (error as { code?: string }).code, message: error.message });
    }
  );
}

export async function sendDirectMessageRemote(input: {
  recipientId?: string;
  conversationId?: string;
  text: string;
  clientMessageId: string;
}) {
  const callable = httpsCallable(getFunctions(firebaseApp), "sendDirectMessage");
  try {
    const result = await callable(input);
    return result.data as { conversationId: string; messageId: string; status: string; duplicate?: boolean };
  } catch (error) {
    const firebaseError = error as { code?: string; message?: string };
    const message = firebaseError.message && firebaseError.message !== "internal"
      ? firebaseError.message
      : firebaseError.code?.includes("not-found")
        ? "Konuşma bulunamadı."
        : "Mesaj gönderilemedi.";
    throw new Error(message);
  }
}

export async function confirmDirectMessageRemote(conversationId: string, clientMessageId: string) {
  if (!conversationId || !clientMessageId) return false;
  const snapshot = await getDocs(query(
    collection(firestoreDb, "conversations", conversationId, "messages"),
    where("clientMessageId", "==", clientMessageId),
    limit(1)
  ));
  return !snapshot.empty;
}

export function subscribeDeletedConversations(userId: string, onChange: (ids: string[]) => void): Unsubscribe {
  return onSnapshot(
    collection(firestoreDb, "users", userId, "dmDeleted"),
    (snapshot) => onChange(snapshot.docs.map((item) => item.id)),
    () => onChange([])
  );
}

export async function reopenConversationForUser(conversationId: string) {
  await conversationActionRemote(conversationId, "reopen_conversation");
}

export async function deleteConversationForUser(conversationId: string) {
  await conversationActionRemote(conversationId, "delete_conversation");
}

export async function conversationActionRemote(conversationId: string, action: "accept_request" | "mark_read" | "pin" | "unpin" | "archive" | "unarchive" | "mute" | "unmute" | "delete_conversation" | "reopen_conversation") {
  const callable = httpsCallable(getFunctions(firebaseApp), "directMessageConversationAction");
  try {
    await callable({ conversationId, action });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (action === "mark_read" && code.includes("not-found")) return;
    throw error;
  }
}

export async function blockDirectMessageUserRemote(targetUserId: string) {
  const callable = httpsCallable(getFunctions(firebaseApp), "blockDirectMessageUser");
  await callable({ targetUserId });
}

export async function unblockDirectMessageUserRemote(targetUserId: string) {
  const callable = httpsCallable(getFunctions(firebaseApp), "unblockDirectMessageUser");
  await callable({ targetUserId });
}

export async function reportDirectMessageRemote(conversationId: string, messageId: string, reason: string) {
  const callable = httpsCallable(getFunctions(firebaseApp), "reportDirectMessage");
  await callable({ conversationId, messageId, reason });
}

export async function persistUserFollow(
  followerId: string,
  followedId: string,
  usernames?: { followerUsername: string; followedUsername: string }
) {
  const { createUserFollow } = await import("./follow-service");
  await createUserFollow({
    followerId,
    followedId,
    followerUsername: usernames?.followerUsername ?? followerId,
    followedUsername: usernames?.followedUsername ?? followedId
  });
}

export async function removeUserFollow(followerId: string, followedId: string) {
  const { deleteUserFollow } = await import("./follow-service");
  await deleteUserFollow(followerId, followedId);
}

export function formatMessageTime(ms: number) {
  if (!ms) return "";
  const diff = Date.now() - ms;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < hour) return `${Math.max(1, Math.floor(diff / minute))}dk`;
  if (diff < day) return `${Math.floor(diff / hour)}s`;
  return `${Math.floor(diff / day)}g`;
}
