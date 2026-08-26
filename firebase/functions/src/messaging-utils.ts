import * as admin from "firebase-admin";
import { FieldValue, Timestamp } from "firebase-admin/firestore";
import {
  conversationIdForParticipants,
  dayKeyInTimezone,
  defaultMessagingSettings,
  followDocId,
  type MessagingSettings
} from "./messaging";
import { isActivePremium } from "./premium/premium-access";

type UserDoc = {
  uid?: string;
  username?: string;
  displayName?: string;
  photoURL?: string;
  role?: string;
  staff?: string[];
  badges?: string[];
  systemBadges?: string[];
  adminBadges?: string[];
  premium?: boolean;
  isPremium?: boolean;
  subscriptionStatus?: string;
  expireDate?: admin.firestore.Timestamp;
  premiumExpiresAt?: admin.firestore.Timestamp;
  isDisabled?: boolean;
  restrictions?: Array<{ type?: string; active?: boolean; duration?: string; until?: string }>;
  createdAt?: admin.firestore.Timestamp;
};

type UsageDoc = {
  dayKey?: string;
  conversationsStarted?: number;
  messagesSent?: number;
  lastMessageAt?: admin.firestore.Timestamp;
  recentMessageAt?: number[];
  recentMessageTexts?: string[];
  temporaryBlockedUntil?: admin.firestore.Timestamp | null;
  violationCount?: number;
};

const LINK_PATTERN = /(https?:\/\/|www\.|\.com|\.net|\.org|\.io|bit\.ly|t\.co)/i;

export function mergeMessagingSettings(value: Partial<MessagingSettings> | undefined): MessagingSettings {
  return { ...defaultMessagingSettings, ...(value ?? {}) };
}

export function isPremiumUser(data: UserDoc) {
  return isActivePremium(data);
}

export function isStaffUser(data: UserDoc) {
  if (data.role === "admin") return true;
  if (Array.isArray(data.staff) && data.staff.some((item) => item === "admin" || item === "moderator" || item === "editor")) return true;
  return false;
}

export function hasActiveRestriction(data: UserDoc, type: string) {
  if (!Array.isArray(data.restrictions)) return false;
  const now = Date.now();
  return data.restrictions.some((restriction) => {
    if (!restriction || restriction.active === false || restriction.type !== type) return false;
    if (restriction.duration === "permanent") return true;
    if (!restriction.until) return false;
    const untilMs = Date.parse(restriction.until);
    return !Number.isNaN(untilMs) && untilMs > now;
  });
}

export function isNewAccount(data: UserDoc) {
  if (!data.createdAt) return false;
  const createdMs = data.createdAt.toMillis();
  return Date.now() - createdMs < 24 * 60 * 60 * 1000;
}

export async function loadMessagingSettings(db: admin.firestore.Firestore) {
  const snapshot = await db.doc("appSettings/messaging").get();
  return mergeMessagingSettings(snapshot.exists ? (snapshot.data() as Partial<MessagingSettings>) : undefined);
}

export async function isBlocked(db: admin.firestore.Firestore, blockerId: string, blockedId: string) {
  const snapshot = await db.doc(`userBlocks/${blockerId}_${blockedId}`).get();
  return snapshot.exists;
}

export async function recipientFollowsSender(db: admin.firestore.Firestore, recipientId: string, senderId: string) {
  const snapshot = await db.doc(`userFollows/${followDocId(recipientId, senderId)}`).get();
  return snapshot.exists;
}

export async function senderFollowsRecipient(db: admin.firestore.Firestore, senderId: string, recipientId: string) {
  const snapshot = await db.doc(`userFollows/${followDocId(senderId, recipientId)}`).get();
  return snapshot.exists;
}

function normalizeText(text: string) {
  return text.trim().replace(/\s+/g, " ");
}

function isSpamLikeText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return true;
  if (/^[\s\u200B\uFEFF]+$/.test(trimmed)) return true;
  if (/^([\u{1F300}-\u{1FAFF}\s]){8,}$/u.test(trimmed)) return true;
  if (trimmed.length >= 6 && /^(.)\1{5,}$/.test(trimmed.replace(/\s/g, ""))) return true;
  return false;
}

