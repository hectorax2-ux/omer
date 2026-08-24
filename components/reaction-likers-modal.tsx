import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { ProfileAvatar } from "@/components/profile-avatar";
import { getThemeColors } from "@/constants/theme";
import { useSocial } from "@/hooks/use-social";
import { getUserProfile } from "@/src/services/firebase/core";
import { listReactionsForTarget } from "@/src/services/firebase/like-service";
import { ContentType, ReactionValue } from "@/src/types/firestore";
import { profileRouteParam } from "@/utils/profile-route";
import { isPremiumDataActive } from "@/utils/premium-status";
import { Language } from "@/types/content";

export type ReactionLiker = {
  uid: string;
  name: string;
  username: string;
  photoURL?: string;
  isPremium?: boolean;
};

const labels = {
  title: {
    tr: "Beğenenler",
    en: "Likes",
    ru: "Понравилось",
    uz: "Yoqtirganlar"
  },
  empty: {
    tr: "Henüz beğeni yok.",
    en: "No likes yet.",
    ru: "Пока нет лайков.",
    uz: "Hozircha yoqtirish yo'q."
  },
  loading: {
    tr: "Yükleniyor...",
    en: "Loading...",
    ru: "Загрузка...",
    uz: "Yuklanmoqda..."
  }
};

export function ReactionLikersModal({
  visible,
  onClose,
  targetType,
  targetId,
  reactionValue = "like",
  language,
  colors
}: {
  visible: boolean;
  onClose: () => void;
  targetType: ContentType;
  targetId: string;
  reactionValue?: ReactionValue;
  language: Language;
  colors: ReturnType<typeof getThemeColors>;
}) {
  const router = useRouter();
  const { suggestedUsers } = useSocial();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [loading, setLoading] = useState(false);
  const [likers, setLikers] = useState<ReactionLiker[]>([]);

  useEffect(() => {
    if (!visible || !targetId) return undefined;
    let active = true;
    setLoading(true);
    listReactionsForTarget(targetType, targetId, reactionValue)
      .then(async (reactions) => {
        const uniqueIds = [...new Set(reactions.map((item) => item.userId).filter(Boolean))];
        const resolved = await Promise.all(uniqueIds.map(async (uid) => {
          const cached = suggestedUsers.find((user) => user.uid === uid);
          if (cached) {
            return {
              uid,
              name: cached.name,
              username: cached.username,
              photoURL: cached.image,
              isPremium: cached.isPremium
            };
          }
          const profile = await getUserProfile(uid).catch(() => null);
          if (!profile) {
            return {
              uid,
              name: uid.slice(0, 8),
              username: uid.slice(0, 8)
            };
          }
          return {
            uid,
            name: profile.displayName,
            username: profile.username,
            photoURL: profile.photoURL,
            isPremium: isPremiumDataActive(profile)
          };
        }));
        if (!active) return;
        setLikers(resolved.sort((left, right) => left.name.localeCompare(right.name, "tr")));
      })
      .catch(() => {
        if (active) setLikers([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reactionValue, suggestedUsers, targetId, targetType, visible]);

  function openProfile(liker: ReactionLiker) {
    onClose();
    router.push({
      pathname: "/profile/[name]",
      params: { name: profileRouteParam({ uid: liker.uid, username: liker.username, displayName: liker.name }) }
    });
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.panel}>
          <View style={styles.header}>
            <Ionicons name="heart" size={20} color={colors.gold} />
            <Text style={styles.title}>{labels.title[language]}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={20} color={colors.ivory} />
            </Pressable>
          </View>
          {loading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={colors.gold} size="small" />
              <Text style={styles.loadingText}>{labels.loading[language]}</Text>
            </View>
          ) : null}
          {!loading && !likers.length ? (
            <Text style={styles.empty}>{labels.empty[language]}</Text>
          ) : null}
          {!loading && likers.length ? (
            <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
              {likers.map((liker) => (
                <Pressable key={liker.uid} onPress={() => openProfile(liker)} style={styles.row}>
                  <ProfileAvatar uri={liker.photoURL} size={40} />
                  <View style={styles.rowInfo}>
                    <View style={styles.nameLine}>
                      <Text style={styles.name} numberOfLines={1}>{liker.name}</Text>
                      {liker.isPremium ? <Ionicons name="diamond" size={12} color={colors.gold} /> : null}
                    </View>
                    <Text style={styles.username} numberOfLines={1}>@{liker.username}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.58)",
      justifyContent: "center",
      padding: 20
    },
    panel: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      maxHeight: "72%",
      overflow: "hidden"
    },
    header: {
      minHeight: 48,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 14,
      paddingTop: 12,
      paddingBottom: 8,
      borderBottomWidth: 1,
      borderBottomColor: colors.line
    },
    title: {
      color: colors.ivory,
      fontSize: 16,
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
    loadingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 8,
      padding: 18
    },
    loadingText: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "700"
    },
    empty: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "700",
      textAlign: "center",
      padding: 18
    },
    list: {
      maxHeight: 360
    },
    listContent: {
      padding: 8,
      gap: 6
    },
    row: {
      minHeight: 54,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panelSoft,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 10,
      paddingVertical: 8
    },
    rowInfo: {
      flex: 1,
      minWidth: 0
    },
    nameLine: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5
    },
    name: {
      color: colors.ivory,
      fontSize: 13,
      fontWeight: "900",
      flexShrink: 1
    },
    username: {
      color: colors.gold,
      fontSize: 11,
      fontWeight: "800",
      marginTop: 2
    }
  });
}
