import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { UserNameWithCountry } from "@/components/user-name-with-country";
import { ImagePreviewModal } from "@/components/image-preview-modal";
import { getThemeColors } from "@/constants/theme";
import { copy } from "@/data/content";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { useCountryCodeLookup } from "@/hooks/use-country-code-lookup";
import { useRegisterRefresh } from "@/providers/refresh-provider";
import {
  getArchiveDateCaption,
  getPublicArchiveWinners,
  subscribePublishedWeeklyArchives,
  type CompetitionArchiveRecord
} from "@/src/services/firebase/competition-archive-service";
import type { CompetitionArchiveWinner } from "../firebase/shared/competition-week";

const labels = {
  selectWeek: {
    tr: "Haftayı seç",
    en: "Select a week",
    ru: "Выберите неделю",
    uz: "Haftani tanlang"
  },
  winners: {
    tr: "Kazananlar",
    en: "Winners",
    ru: "Победители",
    uz: "G'oliblar"
  },
  back: {
    tr: "Haftalara dön",
    en: "Back to weeks",
    ru: "Назад к неделям",
    uz: "Haftalarga qaytish"
  },
  votes: {
    tr: "Oy",
    en: "Votes",
    ru: "Голоса",
    uz: "Ovoz"
  },
  netScore: {
    tr: "Net skor",
    en: "Net score",
    ru: "Чистый счёт",
    uz: "Sof ball"
  },
  rankFirst: {
    tr: "Haftanın birincisi",
    en: "Weekly winner",
    ru: "Победитель недели",
    uz: "Hafta g'olibi"
  },
  rankSecond: {
    tr: "Haftanın ikincisi",
    en: "2nd place",
    ru: "2-е место",
    uz: "2-o'rin"
  },
  rankThird: {
    tr: "Haftanın üçüncüsü",
    en: "3rd place",
    ru: "3-е место",
    uz: "3-o'rin"
  },
  loadError: {
    tr: "Arşiv yüklenemedi. Lütfen tekrar deneyin.",
    en: "Could not load archives. Please try again.",
    ru: "Не удалось загрузить архив. Попробуйте снова.",
    uz: "Arxiv yuklanmadi. Qayta urinib ko'ring."
  },
  empty: {
    tr: "Henüz arşivlenmiş haftalık kazanan yok.",
    en: "No archived weekly winners yet.",
    ru: "Архивных победителей недели пока нет.",
    uz: "Hali arxivlangan haftalik g'oliblar yo'q."
  }
};