function temporaryBlockMinutes(violationCount: number) {
  if (violationCount <= 1) return 0;
  if (violationCount === 2) return 5;
  if (violationCount === 3) return 60;
  return 1440;
}

export type SendValidationResult =
  | { ok: true; usage: UsageDoc; settings: MessagingSettings; premium: boolean; staff: boolean }
  | { ok: false; code: string; message: string; violationCount?: number };

export async function validateSendContext(
  db: admin.firestore.Firestore,
  senderId: string,
  sender: UserDoc,
  settings: MessagingSettings
): Promise<SendValidationResult> {
  if (!settings.enabled) {
    return { ok: false, code: "disabled", message: "Mesajlaşma şu an kapalı." };
  }
  if (sender.isDisabled) {
    return { ok: false, code: "disabled-user", message: "Hesabın mesaj göndermeye uygun değil." };
  }
  if (hasActiveRestriction(sender, "dm_send")) {
    return { ok: false, code: "restricted", message: "Mesaj gönderme yetkin geçici olarak kapatıldı." };
  }

  const premium = isPremiumUser(sender);
  const staff = isStaffUser(sender);
  const usageRef = db.doc(`users/${senderId}/usage/dm`);
  const usageSnap = await usageRef.get();
  const today = dayKeyInTimezone(new Date());
  const usage = usageSnap.exists ? (usageSnap.data() as UsageDoc) : {};
  const dayUsage = usage.dayKey === today ? usage : { dayKey: today, conversationsStarted: 0, messagesSent: 0 };

  if (dayUsage.temporaryBlockedUntil) {
    const blockedUntilMs = dayUsage.temporaryBlockedUntil.toMillis?.() ?? 0;
    if (blockedUntilMs > Date.now()) {
      return { ok: false, code: "temp-block", message: "Çok kısa sürede fazla mesaj gönderdin. Mesajlaşma güvenliği için kısa bir süre beklemen gerekiyor." };
    }
  }

  if (!staff) {
    const messageLimit = premium
      ? settings.premiumDailyMessageLimit
      : isNewAccount(sender)
        ? settings.newAccountFirstDayMessageLimit
        : settings.freeDailyMessageLimit;
    if (messageLimit != null && (dayUsage.messagesSent ?? 0) >= messageLimit) {
      return {
        ok: false,
        code: premium ? "daily-limit" : "daily-limit-free",
        message: premium
          ? "Günlük mesaj limitine ulaştın."
          : "Bugünkü ücretsiz mesaj limitine ulaştın. Premium'a geçerek sınırsız mesajlaşabilirsin."
      };
    }
  }

  return { ok: true, usage: dayUsage, settings, premium, staff };
}

