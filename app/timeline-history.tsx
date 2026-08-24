import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { AuthRequired } from "@/components/auth-required";
import { timelineGameCopy } from "@/app/i18n/timeline-game";
import { getThemeColors } from "@/constants/theme";
import { isTimelineGameType, type TimelineGameType } from "@/firebase/shared/timeline-game";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { fetchTimelineGameHistory, peekTimelineGameHistory, type TimelineHistoryRow } from "@/src/services/firebase/timeline-game-service";

export default function TimelineHistoryScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const gameType: TimelineGameType = isTimelineGameType(params.type) ? params.type : "artwork";
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const { isAuthenticated } = useAccount();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const cachedHistory = peekTimelineGameHistory(gameType);
  const [rows, setRows] = useState<TimelineHistoryRow[]>(cachedHistory?.rows ?? []);
  const [cursorMs, setCursorMs] = useState<number | null>(cachedHistory?.nextCursorMs ?? null);
  const [loading, setLoading] = useState(!cachedHistory);
  const title = gameType === "artwork" ? timelineGameCopy.artworkTitle[language] : timelineGameCopy.artistTitle[language];

  useEffect(() => {
    if (!isAuthenticated) return;
    let mounted = true;
    const cached = peekTimelineGameHistory(gameType);
    if (cached) {
      setRows(cached.rows);
      setCursorMs(cached.nextCursorMs);
      setLoading(false);
    }
    fetchTimelineGameHistory(gameType)
      .then((result) => {
        if (!mounted) return;
        setRows(result.rows);
        setCursorMs(result.nextCursorMs);
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
  }, [gameType, isAuthenticated]);

  if (!isAuthenticated) return <AuthRequired title={timelineGameCopy.history[language]} />;

  async function loadMore() {
    if (!cursorMs || loading) return;
    setLoading(true);
    try {
      const result = await fetchTimelineGameHistory(gameType, cursorMs);
      setRows((current) => [...current, ...result.rows]);
      setCursorMs(result.nextCursorMs);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppChrome title={timelineGameCopy.history[language]} eyebrow={title} showBackButton>
      {!rows.length && !loading ? <Text style={styles.empty}>{timelineGameCopy.noHistory[language]}</Text> : null}
      <View style={styles.list}>
        {rows.map((row) => (
          <View key={row.id} style={styles.row}>
            <Ionicons name={row.direction === "oldest-first" ? "arrow-up" : "arrow-down"} size={20} color={colors.gold} />
            <View style={styles.info}>
              <Text style={styles.score}>{row.score} {timelineGameCopy.score[language]}</Text>
              <Text style={styles.meta}>{row.correctPositions}/10 {timelineGameCopy.correct[language]} · {row.elapsedSeconds}s</Text>
            </View>
            <Text style={styles.date}>{new Date(row.finishedAtMs).toLocaleDateString()}</Text>
          </View>
        ))}
      </View>
      {cursorMs ? <Pressable disabled={loading} onPress={loadMore} style={[styles.button, loading && styles.disabled]}><Text style={styles.buttonText}>{timelineGameCopy.loadMore[language]}</Text></Pressable> : null}
    </AppChrome>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    empty: { color: colors.muted, textAlign: "center", fontWeight: "700", marginTop: 20 },
    list: { gap: 8 },
    row: { minHeight: 70, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 10, padding: 11 },
    info: { flex: 1 },
    score: { color: colors.ivory, fontSize: 15, fontWeight: "900" },
    meta: { color: colors.muted, fontSize: 11, fontWeight: "700", marginTop: 3 },
    date: { color: colors.gold, fontSize: 11, fontWeight: "800" },
    button: { minHeight: 46, borderRadius: 10, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", marginTop: 12 },
    buttonText: { color: colors.ink, fontWeight: "900" },
    disabled: { opacity: 0.45 }
  });
}
