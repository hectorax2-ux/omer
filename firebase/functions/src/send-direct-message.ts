import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { onCall, HttpsError } from "firebase-functions/v2/https";
import {
  clearConversationHistory,
  createDirectMessageNotification,
  loadMessagingSettings,
  recordViolation,
  reopenConversationForParticipant,
  resolveConversationStart,
  validateMessageContent,
  validateSendContext,
  isPremiumUser,
  writeMessageTransaction,
  adminWriteDirectMessage
} from "./messaging-utils";
import { followDocId, otherParticipantIdFromConversationId } from "./messaging";

type SendDirectMessageInput = {
  recipientId?: string;
  conversationId?: string;
  text?: string;
  clientMessageId?: string;
};

export async function sendDirectMessageHandler(uid: string, input: SendDirectMessageInput) {
  const text = typeof input.text === "string" ? input.text : "";
  const clientMessageId = typeof input.clientMessageId === "string" && input.clientMessageId.trim()
    ? input.clientMessageId.trim()
    : `client-${Date.now()}`;

  if (!text.trim()) {
    throw new HttpsError("invalid-argument", "Mesaj boş olamaz.");
  }

  const db = admin.firestore();
  const settings = await loadMessagingSettings(db);
  const senderSnap = await db.doc(`users/${uid}`).get();
  if (!senderSnap.exists) {
    throw new HttpsError("failed-precondition", "Kullanıcı profili bulunamadı.");
  }
  const sender = senderSnap.data() ?? {};

  const context = await validateSendContext(db, uid, sender, settings);
  if (!context.ok) {
    throw new HttpsError("failed-precondition", context.message);
  }

  const content = await validateMessageContent(db, uid, text, sender, settings, context.premium, context.staff, context.usage);
  if (!content.ok) {
    if (["duplicate", "rate-second", "rate-minute", "rate-five-minute", "spam"].includes(content.code)) {
      await recordViolation(db, uid, context.usage);
    }
    throw new HttpsError("failed-precondition", content.message);
  }

  let recipientId = typeof input.recipientId === "string" ? input.recipientId : "";
  let conversationRef = input.conversationId ? db.doc(`conversations/${input.conversationId}`) : null;
  let isNew = false;
  let status = "active";

  if (conversationRef) {
    const existing = await conversationRef.get();
    if (existing.exists) {
      const participantIds = existing.get("participantIds") as string[] | undefined;
      if (!participantIds?.includes(uid)) {
        throw new HttpsError("permission-denied", "Bu konuşmaya erişimin yok.");
      }
      recipientId = participantIds.find((item) => item !== uid) ?? "";
      status = existing.get("status") ?? "active";
      isNew = false;
    } else {
      const derivedRecipient = typeof input.recipientId === "string" && input.recipientId.trim()
        ? input.recipientId.trim()
        : otherParticipantIdFromConversationId(uid, conversationRef.id);
      if (!derivedRecipient) {
        throw new HttpsError("invalid-argument", "Geçersiz konuşma kimliği.");
      }
      recipientId = derivedRecipient;
      conversationRef = null;
    }
  }

  if (!recipientId) {
    throw new HttpsError("invalid-argument", "Alıcı belirtilmedi.");
  }
  if (recipientId === uid) {
    throw new HttpsError("invalid-argument", "Kendine mesaj gönderemezsin.");
  }

  const recipientSnap = await db.doc(`users/${recipientId}`).get();
  if (!recipientSnap.exists) {
    throw new HttpsError("not-found", "Alıcı kullanıcı bulunamadı.");
  }
  const recipient = recipientSnap.data() ?? {};
  if (recipient.isDisabled) {
    throw new HttpsError("failed-precondition", "Bu kullanıcı mesaj alamıyor.");
  }

  if (!conversationRef) {
    const resolved = await resolveConversationStart(db, uid, recipientId, sender, recipient, settings, context.premium, context.staff, context.usage);
    if (!resolved.ok) {
      throw new HttpsError("failed-precondition", resolved.message);
    }
    conversationRef = resolved.conversationRef;
    isNew = resolved.isNew;
    status = resolved.status;
  }

  const duplicate = await conversationRef.collection("messages")
    .where("clientMessageId", "==", clientMessageId)
    .limit(1)
    .get();
  if (!duplicate.empty) {
    const messageId = duplicate.docs[0].id;
    await createDirectMessageNotification(db, recipientId, sender, conversationRef.id, messageId, content.normalized.slice(0, 120), settings.pushEnabled).catch(() => undefined);
    return { conversationId: conversationRef.id, messageId, status, duplicate: true };
  }

  const messageId = await writeMessageTransaction(db, {
    senderId: uid,
    recipientId,
    conversationId: conversationRef.id,
    conversationRef,
    isNew,
    status,
    sender,
    recipient,
    normalized: content.normalized,
    clientMessageId,
    usage: context.usage,
    premium: context.premium,
    staff: context.staff,
    settings
  });

  await createDirectMessageNotification(db, recipientId, sender, conversationRef.id, messageId, content.normalized.slice(0, 120), settings.pushEnabled).catch(() => undefined);

  return { conversationId: conversationRef.id, messageId, status, duplicate: false };
}

