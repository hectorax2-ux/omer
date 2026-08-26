import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, FlatList, Modal, ActivityIndicator, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { AuthRequired } from "@/components/auth-required";
import { MessageMentionText } from "@/components/message-mention-text";
import { ProfileAvatar } from "@/components/profile-avatar";
import { getThemeColors } from "@/constants/theme";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { useMessaging } from "@/hooks/use-messaging";
import { subscribeConversationMessages, subscribeConversation, DirectMessageRecord, ConversationRecord } from "@/src/services/firebase/messaging-service";
import { otherParticipantIdFromConversationId } from "@/src/services/firebase/messaging-settings";
import { getUserDocument } from "@/src/services/firebase/user-service";
import { isPremiumDataActive } from "@/utils/premium-status";
import { isResourceArray, loadResourceCache, peekResourceCache, saveResourceCache } from "@/src/services/cache/resource-cache";
import { markPerformanceEvent } from "@/utils/performance";
import { getStandardListPerformanceProps } from "@/constants/list-performance";
import { useRuntimePerformanceMode } from "@/hooks/use-runtime-performance-mode";

const INITIAL_MESSAGE_LIMIT = 18;
const MESSAGE_PAGE_SIZE = 24;

const deleteConfirmCopy = {
  title: {
    tr: "Mesajları sil",
    en: "Delete messages",
    ru: "Удалить сообщения",
    uz: "Xabarlarni o'chirish"
  },
  body: {
    tr: "Tüm mesaj geçmişi her iki taraftan da temizlenir ve sohbet listenizden kaldırılır. İstediğiniz zaman profilden yeniden mesaj gönderebilirsiniz.",
    en: "The full message history is cleared for both sides and the chat is removed from your inbox. You can send a new message from their profile anytime.",
    ru: "Вся история сообщений будет очищена для обеих сторон, и переписка исчезнет из списка. Вы сможете написать снова через профиль.",
    uz: "Butun xabar tarixi ikkala tomondan ham tozalanadi va suhbat ro'yxatdan olib tashlanadi. Profildan istalgan vaqtda qayta yozishingiz mumkin."
  },
  cancel: {
    tr: "Vazgeç",
    en: "Cancel",
    ru: "Отмена",
    uz: "Bekor qilish"
  },
  confirm: {
    tr: "Mesajları sil",
    en: "Delete messages",
    ru: "Удалить",
    uz: "O'chirish"
  }
};

function deleteCopy(language: string, key: keyof typeof deleteConfirmCopy) {
  const lang = language === "en" || language === "ru" || language === "uz" ? language : "tr";
  return deleteConfirmCopy[key][lang];
}

export default function ConversationScreen() {
  const { isAuthenticated } = useAccount();
  const { language } = useLanguage();
  const title = { tr: "Mesajlar", en: "Messages", ru: "Сообщения", uz: "Xabarlar" }[language];
  if (!isAuthenticated) return <AuthRequired title={title} />;
  return <AuthenticatedConversationScreen />;
}

