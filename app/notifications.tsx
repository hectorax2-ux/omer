import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { notificationCopy } from "@/app/i18n/common";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useArtSystems } from "@/hooks/use-art-systems";
import { useLanguage } from "@/hooks/use-language";
import { getText, type NotificationCategory } from "@/types/art-systems";
import { t } from "@/utils/localized-text";

type NotificationTab = NotificationCategory;

type NotificationItem = {
  id: string;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  date: string;
  targetPath?: string;
  read: boolean;
  category: NotificationCategory;
  actorUsername?: string;
};

const tabLabels: Record<NotificationTab, Record<"tr" | "en" | "ru" | "uz", string>> = {
  all: { tr: "Tümü", en: "All", ru: "Все", uz: "Hammasi" },
  system: { tr: "Sistem", en: "System", ru: "Система", uz: "Tizim" },
  message: { tr: "Mesaj", en: "Msgs", ru: "Сообщ.", uz: "Xabar" },
  like: { tr: "Beğeni", en: "Likes", ru: "Лайки", uz: "Like" },
  social: { tr: "Sosyal", en: "Social", ru: "Соц.", uz: "Ijtimoiy" }
};

const emptyLabels: Record<NotificationTab, Record<"tr" | "en" | "ru" | "uz", string>> = {
  all: { tr: "Henüz bildirim yok.", en: "No notifications yet.", ru: "Уведомлений пока нет.", uz: "Hali bildirishnomalar yo'q." },
  system: { tr: "Sistem bildirimi yok.", en: "No system notifications.", ru: "Нет системных уведомлений.", uz: "Tizim bildirishnomalari yo'q." },
  message: { tr: "Mesaj bildirimi yok.", en: "No message notifications.", ru: "Нет сообщений.", uz: "Xabar bildirishnomalari yo'q." },
  like: { tr: "Beğeni bildirimi yok.", en: "No like notifications.", ru: "Нет лайков.", uz: "Yoqtirish bildirishnomalari yo'q." },
  social: { tr: "Etkileşim bildirimi yok.", en: "No social notifications.", ru: "Нет социальных уведомлений.", uz: "O'zaro bildirishnomalar yo'q." }
};

const tabs: NotificationTab[] = ["all", "system", "message", "like", "social"];

