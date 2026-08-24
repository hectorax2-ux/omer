import { useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { AuthRequired } from "@/components/auth-required";
import { ProfileAvatar } from "@/components/profile-avatar";
import { getThemeColors } from "@/constants/theme";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { useMessaging } from "@/hooks/use-messaging";
import { profileRouteParam } from "@/utils/profile-route";

const blockedCopy = {
  title: { tr: "Engellenenler", en: "Blocked users", ru: "Заблокированные", uz: "Bloklanganlar" },
  eyebrow: { tr: "Gizlilik ve güvenlik", en: "Privacy and safety", ru: "Конфиденциальность и безопасность", uz: "Maxfiylik va xavfsizlik" },
  intro: {
    tr: "Engellediğiniz kullanıcıları burada görebilir ve istediğiniz zaman engellerini kaldırabilirsiniz.",
    en: "View people you have blocked and unblock them whenever you choose.",
    ru: "Здесь можно просмотреть заблокированных пользователей и снять блокировку.",
    uz: "Bloklagan foydalanuvchilaringizni ko'ring va istalgan payt blokdan chiqaring."
  },
  empty: { tr: "Engellediğiniz kullanıcı yok.", en: "You have not blocked anyone.", ru: "Нет заблокированных пользователей.", uz: "Bloklangan foydalanuvchilar yo'q." },
  unblock: { tr: "Engeli kaldır", en: "Unblock", ru: "Разблокировать", uz: "Blokdan chiqarish" },
  unblocking: { tr: "Kaldırılıyor", en: "Unblocking", ru: "Разблокировка", uz: "Chiqarilmoqda" },
  error: {
    tr: "Engel kaldırılamadı. Lütfen tekrar deneyin.",
    en: "Unable to unblock this user. Please try again.",
    ru: "Не удалось снять блокировку. Попробуйте снова.",
    uz: "Blokdan chiqarib bo'lmadi. Qayta urinib ko'ring."
  }
} as const;

export default function BlockedUsersScreen() {
  const router = useRouter();
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const { isAuthenticated } = useAccount();
  const { blockedUsers, blocksReady, unblockUser } = useMessaging();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [busyUid, setBusyUid] = useState("");
  const [error, setError] = useState("");

  if (!isAuthenticated) return <AuthRequired title={blockedCopy.title[language]} />;

  async function unblock(uid: string) {
    setBusyUid(uid);
    setError("");
    try {
      await unblockUser(uid);
    } catch {
      setError(blockedCopy.error[language]);
    } finally {
      setBusyUid("");
    }
  }

  return (
    <AppChrome title={blockedCopy.title[language]} eyebrow={blockedCopy.eyebrow[language]} showBackButton backToHome showTopAd={false}>
      <View style={styles.introCard}>
        <Ionicons name="shield-checkmark-outline" size={30} color={colors.gold} />
        <Text style={styles.intro}>{blockedCopy.intro[language]}</Text>
      </View>

      {!blocksReady ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : blockedUsers.length === 0 ? (
        <View style={styles.stateCard}>
          <Ionicons name="people-outline" size={34} color={colors.muted} />
          <Text style={styles.emptyText}>{blockedCopy.empty[language]}</Text>
        </View>
      ) : (
        <View style={styles.list}>
          {blockedUsers.map((user) => (
            <View key={user.uid} style={styles.userCard}>
              <Pressable
                onPress={() => router.push({ pathname: "/profile/[name]", params: { name: profileRouteParam({ uid: user.uid, username: user.username }) } })}
                style={styles.userIdentity}
              >
                <ProfileAvatar uri={user.photo} size={44} />
                <View style={styles.userText}>
                  <View style={styles.nameLine}>
                    <Text style={styles.username} numberOfLines={1}>@{user.username}</Text>
                    {user.premium ? <Ionicons name="diamond" size={13} color={colors.gold} /> : null}
                  </View>
                </View>
              </Pressable>
              <Pressable disabled={busyUid === user.uid} onPress={() => void unblock(user.uid)} style={[styles.unblockButton, busyUid === user.uid && styles.disabled]}>
                <Text style={styles.unblockText} numberOfLines={1} adjustsFontSizeToFit>
                  {busyUid === user.uid ? blockedCopy.unblocking[language] : blockedCopy.unblock[language]}
                </Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </AppChrome>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    introCard: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 12, padding: 14, marginBottom: 12 },
    intro: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: "700", flex: 1 },
    stateCard: { minHeight: 160, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center", gap: 10, padding: 20 },
    emptyText: { color: colors.muted, fontSize: 14, lineHeight: 20, fontWeight: "800", textAlign: "center" },
    list: { gap: 8 },
    userCard: { minHeight: 66, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 10, padding: 10 },
    userIdentity: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
    userText: { flex: 1, minWidth: 0 },
    nameLine: { flexDirection: "row", alignItems: "center", gap: 5 },
    username: { color: colors.ivory, fontSize: 14, fontWeight: "900", flexShrink: 1 },
    unblockButton: { minHeight: 38, maxWidth: 120, borderRadius: 8, borderWidth: 1, borderColor: colors.gold, alignItems: "center", justifyContent: "center", paddingHorizontal: 11 },
    unblockText: { color: colors.gold, fontSize: 12, fontWeight: "900" },
    disabled: { opacity: 0.55 },
    error: { color: "#ef9a9a", fontSize: 13, lineHeight: 19, fontWeight: "800", textAlign: "center", marginTop: 10 }
  });
}
