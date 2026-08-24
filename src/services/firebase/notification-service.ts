import { collection, doc, getDoc, getDocs, limit, orderBy, query, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { firestoreDb } from "./core";
import { NotificationDocument } from "@/src/types/firestore";
import { createDocument, deleteDocument, firestoreQuery, listDocuments, updateDocument } from "@/src/services/firebase/firestore-helpers";

type Localized = NotificationDocument["title"];

export type NotificationTargetType = NonNullable<NotificationDocument["targetType"]>;
export type NotificationType = NotificationDocument["type"];

export type CreateNotificationInput = {
  id?: string;
  recipientId?: string;
  actorId?: string;
  actorUsername?: string;
  actorPhotoURL?: string;
  type: NotificationType;
  title: string | Localized;
  body: string | Localized;
  targetType?: NotificationTargetType;
  targetId?: string;
  targetOwnerId?: string;
  targetPath?: string;
  language?: NotificationDocument["language"];
  role?: NotificationDocument["role"] | "all";
  country?: string;
  metadata?: Record<string, unknown>;
  dedupeKey?: string;
  pushEnabled?: boolean;
  scheduledAt?: unknown;
  status?: NotificationDocument["status"];
};

export function toLocalizedText(value: string | Localized): Localized {
  if (typeof value !== "string") return value;
  return { tr: value, en: value, ru: value, uz: value };
}

export async function createNotification(input: CreateNotificationInput): Promise<string> {
  const recipientId = input.recipientId ?? "all";
  const payload: Omit<NotificationDocument, "id" | "createdAt" | "updatedAt"> & { id?: string } = {
    id: input.id,
    recipientId,
    userId: recipientId,
    actorId: input.actorId,
    actorUsername: input.actorUsername,
    actorPhotoURL: input.actorPhotoURL,
    type: input.type,
    title: toLocalizedText(input.title),
    body: toLocalizedText(input.body),
    targetType: input.targetType,
    targetId: input.targetId,
    targetOwnerId: input.targetOwnerId,
    targetPath: input.targetPath ?? buildTargetPath(input.targetType, input.targetId),
    language: input.language ?? "all",
    role: input.role === "all" ? undefined : input.role,
    country: input.country ?? "",
    isRead: false,
    isDeleted: false,
    readBy: [],
    pushEnabled: input.pushEnabled ?? false,
    pushSent: false,
    metadata: input.metadata ?? {},
    dedupeKey: input.dedupeKey,
    status: input.status ?? "published",
    scheduledAt: input.scheduledAt as NotificationDocument["scheduledAt"]
  };

  const sanitized = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  ) as typeof payload;

  return createDocument<NotificationDocument>("notifications", sanitized);
}

export async function createInteractionNotification(input: CreateNotificationInput & {
  recipientId: string;
  actorId: string;
  targetId: string;
}): Promise<string | null> {
  if (!input.recipientId || input.recipientId === input.actorId) return null;
  const dedupeKey = input.dedupeKey ?? `${input.type}_${input.actorId}_${input.targetId}`;
  const notificationId = stableId(dedupeKey);
  const existing = await getDoc(doc(firestoreDb, "notifications", notificationId));
  if (existing.exists()) return notificationId;

  return createNotification({
    ...input,
    id: notificationId,
    dedupeKey,
    recipientId: input.recipientId,
    status: "published"
  });
}

export async function listUserNotifications(userId: string, maxResults = 80): Promise<NotificationDocument[]> {
  if (!userId) return [];
  const [personal, broadcast] = await Promise.all([
    listDocuments<NotificationDocument>("notifications", [
      firestoreQuery.where("recipientId", "==", userId),
      firestoreQuery.limit(maxResults)
    ]),
    listDocuments<NotificationDocument>("notifications", [
      firestoreQuery.where("recipientId", "==", "all"),
      firestoreQuery.limit(maxResults)
    ]).catch(() => listDocuments<NotificationDocument>("notifications", [
      firestoreQuery.where("userId", "==", "all"),
      firestoreQuery.limit(maxResults)
    ]))
  ]);

  return [...personal, ...broadcast]
    .filter((item) => item.status === "published" && item.isDeleted !== true && notificationVisibleInApp(item))
    .sort((a, b) => toTime(b.createdAt) - toTime(a.createdAt))
    .slice(0, maxResults);
}

export function notificationVisibleInApp(notification: Pick<NotificationDocument, "metadata">): boolean {
  return notification.metadata?.channel !== "push";
}

export async function listPublishedNotifications(maxResults = 80): Promise<NotificationDocument[]> {
  return listDocuments<NotificationDocument>("notifications", [
    firestoreQuery.where("status", "==", "published"),
    firestoreQuery.limit(maxResults)
  ]);
}

export async function listAdminNotifications(maxResults = 100): Promise<NotificationDocument[]> {
  const snapshot = await getDocs(query(collection(firestoreDb, "notifications"), orderBy("createdAt", "desc"), limit(maxResults)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() } as NotificationDocument));
}

export async function markNotificationRead(notificationId: string, userId: string): Promise<void> {
  await setDoc(doc(firestoreDb, "notificationReads", `${userId}_${notificationId}`), {
    userId,
    notificationId,
    readAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export async function softDeleteNotification(notificationId: string): Promise<void> {
  await updateDoc(doc(firestoreDb, "notifications", notificationId), {
    isDeleted: true,
    status: "hidden",
    updatedAt: serverTimestamp()
  });
}

export async function logNotificationEvent(input: {
  type: string;
  status: "notification_created" | "notification_skipped" | "notification_failed";
  actorId?: string;
  recipientId?: string;
  targetType?: string;
  targetId?: string;
  notificationId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await setDoc(doc(collection(firestoreDb, "notificationLogs")), {
    ...input,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateNotification(id: string, input: Partial<Omit<NotificationDocument, "id" | "createdAt" | "updatedAt">>): Promise<void> {
  return updateDocument<NotificationDocument>("notifications", id, input);
}

export async function deleteNotification(id: string): Promise<void> {
  return deleteDocument("notifications", id);
}

function buildTargetPath(targetType?: NotificationTargetType, targetId?: string) {
  if (targetType === "communityImage") return "/ranking";
  if (!targetType || !targetId) return "/notifications";
  if (targetType === "post") return `/post/${targetId}`;
  if (targetType === "profile") return `/profile/${targetId}`;
  if (targetType === "museum") return `/museum/${targetId}`;
  if (targetType === "artwork") return `/artwork/${targetId}`;
  if (targetType === "duel") return "/duels";
  if (targetType === "quiz") return "/quiz";
  if (targetType === "badge") return "/roles-badges";
  return "/notifications";
}

function stableId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 180);
}

function toTime(value: unknown) {
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    return value.toDate().getTime();
  }
  if (typeof value === "string") return Date.parse(value) || 0;
  return 0;
}
