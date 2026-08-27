import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { AuthRequired } from "@/components/auth-required";
import { ImagePreviewModal } from "@/components/image-preview-modal";
import { UserNameWithCountry } from "@/components/user-name-with-country";
import { getThemeColors } from "@/constants/theme";
import { useArtSystems } from "@/hooks/use-art-systems";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useCommunityArt } from "@/hooks/use-community-art";
import { useLanguage } from "@/hooks/use-language";
import { useRouteFirstRouter } from "@/hooks/use-route-first-router";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { useAccount } from "@/hooks/use-account";
import { useCountryCodeLookup } from "@/hooks/use-country-code-lookup";
import { commonCopy } from "@/app/i18n/common";
import {
  getPublicArchiveWinners,
  subscribePublishedWeeklyArchives,
  type CompetitionArchiveRecord
} from "@/src/services/firebase/competition-archive-service";
import {
  buildChanceOverrideMap,
  buildHiddenChanceKeys,
  buildJigsawLeaderboardRows,
  buildLuckLeaderboardRows,
  buildProphecyLeaderboardRows,
  luckRankingAverageNote,
  normalizeChanceDrawFromApp,
  type GamePeriod
} from "../firebase/shared/rankings";
import { listJigsawAttempts, type JigsawAttemptRecord } from "@/src/services/firebase/jigsaw-attempt-service";
import { getCompetitionSettings, resolveActiveWeekId } from "@/src/services/firebase/competition-week-service";
import { listQuizLeaderboard } from "@/src/services/firebase/quiz-week-service";
import { listAdminRankingKeys } from "@/src/services/firebase/user-service";
import { t } from "@/utils/localized-text";

type BoardType = "weekly" | "quiz" | "games" | "prophecy" | "chance";
type PeriodType = "month" | "threeMonth" | "all";
type ChancePeriodType = "today" | "week" | "month" | "threeMonth";
type GamePeriodType = GamePeriod;
type WeeklyView = null | "live" | string;
const PAGE_SIZE = 20;
const MAX_ROWS = 200;

const labels = {
  title: { tr: "Sıralamalar", en: "Leaderboards", ru: "Рейтинги", uz: "Reytinglar" },
  eyebrow: { tr: "Aktif listeler", en: "Active lists", ru: "Активные списки", uz: "Faol ro'yxatlar" },
  intro: {
    tr: "Aktif yarışma ve oyun sıralamalarını buradan seçerek görebilirsin.",
    en: "Choose active challenge and game leaderboards here.",
    ru: "Выберите активные рейтинги конкурсов и игр.",
    uz: "Faol tanlov va o'yin reytinglarini shu yerdan tanlang."
  },
  selectWeek: {
    tr: "Haftayı seç",
    en: "Select a week",
    ru: "Выберите неделю",
    uz: "Haftani tanlang"
  },
  winners: {
    tr: "kazanan",
    en: "winners",
    ru: "победителей",
    uz: "g'olib"
  },
  backToWeeks: {
    tr: "Haftalara dön",
    en: "Back to weeks",
    ru: "Назад к неделям",
    uz: "Haftalarga qaytish"
  },
  activeWeek: {
    tr: "Aktif hafta",
    en: "Active week",
    ru: "Текущая неделя",
    uz: "Faol hafta"
  },
  activeWeekMeta: {
    tr: "Devam eden yarışmanın canlı sıralaması",
    en: "Live ranking for the current contest",
    ru: "Текущий рейтинг конкурса",
    uz: "Davom etayotgan tanlovning jonli reytingi"
  },
  archiveEmpty: {
    tr: "Henüz arşivlenmiş haftalık kazanan yok.",
    en: "No archived weekly winners yet.",
    ru: "Архивных победителей недели пока нет.",
    uz: "Hali arxivlangan haftalik g'oliblar yo'q."
  },
  jigsawBoard: { tr: "Sanat Dedektifi", en: "Art Detective", ru: "Арт-детектив", uz: "San'at detektivi" },
  rewards: { tr: "Ödüller", en: "Awards", ru: "Награды", uz: "Mukofotlar" },
  prestige: { tr: "Sanat bilgisinin zirvesi", en: "The summit of art knowledge", ru: "Вершина знаний об искусстве", uz: "San'at bilimining cho'qqisi" },
  hallOfFame: { tr: "Şöhret Salonu", en: "Hall of Fame", ru: "Зал славы", uz: "Shon-sharaf zali" },
  timeGallery: { tr: "Zaman Galerisi", en: "Time Gallery", ru: "Галерея времени", uz: "Vaqt galereyasi" },
  latest: { tr: "GÜNCEL", en: "LATEST", ru: "СЕЙЧАС", uz: "HOZIR" }
};