export async function validateMessageContent(
  db: admin.firestore.Firestore,
  senderId: string,
  text: string,
  sender: UserDoc,
  settings: MessagingSettings,
  premium: boolean,
  staff: boolean,
  usage: UsageDoc
) {
  const normalized = normalizeText(text);
  if (!normalized) {
    return { ok: false as const, code: "empty", message: "Mesaj boş olamaz." };
  }

  const maxLength = premium || staff ? settings.premiumMaxMessageLength : settings.freeMaxMessageLength;
  if (normalized.length > maxLength) {
    return { ok: false as const, code: "length", message: `Mesaj en fazla ${maxLength} karakter olabilir.` };
  }

  if (isSpamLikeText(normalized)) {
    return { ok: false as const, code: "spam", message: "Bu mesaj gönderilemez." };
  }

  if (settings.spamProtectionEnabled && !staff) {
    const now = Date.now();
    const recentAt = Array.isArray(usage.recentMessageAt) ? usage.recentMessageAt.filter((value) => now - value < 5 * 60 * 1000) : [];
    const recentTexts = Array.isArray(usage.recentMessageTexts) ? usage.recentMessageTexts.slice(-10) : [];
    const sameCount = recentTexts.filter((item) => item === normalized).length;
    if (sameCount >= 2) {
      return { ok: false as const, code: "duplicate", message: "Aynı mesajı kısa sürede tekrar gönderemezsin." };
    }
    if (recentAt.length >= 1 && now - recentAt[recentAt.length - 1] < 1000) {
      return { ok: false as const, code: "rate-second", message: "Çok hızlı mesaj gönderiyorsun. Lütfen bir saniye bekle." };
    }
    const minuteCount = recentAt.filter((value) => now - value < 60 * 1000).length;
    if (minuteCount >= settings.perMinuteMessageLimit) {
      return { ok: false as const, code: "rate-minute", message: "Dakikalık mesaj limitine ulaştın." };
    }
    if (recentAt.length >= settings.fiveMinuteMessageLimit) {
      return { ok: false as const, code: "rate-five-minute", message: "Çok kısa sürede fazla mesaj gönderdin. Mesajlaşma güvenliği için kısa bir süre beklemen gerekiyor." };
    }
  }

  if (settings.linkProtectionEnabled && LINK_PATTERN.test(normalized)) {
    if (isNewAccount(sender)) {
      return { ok: false as const, code: "link-new-account", message: "Yeni hesaplarda link gönderilemez." };
    }
    if (!premium && !staff) {
      const recentLinks = Array.isArray(usage.recentMessageTexts)
        ? usage.recentMessageTexts.filter((item) => LINK_PATTERN.test(item)).length
        : 0;
      if (recentLinks >= 2) {
        return { ok: false as const, code: "link-limit", message: "Kısa sürede çok fazla link gönderemezsin." };
      }
    }
  }

  return { ok: true as const, normalized };
}

export async function resolveConversationStart(
  db: admin.firestore.Firestore,
  senderId: string,
  recipientId: string,
  sender: UserDoc,
  recipient: UserDoc,
  settings: MessagingSettings,
  premium: boolean,
  staff: boolean,
  usage: UsageDoc
) {
  const conversationId = conversationIdForParticipants(senderId, recipientId);
  const conversationRef = db.doc(`conversations/${conversationId}`);
  const existing = await conversationRef.get();

  if (existing.exists) {
    const data = existing.data() as { status?: string; participantIds?: string[] };
    if (data.status === "blocked" || data.status === "closed") {
      return { ok: false as const, code: "closed", message: "Bu konuşmaya mesaj gönderilemez." };
    }
    if (data.status === "request") {
      const requestBy = existing.get("requestBy");
      if (requestBy !== senderId) {
        return { ok: false as const, code: "request-pending", message: "Mesaj isteği henüz kabul edilmedi." };
      }
    }
    return { ok: true as const, conversationId, conversationRef, isNew: false, status: data.status ?? "active" };
  }

  if (await isBlocked(db, recipientId, senderId)) {
    return { ok: false as const, code: "blocked", message: "Bu kullanıcıya mesaj gönderemezsin." };
  }
  if (await isBlocked(db, senderId, recipientId)) {
    return { ok: false as const, code: "blocked", message: "Engellediğin bir kullanıcıya mesaj gönderemezsin." };
  }

  const followsBack = await recipientFollowsSender(db, recipientId, senderId);
  const alreadyFollowing = await senderFollowsRecipient(db, senderId, recipientId);
  let status: "request" | "active" = "active";

  if (!staff) {
    const conversationLimit = premium
      ? settings.premiumDailyConversationLimit
      : isNewAccount(sender)
        ? settings.newAccountFirstDayConversationLimit
        : settings.freeDailyConversationLimit;
    if (conversationLimit != null && (usage.conversationsStarted ?? 0) >= conversationLimit) {
      return {
        ok: false as const,
        code: premium ? "conversation-limit" : "conversation-limit-free",
        message: premium
          ? "Günlük yeni konuşma limitine ulaştın."
          : "Bugünkü ücretsiz yeni konuşma limitine ulaştın. Premium'a geçerek daha fazla sohbet başlatabilirsin."
      };
    }

    if (!followsBack && !alreadyFollowing) {
      if (premium && settings.allowPremiumColdMessages) {
        status = "active";
      } else if (!premium && settings.messageRequestsEnabled) {
        status = "request";
      } else if (!premium && settings.allowFreeColdMessages) {
        status = "active";
      } else {
        return { ok: false as const, code: "cold-dm", message: "Bu kullanıcıya doğrudan mesaj gönderemezsin. Mesaj isteği veya Premium gerekli." };
      }
    } else if (!followsBack && alreadyFollowing && !premium && settings.messageRequestsEnabled) {
      status = "request";
    }
  }

  return { ok: true as const, conversationId, conversationRef, isNew: true, status };
}

