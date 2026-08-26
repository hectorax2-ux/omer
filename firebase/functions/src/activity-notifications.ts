import { FieldValue, getFirestore, type DocumentData } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { onDocumentCreated, onDocumentUpdated, onDocumentWritten } from "firebase-functions/v2/firestore";

type ActivityTarget = {
  recipientId: string;
  body: string;
  targetType: "post" | "comment" | "communityImage" | "profile" | "museum" | "artwork";
  targetId: string;
  targetPath: string;
};

type NotificationType =
  | "post_liked"
  | "post_disliked"
  | "post_commented"
  | "post_approved"
  | "post_rejected"
  | "comment_liked"
  | "community_image_liked"
  | "community_image_disliked"
  | "community_image_commented"
  | "community_image_approved"
  | "community_image_rejected"
  | "museum_liked"
  | "new_follower"
  | "direct_message";

type LocalizedText = { tr: string; en: string; ru: string; uz: string };

const triggerOptions = { retry: true, timeoutSeconds: 120, memory: "256MiB" as const };

export const notifyReactionActivity = onDocumentWritten(
  { ...triggerOptions, document: "likes/{likeId}" },
  async (event) => {
    const after = event.data?.after;
    if (!after?.exists) return;
    const reaction = after.data();
    if (!reaction) return;
    const previous = event.data?.before.exists ? event.data.before.data() : undefined;
    if (previous?.value === reaction.value) return;
    if (reaction.value !== "like" && reaction.value !== "dislike") return;

    const actorId = text(reaction.userId);
    const targetId = text(reaction.targetId);
    const targetType = text(reaction.targetType);
    if (!actorId || !targetId || !targetType) return;

    const db = getFirestore();
    const target = await resolveReactionTarget(db, targetType, targetId);
    if (!target || target.recipientId === actorId) return;

    const actor = await loadActor(db, actorId);
    const liked = reaction.value === "like";
    const type = reactionNotificationType(targetType, liked);
    if (!type) return;

    await createActivityNotification(db, {
      id: eventNotificationId("reaction", event.id),
      recipientId: target.recipientId,
      actorId,
      actor,
      type,
      title: reactionTitle(actor.username, targetType, liked),
      body: target.body,
      targetType: target.targetType,
      targetId: target.targetId,
      targetPath: target.targetPath,
      metadata: { source: "firestore_trigger", reactionValue: reaction.value }
    });
  }
);

export const notifyPostCommentActivity = onDocumentCreated(
  { ...triggerOptions, document: "postComments/{commentId}" },
  async (event) => {
    const comment = event.data?.data();
    if (!comment || !isVisibleComment(comment)) return;
    const actorId = text(comment.authorId);
    const postId = text(comment.postId);
    if (!actorId || !postId) return;

    const db = getFirestore();
    const post = await db.collection("posts").doc(postId).get();
    if (!post.exists) return;
    const recipientId = text(post.data()?.authorId);
    if (!recipientId || recipientId === actorId) return;

    const actor = await loadActor(db, actorId, comment);
    await createActivityNotification(db, {
      id: eventNotificationId("post_comment", event.id),
      recipientId,
      actorId,
      actor,
      type: "post_commented",
      title: localized(
        `${actor.username} yazına yorum yaptı.`,
        `${actor.username} commented on your post.`,
        `${actor.username} прокомментировал(а) вашу публикацию.`,
        `${actor.username} postingizga izoh qoldirdi.`
      ),
      body: text(comment.text).slice(0, 140),
      targetType: "post",
      targetId: postId,
      targetPath: `/post/${postId}`,
      metadata: { source: "firestore_trigger", commentId: event.params.commentId }
    });
  }
);

