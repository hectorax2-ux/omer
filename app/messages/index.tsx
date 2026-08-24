import { useEffect, useMemo, useRef, useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, useSegments } from "expo-router";
import { AppChrome, AdSlot } from "@/components/app-chrome";
import { AuthRequired } from "@/components/auth-required";
import { copy as contentCopy } from "@/data/content";
import { ProfileAvatar } from "@/components/profile-avatar";
import { getThemeColors } from "@/constants/theme";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { useMessaging } from "@/hooks/use-messaging";
import { ConversationRecord, formatMessageTime } from "@/src/services/firebase/messaging-service";
import { conversationIdForParticipants } from "@/src/services/firebase/messaging-settings";
import type { BlockedUserEntry, MessageListTab } from "@/providers/messaging-provider";

const copy = {
  title: { tr: "Mesajlar", en: "Messages", ru: "Сообщения", uz: "Xabarlar" },
  primary: { tr: "Genel", en: "General", ru: "Основные", uz: "Umumiy" },
  requests: { tr: "İstekler", en: "Requests", ru: "Запросы", uz: "So'rovlar" },
  archived: { tr: "Arşiv", en: "Archived", ru: "Архив", uz: "Arxiv" },
  blocked: { tr: "Engellenenler", en: "Blocked", ru: "Заблок.", uz: "Bloklangan" },
  empty: { tr: "Henüz mesaj yok.", en: "No messages yet.", ru: "Сообщений пока нет.", uz: "Hali xabar yo'q." },
  blockedEmpty: { tr: "Engellenen kullanıcı yok.", en: "No blocked users.", ru: "Нет заблокированных.", uz: "Bloklangan foydalanuvchi yo'q." },
  unblock: { tr: "Engeli kaldır", en: "Unblock", ru: "Разблок.", uz: "Blokdan chiqar" },
  you: { tr: "Sen", en: "You", ru: "Вы", uz: "Siz" }
};

const tabs: MessageListTab[] = ["primary", "requests", "archived", "blocked"];

export default function MessagesScreen() {
  const { isAuthenticated } = useAccount();
  const { language } = useLanguage();
  if (!isAuthenticated) return <AuthRequired title={copy.title[language]} />;
  return <AuthenticatedMessagesScreen />;
}