export const sendDirectMessage = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Mesaj göndermek için giriş yapmalısın.");
  }
  return sendDirectMessageHandler(request.auth.uid, request.data ?? {});
});

type ConversationActionInput = {
  conversationId?: string;
  action?: "accept_request" | "mark_read" | "pin" | "unpin" | "archive" | "unarchive" | "mute" | "unmute" | "delete_conversation" | "reopen_conversation";
  value?: boolean;
};

export const directMessageConversationAction = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Oturum gerekli.");
  }
  const uid = request.auth.uid;
  const input = (request.data ?? {}) as ConversationActionInput;
  const conversationId = typeof input.conversationId === "string" ? input.conversationId : "";
  const action = input.action;
  if (!conversationId || !action) {
    throw new HttpsError("invalid-argument", "Geçersiz istek.");
  }

  const db = admin.firestore();
  const ref = db.doc(`conversations/${conversationId}`);
  const snapshot = await ref.get();
  if (!snapshot.exists) {
    throw new HttpsError("not-found", "Konuşma bulunamadı.");
  }
  const participantIds = snapshot.get("participantIds") as string[] | undefined;
  if (!participantIds?.includes(uid)) {
    throw new HttpsError("permission-denied", "Bu konuşmaya erişimin yok.");
  }

  const settings = await loadMessagingSettings(db);
  const userSnap = await db.doc(`users/${uid}`).get();
  const user = userSnap.data() ?? {};
  const premium = isPremiumUser(user);
  const staff = user.role === "admin" || (Array.isArray(user.staff) && user.staff.length > 0);
  const pinLimit = premium || staff ? settings.premiumPinnedConversationLimit : settings.freePinnedConversationLimit;

  if (action === "accept_request") {
    if (snapshot.get("status") !== "request") {
      throw new HttpsError("failed-precondition", "Bu konuşma mesaj isteği değil.");
    }
    await ref.update({
      status: "active",
      acceptedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    return { ok: true };
  }

  if (action === "mark_read") {
    await ref.update({
      [`unreadCount.${uid}`]: 0,
      [`lastReadAt.${uid}`]: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    return { ok: true };
  }

  const patch: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
  if (action === "pin") {
    const pinnedSnap = await db.collection("conversations")
      .where("participantIds", "array-contains", uid)
      .limit(100)
      .get();
    const pinnedCount = pinnedSnap.docs.filter((item) => item.get(`pinnedBy.${uid}`) === true).length;
    if (pinnedCount >= pinLimit) {
      throw new HttpsError("failed-precondition", `En fazla ${pinLimit} sohbet sabitleyebilirsin.`);
    }
    patch[`pinnedBy.${uid}`] = true;
  }
  if (action === "unpin") patch[`pinnedBy.${uid}`] = false;
  if (action === "archive") patch[`archivedBy.${uid}`] = true;
  if (action === "unarchive") patch[`archivedBy.${uid}`] = false;
  if (action === "mute") patch[`mutedBy.${uid}`] = true;
  if (action === "unmute") patch[`mutedBy.${uid}`] = false;
  if (action === "delete_conversation") {
    try {
      await clearConversationHistory(db, conversationId, uid);
    } catch (error) {
      throw new HttpsError("failed-precondition", error instanceof Error ? error.message : "Sohbet silinemedi.");
    }
    return { ok: true };
  }

  if (action === "reopen_conversation") {
    try {
      await reopenConversationForParticipant(db, conversationId, uid);
    } catch (error) {
      throw new HttpsError("failed-precondition", error instanceof Error ? error.message : "Sohbet açılamadı.");
    }
    return { ok: true };
  }

  await ref.update(patch);
  return { ok: true };
});

export const blockDirectMessageUser = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Oturum gerekli.");
  }
  const uid = request.auth.uid;
  const targetUserId = typeof request.data?.targetUserId === "string" ? request.data.targetUserId : "";
  if (!targetUserId || targetUserId === uid) {
    throw new HttpsError("invalid-argument", "Geçersiz kullanıcı.");
  }
  const db = admin.firestore();
  const [blockerSnap, blockedSnap] = await Promise.all([
    db.doc(`users/${uid}`).get(),
    db.doc(`users/${targetUserId}`).get()
  ]);
  if (!blockedSnap.exists) {
    throw new HttpsError("not-found", "Kullanıcı bulunamadı.");
  }
  const blocker = blockerSnap.data() ?? {};
  const blocked = blockedSnap.data() ?? {};
  const conversationId = uid < targetUserId ? `${uid}__${targetUserId}` : `${targetUserId}__${uid}`;
  const reportRef = db.collection("reports").doc();
  const batch = db.batch();
  batch.set(db.doc(`userBlocks/${uid}_${targetUserId}`), {
    blockerId: uid,
    blockedId: targetUserId,
    blockerUsername: typeof blocker.username === "string" ? blocker.username : "",
    blockedUsername: typeof blocked.username === "string" ? blocked.username : "",
    blockedDisplayName: typeof blocked.displayName === "string" ? blocked.displayName : "",
    createdAt: FieldValue.serverTimestamp()
  });
  batch.set(db.doc(`conversations/${conversationId}`), {
    status: "blocked",
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true });
  batch.delete(db.doc(`userFollows/${followDocId(uid, targetUserId)}`));
  batch.delete(db.doc(`userFollows/${followDocId(targetUserId, uid)}`));
  batch.set(reportRef, {
    reporterId: uid,
    targetType: "profile",
    targetId: targetUserId,
    category: "abuse",
    subject: "User blocked — safety review",
    message: `A user was blocked through the in-app safety control.\nReporter: ${String(blocker.username ?? uid)} (${uid})\nBlocked user: ${String(blocked.username ?? targetUserId)} (${targetUserId})`,
    source: "block_user",
    status: "open",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  await batch.commit();
  return { ok: true };
});

export const unblockDirectMessageUser = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Oturum gerekli.");
  }
  const uid = request.auth.uid;
  const targetUserId = typeof request.data?.targetUserId === "string" ? request.data.targetUserId : "";
  if (!targetUserId || targetUserId === uid) {
    throw new HttpsError("invalid-argument", "Geçersiz kullanıcı.");
  }
  const db = admin.firestore();
  await db.doc(`userBlocks/${uid}_${targetUserId}`).delete();
  const conversationId = uid < targetUserId ? `${uid}__${targetUserId}` : `${targetUserId}__${uid}`;
  const conversationRef = db.doc(`conversations/${conversationId}`);
  const conversationSnap = await conversationRef.get();
  if (conversationSnap.exists && conversationSnap.get("status") === "blocked") {
    await conversationRef.set({
      status: "active",
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  return { ok: true };
});

type ReportInput = {
  conversationId?: string;
  messageId?: string;
  reason?: string;
};

export const reportDirectMessage = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Oturum gerekli.");
  }
  const uid = request.auth.uid;
  const input = (request.data ?? {}) as ReportInput;
  const conversationId = typeof input.conversationId === "string" ? input.conversationId : "";
  const messageId = typeof input.messageId === "string" ? input.messageId : "";
  const reason = typeof input.reason === "string" ? input.reason.trim() : "";
  if (!conversationId || !messageId || !reason) {
    throw new HttpsError("invalid-argument", "Rapor bilgileri eksik.");
  }

  const db = admin.firestore();
  const messageRef = db.doc(`conversations/${conversationId}/messages/${messageId}`);
  const messageSnap = await messageRef.get();
  if (!messageSnap.exists) {
    throw new HttpsError("not-found", "Mesaj bulunamadı.");
  }

  const reportedUserId = messageSnap.get("senderId") as string;
  const messageText = typeof messageSnap.get("text") === "string" ? messageSnap.get("text") : "";
  const reporterSnap = await db.doc(`users/${uid}`).get();
  const reportedSnap = await db.doc(`users/${reportedUserId}`).get();
  const reporterUsername = reporterSnap.get("username") ?? uid;
  const reportedUsername = reportedSnap.get("username") ?? reportedUserId;
  const reportRef = db.collection("messageReports").doc();
  await reportRef.set({
    conversationId,
    messageId,
    reporterId: uid,
    reporterUsername,
    reportedUserId,
    reportedUsername,
    messageText,
    reason,
    status: "open",
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  });
  await messageRef.update({
    reportCount: FieldValue.increment(1),
    moderationStatus: "flagged"
  });
  return { ok: true, reportId: reportRef.id };
});