export const notifyCommunityImageCommentActivity = onDocumentCreated(
  { ...triggerOptions, document: "communityImageComments/{commentId}" },
  async (event) => {
    const comment = event.data?.data();
    if (!comment || !isVisibleComment(comment)) return;
    const actorId = text(comment.authorId);
    const imageId = text(comment.communityImageId);
    if (!actorId || !imageId) return;

    const db = getFirestore();
    const image = await db.collection("communityImages").doc(imageId).get();
    if (!image.exists) return;
    const recipientId = text(image.data()?.ownerId);
    if (!recipientId || recipientId === actorId) return;

    const actor = await loadActor(db, actorId, comment);
    await createActivityNotification(db, {
      id: eventNotificationId("image_comment", event.id),
      recipientId,
      actorId,
      actor,
      type: "community_image_commented",
      title: localized(
        `${actor.username} görseline yorum yaptı.`,
        `${actor.username} commented on your image.`,
        `${actor.username} прокомментировал(а) вашу работу.`,
        `${actor.username} rasmingizga izoh qoldirdi.`
      ),
      body: text(comment.text).slice(0, 140),
      targetType: "communityImage",
      targetId: imageId,
      targetPath: "/ranking",
      metadata: { source: "firestore_trigger", commentId: event.params.commentId }
    });
  }
);

export const notifyNewFollowerActivity = onDocumentCreated(
  { ...triggerOptions, document: "userFollows/{followId}" },
  async (event) => {
    const follow = event.data?.data();
    if (!follow) return;
    const actorId = text(follow.followerId);
    const recipientId = text(follow.followedId);
    if (!actorId || !recipientId || actorId === recipientId) return;

    const db = getFirestore();
    const actor = await loadActor(db, actorId, follow);
    await createActivityNotification(db, {
      id: eventNotificationId("follow", event.id),
      recipientId,
      actorId,
      actor,
      type: "new_follower",
      title: localized(
        `${actor.username} seni takip etmeye başladı.`,
        `${actor.username} started following you.`,
        `${actor.username} подписался(-ась) на вас.`,
        `${actor.username} sizni kuzata boshladi.`
      ),
      body: localized(
        "Profiline gidip çalışmalarını inceleyebilirsin.",
        "Open their profile to see their work.",
        "Откройте профиль, чтобы посмотреть работы.",
        "Ishlarini ko‘rish uchun profilini oching."
      ),
      targetType: "profile",
      targetId: actorId,
      targetPath: `/profile/${actorId}`,
      metadata: { source: "firestore_trigger" }
    });
  }
);