function AuthenticatedConversationScreen() {
  const params = useLocalSearchParams<{ conversationId: string | string[]; recipientId?: string | string[]; username?: string | string[] }>();
  const conversationId = Array.isArray(params.conversationId) ? params.conversationId[0] : params.conversationId;
  const recipientIdParam = Array.isArray(params.recipientId) ? params.recipientId[0] : params.recipientId;
  const usernameParam = Array.isArray(params.username) ? params.username[0] : params.username;
  const router = useRouter();
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const performanceMode = useRuntimePerformanceMode();
  const { account } = useAccount();
  const {
    conversations,
    getOtherParticipant,
    sendMessage,
    markConversationRead,
    acceptRequest,
    blockUser,
    reportMessage,
    deleteConversation,
    toggleArchive,
    hasBlockedUser,
    unblockUser,
    pendingMessages,
    retryPending,
    syncError,
    clearSyncError,
    setActiveConversationId,
    setListTab,
  } = useMessaging();
  const [messages, setMessages] = useState<DirectMessageRecord[]>([]);
  const [conversationMeta, setConversationMeta] = useState<ConversationRecord | null>(null);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [text, setText] = useState("");
  const sendPressLockedRef = useRef(false);
  const [menuAction, setMenuAction] = useState<null | "archive" | "unarchive" | "block" | "unblock" | "delete">(null);
  const [localError, setLocalError] = useState("");
  const [premiumModal, setPremiumModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [draftRecipient, setDraftRecipient] = useState<{ uid: string; username: string; photo: string; premium: boolean } | null>(null);
  const [messageLimit, setMessageLimit] = useState(INITIAL_MESSAGE_LIMIT);
  const [reachedStart, setReachedStart] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);
  const [copyNotice, setCopyNotice] = useState(false);
  const [actionMenu, setActionMenu] = useState<{ id: string; text: string; x: number; y: number } | null>(null);
  const actionMenuOpenedAt = useRef(0);
  const isFocusedRef = useRef(false);
  const listRef = useRef<FlatList<DirectMessageRecord>>(null);

  const conversation = conversationMeta ?? conversations.find((item) => item.id === conversationId) ?? null;
  const recipientId = recipientIdParam
    || (account.uid && conversationId ? otherParticipantIdFromConversationId(account.uid, conversationId) : "");
  const other = conversation
    ? getOtherParticipant(conversation)
    : draftRecipient ?? {
      uid: recipientId,
      username: usernameParam || "kullanici",
      photo: "",
      premium: false
    };
  const historyClearedAtMs = conversationMeta?.historyClearedAtMs ?? 0;
  const threadReady = metaLoaded || Boolean(conversation);
  const displayMessages = useMemo(() => {
    const pending = pendingMessages
      .filter((item) => item.conversationId === conversationId)
      .map((item) => ({
        id: item.clientMessageId,
        senderId: account.uid,
        text: item.text,
        createdAtMs: Date.now(),
        readAtMs: null,
        clientMessageId: item.clientMessageId,
        deliveryStatus: item.status
      } satisfies DirectMessageRecord));
    const pendingIds = new Set(pending.map((item) => item.clientMessageId));
    const confirmed = (threadReady ? messages : []).filter((item) => !pendingIds.has(item.clientMessageId));
    return [...pending.reverse(), ...confirmed];
  }, [account.uid, conversationId, messages, pendingMessages, threadReady]);
  const canSeeReadReceipts = account.isPremium || account.isAdmin;
  const isBlockedConversation = conversation?.status === "blocked";
  const blockedByMe = hasBlockedUser(other.uid);
  const isArchived = Boolean(conversation?.archivedBy[account.uid]);
  const closed = conversation?.status === "closed" || isBlockedConversation;
  const isRequest = conversation?.status === "request" && conversation.requestBy !== account.uid;
  const hideMessages = isBlockedConversation;

  useEffect(() => {
    let active = true;
    const cacheKey = `messages:thread:${conversationId}`;
    const cached = peekResourceCache<DirectMessageRecord[]>(cacheKey);
    setMessageLimit(INITIAL_MESSAGE_LIMIT);
    setReachedStart(false);
    setInitialLoaded(Boolean(cached));
    setMetaLoaded(false);
    setConversationMeta(null);
    setMessages(cached ?? []);
    if (!cached) {
      void loadResourceCache(cacheKey, isDirectMessageArray).then((diskValue) => {
        if (!active || !diskValue) return;
        setMessages(diskValue);
        setInitialLoaded(true);
      });
    }
    return () => {
      active = false;
    };
  }, [conversationId]);

  function loadOlderMessages() {
    if (reachedStart || !threadReady || !initialLoaded || messages.length < messageLimit) return;
    setMessageLimit((current) => current + MESSAGE_PAGE_SIZE);
  }

  useEffect(() => {
    if (conversation || !recipientId) return;
    if (usernameParam) {
      setDraftRecipient({ uid: recipientId, username: usernameParam, photo: "", premium: false });
    }
    let active = true;
    getUserDocument(recipientId)
      .then((profile) => {
        if (!active || !profile) return;
        setDraftRecipient({
          uid: profile.uid,
          username: profile.username || usernameParam || "kullanici",
          photo: profile.photoURL || "",
          premium: isPremiumDataActive(profile)
        });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [conversation, recipientId, usernameParam]);

  useEffect(() => {
    if (!conversationId) {
      setConversationMeta(null);
      setMetaLoaded(false);
      return;
    }
    setMetaLoaded(false);
    return subscribeConversation(conversationId, (item) => {
      setConversationMeta(item);
      setMetaLoaded(true);
    });
  }, [conversationId]);

  useEffect(() => {
    clearSyncError();
    setLocalError("");
  }, [clearSyncError, conversationId]);

  useEffect(() => {
    if (!conversationId || hideMessages || !threadReady) return;
    return subscribeConversationMessages(
      conversationId,
      (items, meta) => {
        const visible = historyClearedAtMs > 0
          ? items.filter((item) => item.createdAtMs > historyClearedAtMs)
          : items;
        setMessages(visible);
        void saveResourceCache(`messages:thread:${conversationId}`, visible);
        setReachedStart(meta.reachedStart);
        setInitialLoaded(true);
        setLocalError("");
      },
      (error) => {
        setInitialLoaded(true);
        setLocalError(
          language === "tr"
            ? `Mesajlar yüklenemedi${error.code ? ` (${error.code})` : ""}. Lütfen tekrar deneyin.`
            : `Could not load messages${error.code ? ` (${error.code})` : ""}. Please try again.`
        );
      },
      messageLimit
    );
  }, [conversationId, hideMessages, historyClearedAtMs, language, messageLimit, threadReady]);

  useFocusEffect(
    useCallback(() => {
      if (!conversationId) return;
      isFocusedRef.current = true;
      setActiveConversationId(conversationId);
      if (conversationMeta) void markConversationRead(conversationMeta.id);
      return () => {
        isFocusedRef.current = false;
        setActiveConversationId(null);
      };
    }, [conversationId, conversationMeta, markConversationRead, setActiveConversationId])
  );

  useEffect(() => {
    if (!conversationMeta || !isFocusedRef.current) return;
    void markConversationRead(conversationMeta.id);
  }, [conversationMeta?.id, conversationMeta?.lastMessageAtMs, conversationMeta, markConversationRead]);

  function handleSend() {
    if (!conversationId || !text.trim() || sendPressLockedRef.current || closed) return;
    sendPressLockedRef.current = true;
    requestAnimationFrame(() => {
      sendPressLockedRef.current = false;
    });
    const outgoing = text.trim();
    markPerformanceEvent("MESSAGE_PRESS", { conversationId });
    setLocalError("");
    setText("");
    requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: 0, animated: true }));
    void sendMessage({
      conversationId,
      recipientId: recipientId || undefined,
      text: outgoing
    }).then((result) => {
      if (result.ok) return;
      setText((current) => current.trim() ? current : outgoing);
      if (result.message) setLocalError(result.message);
      if (result.premiumUpsell) setPremiumModal(true);
    });
  }

  function openProfile() {
    if (!other.username || other.username === "kullanici") return;
    router.push({ pathname: "/profile/[name]", params: { name: other.username } });
  }

  async function handleCopyMessage(value: string) {
    if (!value.trim()) return;
    await Clipboard.setStringAsync(value).catch(() => undefined);
    setCopyNotice(true);
    setTimeout(() => setCopyNotice(false), 1600);
  }

  function reportToSupport(messageText: string) {
    const username = other.username && other.username !== "kullanici" ? other.username : "";
    const labels = {
      subcategory: { tr: "Uygunsuz davranış", en: "Inappropriate behavior", ru: "Поведение", uz: "Xatti-harakat" },
      subject: { tr: "Mesaj şikayeti", en: "Message report", ru: "Жалоба на сообщение", uz: "Xabar shikoyati" },
      reportedUser: { tr: "Şikayet edilen kullanıcı", en: "Reported user", ru: "Пользователь", uz: "Shikoyat qilingan" },
      message: { tr: "Mesaj", en: "Message", ru: "Сообщение", uz: "Xabar" },
      yourComplaint: { tr: "Şikayetin", en: "Your complaint", ru: "Ваша жалоба", uz: "Shikoyatingiz" },
    };
    const subjectText = username ? `@${username} – ${labels.subject[language]}` : labels.subject[language];
    const topicText = `${labels.reportedUser[language]}: ${username ? `@${username}` : "-"}\n${labels.message[language]}: "${messageText}"\n\n${labels.yourComplaint[language]}: `;
    router.push({ pathname: "/support", params: { category: "user", subcategory: labels.subcategory[language], subject: subjectText, topic: topicText } });
  }

  async function handleArchive() {
    if (!conversationId || menuAction) return;
    setMenuAction("archive");
    try {
      await toggleArchive(conversationId, true);
      setListTab("archived");
      setMenuOpen(false);
      router.back();
    } catch {
      setLocalError(language === "tr" ? "Arşivleme başarısız." : "Archive failed.");
    } finally {
      setMenuAction(null);
    }
  }

  async function handleDeleteConversation() {
    if (!conversationId || menuAction) return;
    setMenuAction("delete");
    setDeleteConfirmOpen(false);
    setMessages([]);
    void saveResourceCache(`messages:thread:${conversationId}`, []);
    try {
      await deleteConversation(conversationId);
      setMenuOpen(false);
      router.replace("/messages");
    } catch {
      setLocalError(language === "tr" ? "Sohbet silinemedi. Lütfen tekrar deneyin." : "Could not delete conversation. Please try again.");
    } finally {
      setMenuAction(null);
    }
  }

  function openDeleteConfirm() {
    setMenuOpen(false);
    setDeleteConfirmOpen(true);
  }

  async function handleUnarchive() {
    if (!conversationId || menuAction) return;
    setMenuAction("unarchive");
    try {
      await toggleArchive(conversationId, false);
      setListTab("primary");
      setMenuOpen(false);
      router.back();
    } catch {
      setLocalError(language === "tr" ? "Arşivden çıkarma başarısız." : "Unarchive failed.");
    } finally {
      setMenuAction(null);
    }
  }

  async function handleBlock() {
    if (!other.uid || menuAction) return;
    setMenuAction("block");
    try {
      await blockUser(other.uid);
      setMenuOpen(false);
      router.back();
    } catch {
      setLocalError(language === "tr" ? "Engelleme başarısız." : "Block failed.");
    } finally {
      setMenuAction(null);
    }
  }

  async function handleUnblock() {
    if (!other.uid || menuAction) return;
    setMenuAction("unblock");
    try {
      await unblockUser(other.uid);
      setMenuOpen(false);
    } catch {
      setLocalError(language === "tr" ? "Engel kaldırılamadı." : "Unblock failed.");
    } finally {
      setMenuAction(null);
    }
  }

  return (
    <AppChrome title={`@${other.username}`} eyebrow="Mesaj" showBackButton showTopAd={false} scroll={false} showBottomDock={false} keyboardAvoiding>
      <View style={styles.head}>
        <Pressable style={styles.headProfile} onPress={openProfile} disabled={!other.username || other.username === "kullanici"}>
          <ProfileAvatar uri={other.photo} size={44} />
          <View style={styles.headCopy}>
            <View style={styles.titleRow}>
              <Text style={styles.username}>@{other.username}</Text>
              {other.premium ? <Ionicons name="diamond" size={14} color={colors.gold} /> : null}
            </View>
            <Text style={styles.subtitle}>{language === "tr" ? "Özel mesaj" : "Direct message"}</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => setMenuOpen(true)}><Ionicons name="ellipsis-vertical" size={18} color={colors.muted} /></Pressable>
      </View>

      {!hideMessages && (!threadReady || !initialLoaded) ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        data={hideMessages || !threadReady ? [] : displayMessages}
        keyExtractor={(item) => item.id}
        style={styles.list}
        contentContainerStyle={styles.messages}
        inverted={!hideMessages && displayMessages.length > 0}
        onEndReached={loadOlderMessages}
        onEndReachedThreshold={0.4}
        showsVerticalScrollIndicator={false}
        {...getStandardListPerformanceProps(performanceMode)}
        initialNumToRender={performanceMode === "reduced" ? 8 : 12}
        maxToRenderPerBatch={performanceMode === "reduced" ? 4 : 8}
        windowSize={performanceMode === "reduced" ? 4 : 7}
        ListFooterComponent={!reachedStart && initialLoaded && displayMessages.length >= INITIAL_MESSAGE_LIMIT ? (
          <View style={styles.olderLoader}>
            <ActivityIndicator color={colors.muted} size="small" />
          </View>
        ) : null}
        ListEmptyComponent={hideMessages ? (
          <View style={styles.blockedBox}>
            <Ionicons name="ban-outline" size={28} color={colors.muted} />
            <Text style={styles.blockedTitle}>
              {blockedByMe
                ? (language === "tr" ? "Bu kullanıcıyı engelledin" : "You blocked this user")
                : (language === "tr" ? "Bu konuşma engellendi" : "This conversation is blocked")}
            </Text>
            <Text style={styles.blockedText}>
              {language === "tr"
                ? "Engellenen konuşmalarda mesaj geçmişi görünmez."
                : "Message history is hidden in blocked conversations."}
            </Text>
            {blockedByMe ? (
              <Pressable disabled={menuAction === "unblock"} style={[styles.primaryButton, menuAction === "unblock" && styles.menuItemBusy]} onPress={() => void handleUnblock()}>
                {menuAction === "unblock" ? (
                  <ActivityIndicator color="#15120d" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>{language === "tr" ? "Engeli kaldır" : "Unblock"}</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        ) : null}
        renderItem={({ item }) => {
          const mine = item.senderId === account.uid;
          return (
            <Pressable
              onPress={() => item.deliveryStatus === "failed" ? void retryPending(item.clientMessageId) : undefined}
              onLongPress={(event) => {
                actionMenuOpenedAt.current = Date.now();
                setActionMenu({ id: item.id, text: item.text, x: event.nativeEvent.pageX, y: event.nativeEvent.pageY });
              }}
              delayLongPress={550}
              style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}
            >
              <MessageMentionText text={item.text} style={[styles.bubbleText, mine && styles.bubbleTextMine]} mine={mine} />
              {mine && item.deliveryStatus === "sending" ? (
                <View style={styles.statusRow}>
                  <Ionicons name="time-outline" size={12} color={colors.muted} />
                  <Text style={styles.statusText}>{language === "tr" ? "Gönderiliyor" : "Sending"}</Text>
                </View>
              ) : null}
              {mine && item.deliveryStatus === "failed" ? (
                <View style={styles.statusRow}>
                  <Ionicons name="alert-circle-outline" size={12} color="#d92d20" />
                  <Text style={styles.statusFailed}>{language === "tr" ? "Gönderilemedi · tekrar dene" : "Failed · tap to retry"}</Text>
                </View>
              ) : null}
              {canSeeReadReceipts && mine && item.deliveryStatus === "sent" && item.readAtMs ? (
                <Text style={styles.readReceipt}>{language === "tr" ? "Okundu" : "Read"}</Text>
              ) : null}
            </Pressable>
          );
        }}
      />

      {copyNotice ? (
        <View style={styles.copyNotice} pointerEvents="none">
          <Ionicons name="checkmark-circle" size={15} color={colors.gold} />
          <Text style={styles.copyNoticeText}>{language === "tr" ? "Mesaj kopyalandı" : "Message copied"}</Text>
        </View>
      ) : null}

      <Modal visible={!!actionMenu} transparent animationType="fade" onRequestClose={() => setActionMenu(null)}>
        <Pressable
          style={styles.actionBackdrop}
          onPress={() => {
            if (Date.now() - actionMenuOpenedAt.current < 700) return;
            setActionMenu(null);
          }}
        >
          {actionMenu ? (
            <View
              style={[
                styles.actionMenu,
                {
                  top: Math.max(insets.top + 8, actionMenu.y - 64),
                  left: Math.min(Math.max(actionMenu.x - 96, 12), Dimensions.get("window").width - 204),
                },
              ]}
            >
              <Pressable
                style={styles.actionItem}
                onPress={() => {
                  const value = actionMenu.text;
                  setActionMenu(null);
                  void handleCopyMessage(value);
                }}
              >
                <Ionicons name="copy-outline" size={16} color={colors.ivory} />
                <Text style={styles.actionText}>{language === "tr" ? "Kopyala" : "Copy"}</Text>
              </Pressable>
              <View style={styles.actionDivider} />
              <Pressable
                style={styles.actionItem}
                onPress={() => {
                  const id = actionMenu.id;
                  const messageText = actionMenu.text;
                  setActionMenu(null);
                  if (conversationId) void reportMessage(conversationId, id, "Uygunsuz mesaj");
                  reportToSupport(messageText);
                }}
              >
                <Ionicons name="flag-outline" size={16} color="#d92d20" />
                <Text style={[styles.actionText, styles.actionTextDanger]}>{language === "tr" ? "Şikayet Et" : "Report"}</Text>
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      </Modal>

      {isRequest ? (
        <View style={styles.requestBox}>
          <Text style={styles.requestText}>{language === "tr" ? "Bu kullanıcıdan mesaj isteği var." : "Message request received."}</Text>
          <Pressable style={styles.primaryButton} onPress={() => void acceptRequest(conversationId!)}>
            <Text style={styles.primaryButtonText}>{language === "tr" ? "Kabul et" : "Accept"}</Text>
          </Pressable>
        </View>
      ) : closed ? (
        <Text style={styles.closedNote}>
          {isBlockedConversation
            ? (language === "tr" ? "Bu konuşmaya mesaj gönderilemez." : "Messaging is disabled.")
            : (language === "tr" ? "Bu konuşmaya mesaj gönderilemez." : "Messaging is disabled.")}
        </Text>
      ) : (
        <View style={[styles.composer, { marginBottom: Math.max(insets.bottom, 12) }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder={language === "tr" ? "Mesaj yaz..." : "Write a message..."}
            placeholderTextColor={colors.muted}
            style={styles.input}
            multiline
          />
          <Pressable disabled={!text.trim()} style={[styles.sendButton, !text.trim() && styles.sendDisabled]} onPress={handleSend}>
            <Ionicons name="send" size={18} color="#15120d" />
          </Pressable>
        </View>
      )}

      {localError || syncError ? <Text style={styles.error}>{localError || syncError}</Text> : null}

      <Modal visible={premiumModal} transparent animationType="fade" onRequestClose={() => setPremiumModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Premium</Text>
            <Text style={styles.modalText}>
              {"Bugünkü ücretsiz mesaj limitine ulaştın. Premium'a geçerek sınırsız mesajlaşabilir, takip etmediğin kullanıcılara doğrudan yazabilir ve daha uzun mesajlar gönderebilirsin."}
            </Text>
            <Pressable style={styles.primaryButton} onPress={() => { setPremiumModal(false); router.push("/premium" as never); }}>
              <Text style={styles.primaryButtonText}>{"Premium'a Geç"}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => !menuAction && setMenuOpen(false)}>
        <Pressable style={[styles.menuBackdrop, { paddingTop: insets.top + 92 }]} onPress={() => !menuAction && setMenuOpen(false)}>
          <Pressable style={styles.menuCard} onPress={() => undefined}>
            {conversationId && !isBlockedConversation ? (
              isArchived ? (
                <Pressable disabled={!!menuAction} style={[styles.menuItem, menuAction === "unarchive" && styles.menuItemBusy]} onPress={() => void handleUnarchive()}>
                  {menuAction === "unarchive" ? <ActivityIndicator color={colors.gold} size="small" /> : <Ionicons name="archive-outline" size={18} color={colors.gold} />}
                  <Text style={styles.menuText}>{language === "tr" ? "Arşivden çıkar" : "Unarchive"}</Text>
                </Pressable>
              ) : (
                <Pressable disabled={!!menuAction} style={[styles.menuItem, menuAction === "archive" && styles.menuItemBusy]} onPress={() => void handleArchive()}>
                  {menuAction === "archive" ? <ActivityIndicator color={colors.gold} size="small" /> : <Ionicons name="archive-outline" size={18} color={colors.gold} />}
                  <Text style={styles.menuText}>{language === "tr" ? "Arşivle" : "Archive"}</Text>
                </Pressable>
              )
            ) : null}
            {blockedByMe ? (
              <Pressable disabled={!!menuAction} style={[styles.menuItem, menuAction === "unblock" && styles.menuItemBusy]} onPress={() => void handleUnblock()}>
                {menuAction === "unblock" ? <ActivityIndicator color={colors.gold} size="small" /> : <Ionicons name="checkmark-circle-outline" size={18} color={colors.gold} />}
                <Text style={styles.menuText}>{language === "tr" ? "Engeli kaldır" : "Unblock"}</Text>
              </Pressable>
            ) : (
              <Pressable disabled={!!menuAction} style={[styles.menuItem, menuAction === "block" && styles.menuItemBusy]} onPress={() => void handleBlock()}>
                {menuAction === "block" ? <ActivityIndicator color={colors.gold} size="small" /> : <Ionicons name="ban-outline" size={18} color={colors.gold} />}
                <Text style={styles.menuText}>{language === "tr" ? "Engelle" : "Block"}</Text>
              </Pressable>
            )}
            <Pressable disabled={!!menuAction} style={[styles.menuItem, menuAction === "delete" && styles.menuItemBusy]} onPress={openDeleteConfirm}>
              <Ionicons name="trash-outline" size={18} color={colors.gold} />
              <Text style={styles.menuText}>{language === "tr" ? "Mesajları sil" : "Delete messages"}</Text>
            </Pressable>
            <Pressable disabled={!!menuAction} style={styles.menuItem} onPress={() => {
              const last = messages[messages.length - 1];
              const lastText = last?.text ?? "";
              if (last && conversationId) void reportMessage(conversationId, last.id, "Uygunsuz mesaj");
              setMenuOpen(false);
              reportToSupport(lastText);
            }}>
              <Ionicons name="flag-outline" size={18} color={colors.gold} />
              <Text style={styles.menuText}>{language === "tr" ? "Raporla" : "Report"}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={deleteConfirmOpen} transparent animationType="fade" onRequestClose={() => !menuAction && setDeleteConfirmOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{deleteCopy(language, "title")}</Text>
            <Text style={styles.modalText}>{deleteCopy(language, "body")}</Text>
            <View style={styles.confirmActions}>
              <Pressable style={styles.secondaryModalButton} disabled={!!menuAction} onPress={() => setDeleteConfirmOpen(false)}>
                <Text style={styles.secondaryModalButtonText}>{deleteCopy(language, "cancel")}</Text>
              </Pressable>
              <Pressable style={[styles.dangerModalButton, menuAction === "delete" && styles.menuItemBusy]} disabled={!!menuAction} onPress={() => void handleDeleteConversation()}>
                {menuAction === "delete" ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.dangerModalButtonText}>{deleteCopy(language, "confirm")}</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppChrome>
  );
}

function isDirectMessageArray(value: unknown): value is DirectMessageRecord[] {
  return isResourceArray(value, (item): item is DirectMessageRecord => {
    if (!item || typeof item !== "object") return false;
    const message = item as Partial<DirectMessageRecord>;
    return typeof message.id === "string" && typeof message.text === "string" && typeof message.senderId === "string";
  });
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    head: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
    headProfile: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
    avatar: { width: 44, height: 44, borderRadius: 22 },
    avatarFallback: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
    headCopy: { flex: 1 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    username: { color: colors.ivory, fontWeight: "800", fontSize: 16 },
    subtitle: { color: colors.muted, fontSize: 12, marginTop: 2 },
    list: { flex: 1 },
    messages: { gap: 6, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 14 },
    loadingBox: { paddingVertical: 24, alignItems: "center", justifyContent: "center" },
    olderLoader: { paddingVertical: 14, alignItems: "center", justifyContent: "center" },
    copyNotice: { position: "absolute", alignSelf: "center", bottom: 92, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
    copyNoticeText: { color: colors.ivory, fontSize: 13, fontWeight: "700" },
    actionBackdrop: { flex: 1 },
    actionMenu: { position: "absolute", flexDirection: "row", alignItems: "center", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: 14, overflow: "hidden", shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
    actionItem: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 16, paddingVertical: 11 },
    actionDivider: { width: 1, alignSelf: "stretch", backgroundColor: colors.line },
    actionText: { color: colors.ivory, fontSize: 14, fontWeight: "700" },
    actionTextDanger: { color: "#d92d20" },
    bubble: { maxWidth: "78%", borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, marginVertical: 1 },
    bubbleMine: { alignSelf: "flex-end", backgroundColor: colors.gold, borderBottomRightRadius: 6 },
    bubbleOther: { alignSelf: "flex-start", backgroundColor: colors.panelSoft, borderWidth: 1, borderColor: colors.line, borderBottomLeftRadius: 6 },
    bubbleText: { color: colors.ivory, lineHeight: 21, fontSize: 15 },
    bubbleTextMine: { color: "#15120d", fontWeight: "600" },
    statusRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4, alignSelf: "flex-end" },
    statusText: { color: "rgba(21,18,13,0.65)", fontSize: 11 },
    statusFailed: { color: "#7a1010", fontSize: 11, fontWeight: "700" },
    readReceipt: { color: "rgba(21,18,13,0.6)", fontSize: 11, marginTop: 3, textAlign: "right" },
    composer: { flexDirection: "row", gap: 8, alignItems: "flex-end", marginTop: 10, marginHorizontal: 14, padding: 7, borderWidth: 1, borderColor: colors.line, borderRadius: 30, backgroundColor: colors.panelSoft, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 5 },
    input: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 11, color: colors.ivory, fontSize: 15 },
    sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
    sendDisabled: { opacity: 0.45 },
    closedNote: { color: colors.muted, paddingVertical: 14, paddingHorizontal: 16, textAlign: "center" },
    blockedBox: { alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 48, paddingHorizontal: 24 },
    blockedTitle: { color: colors.ivory, fontWeight: "800", fontSize: 16, textAlign: "center" },
    blockedText: { color: colors.muted, textAlign: "center", lineHeight: 20 },
    requestBox: { gap: 10, paddingTop: 12, paddingHorizontal: 16, paddingBottom: 12, borderTopWidth: 1, borderTopColor: colors.line },
    requestText: { color: colors.ivory },
    primaryButton: { backgroundColor: colors.gold, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
    primaryButtonText: { color: "#15120d", fontWeight: "800" },
    error: { color: "#d92d20", marginTop: 8, paddingHorizontal: 16 },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 },
    modalCard: { backgroundColor: colors.panel, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: colors.line, gap: 12 },
    modalTitle: { color: colors.gold, fontSize: 18, fontWeight: "800" },
    modalText: { color: colors.ivory, lineHeight: 21 },
    confirmActions: { flexDirection: "row", gap: 10, marginTop: 4 },
    secondaryModalButton: { flex: 1, borderRadius: 12, borderWidth: 1, borderColor: colors.line, paddingVertical: 12, alignItems: "center", backgroundColor: colors.panelSoft },
    secondaryModalButtonText: { color: colors.ivory, fontWeight: "700" },
    dangerModalButton: { flex: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center", backgroundColor: "#b42318" },
    dangerModalButtonText: { color: "#fff", fontWeight: "800" },
    menuBackdrop: { flex: 1, alignItems: "flex-end", paddingHorizontal: 14 },
    menuCard: { minWidth: 200, backgroundColor: colors.panel, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: colors.line, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
    menuItem: { padding: 16, borderBottomWidth: 1, borderBottomColor: colors.line, flexDirection: "row", alignItems: "center", gap: 12 },
    menuItemBusy: { opacity: 0.72 },
    menuText: { color: colors.ivory, fontWeight: "700", flex: 1 }
  });
}