export function buildConversationPayload(
  senderId: string,
  recipientId: string,
  sender: UserDoc,
  recipient: UserDoc,
  status: "request" | "active",
  preview: string
) {
  const participantIds = senderId < recipientId ? [senderId, recipientId] : [recipientId, senderId];
  return {
    participantIds,
    participantUsernames: {
      [senderId]: sender.username ?? senderId,
      [recipientId]: recipient.username ?? recipientId
    },
    participantPhotos: {
      [senderId]: sender.photoURL ?? "",
      [recipientId]: recipient.photoURL ?? ""
    },
    participantPremium: {
      [senderId]: isPremiumUser(sender),
      [recipientId]: isPremiumUser(recipient)
    },
    lastMessageText: preview,
    lastMessageAt: FieldValue.serverTimestamp(),
    lastSenderId: senderId,
    unreadCount: {
      [senderId]: 0,
      [recipientId]: 1
    },
    status,
    requestBy: status === "request" ? senderId : null,
    acceptedAt: null,
    pinnedBy: {},
    mutedBy: {},
    archivedBy: {},
    createdBy: senderId,
    lastReadAt: {},
    deletedFor: {},
    visibleFor: {
      [senderId]: true,
      [recipientId]: true
    },
    historyClearedAt: null,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  };
}

export async function clearConversationHistory(
  db: admin.firestore.Firestore,
  conversationId: string,
  clearedByUid: string
) {
  const ref = db.doc(`conversations/${conversationId}`);
  const snap = await ref.get();
  if (!snap.exists) return;
  const participantIds = (snap.get("participantIds") as string[] | undefined) ?? [];
  if (!participantIds.includes(clearedByUid)) {
    throw new Error("Bu konuşmaya erişimin yok.");
  }

  const currentStatus = snap.get("status");
  const updates: Record<string, unknown> = {
    historyClearedAt: FieldValue.serverTimestamp(),
    lastMessageText: "",
    lastMessageAt: FieldValue.serverTimestamp(),
    lastSenderId: "",
    updatedAt: FieldValue.serverTimestamp()
  };

  for (const participantId of participantIds) {
    updates[`visibleFor.${participantId}`] = false;
    updates[`unreadCount.${participantId}`] = 0;
    updates[`archivedBy.${participantId}`] = false;
    updates[`pinnedBy.${participantId}`] = false;
    updates[`deletedAt.${participantId}`] = FieldValue.serverTimestamp();
    await db.doc(`users/${participantId}/dmDeleted/${conversationId}`).delete().catch(() => undefined);
  }

  if (currentStatus !== "blocked") {
    updates.status = currentStatus === "request" ? "request" : "active";
  }

  await ref.update(updates);
}

export async function reopenConversationForParticipant(
  db: admin.firestore.Firestore,
  conversationId: string,
  uid: string
) {
  const ref = db.doc(`conversations/${conversationId}`);
  const snap = await ref.get();
  if (!snap.exists) return;
  const participantIds = snap.get("participantIds") as string[] | undefined;
  if (!participantIds?.includes(uid)) {
    throw new Error("Bu konuşmaya erişimin yok.");
  }

  await ref.update({
    [`visibleFor.${uid}`]: true,
    updatedAt: FieldValue.serverTimestamp()
  });
  await db.doc(`users/${uid}/dmDeleted/${conversationId}`).delete().catch(() => undefined);
}