export const notifyDirectMessageActivity = onDocumentCreated(
  { ...triggerOptions, document: "conversations/{conversationId}/messages/{messageId}" },
  async (event) => {
    const message = event.data?.data();
    if (!message) return;
    const senderId = text(message.senderId);
    if (!senderId) return;

    const db = getFirestore();
    const conversation = await db.collection("conversations").doc(event.params.conversationId).get();
    const participantIds = Array.isArray(conversation.data()?.participantIds)
      ? conversation.data()?.participantIds.filter((item: unknown): item is string => typeof item === "string") ?? []
      : [];
    const recipientId = participantIds.find((uid: string) => uid !== senderId) ?? "";
    if (!recipientId) return;

    const actor = await loadActor(db, senderId);
    const preview = text(message.text || message.content).slice(0, 140);
    await createActivityNotification(db, {
      id: `dm_${event.params.conversationId}_${event.params.messageId}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 240),
      recipientId,
      actorId: senderId,
      actor,
      type: "direct_message",
      title: localized(
        `${actor.username} sana mesaj gönderdi`,
        `${actor.username} sent you a message`,
        `${actor.username} отправил(а) вам сообщение`,
        `${actor.username} sizga xabar yubordi`
      ),
      body: preview,
      targetType: "profile",
      targetId: event.params.conversationId,
      targetPath: `/messages/${event.params.conversationId}`,
      metadata: { source: "message_trigger", messageId: event.params.messageId }
    });
  }
);

export const notifyCommunityImageReview = onDocumentUpdated(
  { ...triggerOptions, document: "communityImages/{imageId}" },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.status === after.status) return;
    if (after.status !== "published" && after.status !== "rejected") return;
    const recipientId = text(after.ownerId);
    if (!recipientId) return;

    const approved = after.status === "published";
    await createActivityNotification(getFirestore(), {
      id: eventNotificationId("image_review", event.id),
      recipientId,
      actorId: "admin",
      actor: { username: "Art Atlas", photoURL: "" },
      type: approved ? "community_image_approved" : "community_image_rejected",
      title: approved
        ? localized("Resmin onaylandı", "Your image was approved", "Ваша работа одобрена", "Rasmingiz tasdiqlandi")
        : localized("Resmin için inceleme tamamlandı", "Your image review is complete", "Проверка вашей работы завершена", "Rasmingiz tekshiruvi yakunlandi"),
      body: approved
        ? localized("Yüklediğin resim artık uygulamada yayında.", "Your uploaded image is now live in the app.", "Загруженная работа опубликована в приложении.", "Yuklagan rasmingiz endi ilovada ko‘rinadi.")
        : localized("Yüklediğin resim yayın ölçütlerini karşılamadığı için onaylanmadı.", "Your uploaded image did not meet the publishing requirements.", "Загруженная работа не соответствует требованиям публикации.", "Yuklagan rasmingiz nashr talablariga mos kelmadi."),
      targetType: "communityImage",
      targetId: event.params.imageId,
      targetPath: "/ranking",
      metadata: { source: "review_status", reviewStatus: after.status }
    });
  }
);

export const notifyPostReview = onDocumentUpdated(
  { ...triggerOptions, document: "posts/{postId}" },
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after || before.status === after.status || before.status !== "pending") return;
    if (after.status !== "published" && after.status !== "rejected" && after.status !== "removed") return;
    const recipientId = text(after.authorId);
    if (!recipientId) return;

    const approved = after.status === "published";
    await createActivityNotification(getFirestore(), {
      id: eventNotificationId("post_review", event.id),
      recipientId,
      actorId: "admin",
      actor: { username: "Art Atlas", photoURL: "" },
      type: approved ? "post_approved" : "post_rejected",
      title: approved
        ? localized("Yazın onaylandı", "Your post was approved", "Ваша публикация одобрена", "Postingiz tasdiqlandi")
        : localized("Yazı incelemesi tamamlandı", "Your post review is complete", "Проверка публикации завершена", "Post tekshiruvi yakunlandi"),
      body: approved
        ? localized("Yazın artık Keşfet akışında yayında.", "Your post is now live in Discover.", "Публикация появилась в разделе «Обзор».", "Postingiz endi Kashf etish bo‘limida ko‘rinadi.")
        : localized("Yazın yayın ölçütlerini karşılamadığı için onaylanmadı.", "Your post did not meet the publishing requirements.", "Публикация не соответствует требованиям.", "Postingiz nashr talablariga mos kelmadi."),
      targetType: "post",
      targetId: event.params.postId,
      targetPath: approved ? `/post/${event.params.postId}` : "/profile",
      metadata: { source: "review_status", reviewStatus: after.status }
    });
  }
);

async function createActivityNotification(db: FirebaseFirestore.Firestore, input: {
  id: string;
  recipientId: string;
  actorId: string;
  actor: { username: string; photoURL: string };
  type: NotificationType;
  title: LocalizedText;
  body: string | LocalizedText;
  targetType: ActivityTarget["targetType"];
  targetId: string;
  targetPath: string;
  metadata: Record<string, unknown>;
}) {
  if (!input.recipientId || input.recipientId === input.actorId) return;
  const notificationRef = db.collection("notifications").doc(input.id);
  await notificationRef.create({
    recipientId: input.recipientId,
    userId: input.recipientId,
    actorId: input.actorId,
    actorUsername: input.actor.username,
    actorPhotoURL: input.actor.photoURL,
    type: input.type,
    title: input.title,
    body: typeof input.body === "string" ? localized(input.body, input.body, input.body, input.body) : input.body,
    targetType: input.targetType,
    targetId: input.targetId,
    targetOwnerId: input.recipientId,
    targetPath: input.targetPath,
    language: "all",
    isRead: false,
    isDeleted: false,
    readBy: [],
    pushEnabled: true,
    pushSent: false,
    status: "published",
    metadata: input.metadata,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp()
  }).catch((error: unknown) => {
    if (isAlreadyExistsError(error)) return;
    throw error;
  });
  logger.info("Activity notification created", { notificationId: input.id, recipientId: input.recipientId, type: input.type });
}

async function resolveReactionTarget(db: FirebaseFirestore.Firestore, targetType: string, targetId: string): Promise<ActivityTarget | null> {
  if (targetType === "post") {
    const post = await db.collection("posts").doc(targetId).get();
    if (!post.exists) return null;
    return targetFrom(post.data(), "authorId", "text", "post", targetId, `/post/${targetId}`);
  }
  if (targetType === "communityImage") {
    const image = await db.collection("communityImages").doc(targetId).get();
    if (!image.exists) return null;
    return targetFrom(image.data(), "ownerId", "title", "communityImage", targetId, "/ranking");
  }
  if (targetType === "museum") {
    const museum = await db.collection("personalMuseums").doc(targetId).get();
    if (!museum.exists) return null;
    return targetFrom(museum.data(), "ownerId", "name", "museum", targetId, `/museum/${targetId}`);
  }
  if (targetType === "comment") {
    const postComment = await db.collection("postComments").doc(targetId).get();
    if (postComment.exists) {
      const data = postComment.data();
      return targetFrom(data, "authorId", "text", "comment", targetId, `/post/${text(data?.postId)}`);
    }
    const imageComment = await db.collection("communityImageComments").doc(targetId).get();
    if (!imageComment.exists) return null;
    return targetFrom(imageComment.data(), "authorId", "text", "comment", targetId, "/ranking");
  }
  if (targetType === "profile") {
    return { recipientId: targetId, body: "", targetType: "profile", targetId, targetPath: `/profile/${targetId}` };
  }
  return null;
}

function targetFrom(data: DocumentData | undefined, ownerField: string, bodyField: string, targetType: ActivityTarget["targetType"], targetId: string, targetPath: string): ActivityTarget | null {
  const recipientId = text(data?.[ownerField]);
  if (!recipientId) return null;
  return { recipientId, body: text(data?.[bodyField]).slice(0, 140), targetType, targetId, targetPath };
}

async function loadActor(db: FirebaseFirestore.Firestore, uid: string, fallback: DocumentData = {}) {
  const user = await db.collection("users").doc(uid).get();
  const data = user.data() ?? fallback;
  return {
    username: text(data.username) || text(fallback.authorUsername) || text(fallback.followerUsername) || "Kullanıcı",
    photoURL: text(data.photoURL) || text(data.avatar) || ""
  };
}

function reactionNotificationType(targetType: string, liked: boolean): NotificationType | null {
  if (targetType === "post") return liked ? "post_liked" : "post_disliked";
  if (targetType === "communityImage") return liked ? "community_image_liked" : "community_image_disliked";
  if (targetType === "comment" && liked) return "comment_liked";
  if (targetType === "museum" && liked) return "museum_liked";
  return null;
}

function reactionTitle(username: string, targetType: string, liked: boolean): LocalizedText {
  const target = targetType === "post" ? "yazını" : targetType === "communityImage" ? "görselini" : targetType === "comment" ? "yorumunu" : "içeriğini";
  const action = liked ? "beğendi" : "beğenmedi";
  return localized(
    `${username} ${target} ${action}.`,
    `${username} ${liked ? "liked" : "disliked"} your ${targetType === "post" ? "post" : targetType === "comment" ? "comment" : "artwork"}.`,
    `${username} ${liked ? "оценил(а)" : "не оценил(а)"} вашу публикацию.`,
    `${username} kontentingizni ${liked ? "yoqtirdi" : "yoqtirmadi"}.`
  );
}

function localized(tr: string, en: string, ru: string, uz: string): LocalizedText {
  return { tr, en, ru, uz };
}

function isVisibleComment(comment: DocumentData) {
  return comment.status === "published" || comment.status === "pending";
}

function eventNotificationId(prefix: string, eventId: string) {
  return `${prefix}_${eventId}`.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 240);
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function isAlreadyExistsError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? (error as { code?: unknown }).code : undefined;
  return code === 6 || code === "6" || code === "already-exists";
}