const boardOptions: { id: BoardType; icon: keyof typeof Ionicons.glyphMap; title: Record<"tr" | "en" | "ru" | "uz", string> }[] = [
  { id: "weekly", icon: "color-palette-outline", title: { tr: "Resim Yarışması", en: "Painting Contest", ru: "Конкурс рисунков", uz: "Rasm tanlovi" } },
  { id: "quiz", icon: "school-outline", title: { tr: "Haftalık Quiz", en: "Weekly Quiz", ru: "Недельный квиз", uz: "Haftalik quiz" } },
  { id: "games", icon: "game-controller-outline", title: { tr: "Oyunlar", en: "Games", ru: "Игры", uz: "O'yinlar" } },
  { id: "prophecy", icon: "sparkles-outline", title: { tr: "Kahinler", en: "Seers", ru: "Провидцы", uz: "Kohinlar" } },
  { id: "chance", icon: "gift-outline", title: { tr: "Şanslılar", en: "Luck", ru: "Удача", uz: "Omad" } }
];

export default function LeaderboardsScreen() {
  const { isAuthenticated } = useAccount();
  const { language } = useLanguage();
  if (!isAuthenticated) return <AuthRequired title={labels.title[language]} />;
  return <AuthenticatedLeaderboardsScreen />;
}

function AuthenticatedLeaderboardsScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const router = useRouteFirstRouter();
  const params = useLocalSearchParams<{ board?: string }>();
  const colors = getThemeColors(theme);
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(colors, width), [colors, width]);
  const contentTransition = useRef(new Animated.Value(1)).current;
  const { chanceDraws, prophecyScores, rankingOverrides } = useArtSystems();
  const { getRankedCompetitionItems } = useCommunityArt();
  const [board, setBoard] = useState<BoardType>(() => isBoardType(params.board) ? params.board : "weekly");
  const [period, setPeriod] = useState<PeriodType>("month");
  const [chancePeriod, setChancePeriod] = useState<ChancePeriodType>("today");
  const [gamePeriod, setGamePeriod] = useState<GamePeriodType>("today");
  const [jigsawAttempts, setJigsawAttempts] = useState<JigsawAttemptRecord[]>([]);
  const [jigsawLoading, setJigsawLoading] = useState(false);
  const [quizRows, setQuizRows] = useState<{ name: string; meta: string; score: number; username?: string }[]>([]);
  const [quizLoading, setQuizLoading] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [weeklyView, setWeeklyView] = useState<WeeklyView>(null);
  const [archives, setArchives] = useState<CompetitionArchiveRecord[]>([]);
  const [archivesLoading, setArchivesLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [adminRankingKeys, setAdminRankingKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let active = true;
    listAdminRankingKeys().then((keys) => {
      if (active) setAdminRankingKeys(keys);
    }).catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setArchivesLoading(true);
    const unsubscribe = subscribePublishedWeeklyArchives(
      (items) => {
        setArchives(items);
        setArchivesLoading(false);
      },
      () => {
        setArchives([]);
        setArchivesLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  useEffect(() => {
    let active = true;
    if (board !== "games") return () => {
      active = false;
    };
    setJigsawLoading(true);
    listJigsawAttempts(500)
      .then((items) => {
        if (active) setJigsawAttempts(items);
      })
      .catch(() => {
        if (active) setJigsawAttempts([]);
      })
      .finally(() => {
        if (active) setJigsawLoading(false);
      });
    return () => {
      active = false;
    };
  }, [board]);

  useEffect(() => {
    let active = true;
    if (board !== "quiz") return () => {
      active = false;
    };
    setQuizLoading(true);
    getCompetitionSettings()
      .then((settings) => listQuizLeaderboard(resolveActiveWeekId(settings ?? undefined), MAX_ROWS))
      .then((items) => {
        if (!active) return;
        setQuizRows(items.map((item) => ({
          name: item.name,
          username: item.username,
          meta: item.username ? `@${item.username.replace(/^@/, "")}` : "",
          score: item.score
        })));
      })
      .catch(() => {
        if (active) setQuizRows([]);
      })
      .finally(() => {
        if (active) setQuizLoading(false);
      });
    return () => {
      active = false;
    };
  }, [board]);

  const selectedArchive = useMemo(
    () => (typeof weeklyView === "string" && weeklyView !== "live" ? archives.find((week) => week.id === weeklyView) ?? null : null),
    [archives, weeklyView]
  );

  const weeklyLiveRows = useMemo(
    () => getRankedCompetitionItems("all", "liked")
      .slice(0, MAX_ROWS)
      .map((item) => ({
        name: item.artistName,
        meta: item.title,
        score: item.likes + (item.superLikes ?? 0) - item.dislikes
      })),
    [getRankedCompetitionItems]
  );

  const archiveWinnerRows = useMemo(() => {
    if (!selectedArchive) return [];
    return getPublicArchiveWinners(selectedArchive).map((winner) => ({
      id: winner.id,
      image: winner.image,
      title: winner.title,
      story: winner.story,
      rank: winner.rank,
      name: winner.artistName || winner.winnerName || winner.title,
      username: (winner.username || "").replace(/^@/, ""),
      meta: winner.title ? `${winner.title} · @${(winner.username || "").replace(/^@/, "")}` : `@${(winner.username || "").replace(/^@/, "")}`,
      likes: winner.likes,
      dislikes: winner.dislikes,
      superLikes: winner.superLikes ?? 0,
      score: winner.score ?? winner.likes + (winner.superLikes ?? 0) - winner.dislikes,
      profileKey: (winner.username || winner.artistName || winner.winnerName || "").replace(/^@/, "")
    }));
  }, [selectedArchive]);

  const rows = useMemo(
    () => buildRows(board, prophecyScores, period, chanceDraws, chancePeriod, weeklyLiveRows, rankingOverrides, jigsawAttempts, gamePeriod, quizRows, adminRankingKeys),
    [adminRankingKeys, board, chanceDraws, chancePeriod, gamePeriod, jigsawAttempts, period, prophecyScores, quizRows, rankingOverrides, weeklyLiveRows]
  );
  const visibleRows = rows.slice(0, visibleCount);
  const extraCountryIdentities = useMemo(
    () => [
      ...chanceDraws.map((draw) => ({
        uid: draw.uid,
        username: draw.username,
        name: draw.displayName
      })),
      ...jigsawAttempts.map((attempt) => ({
        uid: attempt.uid,
        username: attempt.username,
        name: attempt.displayName
      }))
    ],
    [chanceDraws, jigsawAttempts]
  );
  const lookupUserCountry = useCountryCodeLookup(extraCountryIdentities);

  function rowCountryCode(item: { name: string; username?: string; profileKey?: string; countryCode?: string; id?: string }) {
    const resolved = lookupUserCountry([item.username, item.profileKey, item.name, item.id]);
    if (resolved) return resolved;
    return item.countryCode;
  }

  function changeBoard(nextBoard: BoardType) {
    setBoard(nextBoard);
    setWeeklyView(null);
    setVisibleCount(PAGE_SIZE);
    if (reducedMotion) {
      contentTransition.setValue(1);
      return;
    }
    contentTransition.setValue(0);
    Animated.timing(contentTransition, { toValue: 1, duration: 190, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }

  function openProfile(name: string) {
    const profileKey = name.trim();
    if (!profileKey) return;
    router.push({ pathname: "/profile/[name]", params: { name: profileKey } });
  }

  return (
    <AppChrome title={labels.title[language]} eyebrow={labels.eyebrow[language]} showBackButton backToHome showFloatingShortcuts={false}>
      <RankingPrestigeHero title={labels.hallOfFame[language]} subtitle={labels.prestige[language]} rows={rows.slice(0, 3)} styles={styles} colors={colors} />
      <View style={styles.filters}>
        {boardOptions.map((option) => (
          <Pressable key={option.id} onPress={() => changeBoard(option.id)} style={[styles.filter, board === option.id && styles.filterActive]}>
            <Ionicons name={option.icon} size={16} color={board === option.id ? colors.gold : colors.muted} />
            <Text style={[styles.filterText, board === option.id && styles.filterTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
              {option.title[language]}
            </Text>
          </Pressable>
        ))}
        <Pressable onPress={() => router.push("/rewards")} style={styles.filter}>
          <Ionicons name="ribbon-outline" size={16} color={colors.gold} />
          <Text style={styles.filterText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {labels.rewards[language]}
          </Text>
        </Pressable>
      </View>
      <Animated.View style={{ opacity: contentTransition, transform: [{ translateX: contentTransition.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] }}>
      {board === "games" ? (
        <View style={styles.gamesHeading}>
          <Text style={styles.gamesHeadingTitle}>{labels.jigsawBoard[language]}</Text>
        </View>
      ) : null}
      {board === "games" ? (
        <View style={styles.periodTabs}>
          {[
            ["today", t(commonCopy.today, language)],
            ["week", t(commonCopy.week, language)],
            ["month", t(commonCopy.month, language)],
            ["threeMonth", t(commonCopy.threeMonths, language)]
          ].map(([key, label]) => (
            <Pressable key={key} onPress={() => { setGamePeriod(key as GamePeriodType); setVisibleCount(PAGE_SIZE); }} style={[styles.periodTab, gamePeriod === key && styles.periodTabActive]}>
              <Text style={[styles.periodText, gamePeriod === key && styles.periodTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {board === "prophecy" ? (
        <View style={styles.periodTabs}>
          {[
            ["month", t(commonCopy.oneMonth, language)],
            ["threeMonth", t(commonCopy.threeMonths, language)],
            ["all", t(commonCopy.allTime, language)]
          ].map(([key, label]) => (
            <Pressable key={key} onPress={() => { setPeriod(key as PeriodType); setVisibleCount(PAGE_SIZE); }} style={[styles.periodTab, period === key && styles.periodTabActive]}>
              <Text style={[styles.periodText, period === key && styles.periodTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{label}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {board === "chance" ? (
        <>
          <Text style={styles.rankNote}>{luckRankingAverageNote(chancePeriod, language)}</Text>
          <View style={styles.periodTabs}>
            {[
              ["today", t(commonCopy.today, language)],
              ["week", t(commonCopy.week, language)],
              ["month", t(commonCopy.month, language)],
              ["threeMonth", t(commonCopy.threeMonths, language)]
            ].map(([key, label]) => (
              <Pressable key={key} onPress={() => { setChancePeriod(key as ChancePeriodType); setVisibleCount(PAGE_SIZE); }} style={[styles.periodTab, chancePeriod === key && styles.periodTabActive]}>
                <Text style={[styles.periodText, chancePeriod === key && styles.periodTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{label}</Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : null}
      {board === "weekly" && weeklyView !== "live" && !selectedArchive ? (
        <View style={styles.weekSection}>
          <View style={styles.timeGalleryHeading}>
            <Ionicons name="time-outline" size={17} color={colors.gold} />
            <Text style={styles.weekHelper}>{labels.timeGallery[language]}</Text>
          </View>
          {archivesLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator color={colors.gold} />
            </View>
          ) : (
            <>
              {weeklyLiveRows.length ? (
                <Pressable onPress={() => { setWeeklyView("live"); setVisibleCount(PAGE_SIZE); }} style={styles.weekRow} accessibilityRole="button">
                  {archives.length ? <View style={styles.weekConnector} pointerEvents="none" /> : null}
                  <View style={styles.weekNumberLive}>
                    <Ionicons name="pulse" size={18} color={colors.gold} />
                  </View>
                  <View style={styles.weekInfo}>
                    <View style={styles.weekTitleLine}>
                      <Text style={styles.weekTitle}>{labels.activeWeek[language]}</Text>
                      <Text style={styles.latestBadge}>{labels.latest[language]}</Text>
                    </View>
                    <Text style={styles.weekMeta}>{labels.activeWeekMeta[language]} · {weeklyLiveRows.length}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </Pressable>
              ) : null}
              {archives.map((week, index) => {
                const winnerCount = getPublicArchiveWinners(week).length;
                return (
                  <Pressable key={week.id} onPress={() => setWeeklyView(week.id)} style={styles.weekRow}>
                    {index < archives.length - 1 ? <View style={styles.weekConnector} pointerEvents="none" /> : null}
                    <View style={styles.weekNumber}>
                      <Text style={styles.weekNumberText}>{week.weekNumber}</Text>
                    </View>
                    <View style={styles.weekInfo}>
                      <Text style={styles.weekTitle}>{week.seasonWeekLabel[language]}</Text>
                      <Text style={styles.weekMeta}>{winnerCount} {labels.winners[language]}</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                  </Pressable>
                );
              })}
              {!archives.length && !weeklyLiveRows.length ? (
                <View style={styles.emptyState}>
                  <Ionicons name="trophy-outline" size={24} color={colors.gold} />
                  <Text style={styles.emptyText}>{labels.archiveEmpty[language]}</Text>
                </View>
              ) : null}
            </>
          )}
        </View>
      ) : null}
      {board === "weekly" && selectedArchive ? (
        <View style={styles.weekSection}>
          <Pressable onPress={() => setWeeklyView(null)} style={styles.weekBack}>
            <Ionicons name="chevron-back" size={18} color={colors.gold} />
            <Text style={styles.weekBackText}>{labels.backToWeeks[language]}</Text>
          </Pressable>
          <Text style={styles.weekDetailTitle}>{selectedArchive.seasonWeekLabel[language]}</Text>
          <View style={styles.archiveImageList}>
            {archiveWinnerRows.map((item, index) => (
              <View key={item.id || `${item.name}-${index}`} style={[styles.archiveWinnerCard, archiveFrameStyle(index)]}>
                <Pressable onPress={() => setPreviewImage(item.image)} style={styles.archiveImageWrap}>
                  <Image source={{ uri: item.image }} style={styles.archiveWinnerImage} contentFit="cover" />
                  <View style={[styles.archiveRankBadge, archiveRankBadgeStyle(index)]}>
                    <Text style={[styles.archiveRankText, index < 3 && styles.archiveRankTextTop]}>{index + 1}</Text>
                  </View>
                </Pressable>
                <View style={styles.archiveWinnerBody}>
                  <Pressable onPress={() => openProfile(item.profileKey || item.name)} style={styles.archiveProfileLine}>
                    <UserNameWithCountry name={item.name} username={item.profileKey || item.username} countryCode={rowCountryCode(item)} nameStyle={styles.name} />
                    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
                  </Pressable>
                  <Text style={styles.archiveTitle} numberOfLines={2}>{item.title || item.meta}</Text>
                  {item.story ? <Text style={styles.archiveStory} numberOfLines={2}>{item.story}</Text> : null}
                  <View style={styles.archiveScoreLine}>
                    <View style={styles.scorePill}>
                      <Text style={styles.score}>{item.score}</Text>
                    </View>
                    <Text style={styles.meta} numberOfLines={1}>
                      +{item.likes} · ★{item.superLikes} / -{item.dislikes}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
          {!archiveWinnerRows.length ? (
            <View style={styles.emptyState}>
              <Ionicons name="stats-chart-outline" size={24} color={colors.gold} />
              <Text style={styles.emptyText}>{labels.archiveEmpty[language]}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
      {board === "weekly" && weeklyView === "live" ? (
        <View style={styles.weekSection}>
          <Pressable onPress={() => setWeeklyView(null)} style={styles.weekBack}>
            <Ionicons name="chevron-back" size={18} color={colors.gold} />
            <Text style={styles.weekBackText}>{labels.backToWeeks[language]}</Text>
          </Pressable>
          <Text style={styles.weekDetailTitle}>{labels.activeWeek[language]}</Text>
        </View>
      ) : null}
      {board !== "weekly" || weeklyView === "live" ? (
      board === "games" && jigsawLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : board === "quiz" && quizLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={colors.gold} />
        </View>
      ) : (
      <View style={styles.list}>
        {visibleRows.map((item, index) => (
          <Pressable key={`${item.name}-${index}`} onPress={() => openProfile("username" in item && typeof item.username === "string" ? item.username : item.name)} style={styles.row}>
            <View style={[styles.rank, index < 3 && styles.rankTop]}>
              <Text style={[styles.rankText, index < 3 && styles.rankTopText]}>{index + 1}</Text>
            </View>
            <View style={styles.rowTextBlock}>
              <UserNameWithCountry
                name={item.name}
                username={"username" in item && typeof item.username === "string" ? item.username : undefined}
                uid={"id" in item && typeof item.id === "string" ? item.id : undefined}
                countryCode={rowCountryCode({
                  name: item.name,
                  username: "username" in item && typeof item.username === "string" ? item.username : undefined,
                  id: "id" in item && typeof item.id === "string" ? item.id : undefined,
                  countryCode: "countryCode" in item && typeof item.countryCode === "string" ? item.countryCode : undefined
                })}
                nameStyle={styles.name}
              />
              <Text style={styles.meta} numberOfLines={1}>{item.meta}</Text>
            </View>
            <View style={styles.scorePill}>
              <Text style={styles.score}>{item.score}</Text>
            </View>
            <Ionicons name="chevron-forward" size={17} color={colors.muted} />
          </Pressable>
        ))}
      </View>
      )
      ) : null}
      {board !== "weekly" || weeklyView === "live" ? (
      board === "games" && jigsawLoading ? null : board === "quiz" && quizLoading ? null : (
      !visibleRows.length ? (
        <View style={styles.emptyState}>
          <Ionicons name="stats-chart-outline" size={24} color={colors.gold} />
          <Text style={styles.emptyText}>
            {language === "tr"
              ? "Bu sıralama için henüz kayıt yok."
              : language === "ru"
                ? "Для этого рейтинга пока нет записей."
                : language === "uz"
                  ? "Bu reyting uchun hali yozuv yo'q."
                  : "No entries yet for this leaderboard."}
          </Text>
        </View>
      ) : null
      )
      ) : null}
      {board !== "weekly" || weeklyView === "live" ? (
      board === "games" && jigsawLoading ? null : board === "quiz" && quizLoading ? null : (
      visibleCount < rows.length ? (
        <Pressable onPress={() => setVisibleCount((value) => Math.min(MAX_ROWS, value + PAGE_SIZE))} style={styles.moreButton}>
          <Text style={styles.moreText}>{t(commonCopy.showMore, language)}</Text>
        </Pressable>
      ) : null
      )
      ) : null}
      </Animated.View>
      <ImagePreviewModal image={previewImage} onClose={() => setPreviewImage(null)} />
    </AppChrome>
  );
}

function isBoardType(value: string | undefined): value is BoardType {
  return value === "weekly" || value === "quiz" || value === "games" || value === "prophecy" || value === "chance";
}

function buildRows(
  board: BoardType,
  prophecyScores: { displayName: string; username: string; points: number; monthPoints: number; threeMonthPoints: number }[],
  period: PeriodType,
  chanceDraws: { username: string; displayName: string; score: number; drawnAt: string; dayKey?: string; weekKey?: string; monthKey?: string; uid?: string; leaderboardEligible?: boolean }[],
  chancePeriod: ChancePeriodType,
  weeklyRows: { name: string; meta: string; score: number }[],
  rankingOverrides: { id: string; chance?: { rankingStatus?: "active" | "hidden" | "removed"; displayName?: string; username?: string; scoreAdjust?: number } }[] = [],
  jigsawAttempts: JigsawAttemptRecord[] = [],
  gamePeriod: GamePeriodType = "today",
  quizRows: { name: string; meta: string; score: number; username?: string }[] = [],
  adminRankingKeys: Set<string> = new Set()
) {
  if (board === "weekly") {
    return weeklyRows;
  }

  if (board === "quiz") {
    return quizRows;
  }

  if (board === "games") {
    return buildJigsawLeaderboardRows(jigsawAttempts, gamePeriod, { maxRows: MAX_ROWS, hiddenKeys: adminRankingKeys });
  }

  if (board === "prophecy") {
    return buildProphecyLeaderboardRows(
      prophecyScores.filter((item) => !adminRankingKeys.has(item.username.replace(/^@+/, ""))).map((item) => ({
        username: item.username,
        displayName: item.displayName,
        points: item.points,
        monthPoints: item.monthPoints,
        threeMonthPoints: item.threeMonthPoints
      })),
      period,
      MAX_ROWS
    );
  }

  if (board === "chance") {
    const normalizedDraws = chanceDraws
      .map((draw) => normalizeChanceDrawFromApp(draw))
      .filter((draw): draw is NonNullable<typeof draw> => Boolean(draw));
    return buildLuckLeaderboardRows(normalizedDraws, chancePeriod, {
      hiddenKeys: new Set([...buildHiddenChanceKeys(rankingOverrides), ...adminRankingKeys]),
      overrideByKey: buildChanceOverrideMap(rankingOverrides),
      maxRows: MAX_ROWS
    });
  }

  return [];
}

function RankingPrestigeHero({ title, subtitle, rows, styles, colors }: { title: string; subtitle: string; rows: { name: string; score: number }[]; styles: ReturnType<typeof createStyles>; colors: ReturnType<typeof getThemeColors> }) {
  return (
    <LinearGradient colors={["rgba(30,35,83,0.96)", "rgba(51,27,76,0.94)", "rgba(79,39,61,0.9)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.prestigeHero}>
      <View style={styles.halfRing} pointerEvents="none" />
      <View style={styles.prestigeParticleLeft} pointerEvents="none" />
      <View style={styles.prestigeParticleRight} pointerEvents="none" />
      <View style={styles.trophyCore}><Ionicons name="trophy" size={28} color="#FFE59A" /></View>
      <View style={styles.prestigeCopy}>
        <Text style={styles.prestigeEyebrow}>ART ATLAS</Text>
        <Text style={styles.prestigeTitle}>{title}</Text>
        <Text style={styles.prestigeSubtitle}>{subtitle}</Text>
      </View>
      {rows.length ? (
        <View style={styles.previewRanks}>
          {rows.map((row, index) => (
            <View key={`${row.name}-${index}`} style={styles.previewRank}>
              <Text style={styles.previewRankNumber}>{index + 1}</Text>
              <Text style={styles.previewRankName} numberOfLines={1}>{row.name}</Text>
              <Text style={[styles.previewRankScore, { color: colors.gold }]}>{row.score}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </LinearGradient>
  );
}

function archiveFrameStyle(index: number) {
  if (index === 0) return { borderColor: "#f0c95a", borderWidth: 2 };
  if (index === 1) return { borderColor: "#c8c9cf", borderWidth: 2 };
  if (index === 2) return { borderColor: "#b97945", borderWidth: 2 };
  return { borderColor: "rgba(184, 126, 58, 0.55)" };
}

function archiveRankBadgeStyle(index: number) {
  if (index === 0) return { backgroundColor: "#f0c95a" };
  if (index === 1) return { backgroundColor: "#c8c9cf" };
  if (index === 2) return { backgroundColor: "#b97945" };
  return { backgroundColor: "rgba(184, 126, 58, 0.85)" };
}

function createStyles(colors: ReturnType<typeof getThemeColors>, width = 390) {
  return StyleSheet.create({
    intro: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: "800", marginBottom: 10 },
    prestigeHero: { minHeight: width >= 720 ? 188 : 174, borderRadius: 22, borderWidth: 1, borderColor: "rgba(230,206,149,0.26)", overflow: "hidden", padding: 16, justifyContent: "center", marginBottom: 14 },
    halfRing: { position: "absolute", width: 136, height: 136, borderRadius: 68, borderWidth: 1, borderColor: "rgba(240,211,142,0.28)", left: -54, top: 19 },
    prestigeParticleLeft: { position: "absolute", width: 4, height: 4, borderRadius: 2, backgroundColor: "rgba(255,230,160,0.72)", left: "47%", top: 23 },
    prestigeParticleRight: { position: "absolute", width: 3, height: 3, borderRadius: 2, backgroundColor: "rgba(207,178,255,0.72)", right: 29, top: 38 },
    trophyCore: { width: 64, height: 64, borderRadius: 32, borderWidth: 1, borderColor: "rgba(255,227,151,0.52)", backgroundColor: "rgba(92,64,143,0.68)", alignItems: "center", justifyContent: "center" },
    prestigeCopy: { position: "absolute", left: 94, right: 15, top: 20 },
    prestigeEyebrow: { color: "rgba(255,224,149,0.82)", fontSize: 9, letterSpacing: 2.1, fontWeight: "900" },
    prestigeTitle: { color: colors.ivory, fontSize: width < 360 ? 20 : 23, lineHeight: 27, fontWeight: "900", marginTop: 3 },
    prestigeSubtitle: { color: "rgba(245,238,255,0.72)", fontSize: 11, lineHeight: 15, fontWeight: "700", marginTop: 2 },
    previewRanks: { position: "absolute", left: 94, right: 14, bottom: 12, gap: 3 },
    previewRank: { minHeight: 22, borderRadius: 8, backgroundColor: "rgba(7,10,26,0.3)", flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 7 },
    previewRankNumber: { width: 13, color: colors.gold, fontSize: 9, fontWeight: "900" },
    previewRankName: { flex: 1, color: colors.ivory, fontSize: 9, fontWeight: "800" },
    previewRankScore: { fontSize: 9, fontWeight: "900" },
    rankNote: { color: colors.muted, fontSize: 11, lineHeight: 16, fontWeight: "700", marginBottom: 8 },
    filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 2 },
    filter: { width: width >= 720 ? "31.8%" : "48.5%", minHeight: 46, borderRadius: 12, borderWidth: 1, borderColor: colors.line, borderBottomWidth: 2, backgroundColor: "rgba(255,255,255,0.025)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: 8 },
    filterActive: { backgroundColor: "rgba(217,184,101,0.08)", borderColor: "rgba(217,184,101,0.42)", borderBottomColor: colors.gold },
    filterText: { color: colors.ivory, fontSize: 10, fontWeight: "900", textAlign: "center" },
    filterTextActive: { color: colors.gold },
    dropdown: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, overflow: "hidden", marginTop: 10 },
    dropdownHeader: { minHeight: 44, flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 12 },
    dropdownLabel: { color: colors.ivory, fontSize: 13, fontWeight: "900" },
    dropdownList: { borderTopWidth: 1, borderTopColor: colors.line, padding: 7, gap: 6 },
    dropdownItem: { minHeight: 36, borderRadius: 8, justifyContent: "center", paddingHorizontal: 10 },
    dropdownItemActive: { backgroundColor: colors.gold },
    dropdownItemText: { color: colors.ivory, fontSize: 12, fontWeight: "900" },
    dropdownItemTextActive: { color: colors.ink },
    periodTabs: { flexDirection: "row", gap: 7, marginTop: 10 },
    gamesHeading: { marginTop: 10, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, paddingHorizontal: 12, paddingVertical: 10 },
    gamesHeadingTitle: { color: colors.ivory, fontSize: 14, fontWeight: "900", textAlign: "center" },
    periodTab: { flex: 1, minHeight: 34, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center", paddingHorizontal: 6 },
    periodTabActive: { backgroundColor: colors.gold, borderColor: colors.gold },
    periodText: { color: colors.ivory, fontSize: 10, fontWeight: "900" },
    periodTextActive: { color: colors.ink },
    list: { gap: 8, marginTop: 12 },
    archiveImageList: { gap: 12, marginTop: 12 },
    archiveWinnerCard: { borderRadius: 10, borderWidth: 1, backgroundColor: colors.panel, overflow: "hidden" },
    archiveImageWrap: { position: "relative", backgroundColor: colors.panelSoft },
    archiveWinnerImage: { width: "100%", height: 210 },
    archiveRankBadge: { position: "absolute", left: 10, top: 10, width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
    archiveRankText: { color: colors.ivory, fontSize: 14, fontWeight: "900" },
    archiveRankTextTop: { color: colors.ink },
    archiveWinnerBody: { gap: 6, padding: 12 },
    archiveProfileLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
    archiveTitle: { color: colors.ivory, fontSize: 15, fontWeight: "900" },
    archiveStory: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: "700" },
    archiveScoreLine: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 2 },
    row: { minHeight: 58, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 10 },
    rank: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.panelSoft, alignItems: "center", justifyContent: "center" },
    rankTop: { backgroundColor: colors.gold },
    rankText: { color: colors.gold, fontSize: 12, fontWeight: "900" },
    rankTopText: { color: colors.ink },
    rowTextBlock: { flex: 1, minWidth: 0 },
    name: { color: colors.ivory, fontSize: 14, fontWeight: "900" },
    meta: { color: colors.muted, fontSize: 11, fontWeight: "800", marginTop: 2 },
    scorePill: { minWidth: 54, minHeight: 32, borderRadius: 8, backgroundColor: colors.panelSoft, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
    score: { color: colors.gold, fontWeight: "900" },
    moreButton: { minHeight: 44, borderRadius: 8, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", marginTop: 12 },
    moreText: { color: colors.ink, fontSize: 13, fontWeight: "900" },
    emptyState: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: "center", gap: 8, padding: 16, marginTop: 12 },
    emptyText: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: "800", textAlign: "center" },
    weekSection: { gap: 10, marginTop: 12 },
    timeGalleryHeading: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 1 },
    weekHelper: { color: colors.muted, fontSize: 13, fontWeight: "800" },
    loadingBox: { minHeight: 88, alignItems: "center", justifyContent: "center" },
    weekRow: { minHeight: 66, borderRadius: 16, borderWidth: 1, borderColor: "rgba(217, 184, 101, 0.22)", backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, paddingVertical: 9, overflow: "visible" },
    weekConnector: { position: "absolute", left: 33, bottom: -12, width: 1, height: 12, backgroundColor: "rgba(217,184,101,0.42)" },
    weekNumber: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: "rgba(217,184,101,0.34)", backgroundColor: "rgba(217, 184, 101, 0.1)", alignItems: "center", justifyContent: "center" },
    weekNumberLive: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: colors.gold, backgroundColor: "rgba(217, 184, 101, 0.14)", alignItems: "center", justifyContent: "center" },
    weekNumberText: { color: colors.gold, fontSize: 18, fontWeight: "900" },
    weekInfo: { flex: 1, minWidth: 0 },
    weekTitle: { color: colors.ivory, fontSize: 16, fontWeight: "900" },
    weekTitleLine: { flexDirection: "row", alignItems: "center", gap: 7 },
    latestBadge: { color: colors.ink, backgroundColor: colors.gold, borderRadius: 8, overflow: "hidden", paddingHorizontal: 6, paddingVertical: 2, fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
    weekMeta: { color: colors.gold, fontSize: 12, fontWeight: "800", marginTop: 4 },
    weekBack: { alignSelf: "flex-start", minHeight: 38, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12 },
    weekBackText: { color: colors.ivory, fontWeight: "900" },
    weekDetailTitle: { color: colors.ivory, fontSize: 20, fontWeight: "900" }
  });
}