async function assertAdminUser(db: admin.firestore.Firestore, uid: string) {
  const userSnap = await db.doc(`users/${uid}`).get();
  if (!userSnap.exists || userSnap.get("role") !== "admin") {
    throw new HttpsError("permission-denied", "Bu işlem için admin yetkisi gerekli.");
  }
}

type AdminDirectMessageInput = {
  senderUserId?: string;
  recipientId?: string;
  text?: string;
};

export async function sendAdminDirectMessageHandler(uid: string, input: AdminDirectMessageInput) {
  const db = admin.firestore();
  await assertAdminUser(db, uid);
  const senderUserId = typeof input.senderUserId === "string" ? input.senderUserId.trim() : "";
  const recipientId = typeof input.recipientId === "string" ? input.recipientId.trim() : "";
  const text = typeof input.text === "string" ? input.text.trim() : "";
  if (!senderUserId || !recipientId || !text) {
    throw new HttpsError("invalid-argument", "Gönderen, alıcı ve mesaj gerekli.");
  }
  return adminWriteDirectMessage(db, { senderId: senderUserId, recipientId, text, isSystemMessage: true });
}

export const sendAdminDirectMessage = onCall(async (request) => {
  if (!request.auth?.uid) {
    throw new HttpsError("unauthenticated", "Oturum gerekli.");
  }
  return sendAdminDirectMessageHandler(request.auth.uid, request.data ?? {});
});
