import { createHash } from "node:crypto";
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { notificationTargetsAccount } from "./notification-targeting";
import { isActivePremium } from "./premium/premium-access";

type NotificationRecord = Record<string, unknown> & {
  pushEnabled?: boolean;
  pushSent?: boolean;
  pushState?: string;
  status?: string;
  recipientId?: string;
  userId?: string;
  title?: string | Record<string, string>;
  body?: string | Record<string, string>;
  metadata?: Record<string, unknown>;
  type?: string;
};

type UserRecord = Record<string, unknown> & {
  uid?: string;
  expoPushToken?: string;
  expoPushTokens?: string[];
  language?: string;
  pushPlatform?: string;
  notificationsEnabled?: boolean;
  notificationPreferences?: Record<string, unknown>;
};

type PushDeviceRecord = Record<string, unknown> & {
  id: string;
  uid: string;
  deviceId: string;
  token: string;
  platform: "android" | "ios";
  language: string;
  permissionStatus: string;
  enabled: boolean;
  projectId?: string;
};

type PushEnvelope = PushMessage & {
  userId: string;
  deviceId: string;
  deviceDocumentId: string;
  platform: "android" | "ios" | "unknown";
};

const EXPO_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_RECEIPTS_URL = "https://exp.host/--/api/v2/push/getReceipts";
const ART_ATLAS_EXPO_PROJECT_ID = "c3868530-92e5-47ad-b174-885d09f1c1ca";

export const reconcilePushDeviceRegistration = onDocumentWritten({
  document: "pushDevices/{deviceDocumentId}",
  retry: true
}, async (event) => {
  const after = event.data?.after;
  if (!after?.exists) return;
  const current = { id: after.id, ...after.data() } as PushDeviceRecord;
  if (current.enabled !== true || current.permissionStatus !== "granted" || !isExpoPushToken(current.token)) return;

  const db = getFirestore();
  const [sameToken, sameInstallation] = await Promise.all([
    db.collection("pushDevices").where("token", "==", current.token).get(),
    current.deviceId
      ? db.collection("pushDevices").where("deviceId", "==", current.deviceId).get()
      : Promise.resolve(null)
  ]);
  const superseded = new Map<string, FirebaseFirestore.QueryDocumentSnapshot>();
  sameToken.docs.forEach((item) => {
    if (item.id !== after.id && item.data().enabled === true) superseded.set(item.id, item);
  });
  sameInstallation?.docs.forEach((item) => {
    if (item.id !== after.id && item.data().enabled === true) superseded.set(item.id, item);
  });
  if (!superseded.size) return;

  const batch = db.batch();
  superseded.forEach((item) => batch.set(item.ref, {
    enabled: false,
    disabledAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }, { merge: true }));
  await batch.commit();
  logger.info("Superseded duplicate push registrations", {
    activeDeviceDocumentId: after.id,
    disabledCount: superseded.size
  });
});

