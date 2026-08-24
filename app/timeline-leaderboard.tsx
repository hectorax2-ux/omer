import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { AuthRequired } from "@/components/auth-required";
import { timelineGameCopy, timelineMinimumDaysText } from "@/app/i18n/timeline-game";
import { getThemeColors } from "@/constants/theme";
import { isTimelineGameType, type TimelineGameType } from "@/firebase/shared/timeline-game";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import {
  fetchTimelineLeaderboard,
  peekTimelineLeaderboard,
  type TimelineLeaderboardPage,
  type TimelineLeaderboardPeriod,
  type TimelineLeaderboardRow
} from "@/src/services/firebase/timeline-game-service";

export default function TimelineLeaderboardScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const gameType: TimelineGameType = isTimelineGameType(params.type) ? params.type : "artwork";
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const { isAuthenticated, account } = useAccount();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [period, setPeriod] = useState<TimelineLeaderboardPeriod>("daily");
  const [page, setPage] = useState<TimelineLeaderboardPage | null>(() => peekTimelineLeaderboard(gameType, "daily"));
  const [loading, setLoading] = useState(() => !peekTimelineLeaderboard(gameType, "daily"));
  const [error, setError] = useState(false);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const title = gameType === "artwork" ? timelineGameCopy.artworkTitle[language] : timelineGameCopy.artistTitle[language];

  useEffect(() => {
    if (!isAuthenticated) return;
    let mounted = true;
    const cached = peekTimelineLeaderboard(gameType, period);
    setPage(cached);
    setLoading(!cached);
    setError(false);
    fetchTimelineLeaderboard(gameType, period, null, refreshCounter > 0)
      .then((next) => {
        if (mounted) setPage(next);
      })
      .catch(() => {
        if (mounted) setError(true);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [gameType, isAuthenticated, period, refreshCounter]);

  if (!isAuthenticated) return <AuthRequired title={timelineGameCopy.leaderboard[language]} />;

  async function loadMore() {
    if (!page?.nextCursor || loading) return;
    setLoading(true);
    try {
      const next = await fetchTimelineLeaderboard(gameType, period, page.nextCursor);
      setPage({ ...next, rows: [...page.rows, ...next.rows] });
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppChrome title={timelineGameCopy.leaderboard[language]} eyebrow={title} showBackButton>
      <View style={styles.gameSwitch}>
        {(["artwork", "artist"] as TimelineGameType[]).map((type) => (
          <Pressable key={type} onPress={() => router.replace({ pathname: "/timeline-leaderboard", params: { type } })} style={[styles.gameTab, gameType === type && styles.gameTabActive]}>
            <Ionicons name={type === "artwork" ? "images-outline" : "people-outline"} size={17} color={gameType === type ? colors.ink : colors.gold} />
            <Text style={[styles.gameTabText, gameType === type && styles.gameTabTextActive]} numberOfLines={1} adjustsFontSizeToFit>
              {(type === "artwork" ? timelineGameCopy.artworkTitle : timelineGameCopy.artistTitle)[language]}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.periodTabs}>
        {([
          ["daily", timelineGameCopy.daily[language]],
          ["monthly", timelineGameCopy.monthly[language]],
          ["general", timelineGameCopy.monthlyGeneral[language]]
        ] as [TimelineLeaderboardPeriod, string][]).map(([key, label]) => (
          <Pressable key={key} onPress={() => setPeriod(key)} style={[styles.periodTab, period === key && styles.periodTabActive]}>
            <Text style={[styles.periodText, period === key && styles.periodTextActive]} numberOfLines={2} adjustsFontSizeToFit>{label}</Text>
          </Pressable>
        ))}
      </View>
      {period === "general" ? <Text style={styles.info}>{timelineGameCopy.monthlyGeneralInfo[language]}</Text> : null}
      <Pressable onPress={() => router.push({ pathname: "/timeline-history", params: { type: gameType } })} style={styles.historyButton}>
        <Ionicons name="time-outline" size={18} color={colors.gold} />
        <Text style={styles.historyText}>{timelineGameCopy.history[language]}</Text>
      </Pressable>

      {page?.ownRank ? (
        "eligible" in page.ownRank && page.ownRank.eligible === false ? (
          <View style={styles.ownCard}>
            <Text style={styles.ownTitle}>{timelineGameCopy.yourRank[language]}</Text>
            <Text style={styles.info}>{timelineMinimumDaysText(language, page.ownRank.requiredDays ?? page.minimumDays)}</Text>
            <Text style={styles.ownScore}>{page.ownRank.activeDays ?? 0} / {page.ownRank.requiredDays ?? page.minimumDays}</Text>
          </View>
        ) : (
          <View style={styles.ownCard}>
            <Text style={styles.ownTitle}>{timelineGameCopy.yourRank[language]}</Text>
            <LeaderboardRow row={page.ownRank as TimelineLeaderboardRow} own styles={styles} colors={colors} language={language} onPress={() => undefined} />
          </View>
        )
      ) : null}

      {loading && !page ? <Text style={styles.info}>{timelineGameCopy.preparing[language]}</Text> : null}
      {error ? (
        <View style={styles.errorWrap}>
          <Text style={styles.error}>{timelineGameCopy.networkError[language]}</Text>
          <Pressable onPress={() => setRefreshCounter((value) => value + 1)} style={styles.retry}>
            <Text style={styles.retryText}>{timelineGameCopy.retry[language]}</Text>
          </Pressable>
        </View>
      ) : null}
      {page && !page.rows.length && !loading ? <Text style={styles.info}>{timelineGameCopy.noRank[language]}</Text> : null}
      <View style={styles.rows}>
        {page?.rows.map((row) => (
          <LeaderboardRow
            key={row.id}
            row={row}
            own={row.uid === account.uid}
            styles={styles}
            colors={colors}
            language={language}
            onPress={() => row.username && router.push({ pathname: "/profile/[name]", params: { name: row.username } })}
          />
        ))}
      </View>
      {page?.nextCursor ? (
        <Pressable disabled={loading} onPress={loadMore} style={[styles.loadMore, loading && styles.disabled]}>
          <Text style={styles.loadMoreText}>{timelineGameCopy.loadMore[language]}</Text>
        </Pressable>
      ) : null}
    </AppChrome>
  );
}

function LeaderboardRow({ row, own, onPress, styles, colors, language }: { row: TimelineLeaderboardRow; own: boolean; onPress: () => void; styles: ReturnType<typeof createStyles>; colors: ReturnType<typeof getThemeColors>; language: "tr" | "en" | "ru" | "uz" }) {
  return (
    <Pressable onPress={onPress} style={[styles.row, own && styles.rowOwn]}>
      <Text style={styles.rank}>#{row.rank}</Text>
      {row.photoURL ? <Image source={{ uri: row.photoURL }} style={styles.avatar} contentFit="cover" cachePolicy="memory-disk" /> : <View style={styles.avatarPlaceholder}><Ionicons name="person" size={20} color={colors.gold} /></View>}
      <View style={styles.identity}>
        <Text style={styles.name} numberOfLines={1}>{row.displayName || row.username}</Text>
        <Text style={styles.username} numberOfLines={1}>@{row.username}</Text>
      </View>
      <View style={styles.scoreWrap}>
        <Text style={styles.score}>{formatScore(row.score)}</Text>
        {row.elapsedSeconds !== null ? <Text style={styles.meta}>{row.elapsedSeconds}s</Text> : row.activeDays !== null ? <Text style={styles.meta}>{row.activeDays} {timelineGameCopy.dayUnit[language]}</Text> : null}
      </View>
    </Pressable>
  );
}

function formatScore(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    gameSwitch: { flexDirection: "row", gap: 8 },
    gameTab: { flex: 1, minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 8 },
    gameTabActive: { backgroundColor: colors.gold },
    gameTabText: { color: colors.ivory, fontSize: 12, fontWeight: "900", textAlign: "center" },
    gameTabTextActive: { color: colors.ink },
    periodTabs: { flexDirection: "row", gap: 6, marginTop: 10 },
    periodTab: { flex: 1, minHeight: 46, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center", paddingHorizontal: 5 },
    periodTabActive: { backgroundColor: colors.gold },
    periodText: { color: colors.ivory, fontSize: 11, fontWeight: "900", textAlign: "center" },
    periodTextActive: { color: colors.ink },
    info: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: "700", textAlign: "center", marginTop: 10 },
    errorWrap: { backgroundColor: colors.wine, borderRadius: 9, padding: 10, alignItems: "center", gap: 9, marginTop: 10 },
    error: { color: colors.ivory, textAlign: "center", fontWeight: "800" },
    retry: { minHeight: 38, borderRadius: 9, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
    retryText: { color: colors.ink, fontWeight: "900" },
    historyButton: { alignSelf: "center", minHeight: 40, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 14, marginTop: 10 },
    historyText: { color: colors.ivory, fontWeight: "900" },
    ownCard: { borderRadius: 11, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.panelSoft, padding: 10, marginTop: 12 },
    ownTitle: { color: colors.gold, fontSize: 13, fontWeight: "900", textAlign: "center", marginBottom: 6 },
    ownScore: { color: colors.gold, fontSize: 20, fontWeight: "900", textAlign: "center", marginTop: 5 },
    rows: { gap: 7, marginTop: 12 },
    row: { minHeight: 68, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 9, padding: 9 },
    rowOwn: { borderColor: colors.gold, backgroundColor: colors.panelSoft },
    rank: { width: 42, color: colors.gold, fontSize: 15, fontWeight: "900", textAlign: "center" },
    avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panelSoft },
    avatarPlaceholder: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.panelSoft, alignItems: "center", justifyContent: "center" },
    identity: { flex: 1, minWidth: 0 },
    name: { color: colors.ivory, fontSize: 14, fontWeight: "900" },
    username: { color: colors.muted, fontSize: 11, fontWeight: "700", marginTop: 2 },
    scoreWrap: { alignItems: "flex-end" },
    score: { color: colors.gold, fontSize: 16, fontWeight: "900" },
    meta: { color: colors.muted, fontSize: 10, fontWeight: "700", marginTop: 2 },
    loadMore: { minHeight: 46, borderRadius: 10, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", marginTop: 12 },
    loadMoreText: { color: colors.ink, fontWeight: "900" },
    disabled: { opacity: 0.45 }
  });
}