function AuthenticatedMessagesScreen() {
  const router = useRouter();
  const segments = useSegments();
  const inTabs = segments[0] === "(tabs)";
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { account } = useAccount();
  const {
    listTab,
    setListTab,
    visibleConversations,
    unreadConversationCount,
    requestCount,
    archivedConversationCount,
    blockedUsers,
    getOtherParticipant,
    listScrollOffset,
    setListScrollOffset,
    setActiveConversationId,
    unblockUser
  } = useMessaging();
  const listRef = useRef<FlatList<ConversationRecord>>(null);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setActiveConversationId(null);
      return undefined;
    }, [setActiveConversationId])
  );

  useEffect(() => {
    if (listScrollOffset > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToOffset({ offset: listScrollOffset, animated: false }));
    }
  }, [listScrollOffset, visibleConversations.length]);

  function preview(conversation: ConversationRecord) {
    const prefix = conversation.lastSenderId === account.uid ? `${copy.you[language]}: ` : "";
    return `${prefix}${conversation.lastMessageText}`;
  }

  function tabLabel(tab: MessageListTab) {
    const base = copy[tab][language];
    if (tab === "primary" && unreadConversationCount > 0) return `${base} (${unreadConversationCount})`;
    if (tab === "requests" && requestCount > 0) return `${base} (${requestCount})`;
    if (tab === "archived" && archivedConversationCount > 0) return `${base} (${archivedConversationCount})`;
    if (tab === "blocked" && blockedUsers.length > 0) return `${base} (${blockedUsers.length})`;
    return base;
  }

  return (
    <AppChrome title={copy.title[language]} eyebrow="Art Atlas" showBackButton={!inTabs} backToHome={!inTabs} showTopAd={false} scroll={false}>
      <AdSlot label={contentCopy.adSlot[language]} placement="category_top" compact />
      <View style={styles.tabsWrap}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.tabsScroll} contentContainerStyle={styles.tabs}>
          {tabs.map((tab) => (
            <Pressable key={tab} onPress={() => setListTab(tab)} style={[styles.tab, listTab === tab && styles.tabActive]}>
              <Text style={[styles.tabText, listTab === tab && styles.tabTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>
                {tabLabel(tab)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {listTab === "blocked" ? (
        <FlatList
          data={blockedUsers}
          keyExtractor={(item) => item.uid}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={<Text style={styles.empty}>{copy.blockedEmpty[language]}</Text>}
          renderItem={({ item }) => (
            <BlockedUserRow
              item={item}
              language={language}
              styles={styles}
              colors={colors}
              onOpen={() => router.push(`/messages/${item.conversationId ?? conversationIdForParticipants(account.uid, item.uid)}` as never)}
              onUnblock={async () => {
                if (unblockingId) return;
                setUnblockingId(item.uid);
                try {
                  await unblockUser(item.uid);
                } finally {
                  setUnblockingId(null);
                }
              }}
              unblocking={unblockingId === item.uid}
            />
          )}
        />
      ) : (
        <FlatList
          ref={listRef}
          data={visibleConversations}
          keyExtractor={(item) => item.id}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
          updateCellsBatchingPeriod={48}
          windowSize={5}
          removeClippedSubviews={Platform.OS === "android"}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          onScrollEndDrag={(event) => setListScrollOffset(event.nativeEvent.contentOffset.y)}
          onMomentumScrollEnd={(event) => setListScrollOffset(event.nativeEvent.contentOffset.y)}
          ListEmptyComponent={<Text style={styles.empty}>{copy.empty[language]}</Text>}
          renderItem={({ item }) => {
            const other = getOtherParticipant(item);
            const unread = item.unreadCount[account.uid] ?? 0;
            return (
              <Pressable style={[styles.row, unread > 0 && styles.rowUnread]} onPress={() => router.push(`/messages/${item.id}` as never)}>
                <ProfileAvatar uri={other.photo} size={52} />
                <View style={styles.copy}>
                  <View style={styles.titleRow}>
                    <Text style={[styles.username, unread > 0 && styles.bold]}>@{other.username}</Text>
                    {other.premium ? <Ionicons name="diamond" size={14} color={colors.gold} /> : null}
                    {item.pinnedBy[account.uid] ? <Ionicons name="pin" size={12} color={colors.muted} /> : null}
                  </View>
                  <Text style={[styles.preview, unread > 0 && styles.bold]} numberOfLines={1}>{preview(item)}</Text>
                </View>
                <View style={styles.meta}>
                  <Text style={styles.time}>{formatMessageTime(item.lastMessageAtMs)}</Text>
                  {unread > 0 ? (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadBadgeText}>{unread > 99 ? "99+" : String(unread)}</Text>
                    </View>
                  ) : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </AppChrome>
  );
}

function BlockedUserRow({ item, language, styles, colors, onOpen, onUnblock, unblocking }: {
  item: BlockedUserEntry;
  language: "tr" | "en" | "ru" | "uz";
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof getThemeColors>;
  onOpen: () => void;
  onUnblock: () => void | Promise<void>;
  unblocking: boolean;
}) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.blockedMain} onPress={onOpen}>
        <ProfileAvatar uri={item.photo} size={52} />
        <View style={styles.copy}>
          <View style={styles.titleRow}>
            <Text style={styles.username}>@{item.username}</Text>
            {item.premium ? <Ionicons name="diamond" size={14} color={colors.gold} /> : null}
          </View>
          <Text style={styles.preview}>{language === "tr" ? "Engellendi" : "Blocked"}</Text>
        </View>
      </Pressable>
      <Pressable disabled={unblocking} style={[styles.unblockButton, unblocking && styles.unblockButtonBusy]} onPress={onUnblock}>
        {unblocking ? (
          <ActivityIndicator color={colors.gold} size="small" />
        ) : (
          <Text style={styles.unblockButtonText}>{copy.unblock[language]}</Text>
        )}
      </Pressable>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    tabsWrap: { flexGrow: 0, flexShrink: 0, marginTop: 14, marginBottom: 14 },
    tabsScroll: { flexGrow: 0, flexShrink: 0 },
    tabs: { flexDirection: "row", gap: 6, paddingHorizontal: 10, alignItems: "center" },
    tab: { minWidth: 68, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: colors.line, alignSelf: "flex-start", alignItems: "center" },
    tabActive: { backgroundColor: colors.panelSoft, borderColor: colors.gold },
    tabText: { color: colors.muted, fontWeight: "700", fontSize: 12 },
    tabTextActive: { color: colors.gold },
    list: { flex: 1 },
    listContent: { paddingHorizontal: 16, paddingBottom: 110, gap: 2, flexGrow: 1 },
    row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
    rowUnread: { backgroundColor: colors.panelSoft },
    blockedMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, minWidth: 0 },
    avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.panel },
    avatarFallback: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
    copy: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    username: { color: colors.ivory, fontSize: 15, fontWeight: "700" },
    preview: { color: colors.muted, marginTop: 3, fontSize: 13 },
    bold: { fontWeight: "800", color: colors.ivory },
    meta: { alignItems: "flex-end", gap: 8 },
    time: { color: colors.muted, fontSize: 12 },
    unreadBadge: {
      minWidth: 20,
      height: 20,
      borderRadius: 10,
      paddingHorizontal: 6,
      backgroundColor: colors.gold,
      alignItems: "center",
      justifyContent: "center"
    },
    unreadBadgeText: { color: "#15120d", fontSize: 11, fontWeight: "800" },
    unblockButton: {
      minWidth: 108,
      minHeight: 36,
      borderWidth: 1,
      borderColor: colors.gold,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 8,
      backgroundColor: colors.panelSoft,
      alignItems: "center",
      justifyContent: "center"
    },
    unblockButtonBusy: {
      opacity: 0.75
    },
    unblockButtonText: { color: colors.gold, fontWeight: "800", fontSize: 12 },
    empty: { color: colors.muted, textAlign: "center", marginTop: 40 }
  });
}