export default function NotificationsScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const { markAllSystemNotificationsRead, markSystemNotificationRead, notifications: systemNotifications } = useArtSystems();
  const [activeTab, setActiveTab] = useState<NotificationTab>("all");

  const notifications = useMemo<NotificationItem[]>(() => systemNotifications
    .map((item) => ({
      id: item.id,
      icon: getNotificationIcon(item.type, item.category),
      title: getText(item.title, language),
      body: getText(item.body, language),
      date: item.createdAt,
      targetPath: item.targetPath,
      read: item.read,
      category: item.category,
      actorUsername: item.actorUsername
    }))
    .sort((a, b) => Date.parse(b.date) - Date.parse(a.date)), [language, systemNotifications]);

  const filtered = useMemo(
    () => activeTab === "all" ? notifications : notifications.filter((item) => item.category === activeTab),
    [activeTab, notifications]
  );

  const unreadByTab = useMemo(() => {
    const counts: Record<NotificationTab, number> = { all: 0, system: 0, message: 0, like: 0, social: 0 };
    notifications.forEach((item) => {
      if (item.read) return;
      counts.all += 1;
      counts[item.category] += 1;
    });
    return counts;
  }, [notifications]);

  return (
    <AppChrome
      title={{ tr: "Bildirimler", en: "Notifications", ru: "Уведомления", uz: "Bildirishnomalar" }[language]}
      eyebrow="Art Atlas"
      showBackButton
      backToHome
      showTopAd={false}
    >
      <View style={styles.tabRow}>
        {tabs.map((tab) => {
          const active = activeTab === tab;
          const unread = unreadByTab[tab];
          return (
            <Pressable key={tab} onPress={() => setActiveTab(tab)} style={[styles.tab, active && styles.tabActive]}>
              <Text
                style={[styles.tabText, active && styles.tabTextActive]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.72}
              >
                {tabLabels[tab][language]}
              </Text>
              {unread > 0 ? (
                <View style={[styles.tabBadge, active && styles.tabBadgeActive]}>
                  <Text style={[styles.tabBadgeText, active && styles.tabBadgeTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {unread > 99 ? "99+" : unread}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.summaryLeft}>
          <Text style={styles.summaryText}>
            {filtered.length} {t(notificationCopy.countLabel, language)}
          </Text>
          {unreadByTab[activeTab] > 0 ? <View style={styles.summaryDot} /> : null}
        </View>
        {unreadByTab.all > 0 ? (
          <Pressable onPress={markAllSystemNotificationsRead} style={styles.markAllReadButton} hitSlop={8}>
            <Text style={styles.markAllReadText} numberOfLines={2}>
              {t(notificationCopy.markAllRead, language)}
            </Text>
          </Pressable>
        ) : null}
      </View>

      <View style={styles.list}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="notifications-off-outline" size={28} color={colors.gold} />
            </View>
            <Text style={styles.emptyTitle}>{emptyLabels[activeTab][language]}</Text>
            <Text style={styles.emptyBody}>
              {language === "tr"
                ? "Yeni bildirimler burada görünecek."
                : language === "ru"
                  ? "Новые уведомления появятся здесь."
                  : language === "uz"
                    ? "Yangi bildirishnomalar shu yerda ko'rinadi."
                    : "New notifications will appear here."}
            </Text>
          </View>
        ) : null}
        {filtered.map((item) => (
          <Pressable
            key={item.id}
            onPress={() => {
              markSystemNotificationRead(item.id);
              if (item.targetPath) router.push(item.targetPath as never);
            }}
            style={[styles.card, !item.read && styles.unreadCard]}
          >
            <View style={[styles.iconWrap, !item.read && styles.iconWrapUnread]}>
              <Ionicons name={item.icon} size={20} color={colors.gold} />
            </View>
            <View style={styles.info}>
              <View style={styles.titleRow}>
                <Text style={[styles.title, !item.read && styles.titleUnread]} numberOfLines={2}>{item.title}</Text>
                {!item.read ? (
                  <View style={styles.unreadPill}>
                    <Text style={styles.unreadPillText}>
                      {language === "tr" ? "YENİ" : language === "ru" ? "НОВ." : language === "uz" ? "YANGI" : "NEW"}
                    </Text>
                  </View>
                ) : null}
              </View>
              {item.actorUsername ? <Text style={styles.actor}>@{item.actorUsername.replace(/^@+/, "")}</Text> : null}
              <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
              <Text style={styles.date}>{formatNotificationDate(item.date, language)}</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.muted} />
          </Pressable>
        ))}
      </View>
    </AppChrome>
  );
}

function formatNotificationDate(value: string, language: "tr" | "en" | "ru" | "uz") {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return value;
  const date = new Date(parsed);
  const now = Date.now();
  const diffMs = now - parsed;
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) {
    return language === "tr" ? "Az önce" : language === "ru" ? "Только что" : language === "uz" ? "Hozirgina" : "Just now";
  }
  if (diffMinutes < 60) {
    return language === "tr" ? `${diffMinutes} dk önce` : language === "ru" ? `${diffMinutes} мин назад` : language === "uz" ? `${diffMinutes} daqiqa oldin` : `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return language === "tr" ? `${diffHours} sa önce` : language === "ru" ? `${diffHours} ч назад` : language === "uz" ? `${diffHours} soat oldin` : `${diffHours}h ago`;
  }
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = String(date.getFullYear()).slice(-2);
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

function getNotificationIcon(type: string, category: NotificationCategory): keyof typeof Ionicons.glyphMap {
  if (category === "message" || type === "message") return "chatbubble-ellipses-outline";
  if (category === "like" || type === "like") return "heart-outline";
  if (category === "social") return "people-outline";
  if (type === "duel" || type === "match") return "flash-outline";
  if (type === "weekly_winner") return "trophy-outline";
  if (type === "seer_result") return "eye-outline";
  if (type === "badge") return "ribbon-outline";
  if (type === "chance_card") return "sparkles-outline";
  if (type === "time_capsule") return "time-outline";
  if (type === "system") return "megaphone-outline";
  return "notifications-outline";
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    tabRow: { flexDirection: "row", gap: 5, paddingBottom: 14, width: "100%" },
    tab: {
      flex: 1,
      minWidth: 0,
      alignItems: "center",
      justifyContent: "center",
      gap: 3,
      paddingHorizontal: 2,
      paddingVertical: 8,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel
    },
    tabActive: {
      borderColor: "rgba(217,184,101,0.55)",
      backgroundColor: "rgba(217,184,101,0.12)"
    },
    tabText: { color: colors.muted, fontWeight: "800", fontSize: 10, textAlign: "center", width: "100%" },
    tabTextActive: { color: colors.gold },
    tabBadge: {
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 3,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(217,184,101,0.18)"
    },
    tabBadgeActive: { backgroundColor: colors.gold },
    tabBadgeText: { color: colors.gold, fontSize: 9, fontWeight: "900" },
    tabBadgeTextActive: { color: colors.ink },
    summaryRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 },
    summaryLeft: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
    summaryText: { color: colors.muted, fontWeight: "800", fontSize: 12 },
    summaryDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.gold },
    markAllReadButton: { flexShrink: 1, maxWidth: "52%", alignItems: "flex-end" },
    markAllReadText: { color: colors.gold, fontWeight: "800", fontSize: 11, textAlign: "right", lineHeight: 15 },
    list: { gap: 10, paddingBottom: 24 },
    card: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 14
    },
    unreadCard: {
      borderColor: "rgba(217,184,101,0.42)",
      backgroundColor: "rgba(217,184,101,0.05)"
    },
    iconWrap: {
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: colors.panelSoft,
      alignItems: "center",
      justifyContent: "center"
    },
    iconWrapUnread: { backgroundColor: "rgba(217,184,101,0.14)" },
    info: { flex: 1, minWidth: 0 },
    titleRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
    title: { color: colors.ivory, fontWeight: "800", fontSize: 13, lineHeight: 17, flexShrink: 1 },
    titleUnread: { fontWeight: "900" },
    unreadPill: {
      borderRadius: 999,
      paddingHorizontal: 6,
      paddingVertical: 2,
      backgroundColor: "rgba(217,184,101,0.18)"
    },
    unreadPillText: { color: colors.gold, fontSize: 9, fontWeight: "900", letterSpacing: 0.4 },
    actor: { color: colors.gold, fontSize: 11, fontWeight: "800", marginTop: 2 },
    body: { color: colors.muted, lineHeight: 18, marginTop: 4, fontWeight: "600" },
    date: { color: colors.gold, fontSize: 11, fontWeight: "800", marginTop: 8, opacity: 0.85 },
    emptyState: {
      alignItems: "center",
      justifyContent: "center",
      paddingVertical: 48,
      paddingHorizontal: 24,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel
    },
    emptyIcon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.panelSoft,
      marginBottom: 14
    },
    emptyTitle: { color: colors.ivory, fontWeight: "900", fontSize: 16, textAlign: "center" },
    emptyBody: { color: colors.muted, marginTop: 8, textAlign: "center", lineHeight: 20, fontWeight: "600" }
  });
}