export const sendNotificationPush = onDocumentWritten({
  document: "notifications/{notificationId}",
  retry: true,
  timeoutSeconds: 540,
  memory: "512MiB"
}, async (event) => {
  const after = event.data?.after;
  if (!after?.exists) return;
  const notification = after.data() as NotificationRecord;
  if (notification.pushSent === true || notification.pushEnabled !== true || notification.status !== "published") return;

  const before = event.data?.before?.exists ? event.data.before.data() as NotificationRecord : undefined;
  if (before?.pushSent === true) return;
  // Status updates written by this function must not start a second delivery
  // invocation. The original event is retried by Cloud Functions when needed.
  if (before?.pushState === "processing") return;
  if (notification.pushState === "processing") return;

  const db = getFirestore();
  const claimed = await db.runTransaction(async (transaction) => {
    const current = await transaction.get(after.ref);
    const data = current.data() as NotificationRecord & { pushState?: string; pushProcessingAt?: { toMillis?: () => number } };
    if (data.pushSent === true) return false;
    const processingAt = data.pushProcessingAt?.toMillis?.() ?? 0;
    if (data.pushState === "processing" && processingAt > Date.now() - 10 * 60 * 1000) return false;
    transaction.update(after.ref, {
      pushState: "processing",
      pushProcessingAt: FieldValue.serverTimestamp(),
      pushRequestedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    });
    return true;
  });
  if (!claimed) return;

  try {
    const users = await loadTargetUsers(db, notification);
    const devicesByUid = await loadPushDevices(db, users.map((user) => String(user.uid ?? "")).filter(Boolean));
    const allMessages = deduplicateMessages(users.flatMap((user) => buildUserMessages(after.id, notification, user, devicesByUid.get(String(user.uid)) ?? [])));
    const messages = await filterPreviouslyAccepted(db, after.id, allMessages);
    const result = await sendExpoMessages(db, after.id, messages);

    await cleanupInvalidTokens(db, result.invalidTargets);
    const retryRequired = result.transportFailures.length > 0 || result.retryableFailures > 0;
    await after.ref.update({
      pushSent: !retryRequired,
      pushState: retryRequired ? "failed" : result.failures.length > 0 ? "partial" : messages.length > 0 ? "sent" : "no_devices",
      pushSentAt: retryRequired ? null : FieldValue.serverTimestamp(),
      pushRequestedCount: users.length,
      pushEligibleDeviceCount: allMessages.length,
      pushAttemptedDeviceCount: messages.length,
      pushAcceptedCount: result.accepted,
      pushRecipientCount: result.accepted,
      pushFailureCount: result.failures.length + result.transportFailures.length,
      pushInvalidTokenCount: result.invalidTargets.length,
      pushTicketCount: result.ticketCount,
      pushLastError: [...result.transportFailures, ...result.failures].slice(0, 10).join(", "),
      updatedAt: FieldValue.serverTimestamp()
    });

    logger.info("Notification push processed", {
      notificationId: after.id,
      requested: users.length,
      eligibleDevices: allMessages.length,
      attempted: messages.length,
      accepted: result.accepted,
      failed: result.failures.length,
      invalidTokens: result.invalidTargets.length,
      retryRequired
    });

    if (retryRequired) throw new Error(`Expo push delivery requires retry: ${[...result.transportFailures, ...result.failures].join(", ")}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_push_delivery_error";
    await after.ref.set({
      pushSent: false,
      pushState: "failed",
      pushLastError: message.slice(0, 1000),
      pushFailedAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
    logger.error("Notification push failed", { notificationId: after.id, error: message });
    throw error;
  }
});

export async function processPendingExpoPushReceipts() {
  const db = getFirestore();
  const snapshot = await db.collection("pushReceipts").where("status", "==", "pending").limit(500).get();
  const pending = snapshot.docs
    .map((item) => ({ id: item.id, ...item.data() } as ReceiptRecord))
    .filter((item) => Number(item.createdAtMs ?? 0) < Date.now() - 60_000);
  let delivered = 0;
  let failed = 0;
  let invalidTokens = 0;

  for (const receiptBatch of batches(pending, 100)) {
    const response = await fetch(EXPO_RECEIPTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ ids: receiptBatch.map((item) => item.id) })
    });
    if (!response.ok) {
      logger.error("Expo receipt request failed", { status: response.status, count: receiptBatch.length });
      continue;
    }
    const payload = await response.json() as { data?: Record<string, ExpoReceipt> };
    const writeBatch = db.batch();
    const notificationFailures = new Map<string, { failed: number; invalid: number }>();
    const invalid: ReceiptRecord[] = [];

    receiptBatch.forEach((record) => {
      const receipt = payload.data?.[record.id];
      if (!receipt) return;
      const receiptRef = db.collection("pushReceipts").doc(record.id);
      const deliveryRef = record.deliveryId ? db.collection("pushDeliveries").doc(record.deliveryId) : null;
      if (receipt.status === "ok") {
        delivered += 1;
        writeBatch.update(receiptRef, { status: "delivered", checkedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
        if (deliveryRef) writeBatch.set(deliveryRef, { status: "delivered", receiptCheckedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
        return;
      }
      failed += 1;
      const error = receipt.details?.error ?? "expo_receipt_error";
      const isInvalid = error === "DeviceNotRegistered";
      if (isInvalid) {
        invalidTokens += 1;
        invalid.push(record);
      }
      writeBatch.update(receiptRef, { status: "failed", error, message: receipt.message ?? "", checkedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      if (deliveryRef) writeBatch.set(deliveryRef, { status: isInvalid ? "invalid" : "failed", error, receiptCheckedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() }, { merge: true });
      const current = notificationFailures.get(record.notificationId) ?? { failed: 0, invalid: 0 };
      current.failed += 1;
      if (isInvalid) current.invalid += 1;
      notificationFailures.set(record.notificationId, current);
    });
    await writeBatch.commit();
    await Promise.all([
      ...invalid.map((record) => disableInvalidTarget(db, record)),
      ...[...notificationFailures].map(([notificationId, counts]) => db.collection("notifications").doc(notificationId).set({
        pushReceiptFailureCount: FieldValue.increment(counts.failed),
        pushInvalidTokenCount: FieldValue.increment(counts.invalid),
        pushReceiptsCheckedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      }, { merge: true }))
    ]);
  }

  const result = { requested: pending.length, delivered, failed, invalidTokens };
  if (pending.length) logger.info("Expo push receipts processed", result);
  return result;
}

async function loadTargetUsers(db: Firestore, notification: NotificationRecord) {
  const recipientId = typeof notification.recipientId === "string" ? notification.recipientId : notification.userId;
  if (recipientId && recipientId !== "all") {
    const user = await db.collection("users").doc(recipientId).get();
    return user.exists ? [{ uid: user.id, ...user.data() } as UserRecord] : [];
  }
  const snapshot = await db.collection("users").get();
  return snapshot.docs.map((user) => ({ uid: user.id, ...user.data() } as UserRecord));
}

async function loadPushDevices(db: Firestore, userIds: string[]) {
  const byUid = new Map<string, PushDeviceRecord[]>();
  const uniqueUserIds = [...new Set(userIds)];
  const userIdSet = new Set(uniqueUserIds);
  const snapshots = uniqueUserIds.length > 30
    ? [await db.collection("pushDevices").get()]
    : await Promise.all(batches(uniqueUserIds, 30).filter((batch) => batch.length).map((batch) => (
      db.collection("pushDevices").where("uid", "in", batch).get()
    )));

  snapshots.forEach((snapshot) => {
    snapshot.docs.forEach((item) => {
      const data = item.data();
      const uid = typeof data.uid === "string" ? data.uid : "";
      if (!uid || !userIdSet.has(uid)) return;
      const record = { id: item.id, ...data } as PushDeviceRecord;
      byUid.set(uid, [...(byUid.get(uid) ?? []), record]);
    });
  });
  return byUid;
}

function buildUserMessages(notificationId: string, notification: NotificationRecord, user: UserRecord, devices: PushDeviceRecord[]): PushEnvelope[] {
  const uid = String(user.uid ?? "");
  const account = {
    ...user,
    uid,
    role: typeof user.role === "string" ? user.role : undefined,
    appRole: typeof user.appRole === "string" ? user.appRole : undefined,
    country: typeof user.country === "string" ? user.country : undefined,
    countryCode: typeof user.countryCode === "string" ? user.countryCode : undefined,
    isPremium: isActivePremium(user),
    badges: stringArray(user.badges),
    systemBadges: stringArray(user.systemBadges),
    adminBadges: stringArray(user.adminBadges),
    isDisabled: user.isDisabled === true
  };
  if (!notificationTargetsAccount(notification, account, typeof user.language === "string" ? user.language : "tr")) return [];
  if (!notificationPreferenceAllows(user, notification)) return [];

  const activeDevices: { token: string; language: string; platform: PushEnvelope["platform"]; deviceId: string; deviceDocumentId: string }[] = devices
    .filter((device) => device.enabled === true
      && device.permissionStatus === "granted"
      && (!device.projectId || device.projectId === ART_ATLAS_EXPO_PROJECT_ID)
      && isExpoPushToken(device.token))
    .map((device) => ({
      token: device.token,
      language: supportedLanguage(device.language) ? device.language : typeof user.language === "string" ? user.language : "tr",
      platform: device.platform === "android" || device.platform === "ios" ? device.platform : "unknown",
      deviceId: device.deviceId,
      deviceDocumentId: device.id
    }));
  // Older app versions only wrote the token on the user document. Preserve that
  // fallback whenever no active canonical device remains, including after a
  // denied permission, logout, token rotation, or stale-project registration.
  const targets: { token: string; language: string; platform: PushEnvelope["platform"]; deviceId: string; deviceDocumentId: string }[] = activeDevices.length > 0 ? activeDevices : pushTokens(user).map((token) => ({
    token,
    language: typeof user.language === "string" ? user.language : "tr",
    platform: user.pushPlatform === "android" || user.pushPlatform === "ios" ? user.pushPlatform : "unknown" as const,
    deviceId: "legacy",
    deviceDocumentId: ""
  }));

  return targets.map((target) => ({
    to: target.token,
    title: localizedText(notification.title, target.language),
    body: localizedText(notification.body, target.language),
    sound: notification.metadata?.pushStyle === "silent" ? null : "default",
    priority: notification.metadata?.pushStyle === "silent" ? "normal" : "high",
    channelId: "art-atlas-general",
    data: {
      notificationId,
      targetPath: typeof notification.targetPath === "string" ? notification.targetPath : "/notifications",
      type: typeof notification.type === "string" ? notification.type : "system"
    },
    userId: uid,
    deviceId: target.deviceId,
    deviceDocumentId: target.deviceDocumentId,
    platform: target.platform
  }));
}

async function filterPreviouslyAccepted(db: Firestore, notificationId: string, messages: PushEnvelope[]) {
  const pending: PushEnvelope[] = [];
  for (const messageBatch of batches(messages, 300)) {
    const refs = messageBatch.map((message) => db.collection("pushDeliveries").doc(deliveryId(notificationId, message.to)));
    const snapshots = refs.length ? await db.getAll(...refs) : [];
    messageBatch.forEach((message, index) => {
      const status = snapshots[index]?.data()?.status;
      if (status !== "accepted" && status !== "delivered") pending.push(message);
    });
  }
  return pending;
}

async function sendExpoMessages(db: Firestore, notificationId: string, messages: PushEnvelope[]) {
  const invalidTargets: PushEnvelope[] = [];
  const failures: string[] = [];
  const transportFailures: string[] = [];
  let accepted = 0;
  let ticketCount = 0;
  let retryableFailures = 0;

  for (const messageBatch of batches(messages, 100)) {
    const response = await fetch(EXPO_SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messageBatch.map(expoPayload))
    }).catch((error: unknown) => {
      transportFailures.push(error instanceof Error ? error.message : "expo_push_network_error");
      return null;
    });
    if (!response) continue;
    if (!response.ok) {
      transportFailures.push(`http_${response.status}`);
      continue;
    }
    const payload = await response.json() as { data?: ExpoTicket[] };
    const writeBatch = db.batch();
    messageBatch.forEach((message, index) => {
      const ticket = payload.data?.[index];
      const id = deliveryId(notificationId, message.to);
      const deliveryRef = db.collection("pushDeliveries").doc(id);
      if (!ticket) {
        failures.push("expo_missing_ticket");
        retryableFailures += 1;
        writeBatch.set(deliveryRef, deliveryPayload(notificationId, message, "failed", "", "expo_missing_ticket"), { merge: true });
        return;
      }
      if (ticket.status === "ok" && ticket.id) {
        accepted += 1;
        ticketCount += 1;
        writeBatch.set(deliveryRef, deliveryPayload(notificationId, message, "accepted", ticket.id), { merge: true });
        writeBatch.set(db.collection("pushReceipts").doc(ticket.id), {
          notificationId,
          deliveryId: id,
          token: message.to,
          userId: message.userId,
          deviceId: message.deviceId,
          deviceDocumentId: message.deviceDocumentId,
          platform: message.platform,
          status: "pending",
          createdAtMs: Date.now(),
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp()
        }, { merge: true });
        return;
      }
      const error = ticket.details?.error ?? "expo_push_error";
      failures.push(`${error}:${ticket.message ?? ""}`);
      if (error === "DeviceNotRegistered") invalidTargets.push(message);
      if (error === "MessageRateExceeded") retryableFailures += 1;
      writeBatch.set(deliveryRef, deliveryPayload(notificationId, message, error === "DeviceNotRegistered" ? "invalid" : "failed", "", error), { merge: true });
    });
    await writeBatch.commit();
  }
  return { accepted, ticketCount, invalidTargets, failures, transportFailures, retryableFailures };
}

function deliveryPayload(notificationId: string, message: PushEnvelope, status: string, ticketId = "", error = "") {
  return {
    notificationId,
    tokenHash: tokenHash(message.to),
    userId: message.userId,
    deviceId: message.deviceId,
    deviceDocumentId: message.deviceDocumentId,
    platform: message.platform,
    status,
    ticketId,
    error,
    updatedAt: FieldValue.serverTimestamp()
  };
}

async function cleanupInvalidTokens(db: Firestore, targets: PushEnvelope[]) {
  await Promise.all(targets.map((target) => disableInvalidTarget(db, {
    token: target.to,
    userId: target.userId,
    deviceDocumentId: target.deviceDocumentId
  })));
}

async function disableInvalidTarget(db: Firestore, target: Pick<ReceiptRecord, "token" | "userId" | "deviceDocumentId">) {
  if (target.deviceDocumentId) {
    await db.collection("pushDevices").doc(target.deviceDocumentId).set({
      enabled: false,
      invalidReason: "DeviceNotRegistered",
      invalidAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
  }
  if (!target.userId || !target.token) return;
  const userRef = db.collection("users").doc(target.userId);
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists) return;
    const update: Record<string, unknown> = { expoPushTokens: FieldValue.arrayRemove(target.token), updatedAt: FieldValue.serverTimestamp() };
    if (snapshot.data()?.expoPushToken === target.token) update.expoPushToken = FieldValue.delete();
    transaction.update(userRef, update);
  });
}

function expoPayload(message: PushEnvelope): PushMessage {
  return {
    to: message.to,
    title: message.title,
    body: message.body,
    sound: message.sound,
    priority: message.priority,
    channelId: message.channelId,
    badge: 1,
    data: message.data
  };
}

type PushMessage = {
  to: string;
  title: string;
  body: string;
  sound: "default" | null;
  priority: "normal" | "high";
  channelId: string;
  badge?: number;
  data: Record<string, string>;
};

type ExpoTicket = { status?: string; id?: string; message?: string; details?: { error?: string } };
type ExpoReceipt = { status?: string; message?: string; details?: { error?: string } };
type ReceiptRecord = {
  id: string;
  notificationId: string;
  deliveryId: string;
  token: string;
  userId: string;
  deviceId: string;
  deviceDocumentId: string;
  platform: string;
  status: string;
  createdAtMs: number;
};

function deliveryId(notificationId: string, token: string) {
  return `${notificationId}_${tokenHash(token)}`.slice(0, 240);
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex").slice(0, 40);
}

function pushTokens(user: UserRecord) {
  return [...new Set([
    ...(Array.isArray(user.expoPushTokens) ? user.expoPushTokens : []),
    ...(typeof user.expoPushToken === "string" ? [user.expoPushToken] : [])
  ].filter((token): token is string => isExpoPushToken(token)))];
}

function isExpoPushToken(token: unknown): token is string {
  return typeof token === "string" && /^(ExponentPushToken|ExpoPushToken)\[[^\]]+\]$/.test(token);
}

function deduplicateMessages(messages: PushEnvelope[]) {
  const byToken = new Map<string, PushEnvelope>();
  messages.forEach((message) => {
    const existing = byToken.get(message.to);
    if (!existing || (existing.deviceDocumentId === "" && message.deviceDocumentId !== "")) byToken.set(message.to, message);
  });
  return [...byToken.values()];
}

function notificationPreferenceAllows(user: UserRecord, notification: NotificationRecord) {
  if (user.notificationsEnabled === false) return false;
  const preferences = user.notificationPreferences;
  if (!preferences || typeof preferences !== "object") return true;
  return preferences[notificationPreferenceKey(typeof notification.type === "string" ? notification.type : "system")] !== false;
}

function notificationPreferenceKey(type: string) {
  if (type === "direct_message") return "messages";
  if (type === "new_follower" || type === "follow" || type === "profile_visit_summary" || type === "premium_profile_visitor") return "follows";
  if (type.includes("comment") || type === "post_commented" || type === "community_image_commented") return "comments";
  if (type.includes("liked") || type.includes("disliked") || type === "like" || type === "museum_liked") return "likes";
  if (type.includes("duel")) return "duels";
  if (type.includes("prophecy") || type.includes("seer") || type.includes("prophet")) return "seer";
  if (type.includes("badge") || type.includes("winner")) return "badges";
  if (type.includes("chance") || type.includes("draw")) return "chance";
  if (type.includes("time_capsule")) return "timeCapsule";
  if (type.includes("community_image") || type.includes("weekly") || type.includes("quiz")) return "contests";
  return "system";
}

function localizedText(value: string | Record<string, string> | undefined, language: string) {
  if (typeof value === "string") return value;
  return value?.[language] || value?.tr || value?.en || "Art Atlas";
}

function supportedLanguage(value: string): value is "tr" | "en" | "ru" | "uz" {
  return value === "tr" || value === "en" || value === "ru" || value === "uz";
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function batches<T>(items: T[], size: number) {
  return Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
}
