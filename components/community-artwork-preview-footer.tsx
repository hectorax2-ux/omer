import { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { commonCopy, feedCopy } from "@/app/i18n/common";
import { msg, systemMessages } from "@/app/i18n/system-messages";
import { ReactionLikersModal } from "@/components/reaction-likers-modal";
import { colors as darkColors } from "@/constants/theme";
import { useAccount } from "@/hooks/use-account";
import { useCommunityArt } from "@/hooks/use-community-art";
import { useLanguage } from "@/hooks/use-language";
import { useMessaging } from "@/hooks/use-messaging";
import type { ArtworkComment, ArtworkVote, CommunityArtwork } from "@/providers/community-art-provider";
import { firebaseAuth } from "@/src/services/firebase";
import { createReport } from "@/src/services/firebase/report-service";
import { canCommentOnDiscoverPost, canDeleteComment } from "@/utils/comment-permissions";
import { isActiveCompetitionArtwork } from "@/utils/user-identity";
import { profileRouteParam } from "@/utils/profile-route";
import { t } from "@/utils/localized-text";

const COMMENT_MAX_LENGTH = 500;
const COMMENT_PAGE_SIZE = 8;

type ThemeColors = typeof darkColors;

type CommunityArtworkPreviewFooterProps = {
  artwork: CommunityArtwork;
  colors: ThemeColors;
  showOwnerActions?: boolean;
  onDelete?: () => void;
  onShare: () => void;
  shareCopied?: boolean;
  notice?: string;
};

export function CommunityArtworkPreviewFooter({
  artwork,
  colors,
  showOwnerActions = false,
  onDelete,
  onShare,
  shareCopied = false,
  notice
}: CommunityArtworkPreviewFooterProps) {
  const { language } = useLanguage();
  const { account, canUseMemberFeatures } = useAccount();
  const { blockUser } = useMessaging();
  const { votes, favoriteIds, activeWeekId, commentsByArtwork, voteArtwork, toggleFavoriteArtwork, addArtworkComment, deleteArtworkComment, canDeleteArtworkFromProfile } = useCommunityArt();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [storyExpanded, setStoryExpanded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [commentOpen, setCommentOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [commentText, setCommentText] = useState("");
  const [commentMessage, setCommentMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [likersOpen, setLikersOpen] = useState(false);
  const [blockSubmitting, setBlockSubmitting] = useState(false);

  const isFavorite = favoriteIds.includes(artwork.id);
  const isActiveCompetition = isActiveCompetitionArtwork(artwork, activeWeekId);
  const canComment = canCommentOnDiscoverPost(account);
  const canDelete = showOwnerActions && canDeleteArtworkFromProfile(artwork.id);
  const comments = commentsByArtwork[artwork.id] ?? [];
  const isArtworkOwner = Boolean(account.uid && artwork.ownerId === account.uid);

  function confirmDeleteArtwork() {
    if (!onDelete) return;
    setDeleteConfirmOpen(true);
  }

  function handleDeleteConfirmed() {
    setDeleteConfirmOpen(false);
    onDelete?.();
  }

  function handleVote(vote: ArtworkVote) {
    if (!canUseMemberFeatures) {
      Alert.alert(
        msg(systemMessages.verification.uploadImageRequired, language),
        language === "tr" ? "Beğeni vermek için oturum açın ve e-postanızı doğrulayın." : "Sign in and verify your email to vote."
      );
      return;
    }
    voteArtwork(artwork.id, vote);
  }

  async function submitReport() {
    const reason = reportReason.trim();
    const reporterId = firebaseAuth.currentUser?.uid;
    if (!reporterId || !reason) {
      Alert.alert(t(feedCopy.reportMissingTitle, language), t(feedCopy.reportMissingBody, language));
      return;
    }
    setSubmitting(true);
    try {
      await createReport({
        reporterId,
        targetType: "communityImage",
        targetId: artwork.id,
        category: "content",
        subject: t(commonCopy.reportImage, language),
        message: `${artwork.title} (@${artwork.uploaderUsername ?? artwork.artistName})\n\n${reason}`
      });
      setReportOpen(false);
      setReportReason("");
      Alert.alert(t(feedCopy.reportReceivedTitle, language), t(feedCopy.reportReceivedBody, language));
    } catch {
      Alert.alert(t(feedCopy.reportFailedTitle, language), t(feedCopy.reportFailedBody, language));
    } finally {
      setSubmitting(false);
    }
  }

  function confirmBlockUser() {
    if (!artwork.ownerId || isArtworkOwner || blockSubmitting) return;
    Alert.alert(
      t(commonCopy.blockUserTitle, language),
      t(commonCopy.blockUserBody, language),
      [
        { text: t(commonCopy.cancel, language), style: "cancel" },
        {
          text: t(commonCopy.blockUser, language),
          style: "destructive",
          onPress: () => {
            setBlockSubmitting(true);
            void blockUser(artwork.ownerId!)
              .then(() => Alert.alert(t(commonCopy.blockUser, language), t(commonCopy.blockUserSuccess, language)))
              .catch(() => Alert.alert(t(commonCopy.blockUser, language), t(commonCopy.blockUserFailed, language)))
              .finally(() => setBlockSubmitting(false));
          }
        }
      ]
    );
  }

  function submitComment() {
    if (!canComment) {
      Alert.alert(t(commonCopy.commentImage, language), t(commonCopy.commentPremiumRequired, language));
      return;
    }
    const text = commentText.trim().slice(0, COMMENT_MAX_LENGTH);
    if (!text) return;
    setSubmitting(true);
    const result = addArtworkComment(artwork.id, {
      author: account.displayName,
      username: account.username,
      text,
      isPremium: account.isPremium
    }, language);
    setSubmitting(false);
    if (result.reason === "cooldown") {
      setCommentMessage(result.message ?? "");
      return;
    }
    if (!result.ok) {
      Alert.alert(t(commonCopy.commentImage, language), result.message ?? t(feedCopy.reportFailedBody, language));
      return;
    }
    setCommentText("");
    setCommentMessage(t(commonCopy.commentSent, language));
  }

  return (
    <View style={styles.footer}>
      <View style={styles.headerRow}>
        <View style={styles.textBlock}>
          <Text style={styles.artistName} numberOfLines={1}>{artwork.artistName}</Text>
          <Text style={styles.title} numberOfLines={1}>{artwork.title}</Text>
        </View>
      </View>

      {isActiveCompetition ? (
        <View style={styles.competitionBadge}>
          <Ionicons name="trophy-outline" size={14} color={colors.gold} />
          <Text style={styles.competitionBadgeText}>{t(commonCopy.activeCompetitionBadge, language)}</Text>
        </View>
      ) : null}

      {artwork.story ? (
        <>
          <Text style={styles.story} numberOfLines={storyExpanded ? undefined : 2}>{artwork.story}</Text>
          {artwork.story.length > 90 ? (
            <Pressable onPress={() => setStoryExpanded((value) => !value)} style={styles.moreButton}>
              <Text style={styles.moreText}>{storyExpanded ? t(commonCopy.collapse, language) : t(commonCopy.readMore, language)}</Text>
            </Pressable>
          ) : null}
        </>
      ) : null}

      <View style={styles.actionsRow}>
        <View style={styles.likeCluster}>
          <Pressable onPress={() => handleVote("like")} style={[styles.likeIconButton, votes[artwork.id] === "like" && styles.actionButtonActive]}>
            <Ionicons name={votes[artwork.id] === "like" ? "heart" : "heart-outline"} size={17} color={votes[artwork.id] === "like" ? colors.ink : colors.gold} />
          </Pressable>
          <Pressable onPress={() => artwork.likes >= 0 && setLikersOpen(true)} style={[styles.likeCountButton, votes[artwork.id] === "like" && styles.likeCountButtonActive]}>
            <Text style={[styles.actionCount, votes[artwork.id] === "like" && styles.actionCountActive]}>{artwork.likes}</Text>
            <Text style={[styles.likeCountLabel, votes[artwork.id] === "like" && styles.likeCountLabelActive]}>{t(commonCopy.likersChip, language)}</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => toggleFavoriteArtwork(artwork.id)} style={[styles.iconButton, isFavorite && styles.actionButtonActive]}>
          <Ionicons name={isFavorite ? "bookmark" : "bookmark-outline"} size={17} color={isFavorite ? colors.ink : colors.gold} />
        </Pressable>
        <Pressable onPress={onShare} style={styles.iconButton}>
          {shareCopied ? <Text style={styles.copiedText}>{t(commonCopy.copied, language)}</Text> : null}
          <Ionicons name="share-social-outline" size={17} color={colors.gold} />
        </Pressable>
        <Pressable onPress={() => setReportOpen(true)} style={styles.iconButton}>
          <Ionicons name="flag-outline" size={17} color={colors.gold} />
        </Pressable>
        {artwork.ownerId && !isArtworkOwner && canUseMemberFeatures ? (
          <Pressable onPress={confirmBlockUser} disabled={blockSubmitting} style={[styles.iconButton, blockSubmitting && styles.buttonDisabled]} accessibilityLabel={t(commonCopy.blockUser, language)}>
            <Ionicons name="ban-outline" size={17} color={colors.gold} />
          </Pressable>
        ) : null}
        {showOwnerActions && canDelete && onDelete ? (
          <Pressable onPress={confirmDeleteArtwork} style={styles.deleteIconButton} accessibilityLabel={t(commonCopy.delete, language)}>
            <Ionicons name="trash-outline" size={15} color={colors.muted} />
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={() => {
          setCommentMessage("");
          setCommentOpen(true);
        }}
        style={[styles.commentButtonLarge, !canComment && styles.commentButtonLocked]}
      >
        <Ionicons name="chatbubble-outline" size={18} color={canComment ? colors.gold : colors.muted} />
        <Text style={[styles.commentButtonLargeText, !canComment && styles.commentButtonTextLocked]} numberOfLines={1}>
          {t(commonCopy.commentAction, language)}
        </Text>
        <View style={styles.commentButtonLargeBadge}>
          <Text style={styles.commentButtonLargeBadgeText}>{comments.length}</Text>
        </View>
      </Pressable>

      {showOwnerActions && isActiveCompetition && !canDelete ? (
        <Text style={styles.lockedText}>{msg(systemMessages.community.activeCompetitionDeleteBlocked, language)}</Text>
      ) : null}

      {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

      <ReportModal
        visible={reportOpen}
        title={t(commonCopy.reportImage, language)}
        hint={t(feedCopy.reportHint, language)}
        placeholder={t(feedCopy.reportReasonPlaceholder, language)}
        value={reportReason}
        onChange={setReportReason}
        onClose={() => setReportOpen(false)}
        onSubmit={submitReport}
        submitting={submitting}
        canSubmit={canUseMemberFeatures}
        signInMessage={t(feedCopy.reportSignInRequired, language)}
        submitLabel={t(commonCopy.report, language)}
        okLabel={t(commonCopy.ok, language)}
        colors={colors}
      />

      <CommentModal
        visible={commentOpen}
        artwork={artwork}
        title={t(commonCopy.commentImage, language)}
        hint={t(commonCopy.commentImageHint, language)}
        placeholder={t(commonCopy.commentPlaceholder, language)}
        value={commentText}
        onChange={(value) => setCommentText(value.slice(0, COMMENT_MAX_LENGTH))}
        onClose={() => setCommentOpen(false)}
        onSubmit={submitComment}
        onDeleteComment={(commentId) => deleteArtworkComment(artwork.id, commentId)}
        submitting={submitting}
        canSubmit={canComment}
        signInMessage={t(commonCopy.commentPremiumRequired, language)}
        submitLabel={t(commonCopy.comment, language)}
        okLabel={t(commonCopy.ok, language)}
        showMoreLabel={t(commonCopy.showMore, language)}
        emptyCommentsLabel={t(commonCopy.commentEmpty, language)}
        deleteConfirmTitle={msg(systemMessages.community.deleteCommentConfirmTitle, language)}
        deleteConfirmMessage={msg(systemMessages.community.deleteCommentConfirmMessage, language)}
        cancelLabel={t(commonCopy.cancel, language)}
        deleteLabel={t(commonCopy.delete, language)}
        message={commentMessage}
        comments={comments}
        colors={colors}
      />

      <DeleteConfirmModal
        visible={deleteConfirmOpen}
        title={msg(systemMessages.community.deleteArtworkConfirmTitle, language)}
        message={msg(systemMessages.community.deleteArtworkConfirmMessage, language)}
        cancelLabel={t(commonCopy.cancel, language)}
        confirmLabel={t(commonCopy.delete, language)}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteConfirmed}
        colors={colors}
      />

      <ReactionLikersModal
        visible={likersOpen}
        onClose={() => setLikersOpen(false)}
        targetType="communityImage"
        targetId={artwork.id}
        language={language}
        colors={colors}
      />
    </View>
  );
}

function DeleteConfirmModal({
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
  colors: ThemeColors;
}) {
  const styles = createModalStyles(colors);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.confirmBackdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.confirmPanel}>
          <Ionicons name="trash-outline" size={28} color={colors.gold} />
          <Text style={styles.confirmTitle}>{title}</Text>
          <Text style={styles.confirmMessage}>{message}</Text>
          <View style={styles.confirmActions}>
            <Pressable onPress={onCancel} style={styles.confirmCancelButton}>
              <Text style={styles.confirmCancelText}>{cancelLabel}</Text>
            </Pressable>
            <Pressable onPress={onConfirm} style={styles.confirmDeleteButton}>
              <Text style={styles.confirmDeleteText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CommentModal({
  visible,
  artwork,
  title,
  hint,
  placeholder,
  value,
  onChange,
  onClose,
  onSubmit,
  onDeleteComment,
  submitting,
  canSubmit,
  signInMessage,
  submitLabel,
  okLabel,
  showMoreLabel,
  emptyCommentsLabel,
  deleteConfirmTitle,
  deleteConfirmMessage,
  cancelLabel,
  deleteLabel,
  message,
  comments,
  colors
}: {
  visible: boolean;
  artwork: CommunityArtwork;
  title: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  onDeleteComment: (commentId: string) => { ok: boolean; message?: string };
  submitting: boolean;
  canSubmit: boolean;
  signInMessage: string;
  submitLabel: string;
  okLabel: string;
  showMoreLabel: string;
  emptyCommentsLabel: string;
  deleteConfirmTitle: string;
  deleteConfirmMessage: string;
  cancelLabel: string;
  deleteLabel: string;
  message?: string;
  comments: ArtworkComment[];
  colors: ThemeColors;
}) {
  const { account } = useAccount();
  const router = useRouter();
  const styles = createModalStyles(colors);
  const [visibleCount, setVisibleCount] = useState(COMMENT_PAGE_SIZE);
  const [pendingDeleteCommentId, setPendingDeleteCommentId] = useState<string | null>(null);
  const sortedComments = useMemo(
    () => [...comments].sort((a, b) => b.createdAt - a.createdAt),
    [comments]
  );
  const visibleComments = sortedComments.slice(0, visibleCount);
  const hasMoreComments = sortedComments.length > visibleCount;

  useEffect(() => {
    if (visible) {
      setVisibleCount(COMMENT_PAGE_SIZE);
      setPendingDeleteCommentId(null);
    }
  }, [visible]);

  function canDelete(comment: ArtworkComment) {
    return canDeleteComment(
      comment,
      {
        kind: "artwork",
        ownerId: artwork.ownerId,
        uploaderUsername: artwork.uploaderUsername,
        artistName: artwork.artistName
      },
      account
    );
  }

  function handleDeleteCommentConfirmed() {
    if (!pendingDeleteCommentId) return;
    const result = onDeleteComment(pendingDeleteCommentId);
    setPendingDeleteCommentId(null);
    if (!result.ok && result.message) {
      Alert.alert(deleteConfirmTitle, result.message);
    }
  }

  function openCommenterProfile(comment: ArtworkComment) {
    const profileName = profileRouteParam({ username: comment.username, displayName: comment.author });
    if (!profileName) return;
    onClose();
    router.push({ pathname: "/profile/[name]", params: { name: profileName } });
  }

  return (
    <>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close comments" />
        <View style={styles.panel}>
          <View style={styles.header}>
            <Ionicons name="chatbubble-outline" size={20} color={colors.gold} />
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.ivory} />
            </Pressable>
          </View>

          <Text style={styles.hint}>{hint}</Text>

          <ScrollView style={styles.commentList} contentContainerStyle={styles.commentListContent} nestedScrollEnabled>
            {visibleComments.length ? (
              visibleComments.map((comment) => (
                <View key={comment.id} style={styles.commentItem}>
                  <View style={styles.commentItemHeader}>
                    <Pressable onPress={() => openCommenterProfile(comment)} style={styles.commentAuthorButton}>
                      <Text style={styles.commentAuthor}>{comment.author || `@${comment.username}`}</Text>
                    </Pressable>
                    {canDelete(comment) ? (
                      <Pressable onPress={() => setPendingDeleteCommentId(comment.id)} style={styles.commentDeleteButton}>
                        <Ionicons name="trash-outline" size={14} color={colors.muted} />
                      </Pressable>
                    ) : null}
                  </View>
                  <Text style={styles.commentText}>{comment.text}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyComments}>{emptyCommentsLabel}</Text>
            )}
            {hasMoreComments ? (
              <Pressable onPress={() => setVisibleCount((current) => current + COMMENT_PAGE_SIZE)} style={styles.showMoreButton}>
                <Text style={styles.showMoreText}>{showMoreLabel}</Text>
              </Pressable>
            ) : null}
          </ScrollView>

          <View style={styles.composer}>
            {canSubmit ? (
              <>
                <TextInput
                  value={value}
                  onChangeText={onChange}
                  placeholder={placeholder}
                  placeholderTextColor={colors.muted}
                  style={styles.input}
                  multiline
                  maxLength={COMMENT_MAX_LENGTH}
                />
                {message ? <Text style={styles.message}>{message}</Text> : null}
                <Pressable onPress={onSubmit} disabled={submitting || !value.trim()} style={[styles.submitButton, (submitting || !value.trim()) && styles.submitDisabled]}>
                  <Text style={styles.submitText}>{submitLabel}</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Text style={styles.lockedComposerText}>{signInMessage}</Text>
                <Pressable onPress={onClose} style={styles.submitButton}>
                  <Text style={styles.submitText}>{okLabel}</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </View>
    </Modal>

    <DeleteConfirmModal
      visible={pendingDeleteCommentId !== null}
      title={deleteConfirmTitle}
      message={deleteConfirmMessage}
      cancelLabel={cancelLabel}
      confirmLabel={deleteLabel}
      onCancel={() => setPendingDeleteCommentId(null)}
      onConfirm={handleDeleteCommentConfirmed}
      colors={colors}
    />
    </>
  );
}

function ReportModal({
  visible,
  title,
  hint,
  placeholder,
  value,
  onChange,
  onClose,
  onSubmit,
  submitting,
  canSubmit,
  signInMessage,
  submitLabel,
  okLabel,
  colors
}: {
  visible: boolean;
  title: string;
  hint: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
  canSubmit: boolean;
  signInMessage: string;
  submitLabel: string;
  okLabel: string;
  colors: ThemeColors;
}) {
  const styles = createModalStyles(colors);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <Ionicons name="flag-outline" size={20} color={colors.gold} />
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.ivory} />
            </Pressable>
          </View>
          {canSubmit ? (
            <>
              <Text style={styles.hint}>{hint}</Text>
              <TextInput
                value={value}
                onChangeText={onChange}
                placeholder={placeholder}
                placeholderTextColor={colors.muted}
                style={styles.input}
                multiline
              />
              <Pressable onPress={onSubmit} disabled={submitting} style={[styles.submitButton, submitting && styles.submitDisabled]}>
                <Text style={styles.submitText}>{submitLabel}</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.hint}>{signInMessage}</Text>
              <Pressable onPress={onClose} style={styles.submitButton}>
                <Text style={styles.submitText}>{okLabel}</Text>
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    footer: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(248, 240, 223, 0.16)",
      backgroundColor: "rgba(29, 23, 18, 0.9)",
      padding: 10,
      gap: 8
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8
    },
    textBlock: {
      flex: 1
    },
    artistName: {
      color: colors.ivory,
      fontSize: 14,
      fontWeight: "900"
    },
    title: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 2
    },
    competitionBadge: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 6,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.28)",
      backgroundColor: "rgba(217, 184, 101, 0.08)",
      padding: 8
    },
    competitionBadgeText: {
      flex: 1,
      color: colors.gold,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "800"
    },
    story: {
      color: colors.ivory,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700"
    },
    moreButton: {
      alignSelf: "flex-start"
    },
    moreText: {
      color: colors.gold,
      fontSize: 11,
      fontWeight: "900"
    },
    actionsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 6,
      alignItems: "center"
    },
    likeCluster: {
      flexDirection: "row",
      alignItems: "center",
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.28)",
      overflow: "hidden"
    },
    likeIconButton: {
      minHeight: 36,
      minWidth: 40,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8
    },
    likeCountButton: {
      minHeight: 36,
      paddingHorizontal: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      borderLeftWidth: 1,
      borderLeftColor: "rgba(217, 184, 101, 0.28)",
      backgroundColor: "rgba(217, 184, 101, 0.06)"
    },
    likeCountButtonActive: {
      backgroundColor: "rgba(217, 184, 101, 0.14)"
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
    actionButton: {
      minHeight: 36,
      minWidth: 54,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.28)",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
      paddingHorizontal: 8
    },
    iconButton: {
      minHeight: 36,
      minWidth: 36,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.28)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
      position: "relative"
    },
    buttonDisabled: { opacity: 0.5 },
    iconButtonLocked: {
      opacity: 0.55
    },
    deleteIconButton: {
      minHeight: 36,
      minWidth: 36,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.18)",
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
      opacity: 0.85
    },
    commentButtonLarge: {
      minHeight: 44,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.34)",
      backgroundColor: "rgba(217, 184, 101, 0.08)",
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      paddingHorizontal: 12
    },
    commentButtonLocked: {
      opacity: 0.55
    },
    commentButtonLargeText: {
      color: colors.gold,
      fontSize: 13,
      fontWeight: "900",
      flex: 1
    },
    commentButtonTextLocked: {
      color: colors.muted
    },
    commentButtonLargeBadge: {
      minWidth: 22,
      height: 22,
      borderRadius: 11,
      backgroundColor: colors.gold,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6
    },
    commentButtonLargeBadgeText: {
      color: colors.ink,
      fontSize: 11,
      fontWeight: "900"
    },
    actionButtonActive: {
      backgroundColor: colors.gold
    },
    actionCount: {
      color: colors.gold,
      fontWeight: "900",
      fontSize: 12
    },
    actionCountActive: {
      color: colors.ink
    },
    copiedText: {
      color: colors.gold,
      fontSize: 9,
      fontWeight: "900"
    },
    lockedText: {
      color: colors.muted,
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "700"
    },
    noticeText: {
      color: colors.gold,
      fontSize: 11,
      fontWeight: "800"
    }
  });
}

