import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import * as ExpoLinking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import { commonCopy } from "@/app/i18n/common";
import { feedCopy, postCopy } from "@/app/i18n/common";
import { msg, systemMessages } from "@/app/i18n/system-messages";
import { AppChrome } from "@/components/app-chrome";
import { ProfileAvatar } from "@/components/profile-avatar";
import { ReactionLikersModal } from "@/components/reaction-likers-modal";
import { getThemeColors } from "@/constants/theme";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useDiscoveryPosts } from "@/hooks/use-discovery-posts";
import { useLanguage } from "@/hooks/use-language";
import { firebaseAuth } from "@/src/services/firebase";
import { createReport } from "@/src/services/firebase/report-service";
import {
  canCommentOnDiscoverPost,
  canDeleteComment,
  canEditDiscoverComment,
  isDiscoverCommentAuthor
} from "@/utils/comment-permissions";
import { formatPostTime } from "@/utils/post-time";
import { buildBlockedLanguageMessage } from "@/utils/safety";
import { profileRouteParam } from "@/utils/profile-route";
import { t } from "@/utils/localized-text";

const COMMENT_MAX_LENGTH = 500;
const COMMENT_PAGE_SIZE = 10;
const FLASH_HINT_MS = 2500;

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { language } = useLanguage();
  const { account } = useAccount();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { addComment, commentsByPost, deleteComment, editComment, posts, likedIds, favoriteIds, toggleLike, toggleFavorite } = useDiscoveryPosts();
  const [commentText, setCommentText] = useState("");
  const [message, setMessage] = useState("");
  const [flashHint, setFlashHint] = useState("");
  const [visibleCount, setVisibleCount] = useState(COMMENT_PAGE_SIZE);
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null);
  const [openMenuCommentId, setOpenMenuCommentId] = useState<string | null>(null);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [reportCommentId, setReportCommentId] = useState<string | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [likersOpen, setLikersOpen] = useState(false);
  const [reportPostOpen, setReportPostOpen] = useState(false);
  const [postReportReason, setPostReportReason] = useState("");
  const [postReportSubmitting, setPostReportSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);
  const post = posts.find((item) => item.id === id);
  const comments = commentsByPost[id ?? ""] ?? [];
  const visibleComments = comments.slice(0, visibleCount);
  const canComment = canCommentOnDiscoverPost(account);
  const liked = post ? likedIds.includes(post.id) : false;
  const favorited = post ? favoriteIds.includes(post.id) : false;
  const isOwner = post ? (post.authorId === account.uid || post.username === account.username) : false;

  useEffect(() => {
    if (!flashHint) return;
    const timer = setTimeout(() => setFlashHint(""), FLASH_HINT_MS);
    return () => clearTimeout(timer);
  }, [flashHint]);

  function submitComment() {
    if (!post) return;
    if (!canComment) {
      setMessage(t(commonCopy.commentPremiumRequired, language));
      return;
    }
    const text = commentText.trim().slice(0, COMMENT_MAX_LENGTH);
    if (!text) return;
    const result = addComment(post.id, {
      author: account.displayName,
      username: account.username,
      text,
      isPremium: account.isPremium
    }, language);
    if (result.reason === "cooldown") {
      setFlashHint(result.message ?? "");
      return;
    }
    setMessage(result.message ?? (result.ok ? t(commonCopy.commentAdded, language) : buildBlockedLanguageMessage(language)));
    if (result.ok) setCommentText("");
  }

  function handleDeleteCommentConfirmed() {
    if (!post || !pendingDeleteCommentId) return;
    const result = deleteComment(post.id, pendingDeleteCommentId);
    setPendingDeleteCommentId(null);
    if (!result.ok && result.message) setMessage(result.message);
  }

  function startEditComment(commentId: string, text: string) {
    setOpenMenuCommentId(null);
    setEditingCommentId(commentId);
    setEditDraft(text);
  }

  function cancelEditComment() {
    setEditingCommentId(null);
    setEditDraft("");
  }

  function saveEditComment() {
    if (!post || !editingCommentId) return;
    const result = editComment(post.id, editingCommentId, editDraft, language);
    if (!result.ok) {
      setMessage(result.message ?? buildBlockedLanguageMessage(language));
      return;
    }
    setEditingCommentId(null);
    setEditDraft("");
    setMessage(t(commonCopy.commentUpdated, language));
  }

  async function sharePost() {
    if (!post) return;
    await Clipboard.setStringAsync(ExpoLinking.createURL(`/post/${post.id}`));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function reportPost() {
    if (!post) return;
    const reason = postReportReason.trim();
    const reporterId = firebaseAuth.currentUser?.uid;
    if (!reporterId || !reason) {
      Alert.alert(t(feedCopy.reportMissingTitle, language), t(feedCopy.reportMissingBody, language));
      return;
    }
    setPostReportSubmitting(true);
    try {
      await createReport({
        reporterId,
        targetType: "post",
        targetId: post.id,
        category: "content",
        subject: t(feedCopy.reportSubject, language),
        message: `Post: ${post.id}\nAuthor: ${post.author} (@${post.username})\nLink: ${ExpoLinking.createURL(`/post/${post.id}`)}\nReason: ${reason}`
      });
      setReportPostOpen(false);
      setPostReportReason("");
      Alert.alert(t(feedCopy.reportReceivedTitle, language), t(feedCopy.reportReceivedBody, language));
    } catch {
      Alert.alert(t(feedCopy.reportFailedTitle, language), t(feedCopy.reportFailedBody, language));
    } finally {
      setPostReportSubmitting(false);
    }
  }

  async function submitCommentReport() {
    if (!post || !reportCommentId) return;
    const reason = reportReason.trim();
    const reporterId = firebaseAuth.currentUser?.uid;
    const comment = comments.find((item) => item.id === reportCommentId);
    if (!reporterId || !reason || !comment) {
      Alert.alert(t(feedCopy.reportMissingTitle, language), t(feedCopy.reportMissingBody, language));
      return;
    }
    setReportSubmitting(true);
    try {
      await createReport({
        reporterId,
        targetType: "comment",
        targetId: comment.id,
        category: "content",
        subject: t(commonCopy.reportCommentSubject, language),
        message: `Post: ${post.id}\nComment: ${comment.id}\nAuthor: ${comment.author} (@${comment.username})\nLink: ${ExpoLinking.createURL(`/post/${post.id}`)}\nReason: ${reason}`
      });
      setReportCommentId(null);
      setReportReason("");
      Alert.alert(t(feedCopy.reportReceivedTitle, language), t(commonCopy.reportCommentReceivedBody, language));
    } catch {
      Alert.alert(t(feedCopy.reportFailedTitle, language), t(feedCopy.reportFailedBody, language));
    } finally {
      setReportSubmitting(false);
    }
  }

  const reportComment = reportCommentId ? comments.find((item) => item.id === reportCommentId) : undefined;

  if (!post) {
    return (
      <AppChrome title={t(postCopy.title, language)} eyebrow="Art Atlas" showBackButton backToHome>
        <Text style={styles.empty}>{t(postCopy.notFound, language)}</Text>
      </AppChrome>
    );
  }

  return (
    <AppChrome title={t(postCopy.title, language)} eyebrow="Art Atlas" showBackButton>
      <View style={[styles.postCard, post.isPremium && styles.premiumCard]}>
        <View style={styles.postHeader}>
          <ProfileAvatar uri={post.authorPhotoURL} size={28} />
          <View style={styles.postIdentity}>
            <View style={styles.nameLine}>
              <Text style={styles.author}>{post.author}</Text>
              {post.isPremium ? <Ionicons name="diamond" size={11} color={colors.gold} /> : null}
            </View>
            <Text style={styles.postTime}>{formatPostTime(post.createdAt, language)}</Text>
          </View>
        </View>
        <Text style={styles.postText}>{post.text}</Text>
        <View style={styles.actionRow}>
          <View style={styles.likeCluster}>
            <Pressable onPress={() => toggleLike(post.id)} style={[styles.likeButton, liked && styles.likeButtonActive]}>
              <Ionicons name={liked ? "heart" : "heart-outline"} size={16} color={liked ? colors.ink : colors.gold} />
            </Pressable>
            <Pressable onPress={() => setLikersOpen(true)} style={[styles.likeCountButton, liked && styles.likeCountButtonActive]}>
              <Text style={[styles.likeCountText, liked && styles.likeCountTextActive]}>{post.likes}</Text>
              <Text style={[styles.likeCountLabel, liked && styles.likeCountLabelActive]}>{t(commonCopy.likersChip, language)}</Text>
            </Pressable>
          </View>
          {copied ? <Text style={styles.copiedInline}>{t(commonCopy.copied, language)}</Text> : null}
          <View style={styles.actionGroup}>
            <Pressable onPress={() => { void sharePost(); }} style={styles.iconActionButton}>
              <Ionicons name="share-social-outline" size={16} color={colors.gold} />
            </Pressable>
            <Pressable onPress={() => toggleFavorite(post.id)} style={[styles.iconActionButton, favorited && styles.iconActionButtonActive]}>
              <Ionicons name={favorited ? "bookmark" : "bookmark-outline"} size={16} color={favorited ? colors.ink : colors.gold} />
            </Pressable>
            {!isOwner ? (
              <Pressable onPress={() => setReportPostOpen(true)} style={styles.iconActionButton}>
                <Ionicons name="flag-outline" size={16} color={colors.gold} />
              </Pressable>
            ) : null}
          </View>
        </View>
      </View>

      <View style={styles.commentBox}>
        <Text style={styles.sectionTitle}>{t(commonCopy.addCommentSection, language)}</Text>
        <Text style={styles.note}>{t(commonCopy.commentDiscoverHint, language)}</Text>
        <TextInput
          value={commentText}
          onChangeText={(value) => setCommentText(value.slice(0, COMMENT_MAX_LENGTH))}
          editable={canComment}
          multiline
          maxLength={COMMENT_MAX_LENGTH}
          placeholder={canComment ? t(commonCopy.commentPlaceholder, language) : t(commonCopy.commentNoPermission, language)}
          placeholderTextColor={colors.muted}
          style={[styles.commentInput, !canComment && styles.disabledInput]}
        />
        <View style={styles.commentFooter}>
          <Text style={styles.counter}>{commentText.length} / {COMMENT_MAX_LENGTH}</Text>
          <Pressable onPress={submitComment} disabled={!canComment || !commentText.trim()} style={[styles.submitButton, (!canComment || !commentText.trim()) && styles.submitDisabled]}>
            <Text style={styles.submitText}>{t(commonCopy.sendComment, language)}</Text>
          </Pressable>
        </View>
        {flashHint ? <Text style={styles.flashHint}>{flashHint}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>

      <View style={styles.commentsPanel}>
        <Text style={styles.sectionTitle}>{t(commonCopy.commentsTitle, language)} ({comments.length})</Text>
        <View style={[styles.commentsList, openMenuCommentId ? styles.commentsListMenuOpen : null]}>
          {visibleComments.map((comment) => {
            const owner = { kind: "post" as const, authorId: post.authorId, username: post.username };
            const canDelete = canDeleteComment(comment, owner, account);
            const canEdit = canEditDiscoverComment(comment, account);
            const canReport = Boolean(account.uid) && !isDiscoverCommentAuthor(comment, account);
            const showMenu = Boolean(account.uid) && (canDelete || canEdit || canReport);
            return (
              <View key={comment.id} style={styles.commentRow}>
                <Pressable onPress={() => router.push({ pathname: "/profile/[name]", params: { name: profileRouteParam({ username: comment.username, displayName: comment.author, uid: comment.authorId }) } })}>
                  <ProfileAvatar size={28} />
                </Pressable>
                <View style={styles.commentMain}>
                  <View style={styles.commentHeader}>
                    <Pressable onPress={() => router.push({ pathname: "/profile/[name]", params: { name: profileRouteParam({ username: comment.username, displayName: comment.author, uid: comment.authorId }) } })} style={styles.nameLine}>
                      <Text style={styles.commentAuthor}>{comment.author}</Text>
                      {comment.isPremium ? <Ionicons name="diamond" size={11} color={colors.gold} /> : null}
                    </Pressable>
                    {showMenu ? (
                      <View style={styles.menuAnchor}>
                        <Pressable
                          onPress={() => setOpenMenuCommentId((current) => current === comment.id ? null : comment.id)}
                          style={styles.commentMenuButton}
                        >
                          <Ionicons name="ellipsis-vertical" size={16} color={colors.muted} />
                        </Pressable>
                        {openMenuCommentId === comment.id ? (
                          <View style={styles.dropdownMenu}>
                            {canEdit ? (
                              <Pressable
                                onPress={() => startEditComment(comment.id, comment.text)}
                                style={styles.dropdownItem}
                              >
                                <Ionicons name="create-outline" size={14} color={colors.gold} />
                                <Text style={styles.dropdownItemText}>{t(commonCopy.edit, language)}</Text>
                              </Pressable>
                            ) : null}
                            {canReport ? (
                              <Pressable
                                onPress={() => { setReportCommentId(comment.id); setOpenMenuCommentId(null); }}
                                style={styles.dropdownItem}
                              >
                                <Ionicons name="flag-outline" size={14} color={colors.gold} />
                                <Text style={styles.dropdownItemText}>{t(commonCopy.report, language)}</Text>
                              </Pressable>
                            ) : null}
                            {canDelete ? (
                              <Pressable
                                onPress={() => { setPendingDeleteCommentId(comment.id); setOpenMenuCommentId(null); }}
                                style={[styles.dropdownItem, styles.dropdownItemLast]}
                              >
                                <Ionicons name="trash-outline" size={14} color={colors.wine} />
                                <Text style={[styles.dropdownItemText, styles.dropdownItemDanger]}>{t(commonCopy.delete, language)}</Text>
                              </Pressable>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.commentTime}>{formatPostTime(comment.createdAt, language)}</Text>
                  <Text style={styles.commentText}>{comment.text}</Text>
                </View>
              </View>
            );
          })}
        </View>
        {!comments.length ? <Text style={styles.empty}>{t(commonCopy.commentEmptyShort, language)}</Text> : null}
        {visibleCount < comments.length ? (
          <Pressable onPress={() => setVisibleCount((value) => value + COMMENT_PAGE_SIZE)} style={styles.moreButton}>
            <Text style={styles.moreText}>{t(commonCopy.showMore, language)}</Text>
          </Pressable>
        ) : null}
      </View>

      <CommentEditModal
        visible={editingCommentId !== null}
        value={editDraft}
        onChangeText={(value) => setEditDraft(value.slice(0, COMMENT_MAX_LENGTH))}
        onCancel={cancelEditComment}
        onSave={saveEditComment}
        language={language}
        colors={colors}
      />

      <CommentDeleteConfirmModal
        visible={pendingDeleteCommentId !== null}
        title={msg(systemMessages.community.deleteCommentConfirmTitle, language)}
        message={msg(systemMessages.community.deleteCommentConfirmMessage, language)}
        cancelLabel={t(commonCopy.cancel, language)}
        confirmLabel={t(commonCopy.delete, language)}
        onCancel={() => setPendingDeleteCommentId(null)}
        onConfirm={handleDeleteCommentConfirmed}
        colors={colors}
      />

      <Modal visible={reportCommentId !== null} transparent animationType="fade" onRequestClose={() => setReportCommentId(null)}>
        <View style={styles.reportBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setReportCommentId(null)} />
          <View style={styles.reportPanel}>
            <Text style={styles.reportTitle}>{t(commonCopy.reportCommentTitle, language)}</Text>
            <Text style={styles.reportHint}>
              {reportComment ? `@${reportComment.username}` : ""} · {t(commonCopy.reportCommentHint, language)}
            </Text>
            <TextInput
              value={reportReason}
              onChangeText={setReportReason}
              placeholder={t(feedCopy.reportReasonPlaceholder, language)}
              placeholderTextColor={colors.muted}
              multiline
              style={styles.reportInput}
            />
            <View style={styles.reportActions}>
              <Pressable onPress={() => { setReportCommentId(null); setReportReason(""); }} style={styles.reportCancelButton}>
                <Text style={styles.reportCancelText}>{t(commonCopy.cancel, language)}</Text>
              </Pressable>
              <Pressable onPress={submitCommentReport} disabled={reportSubmitting} style={[styles.reportSubmitButton, reportSubmitting && styles.submitDisabled]}>
                <Text style={styles.reportSubmitText}>{t(commonCopy.report, language)}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={reportPostOpen} transparent animationType="fade" onRequestClose={() => setReportPostOpen(false)}>
        <View style={styles.reportBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setReportPostOpen(false)} />
          <View style={styles.reportPanel}>
            <Text style={styles.reportTitle}>{t(feedCopy.reportPost, language)}</Text>
            <Text style={styles.reportHint}>{t(feedCopy.reportHint, language)}</Text>
            <TextInput
              value={postReportReason}
              onChangeText={setPostReportReason}
              placeholder={t(feedCopy.reportReasonPlaceholder, language)}
              placeholderTextColor={colors.muted}
              multiline
              style={styles.reportInput}
            />
            <View style={styles.reportActions}>
              <Pressable onPress={() => { setReportPostOpen(false); setPostReportReason(""); }} style={styles.reportCancelButton}>
                <Text style={styles.reportCancelText}>{t(commonCopy.cancel, language)}</Text>
              </Pressable>
              <Pressable onPress={() => { void reportPost(); }} disabled={postReportSubmitting} style={[styles.reportSubmitButton, postReportSubmitting && styles.submitDisabled]}>
                <Text style={styles.reportSubmitText}>{t(commonCopy.report, language)}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ReactionLikersModal
        visible={likersOpen}
        onClose={() => setLikersOpen(false)}
        targetType="post"
        targetId={post.id}
        language={language}
        colors={colors}
      />
    </AppChrome>
  );
}

function CommentEditModal({
  visible,
  value,
  onChangeText,
  onCancel,
  onSave,
  language,
  colors
}: {
  visible: boolean;
  value: string;
  onChangeText: (value: string) => void;
  onCancel: () => void;
  onSave: () => void;
  language: "tr" | "en" | "ru" | "uz";
  colors: ReturnType<typeof getThemeColors>;
}) {
  const styles = createEditModalStyles(colors);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.panel}>
          <View style={styles.header}>
            <Ionicons name="create-outline" size={22} color={colors.gold} />
            <Text style={styles.title}>{t(commonCopy.editCommentTitle, language)}</Text>
          </View>
          <Text style={styles.hint}>{t(commonCopy.editCommentHint, language)}</Text>
          <TextInput
            value={value}
            onChangeText={onChangeText}
            multiline
            autoFocus
            maxLength={COMMENT_MAX_LENGTH}
            placeholder={t(commonCopy.editCommentPlaceholder, language)}
            placeholderTextColor={colors.muted}
            style={styles.input}
          />
          <Text style={styles.counter}>{value.length} / {COMMENT_MAX_LENGTH}</Text>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.cancelButton}>
              <Text style={styles.cancelText}>{t(commonCopy.cancel, language)}</Text>
            </Pressable>
            <Pressable onPress={onSave} disabled={!value.trim()} style={[styles.saveButton, !value.trim() && styles.saveButtonDisabled]}>
              <Text style={styles.saveText}>{t(commonCopy.save, language)}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createEditModalStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.68)",
      justifyContent: "center",
      padding: 20
    },
    panel: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      padding: 16,
      gap: 10
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8
    },
    title: {
      color: colors.ivory,
      fontSize: 17,
      fontWeight: "900",
      flex: 1
    },
    hint: {
      color: colors.muted,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "600"
    },
    input: {
      minHeight: 110,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panelSoft,
      color: colors.ivory,
      padding: 12,
      textAlignVertical: "top",
      fontSize: 14,
      lineHeight: 22,
      fontWeight: "500"
    },
    counter: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: "700",
      textAlign: "right"
    },
    actions: {
      flexDirection: "row",
      gap: 8,
      marginTop: 4
    },
    cancelButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: "center",
      justifyContent: "center"
    },
    cancelText: {
      color: colors.ivory,
      fontWeight: "800"
    },
    saveButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 8,
      backgroundColor: colors.gold,
      alignItems: "center",
      justifyContent: "center"
    },
    saveButtonDisabled: { opacity: 0.45 },
    saveText: {
      color: colors.ink,
      fontWeight: "900"
    }
  });
}