export default function WeeklyWinnersScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const lookupUserCountry = useCountryCodeLookup();
  const { width } = useWindowDimensions();
  const [archives, setArchives] = useState<CompetitionArchiveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedWeekId, setSelectedWeekId] = useState<string | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  useRegisterRefresh(() => setRefreshCounter((value) => value + 1));
  const selectedWeek = useMemo(
    () => archives.find((week) => week.id === selectedWeekId) ?? null,
    [archives, selectedWeekId]
  );
  const selectedWinners = useMemo(
    () => (selectedWeek ? getPublicArchiveWinners(selectedWeek) : []),
    [selectedWeek]
  );
  const imageHeight = Math.min(230, Math.max(168, width * 0.5));

  useEffect(() => {
    setLoading(true);
    setLoadError(false);
    const unsubscribe = subscribePublishedWeeklyArchives(
      (items) => {
        setArchives(items);
        setLoading(false);
      },
      (error) => {
        console.warn("[weekly-winners] archive subscription failed", error);
        setArchives([]);
        setLoadError(true);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, [refreshCounter]);

  function openProfile(winner: CompetitionArchiveWinner) {
    const profileKey = (winner.username || winner.artistName || winner.winnerName || "").trim();
    if (!profileKey) return;
    router.push(`/profile/${encodeURIComponent(profileKey)}`);
  }

  function rankLabel(rank: number) {
    if (rank === 1) return labels.rankFirst[language];
    if (rank === 2) return labels.rankSecond[language];
    if (rank === 3) return labels.rankThird[language];
    return `#${rank}`;
  }

  return (
    <AppChrome title={copy.previousWinners[language]} eyebrow="Archive">
      <Pressable onPress={() => router.back()} style={styles.backTop}>
        <Ionicons name="arrow-back" size={18} color={colors.gold} />
        <Text style={styles.backTopText}>{copy.communityArt[language]}</Text>
      </Pressable>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : selectedWeek ? (
        <View style={styles.stack}>
          <Pressable onPress={() => setSelectedWeekId(null)} style={styles.weekBack}>
            <Ionicons name="calendar-outline" size={18} color={colors.gold} />
            <Text style={styles.weekBackText}>{labels.back[language]}</Text>
          </Pressable>

          <View style={styles.sectionHeader}>
            <Text style={styles.dateCaption}>{getArchiveDateCaption(selectedWeek, language)}</Text>
            <Text style={styles.sectionTitle}>{selectedWeek.seasonWeekLabel[language]}</Text>
            <Text style={styles.sectionMeta}>{labels.winners[language]}</Text>
          </View>

          {selectedWinners.map((item) => {
            const rank = item.rank ?? 0;
            const superLikes = item.superLikes ?? 0;
            const netScore = item.score ?? item.likes + superLikes - item.dislikes;
            const username = item.username ? `@${item.username.replace(/^@/, "")}` : "";
            return (
              <View key={item.id} style={[styles.winnerCard, rankFrameStyle(rank, colors)]}>
                <Pressable onPress={() => setPreviewImage(item.image)}>
                  <Image source={{ uri: item.image }} style={[styles.winnerImage, { height: imageHeight }]} contentFit="cover" />
                </Pressable>
                <View style={styles.winnerBody}>
                  <View style={[styles.rankBadge, rank === 1 ? styles.rankBadgeFirst : null]}>
                    <Ionicons name="trophy" size={16} color={colors.ink} />
                    <Text style={styles.rankText}>{rank}</Text>
                  </View>
                  <View style={styles.winnerInfo}>
                    <Text style={styles.rankLabel}>{rankLabel(rank)}</Text>
                    {item.title ? <Text style={styles.artworkTitle}>{item.title}</Text> : null}
                    <Pressable onPress={() => openProfile(item)}>
                      <UserNameWithCountry
                        name={item.artistName || item.winnerName || ""}
                        username={item.username?.replace(/^@/, "")}
                        countryCode={lookupUserCountry([item.username?.replace(/^@/, ""), item.artistName, item.winnerName])}
                        nameStyle={styles.winnerName}
                      />
                      {username ? <Text style={styles.username}>{username}</Text> : null}
                    </Pressable>
                    {item.story ? (
                      <Text style={styles.winnerStory} numberOfLines={2}>
                        {item.story}
                      </Text>
                    ) : null}
                    <View style={styles.scoreRow}>
                      <Text style={styles.scoreText}>
                        {labels.netScore[language]}: {netScore}
                      </Text>
                      <Text style={styles.voteText}>
                        {labels.votes[language]}: +{item.likes} · ★{superLikes} / -{item.dislikes}
                      </Text>
                    </View>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      ) : (
        <View style={styles.stack}>
          <Text style={styles.helper}>{labels.selectWeek[language]}</Text>
          {archives.map((week) => {
            const winnerCount = getPublicArchiveWinners(week).length;
            return (
              <Pressable key={week.id} onPress={() => setSelectedWeekId(week.id)} style={styles.weekRow}>
                <View style={styles.weekNumber}>
                  <Text style={styles.weekNumberText}>{week.weekNumber}</Text>
                </View>
                <View style={styles.weekInfo}>
                  <Text style={styles.weekTitle}>{week.seasonWeekLabel[language]}</Text>
                  <Text style={styles.weekMeta}>
                    {winnerCount} {labels.winners[language].toLowerCase()}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            );
          })}
          {!archives.length ? (
            <View style={styles.emptyBox}>
              <Ionicons name="trophy-outline" size={28} color={colors.gold} />
              <Text style={styles.empty}>{loadError ? labels.loadError[language] : labels.empty[language]}</Text>
            </View>
          ) : null}
        </View>
      )}

      <ImagePreviewModal image={previewImage} onClose={() => setPreviewImage(null)} />
    </AppChrome>
  );
}

function rankFrameStyle(rank: number, colors: ReturnType<typeof getThemeColors>) {
  if (rank === 1) return { borderColor: "#f0c95a", borderWidth: 2 };
  if (rank === 2) return { borderColor: "#c8c9cf", borderWidth: 2 };
  if (rank === 3) return { borderColor: "#b97945", borderWidth: 2 };
  return { borderColor: "rgba(184, 126, 58, 0.55)" };
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    backTop: {
      alignSelf: "flex-start",
      minHeight: 38,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12,
      marginBottom: 14
    },
    backTopText: {
      color: colors.ivory,
      fontWeight: "900"
    },
    stack: {
      gap: 12
    },
    loadingBox: {
      minHeight: 120,
      alignItems: "center",
      justifyContent: "center"
    },
    helper: {
      color: colors.muted,
      fontSize: 14,
      fontWeight: "800"
    },
    weekRow: {
      minHeight: 72,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.25)",
      backgroundColor: colors.panel,
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      padding: 12
    },
    weekNumber: {
      width: 44,
      height: 44,
      borderRadius: 8,
      backgroundColor: "rgba(217, 184, 101, 0.14)",
      alignItems: "center",
      justifyContent: "center"
    },
    weekNumberText: {
      color: colors.gold,
      fontSize: 18,
      fontWeight: "900"
    },
    weekInfo: {
      flex: 1
    },
    weekTitle: {
      color: colors.ivory,
      fontSize: 17,
      fontWeight: "900"
    },
    weekSubtitle: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "700",
      marginTop: 2
    },
    weekMeta: {
      color: colors.gold,
      fontSize: 12,
      fontWeight: "800",
      marginTop: 4
    },
    weekBack: {
      minHeight: 44,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      paddingHorizontal: 12
    },
    weekBackText: {
      color: colors.ivory,
      fontWeight: "900"
    },
    sectionHeader: {
      gap: 3
    },
    dateCaption: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: "700"
    },
    sectionTitle: {
      color: colors.ivory,
      fontSize: 22,
      fontWeight: "900"
    },
    sectionMeta: {
      color: colors.gold,
      fontSize: 12,
      fontWeight: "900",
      textTransform: "uppercase"
    },
    winnerCard: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      overflow: "hidden"
    },
    winnerImage: {
      width: "100%"
    },
    winnerBody: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      padding: 12
    },
    rankBadge: {
      minWidth: 46,
      height: 36,
      borderRadius: 8,
      backgroundColor: colors.gold,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 4,
      paddingHorizontal: 8
    },
    rankBadgeFirst: {
      backgroundColor: "#e8c96a"
    },
    rankText: {
      color: colors.ink,
      fontWeight: "900"
    },
    winnerInfo: {
      flex: 1,
      gap: 2
    },
    rankLabel: {
      color: colors.gold,
      fontSize: 11,
      fontWeight: "900",
      textTransform: "uppercase"
    },
    artworkTitle: {
      color: colors.ivory,
      fontSize: 15,
      fontWeight: "800"
    },
    winnerName: {
      color: colors.ivory,
      fontSize: 17,
      fontWeight: "900",
      marginTop: 2
    },
    username: {
      color: colors.muted,
      fontSize: 13,
      fontWeight: "700",
      marginTop: 2
    },
    winnerStory: {
      color: colors.muted,
      lineHeight: 20,
      marginTop: 4
    },
    scoreRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 10,
      marginTop: 8
    },
    scoreText: {
      color: colors.gold,
      fontWeight: "900"
    },
    voteText: {
      color: colors.muted,
      fontWeight: "800",
      fontSize: 12
    },
    emptyBox: {
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      alignItems: "center",
      gap: 8,
      padding: 18
    },
    empty: {
      color: colors.muted,
      fontWeight: "900",
      textAlign: "center"
    }
  });
}