function createModalStyles(colors: ThemeColors) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.58)",
      justifyContent: "flex-end",
      paddingHorizontal: 12,
      paddingBottom: 12,
      paddingTop: 48
    },
    panel: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      maxHeight: "88%",
      overflow: "hidden",
      flexDirection: "column"
    },
    header: {
      minHeight: 46,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingTop: 12
    },
    title: {
      color: colors.ivory,
      fontSize: 17,
      fontWeight: "900",
      flex: 1
    },
    closeButton: {
      width: 34,
      height: 34,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center"
    },
    hint: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "800",
      paddingHorizontal: 14,
      paddingBottom: 8
    },
    commentList: {
      flexGrow: 0,
      flexShrink: 1,
      maxHeight: 280
    },
    commentListContent: {
      paddingHorizontal: 14,
      paddingBottom: 8,
      gap: 6
    },
    commentItem: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panelSoft,
      padding: 8,
      gap: 2
    },
    commentItemHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 8
    },
    commentDeleteButton: {
      width: 28,
      height: 28,
      borderRadius: 8,
      alignItems: "center",
      justifyContent: "center"
    },
    commentAuthorButton: {
      flex: 1,
      alignSelf: "flex-start"
    },
    commentAuthor: {
      color: colors.gold,
      fontSize: 11,
      fontWeight: "900"
    },
    commentText: {
      color: colors.ivory,
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "700"
    },
    emptyComments: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "700",
      textAlign: "center",
      paddingVertical: 12
    },
    showMoreButton: {
      alignSelf: "center",
      paddingVertical: 8,
      paddingHorizontal: 12
    },
    showMoreText: {
      color: colors.gold,
      fontSize: 12,
      fontWeight: "900"
    },
    composer: {
      borderTopWidth: 1,
      borderTopColor: colors.line,
      backgroundColor: colors.panel,
      padding: 14,
      gap: 8
    },
    lockedComposerText: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "800"
    },
    message: {
      color: colors.gold,
      fontSize: 11,
      fontWeight: "800"
    },
    input: {
      minHeight: 72,
      maxHeight: 120,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panelSoft,
      color: colors.ivory,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "800",
      padding: 10,
      textAlignVertical: "top"
    },
    submitButton: {
      minHeight: 42,
      borderRadius: 8,
      backgroundColor: colors.gold,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 12
    },
    submitDisabled: {
      opacity: 0.5
    },
    submitText: {
      color: colors.ink,
      fontWeight: "900"
    },
    confirmBackdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.68)",
      justifyContent: "center",
      padding: 24
    },
    confirmPanel: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      padding: 18,
      gap: 10,
      alignItems: "center"
    },
    confirmTitle: {
      color: colors.ivory,
      fontSize: 17,
      fontWeight: "900",
      textAlign: "center"
    },
    confirmMessage: {
      color: colors.muted,
      fontSize: 13,
      lineHeight: 19,
      fontWeight: "700",
      textAlign: "center"
    },
    confirmActions: {
      flexDirection: "row",
      gap: 8,
      width: "100%",
      marginTop: 4
    },
    confirmCancelButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: "center",
      justifyContent: "center"
    },
    confirmCancelText: {
      color: colors.ivory,
      fontWeight: "900"
    },
    confirmDeleteButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 8,
      backgroundColor: "#8b2e2e",
      alignItems: "center",
      justifyContent: "center"
    },
    confirmDeleteText: {
      color: colors.ivory,
      fontWeight: "900"
    }
  });
}