function CommentDeleteConfirmModal({
  visible,
  title,
  message,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
  colors
}: {
  visible: boolean;
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
  colors: ReturnType<typeof getThemeColors>;
}) {
  const styles = createConfirmStyles(colors);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.panel}>
          <Ionicons name="trash-outline" size={28} color={colors.gold} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable onPress={onCancel} style={styles.cancelButton}>
              <Text style={styles.cancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={styles.deleteButton}>
              <Text style={styles.deleteText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createConfirmStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.68)",
      justifyContent: "center",
      padding: 24
    },
    panel: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      padding: 18,
      gap: 10,
      alignItems: "center"
    },
    title: {
      color: colors.ivory,
      fontSize: 17,
      fontWeight: "900",
      textAlign: "center"
    },
    message: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "700",
      textAlign: "center"
    },
    actions: {
      flexDirection: "row",
      gap: 8,
      width: "100%",
      marginTop: 4
    },
    cancelButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: "center",
      justifyContent: "center"
    },
    cancelText: {
      color: colors.ivory,
      fontWeight: "900"
    },
    deleteButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 8,
      backgroundColor: "#8b2e2e",
      alignItems: "center",
      justifyContent: "center"
    },
    deleteText: {
      color: colors.ivory,
      fontWeight: "900"
    }
  });
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    postCard: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.08)",
      backgroundColor: colors.panel,
      padding: 14
    },
    premiumCard: { borderColor: "rgba(210, 184, 121, 0.2)" },
    postHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
    avatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.panelSoft,
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.08)",
      alignItems: "center",
      justifyContent: "center"
    },
    avatarText: { color: colors.gold, fontWeight: "700", fontSize: 11 },
    postIdentity: { flex: 1, minWidth: 0 },
    nameLine: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
    author: { color: colors.ivory, fontSize: 11, fontWeight: "600", flexShrink: 1 },
    postTime: { color: colors.muted, fontSize: 10, fontWeight: "400", marginTop: 1 },
    postText: {
      color: colors.ivory,
      fontSize: 14,
      lineHeight: 22,
      fontWeight: "500"
    },
    actionRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 12,
      flexWrap: "wrap"
    },
    likeCluster: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.28)",
      overflow: "hidden"
    },
    likeButton: {
      minHeight: 34,
      minWidth: 38,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8
    },
    likeButtonActive: {
      backgroundColor: colors.gold
    },
    likeCountButton: {
      minHeight: 34,
      paddingHorizontal: 12,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      borderLeftWidth: 1,
      borderLeftColor: "rgba(217, 184, 101, 0.28)",
      backgroundColor: "rgba(217, 184, 101, 0.06)"
    },
    likeCountButtonActive: {
      backgroundColor: "rgba(217, 184, 101, 0.14)"
    },
    likeCountText: {
      color: colors.gold,
      fontSize: 13,
      fontWeight: "900"
    },
    likeCountTextActive: {
      color: colors.ivory
    },
    likeCountLabel: {
      color: colors.gold,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 0.2,
      textTransform: "lowercase"
    },
    likeCountLabelActive: {
      color: colors.ivory
    },
    copiedInline: {
      color: colors.gold,
      fontSize: 10,
      fontWeight: "800"
    },
    actionGroup: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      marginLeft: "auto"
    },
    iconActionButton: {
      minHeight: 34,
      minWidth: 34,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.28)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8
    },
    iconActionButtonActive: {
      backgroundColor: colors.gold
    },
    commentBox: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.08)",
      backgroundColor: colors.panel,
      padding: 14,
      gap: 8,
      marginTop: 10
    },
    sectionTitle: { color: colors.ivory, fontSize: 13, fontWeight: "700" },
    note: { color: colors.muted, fontSize: 10, lineHeight: 16, fontWeight: "400" },
    commentInput: {
      minHeight: 80,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.08)",
      backgroundColor: colors.panelSoft,
      color: colors.ivory,
      padding: 10,
      textAlignVertical: "top",
      fontSize: 14,
      lineHeight: 22,
      fontWeight: "500"
    },
    disabledInput: { opacity: 0.62 },
    commentFooter: { flexDirection: "row", alignItems: "center", gap: 10 },
    counter: { color: colors.muted, fontSize: 10, fontWeight: "400", flex: 1 },
    submitButton: {
      minHeight: 28,
      borderRadius: 6,
      backgroundColor: colors.gold,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 10
    },
    submitDisabled: { opacity: 0.45 },
    submitText: { color: colors.ink, fontWeight: "700", fontSize: 11 },
    flashHint: {
      color: colors.gold,
      fontSize: 10,
      fontWeight: "500",
      textAlign: "center",
      opacity: 0.85
    },
    message: { color: colors.gold, fontSize: 11, fontWeight: "600", textAlign: "center" },
    commentsPanel: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.08)",
      backgroundColor: colors.panel,
      padding: 14,
      gap: 10,
      marginTop: 10
    },
    commentsList: { gap: 10 },
    commentsListMenuOpen: { zIndex: 50 },
    commentRow: { flexDirection: "row", gap: 8 },
    commentAvatar: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.panelSoft,
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.08)",
      alignItems: "center",
      justifyContent: "center"
    },
    commentMain: { flex: 1, minWidth: 0 },
    commentHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: 6 },
    commentAuthor: { color: colors.ivory, fontSize: 11, fontWeight: "600", flexShrink: 1 },
    commentTime: { color: colors.muted, fontSize: 10, fontWeight: "400", marginTop: 1, marginBottom: 4 },
    commentText: {
      color: colors.ivory,
      fontSize: 14,
      lineHeight: 22,
      fontWeight: "500"
    },
    menuAnchor: {
      position: "relative",
      zIndex: 30
    },
    commentMenuButton: {
      width: 28,
      height: 28,
      borderRadius: 6,
      alignItems: "center",
      justifyContent: "center"
    },
    dropdownMenu: {
      position: "absolute",
      top: 30,
      right: 0,
      minWidth: 132,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: "rgba(217,184,101,0.28)",
      backgroundColor: colors.panel,
      shadowColor: "#000",
      shadowOpacity: 0.28,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 8,
      overflow: "hidden",
      zIndex: 40
    },
    dropdownItem: {
      minHeight: 36,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderBottomColor: colors.line
    },
    dropdownItemLast: { borderBottomWidth: 0 },
    dropdownItemText: { color: colors.ivory, fontWeight: "700", fontSize: 12 },
    dropdownItemDanger: { color: colors.wine },
    reportBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.58)", justifyContent: "center", padding: 18 },
    reportPanel: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      padding: 16,
      gap: 10
    },
    reportTitle: { color: colors.ivory, fontSize: 17, fontWeight: "900" },
    reportHint: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: "700" },
    reportInput: {
      minHeight: 88,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panelSoft,
      color: colors.ivory,
      padding: 10,
      textAlignVertical: "top",
      fontSize: 13,
      fontWeight: "600"
    },
    reportActions: { flexDirection: "row", gap: 8 },
    reportCancelButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: "center",
      justifyContent: "center"
    },
    reportCancelText: { color: colors.ivory, fontWeight: "800" },
    reportSubmitButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 8,
      backgroundColor: colors.gold,
      alignItems: "center",
      justifyContent: "center"
    },
    reportSubmitText: { color: colors.ink, fontWeight: "900" },
    empty: { color: colors.muted, fontWeight: "500", fontSize: 12, textAlign: "center" },
    moreButton: {
      minHeight: 28,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.08)",
      alignItems: "center",
      justifyContent: "center"
    },
    moreText: { color: colors.gold, fontWeight: "600", fontSize: 11 }
  });
}