export async function writeMessageTransaction(
  db: admin.firestore.Firestore,
  input: {
    senderId: string;
    recipientId: string;
    conversationId: string;
    conversationRef: admin.firestore.DocumentReference;
    isNew: boolean;
    status: string;
    sender: UserDoc;
    recipient: UserDoc;
    normalized: string;
    clientMessageId: string;
    usage: UsageDoc;
    premium: boolean;
    staff: boolean;
    settings: MessagingSettings;
  }
) {
  const messageRef = input.conversationRef.collection("messages").doc();
  const usageRef = db.doc(`users/${input.senderId}/usage/dm`);
  const now = Date.now();
  const today = dayKeyInTimezone(new Date());
  const recentAt = Array.isArray(input.usage.recentMessageAt)
    ? input.usage.recentMessageAt.filter((value) => now - value < 5 * 60 * 1000)
    : [];
  recentAt.push(now);
  const recentTexts = Array.isArray(input.usage.recentMessageTexts) ? input.usage.recentMessageTexts.slice(-9) : [];
  recentTexts.push(input.normalized);

  await db.runTransaction(async (transaction) => {
    if (input.isNew) {
      transaction.set(input.conversationRef, buildConversationPayload(
        input.senderId,
        input.recipientId,
        input.sender,
        input.recipient,
        input.status === "request" ? "request" : "active",
        input.normalized
      ));
    } else {
      transaction.update(input.conversationRef, {
        lastMessageText: input.normalized,
        lastMessageAt: FieldValue.serverTimestamp(),
        lastSenderId: input.senderId,
        [`unreadCount.${input.recipientId}`]: FieldValue.increment(1),
        [`visibleFor.${input.senderId}`]: true,
        [`visibleFor.${input.recipientId}`]: true,
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    transaction.set(messageRef, {
      senderId: input.senderId,
      senderRole: "user",
      text: input.normalized,
      createdAt: FieldValue.serverTimestamp(),
      readAt: null,
      editedAt: null,
      deletedFor: [],
      isSystemMessage: false,
      moderationStatus: "clean",
      reportCount: 0,
      clientMessageId: input.clientMessageId,
      deliveryStatus: "sent",
      deviceId: null
    });

    const violationCount = input.usage.violationCount ?? 0;
    transaction.set(usageRef, {
      dayKey: today,
      conversationsStarted: FieldValue.increment(input.isNew ? 1 : 0),
      messagesSent: FieldValue.increment(1),
      lastMessageAt: FieldValue.serverTimestamp(),
      recentMessageAt: recentAt.slice(-80),
      recentMessageTexts: recentTexts,
      temporaryBlockedUntil: null,
      violationCount
    }, { merge: true });
  });

  await db.doc(`users/${input.senderId}/dmDeleted/${input.conversationId}`).delete().catch(() => undefined);
  await db.doc(`users/${input.recipientId}/dmDeleted/${input.conversationId}`).delete().catch(() => undefined);

  return messageRef.id;
}

export async function adminWriteDirectMessage(
  db: admin.firestore.Firestore,
  input: {
    senderId: string;
    recipientId: string;
    text: string;
    isSystemMessage?: boolean;
  }
) {
  const normalized = input.text.trim();
  if (!normalized) {
    throw new Error("Mesaj boş olamaz.");
  }
  if (input.senderId === input.recipientId) {
    throw new Error("Gönderen ve alıcı aynı olamaz.");
  }

  const senderSnap = await db.doc(`users/${input.senderId}`).get();
  const recipientSnap = await db.doc(`users/${input.recipientId}`).get();
  if (!senderSnap.exists || !recipientSnap.exists) {
    throw new Error("Kullanıcı bulunamadı.");
  }
  const sender = senderSnap.data() ?? {};
  const recipient = recipientSnap.data() ?? {};
  if (recipient.isDisabled) {
    throw new Error("Alıcı mesaj alamıyor.");
  }

  const conversationId = conversationIdForParticipants(input.senderId, input.recipientId);
  const conversationRef = db.doc(`conversations/${conversationId}`);
  const existing = await conversationRef.get();
  const isNew = !existing.exists;
  const messageRef = conversationRef.collection("messages").doc();
  const settings = await loadMessagingSettings(db);
  const isSystemMessage = input.isSystemMessage !== false;

  await db.runTransaction(async (transaction) => {
    if (isNew) {
      transaction.set(conversationRef, buildConversationPayload(
        input.senderId,
        input.recipientId,
        sender,
        recipient,
        "active",
        normalized
      ));
    } else {
      const currentStatus = existing.get("status");
      transaction.update(conversationRef, {
        lastMessageText: normalized,
        lastMessageAt: FieldValue.serverTimestamp(),
        lastSenderId: input.senderId,
        [`unreadCount.${input.recipientId}`]: FieldValue.increment(1),
        [`visibleFor.${input.senderId}`]: true,
        [`visibleFor.${input.recipientId}`]: true,
        status: currentStatus === "closed" || currentStatus === "blocked" ? "active" : currentStatus ?? "active",
        updatedAt: FieldValue.serverTimestamp()
      });
    }

    transaction.set(messageRef, {
      senderId: input.senderId,
      senderRole: isSystemMessage ? "staff" : "user",
      text: normalized,
      createdAt: FieldValue.serverTimestamp(),
      readAt: null,
      editedAt: null,
      deletedFor: [],
      isSystemMessage,
      moderationStatus: "clean",
      reportCount: 0,
      clientMessageId: `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      deliveryStatus: "sent",
      deviceId: null
    });
  });

  await createDirectMessageNotification(
    db,
    input.recipientId,
    { ...sender, uid: input.senderId },
    conversationId,
    messageRef.id,
    normalized.slice(0, 120),
    settings.pushEnabled
  ).catch(() => undefined);

  await db.doc(`users/${input.senderId}/dmDeleted/${conversationId}`).delete().catch(() => undefined);
  await db.doc(`users/${input.recipientId}/dmDeleted/${conversationId}`).delete().catch(() => undefined);

  return { conversationId, messageId: messageRef.id };
}

export async function createDirectMessageNotification(
  db: admin.firestore.Firestore,
  recipientId: string,
  sender: UserDoc,
  conversationId: string,
  messageId: string,
  preview: string,
  pushEnabled: boolean
) {
  const notificationId = `dm_${conversationId}_${messageId}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 240);
  await db.collection("notifications").doc(notificationId).create({
    recipientId,
    userId: recipientId,
    actorId: sender.uid ?? "",
    actorUsername: sender.username ?? "",
    actorPhotoURL: sender.photoURL ?? "",
    type: "direct_message",
    title: { tr: `${sender.username ?? "Kullanıcı"} sana mesaj gönderdi`, en: `${sender.username ?? "User"} sent you a message`, ru: `${sender.username ?? "Пользователь"} отправил сообщение`, uz: `${sender.username ?? "Foydalanuvchi"} sizga xabar yubordi` },
    body: { tr: preview, en: preview, ru: preview, uz: preview },
    targetType: "profile",
    targetId: conversationId,
    targetPath: `/messages/${conversationId}`,
    isRead: false,
    isDeleted: false,
    readBy: [],
    pushEnabled,
    pushSent: false,
    status: "published",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }).catch((error: unknown) => {
    if (!error || typeof error !== "object") throw error;
    const code = "code" in error ? (error as { code?: unknown }).code : undefined;
    if (code === 6 || code === "6" || code === "already-exists") return;
    throw error;
  });
}

export async function recordViolation(db: admin.firestore.Firestore, senderId: string, usage: UsageDoc) {
  const usageRef = db.doc(`users/${senderId}/usage/dm`);
  const violationCount = (usage.violationCount ?? 0) + 1;
  const minutes = temporaryBlockMinutes(violationCount);
  const patch: Record<string, unknown> = {
    violationCount,
    updatedAt: FieldValue.serverTimestamp()
  };
  if (minutes > 0) {
    patch.temporaryBlockedUntil = Timestamp.fromMillis(Date.now() + minutes * 60 * 1000);
  }
  await usageRef.set(patch, { merge: true });
  return violationCount;
}
