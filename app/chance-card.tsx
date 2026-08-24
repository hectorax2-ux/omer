import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { AuthRequired } from "@/components/auth-required";
import { UserNameWithCountry } from "@/components/user-name-with-country";
import { chanceCardBestKeptCopy, chanceCardCopy } from "@/app/i18n/chance-card";
import { chanceCardMessage } from "@/app/i18n/chance-card-messages";
import { areRewardedAdRequirementsEnabled } from "@/constants/ad-feature-flags";
import { getThemeColors } from "@/constants/theme";
import { useAccount } from "@/hooks/use-account";
import { useAds } from "@/hooks/use-ads";
import { useArtSystems } from "@/hooks/use-art-systems";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useCountryCodeLookup } from "@/hooks/use-country-code-lookup";
import { useLanguage } from "@/hooks/use-language";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { buildLuckLeaderboardRows, countUserTodayChanceDraws, getLocalDayKey, luckRankingAverageNote, millisecondsUntilLocalMidnight, normalizeChanceDrawFromApp } from "../firebase/shared/rankings";
import { listAdminRankingKeys } from "@/src/services/firebase/user-service";
import { tFormat } from "@/utils/localized-text";
import { profileRouteParam } from "@/utils/profile-route";

type ChanceCopy = ReturnType<typeof chanceCardCopy>;
type ThemeColors = ReturnType<typeof getThemeColors>;

export default function ChanceCardScreen() {
  const { isAuthenticated } = useAccount();
  const { language } = useLanguage();
  if (!isAuthenticated) return <AuthRequired title={chanceCardCopy(language).screenTitle} />;
  return <AuthenticatedChanceCardScreen />;
}

function AuthenticatedChanceCardScreen() {
  const { language } = useLanguage();
  const copy = chanceCardCopy(language);
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const reducedMotion = useReducedMotion();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { account } = useAccount();
  const { adsEnabled, showRewardedAd } = useAds();
  const { chanceDraws, chanceDrawsLoaded, drawChanceCard, lastChanceDraw } = useArtSystems();
  const flip = useRef(new Animated.Value(0)).current;
  const ritual = useRef(new Animated.Value(0)).current;
  const [message, setMessage] = useState("");
  const [period, setPeriod] = useState<"today" | "week" | "month" | "threeMonth">("today");
  const [visibleCount, setVisibleCount] = useState(20);
  const [adPromptVisible, setAdPromptVisible] = useState(false);
  const [opening, setOpening] = useState(false);
  const [cardFace, setCardFace] = useState<"back" | "front">("back");
  const [displayedScore, setDisplayedScore] = useState<number>();
  const [resultVisible, setResultVisible] = useState(false);
  const [, setDayRevision] = useState(0);
  const [adminRankingKeys, setAdminRankingKeys] = useState<Set<string>>(new Set());
  const cardWidth = Math.min(210, Math.max(160, width * 0.5));
  const chanceCountryExtras = useMemo(() => chanceDraws.map((draw) => ({
    uid: draw.uid,
    username: draw.username,
    name: draw.displayName,
    countryCode: draw.countryCode
  })), [chanceDraws]);
  const lookupUserCountry = useCountryCodeLookup(chanceCountryExtras);
  const leaders = useMemo(
    () => buildLuckLeaderboardRows(
      chanceDraws.map((draw) => normalizeChanceDrawFromApp(draw)).filter((draw): draw is NonNullable<typeof draw> => Boolean(draw)),
      period,
      { maxRows: 200, hiddenKeys: adminRankingKeys }
    ),
    [adminRankingKeys, chanceDraws, period]
  );
  const dailyLimit = account.isPremium ? 2 : 1;
  const todayDrawCount = countUserTodayChanceDraws(chanceDraws, account);
  const dailyLimitReached = !account.isAdmin && chanceDrawsLoaded && todayDrawCount >= dailyLimit;
  const shouldRequireRewardedAd = !account.isAdmin && !account.isPremium && adsEnabled && areRewardedAdRequirementsEnabled();
  const latestDrawRef = useRef(lastChanceDraw);
  latestDrawRef.current = lastChanceDraw;

  useEffect(() => setVisibleCount(20), [period]);

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
    if (!lastChanceDraw || opening) return;
    flip.setValue(0);
    setCardFace("front");
    setDisplayedScore(lastChanceDraw.score);
    setResultVisible(true);
  }, [flip, lastChanceDraw, opening]);

  async function animateValue(value: Animated.Value, toValue: number, duration: number) {
    await new Promise<void>((resolve) => {
      Animated.timing(value, { toValue, duration: reducedMotion ? Math.min(duration, 160) : duration, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }).start(() => resolve());
    });
  }

  async function openCardAfterAccess() {
    setOpening(true);
    setMessage("");
    setResultVisible(false);
    const drawPromise = drawChanceCard();
    await Promise.all([
      animateValue(flip, reducedMotion ? 0 : 72, 400),
      animateValue(ritual, reducedMotion ? 0.35 : 1, 400)
    ]);
    const result = await drawPromise;
    if (!result.ok) {
      setMessage(result.message);
      await Promise.all([animateValue(flip, 0, 340), animateValue(ritual, 2, 420)]);
      ritual.setValue(0);
      setResultVisible(Boolean(lastChanceDraw));
      setOpening(false);
      return;
    }
    await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
    await animateValue(flip, reducedMotion ? 0 : 90, 90);
    setDisplayedScore(latestDrawRef.current?.score);
    setCardFace("front");
    setResultVisible(true);
    if (!reducedMotion) flip.setValue(-90);
    await Promise.all([animateValue(flip, 0, 500), animateValue(ritual, 2, 560)]);
    ritual.setValue(0);
    setMessage(result.message);
    setOpening(false);
  }

  async function confirmOpenCard() {
    if (!chanceDrawsLoaded || dailyLimitReached || opening) return;
    if (!shouldRequireRewardedAd) {
      await openCardAfterAccess();
      return;
    }
    setOpening(true);
    const completed = await showRewardedAd("admob_rewarded");
    setOpening(false);
    if (!completed) {
      setMessage(copy.adRequired);
      setAdPromptVisible(false);
      return;
    }
    setAdPromptVisible(false);
    await openCardAfterAccess();
  }

  function requestOpenCard() {
    if (!chanceDrawsLoaded || dailyLimitReached || opening) return;
    if (!shouldRequireRewardedAd) {
      void confirmOpenCard();
      return;
    }
    setAdPromptVisible(true);
  }

  return (
    <AppChrome title={copy.screenTitle} eyebrow="Art Atlas" showBackButton backToHome>
      <Modal visible={adPromptVisible} transparent animationType="fade" onRequestClose={() => !opening && setAdPromptVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <TimeCompass size={58} colors={colors} />
            <Text style={styles.modalTitle}>{copy.adTitle}</Text>
            <Text style={styles.modalText}>{copy.adDescription}</Text>
            <View style={styles.modalActions}>
              <Pressable disabled={opening} onPress={() => setAdPromptVisible(false)} style={styles.modalCancel} accessibilityRole="button">
                <Text style={styles.modalCancelText}>{copy.cancel}</Text>
              </Pressable>
              <Pressable disabled={opening} onPress={() => void confirmOpenCard()} style={styles.modalConfirm} accessibilityRole="button">
                <Text style={styles.modalConfirmText}>{opening ? copy.openingButton : copy.watchAd}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <ArtHistoryHero copy={copy} colors={colors} />
      <DailyResetStatus available={!dailyLimitReached} copy={copy} colors={colors} onReset={() => setDayRevision((value) => value + 1)} />
      <LuckCardStage
        cardWidth={cardWidth}
        colors={colors}
        copy={copy}
        cardFace={cardFace}
        flip={flip}
        reducedMotion={reducedMotion}
        resultVisible={resultVisible}
        ritual={ritual}
        score={displayedScore}
        message={displayedScore ? chanceCardMessage(displayedScore, language) : ""}
      />

      <Pressable
        disabled={!chanceDrawsLoaded || dailyLimitReached || opening}
        onPress={requestOpenCard}
        style={({ pressed }) => [styles.openButton, width < 360 && styles.openButtonNarrow, pressed && styles.openButtonPressed, (!chanceDrawsLoaded || dailyLimitReached || opening) && styles.openButtonDisabled]}
        accessibilityRole="button"
        accessibilityLabel={copy.openButton}
      >
        <LinearGradient colors={[colors.gold, colors.bronze]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.openButtonGradient}>
          <Ionicons name="sparkles-outline" size={17} color={colors.ink} />
          <Text style={styles.openButtonText}>{copy.openButton}</Text>
        </LinearGradient>
      </Pressable>

      <View style={styles.ritualMetaRow}>
        <View style={styles.ritualMetaItem}>
          <Ionicons name="compass-outline" size={15} color={colors.gold} />
          <View>
            <Text style={styles.ritualMetaStrong}>1–100</Text>
            <Text style={styles.ritualMetaLabel}>{copy.scoreScale}</Text>
          </View>
        </View>
        {account.isPremium ? (
          <View style={styles.premiumBadge}>
            <Ionicons name="diamond-outline" size={14} color={colors.gold} />
            <Text style={styles.premiumBadgeText}>{copy.premiumSecondChance}</Text>
          </View>
        ) : <Text style={styles.ritualHint}>{copy.personalMessage}</Text>}
      </View>

      {message ? <Text style={styles.statusMessage} accessibilityLiveRegion="polite">{message}</Text> : null}
      {!opening && lastChanceDraw && lastChanceDraw.activeScore > lastChanceDraw.score ? (
        <View style={styles.bestScoreSurface}>
          <Ionicons name="shield-checkmark-outline" size={15} color={colors.gold} />
          <View style={styles.bestScoreCopy}>
            <Text style={styles.bestScore}>{tFormat(chanceCardBestKeptCopy, language, { score: lastChanceDraw.activeScore })}</Text>
            <Text style={styles.resultHint}>{copy.bestKeptHint}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.boardCard}>
        <View style={styles.boardHeading}>
          <View style={styles.boardIcon}><Ionicons name="trophy-outline" size={17} color={colors.gold} /></View>
          <View style={styles.boardHeadingCopy}>
            <Text style={styles.boardEyebrow}>ART ATLAS</Text>
            <Text style={styles.boardTitle}>{copy.leaderboardTitle}</Text>
          </View>
        </View>
        <View style={styles.tabs}>
          {([[
            "today", copy.today
          ], ["week", copy.week], ["month", copy.month], ["threeMonth", copy.threeMonths]] as const).map(([key, label]) => (
            <Pressable key={key} onPress={() => setPeriod(key)} style={[styles.tab, period === key && styles.tabActive]} accessibilityRole="tab" accessibilityState={{ selected: period === key }}>
              <Text style={[styles.tabText, period === key && styles.tabTextActive]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.boardNote}>{luckRankingAverageNote(period, language)}</Text>
        <View style={styles.leaderList}>
          {leaders.slice(0, visibleCount).map((item, index) => (
            <Pressable
              key={`${item.id}-${item.username}`}
              onPress={() => router.push({ pathname: "/profile/[name]", params: { name: profileRouteParam({ username: item.username, displayName: item.name, uid: item.id }) } })}
              style={[styles.leaderRow, index === 0 && styles.leaderRow1, index === 1 && styles.leaderRow2, index === 2 && styles.leaderRow3]}
              accessibilityRole="button"
              accessibilityLabel={`${index + 1}. ${item.name}, ${item.score}`}
            >
              <View style={[styles.rankMedal, index === 0 && styles.rankGold, index === 1 && styles.rankSilver, index === 2 && styles.rankBronze]}>
                <Text style={styles.rank}>{index + 1}</Text>
              </View>
              <View style={styles.avatar}><Text style={styles.avatarText}>{(item.name || item.username).slice(0, 1).toLocaleUpperCase()}</Text></View>
              <View style={styles.leaderText}>
                <UserNameWithCountry name={item.name} username={item.username} uid={item.id} countryCode={item.countryCode ?? lookupUserCountry([item.username, item.name, item.id])} nameStyle={styles.leaderName} />
                <Text style={styles.leaderMeta}>@{item.username}</Text>
              </View>
              <Text style={styles.leaderScore}>{item.score}</Text>
              <Ionicons name="chevron-forward" size={15} color={colors.muted} />
            </Pressable>
          ))}
        </View>
        {visibleCount < leaders.length ? (
          <Pressable onPress={() => setVisibleCount((value) => value + 20)} style={styles.moreButton} accessibilityRole="button">
            <Text style={styles.moreText}>{copy.showMore}</Text>
          </Pressable>
        ) : null}
      </View>
    </AppChrome>
  );
}

function ArtHistoryHero({ copy, colors }: { copy: ChanceCopy; colors: ThemeColors }) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.hero}>
      <View style={styles.heroGlow} />
      <View style={styles.museumMark}><Ionicons name="business-outline" size={42} color={colors.gold} /></View>
      <View style={styles.artFragment}><View style={styles.artFragmentSun} /><View style={styles.artFragmentHorizon} /></View>
      <Text style={styles.heroEyebrow}>ART HISTORY · DAILY RITUAL</Text>
      <Text style={styles.heroTitle}>{copy.heroTitle}</Text>
      <Text style={styles.heroDescription}>{copy.heroDescription}</Text>
    </View>
  );
}

function DailyResetStatus({ available, copy, colors, onReset }: { available: boolean; copy: ChanceCopy; colors: ThemeColors; onReset: () => void }) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [remaining, setRemaining] = useState(() => millisecondsUntilLocalMidnight());
  const dayKey = useRef(getLocalDayKey());

  useEffect(() => {
    if (available) return;
    const tick = () => {
      const nextDayKey = getLocalDayKey();
      if (nextDayKey !== dayKey.current) {
        dayKey.current = nextDayKey;
        onReset();
      }
      setRemaining(millisecondsUntilLocalMidnight());
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [available, onReset]);

  if (available) {
    return <View style={styles.readySurface}><View style={styles.readyDot} /><Text style={styles.readyText}>{copy.ready}</Text></View>;
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const values = [Math.floor(totalSeconds / 3600), Math.floor((totalSeconds % 3600) / 60), totalSeconds % 60];
  const labels = [copy.hours, copy.minutes, copy.seconds];
  return (
    <View style={styles.countdownSurface} accessibilityLiveRegion="polite">
      <View style={styles.countdownHeading}><Ionicons name="time-outline" size={14} color={colors.gold} /><Text style={styles.countdownHeadingText}>{copy.nextCardIn}</Text></View>
      <View style={styles.countdownValues}>
        {values.map((value, index) => (
          <View key={labels[index]} style={styles.countdownUnit}>
            <Text style={styles.countdownValue}>{String(value).padStart(2, "0")}</Text>
            <Text style={styles.countdownLabel} numberOfLines={1}>{labels[index]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function LuckCardStage({ cardWidth, colors, copy, cardFace, flip, reducedMotion, resultVisible, ritual, score, message }: {
  cardWidth: number;
  colors: ThemeColors;
  copy: ChanceCopy;
  cardFace: "back" | "front";
  flip: Animated.Value;
  reducedMotion: boolean;
  resultVisible: boolean;
  ritual: Animated.Value;
  score?: number;
  message: string;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const float = useRef(new Animated.Value(0)).current;
  const orbit = useRef(new Animated.Value(0)).current;
  const reveal = useRef(new Animated.Value(resultVisible ? 1 : 0)).current;
  const particles = useRef(new Animated.Value(0)).current;
  const shine = useRef(new Animated.Value(0)).current;
  const cardHeight = cardWidth / 0.66;
  const atmosphere = scoreAtmosphere(score, colors);

  useEffect(() => {
    if (reducedMotion) return;
    const floatLoop = Animated.loop(Animated.sequence([
      Animated.timing(float, { toValue: 1, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(float, { toValue: 0, duration: 2400, easing: Easing.inOut(Easing.sin), useNativeDriver: true })
    ]));
    const orbitLoop = Animated.loop(Animated.timing(orbit, { toValue: 1, duration: 24000, easing: Easing.linear, useNativeDriver: true }));
    floatLoop.start();
    orbitLoop.start();
    return () => {
      floatLoop.stop();
      orbitLoop.stop();
    };
  }, [float, orbit, reducedMotion]);

  useEffect(() => {
    if (!resultVisible) {
      reveal.setValue(0);
      particles.setValue(0);
      shine.setValue(0);
      return;
    }
    reveal.setValue(0);
    particles.setValue(0);
    shine.setValue(0);
    Animated.parallel([
      Animated.timing(reveal, { toValue: 1, duration: reducedMotion ? 180 : 360, delay: reducedMotion ? 0 : 110, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.sequence([
        Animated.timing(shine, { toValue: 1, duration: reducedMotion ? 1 : 320, delay: reducedMotion ? 0 : 80, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(shine, { toValue: 0, duration: reducedMotion ? 1 : 260, easing: Easing.in(Easing.cubic), useNativeDriver: true })
      ]),
      Animated.sequence([
        Animated.timing(particles, { toValue: reducedMotion ? 0 : 1, duration: reducedMotion ? 1 : 260, delay: reducedMotion ? 0 : 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(particles, { toValue: 0, duration: reducedMotion ? 1 : 420, easing: Easing.in(Easing.cubic), useNativeDriver: true })
      ])
    ]).start();
  }, [particles, reducedMotion, resultVisible, reveal, score, shine]);

  const floatTransform = reducedMotion ? 0 : float.interpolate({ inputRange: [0, 1], outputRange: [-3, 4] });
  const tiltTransform = reducedMotion ? "0deg" : float.interpolate({ inputRange: [0, 1], outputRange: ["-0.7deg", "0.7deg"] });
  const orbitTransform = reducedMotion ? "-8deg" : orbit.interpolate({ inputRange: [0, 1], outputRange: ["-8deg", "352deg"] });
  const cardRotation = reducedMotion ? "0deg" : flip.interpolate({ inputRange: [-90, 0, 90], outputRange: ["-90deg", "0deg", "90deg"] });
  const ritualLift = ritual.interpolate({ inputRange: [0, 1, 2], outputRange: [0, -13, 0] });
  const ritualScale = ritual.interpolate({ inputRange: [0, 1, 2], outputRange: [1, 1.065, 1] });
  const orbitScale = reducedMotion ? 1 : ritual.interpolate({ inputRange: [0, 1, 2], outputRange: [1, 0.78, 1] });
  const orbitBurst = reducedMotion ? "0deg" : ritual.interpolate({ inputRange: [0, 1, 2], outputRange: ["0deg", "145deg", "360deg"] });
  const orbitCounterBurst = reducedMotion ? "0deg" : ritual.interpolate({ inputRange: [0, 1, 2], outputRange: ["0deg", "-110deg", "-360deg"] });
  const glowScale = ritual.interpolate({ inputRange: [0, 1, 2], outputRange: [0.88, 1.18, 0.88] });
  const glowOpacity = ritual.interpolate({ inputRange: [0, 1, 2], outputRange: [0.62, 1, 0.62] });
  const resultScale = reveal.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });
  const accessibilityLabel = resultVisible && score ? copy.cardScoreAccessibility.replace("{score}", String(score)) : copy.cardReadyAccessibility;

  return (
    <View style={[styles.cardStage, { minHeight: cardHeight + 76 }]}>
      <Animated.View style={[styles.stageGlow, { backgroundColor: atmosphere.glow, opacity: glowOpacity, transform: [{ scale: glowScale }] }]} />
      <Animated.View style={[styles.orbit, styles.orbitOuter, { transform: [{ scale: orbitScale }, { rotateZ: orbitTransform }, { rotateZ: orbitBurst }] }]}><View style={[styles.orbitPoint, styles.orbitPointTop]} /><View style={[styles.orbitPoint, styles.orbitPointBottom]} /></Animated.View>
      <Animated.View style={[styles.orbit, styles.orbitMiddle, { transform: [{ scale: orbitScale }, { rotateZ: orbitTransform }, { rotateZ: orbitCounterBurst }, { rotateX: "62deg" }] }]} />
      <Animated.View style={[styles.orbit, styles.orbitInner, { transform: [{ scale: orbitScale }, { rotateZ: orbitBurst }] }]} />
      {resultVisible ? [0, 1, 2, 3].map((particle) => (
        <Animated.View key={particle} style={[styles.prestigeParticle, { opacity: particles, transform: [{ rotateZ: `${particle * 90 + 22}deg` }, { translateY: particles.interpolate({ inputRange: [0, 1], outputRange: [-20, score === 100 ? -88 : -64] }) }, { scale: particles.interpolate({ inputRange: [0, 1], outputRange: [0.7, score === 100 ? 1.3 : 1] }) }] }]} />
      )) : null}
      <Animated.View style={{ transform: [{ translateY: floatTransform }, { translateY: ritualLift }, { scale: ritualScale }, { rotateZ: tiltTransform }] }}>
        <View style={[styles.cardShadow, { width: cardWidth * 0.78 }]} />
        <View style={{ width: cardWidth, height: cardHeight }} accessible accessibilityLabel={accessibilityLabel}>
          <Animated.View style={[styles.cardFace, { width: cardWidth, height: cardHeight, transform: [{ perspective: 900 }, { rotateY: cardRotation }] }]}>
            <LinearGradient colors={cardFace === "back" ? [colors.navy, colors.panel, colors.ink] : [colors.navy, atmosphere.surface, colors.ink]} style={styles.cardGradient}>
              <View style={[styles.cardOuterFrame, { borderColor: cardFace === "back" ? colors.gold : atmosphere.accent }]} /><View style={styles.cardInnerFrame} />
              {cardFace === "back" ? (
                <>
                  <CornerOrnaments colors={colors} />
                  <View style={styles.cardBrandRow}><Text style={styles.cardBrand}>ART ATLAS</Text><Text style={styles.cardEdition}>MMXXVI</Text></View>
                  <TimeCompass size={cardWidth * 0.55} colors={colors} />
                  <Text style={styles.cardBackTitle}>{copy.dailyCard}</Text><Text style={styles.cardBackMicro}>ART · TIME · DISCOVERY</Text>
                </>
              ) : (
                <>
                  <Text style={styles.cardFrontBrand}>ART ATLAS · {copy.dailyCard.toLocaleUpperCase()}</Text><View style={styles.cardFrontDivider} />
                  <Animated.View style={[styles.resultContent, { opacity: reveal, transform: [{ scale: resultScale }] }]}>
                    <Text style={styles.cardScoreLabel}>{copy.todayScore}</Text><Text style={[styles.cardScore, { color: atmosphere.accent }]}>{score ?? "—"}</Text><Text style={styles.cardScoreScale}>{score ?? "—"} / 100</Text>
                    <View style={[styles.cardMessageMark, { backgroundColor: atmosphere.accent }]} /><Text style={styles.cardMessageLabel}>{copy.todayMessage}</Text>
                    <Text style={[styles.cardMessage, cardWidth < 175 && styles.cardMessageCompact]} numberOfLines={7} adjustsFontSizeToFit minimumFontScale={0.76}>{message}</Text>
                  </Animated.View>
                  <Animated.View style={[styles.resultShine, { opacity: shine, transform: [{ translateX: shine.interpolate({ inputRange: [0, 1], outputRange: [-110, 145] }) }, { rotateZ: "13deg" }] }]} />
                </>
              )}
              <View style={styles.cardHighlight} />
            </LinearGradient>
          </Animated.View>
        </View>
      </Animated.View>
      <View style={styles.pedestal}><View style={styles.pedestalOuter} /><View style={styles.pedestalInner} /><View style={[styles.pedestalCore, { backgroundColor: atmosphere.glow }]} /></View>
    </View>
  );
}

function TimeCompass({ size, colors }: { size: number; colors: ThemeColors }) {
  const pointSize = Math.max(3, size * 0.045);
  return (
    <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={[stylesStatic.compassRing, { width: size, height: size, borderRadius: size / 2, borderColor: colors.gold }]} />
      <View style={[stylesStatic.compassInnerRing, { width: size * 0.68, height: size * 0.68, borderRadius: size, borderColor: colors.line }]} />
      {[0, 45, 90, 135].map((rotation) => <View key={rotation} style={[stylesStatic.compassAxis, { width: size * 0.82, transform: [{ rotateZ: `${rotation}deg` }], backgroundColor: colors.line }]} />)}
      <View style={[stylesStatic.compassDiamond, { width: size * 0.23, height: size * 0.23, borderColor: colors.gold, backgroundColor: colors.panelSoft }]}><View style={[stylesStatic.compassCore, { width: pointSize, height: pointSize, borderRadius: pointSize, backgroundColor: colors.gold }]} /></View>
    </View>
  );
}

function CornerOrnaments({ colors }: { colors: ThemeColors }) {
  return <>{[stylesStatic.cornerTopLeft, stylesStatic.cornerTopRight, stylesStatic.cornerBottomLeft, stylesStatic.cornerBottomRight].map((position, index) => <View key={index} style={[stylesStatic.corner, position, { borderColor: colors.gold }]} />)}</>;
}

function scoreAtmosphere(score: number | undefined, colors: ThemeColors) {
  if (!score || score <= 20) return { glow: "rgba(92,105,140,0.18)", surface: colors.panel, accent: colors.muted };
  if (score <= 40) return { glow: "rgba(69,128,214,0.20)", surface: colors.panelSoft, accent: colors.bronze };
  if (score <= 60) return { glow: "rgba(124,58,237,0.22)", surface: colors.panel, accent: colors.plum };
  if (score <= 80) return { glow: "rgba(151,104,232,0.24)", surface: colors.panelSoft, accent: colors.gold };
  return { glow: "rgba(246,196,83,0.28)", surface: colors.panel, accent: colors.gold };
}

const stylesStatic = StyleSheet.create({
  compassRing: { position: "absolute", borderWidth: 1, opacity: 0.62 },
  compassInnerRing: { position: "absolute", borderWidth: 1 },
  compassAxis: { position: "absolute", height: StyleSheet.hairlineWidth },
  compassDiamond: { transform: [{ rotateZ: "45deg" }], borderWidth: 1, alignItems: "center", justifyContent: "center" },
  compassCore: { opacity: 0.95 },
  corner: { position: "absolute", width: 14, height: 14, opacity: 0.5 },
  cornerTopLeft: { top: 14, left: 14, borderTopWidth: 1, borderLeftWidth: 1 },
  cornerTopRight: { top: 14, right: 14, borderTopWidth: 1, borderRightWidth: 1 },
  cornerBottomLeft: { bottom: 14, left: 14, borderBottomWidth: 1, borderLeftWidth: 1 },
  cornerBottomRight: { right: 14, bottom: 14, borderRightWidth: 1, borderBottomWidth: 1 }
});

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    hero: { minHeight: 126, overflow: "hidden", alignItems: "center", justifyContent: "center", paddingHorizontal: 44, paddingVertical: 14, marginBottom: 8 },
    heroGlow: { position: "absolute", width: 270, height: 104, borderRadius: 140, backgroundColor: colors.plum, opacity: 0.1 },
    museumMark: { position: "absolute", left: 2, bottom: 12, opacity: 0.12, transform: [{ rotateZ: "-6deg" }] },
    artFragment: { position: "absolute", right: 3, top: 15, width: 40, height: 50, padding: 3, borderWidth: 1, borderColor: colors.gold, opacity: 0.24, transform: [{ rotateZ: "5deg" }], overflow: "hidden" },
    artFragmentSun: { position: "absolute", top: 10, right: 8, width: 10, height: 10, borderRadius: 10, backgroundColor: colors.gold },
    artFragmentHorizon: { position: "absolute", left: -4, right: -4, bottom: 8, height: 17, backgroundColor: colors.plum, transform: [{ rotateZ: "-8deg" }] },
    heroEyebrow: { color: colors.gold, fontSize: 9, letterSpacing: 2.2, fontWeight: "900", textAlign: "center", marginBottom: 7 },
    heroTitle: { color: colors.ivory, fontSize: 23, lineHeight: 27, fontWeight: "900", textAlign: "center", letterSpacing: -0.5 },
    heroDescription: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: "700", textAlign: "center", marginTop: 6, maxWidth: 290 },
    readySurface: { alignSelf: "center", minHeight: 32, borderRadius: 16, flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 13, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, marginBottom: 5 },
    readyDot: { width: 6, height: 6, borderRadius: 6, backgroundColor: colors.jade },
    readyText: { color: colors.ivory, fontSize: 11, fontWeight: "900" },
    countdownSurface: { alignSelf: "center", minWidth: 240, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, paddingHorizontal: 14, paddingVertical: 9, marginBottom: 5 },
    countdownHeading: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginBottom: 6 },
    countdownHeadingText: { color: colors.muted, fontSize: 10, fontWeight: "900" },
    countdownValues: { flexDirection: "row", justifyContent: "center", gap: 18 },
    countdownUnit: { alignItems: "center", minWidth: 46 },
    countdownValue: { color: colors.gold, fontSize: 19, lineHeight: 21, fontWeight: "900", fontVariant: ["tabular-nums"], letterSpacing: 1 },
    countdownLabel: { color: colors.muted, fontSize: 7, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.6 },
    cardStage: { alignItems: "center", justifyContent: "center", marginTop: 1, overflow: "hidden" },
    stageGlow: { position: "absolute", width: 260, height: 260, borderRadius: 140, opacity: 0.9 },
    orbit: { position: "absolute", borderWidth: StyleSheet.hairlineWidth, borderColor: colors.gold, opacity: 0.22 },
    orbitOuter: { width: 300, height: 178, borderRadius: 180 },
    orbitMiddle: { width: 254, height: 172, borderRadius: 150, borderColor: colors.plum },
    orbitInner: { width: 218, height: 104, borderRadius: 130, transform: [{ rotateZ: "13deg" }], opacity: 0.14 },
    orbitPoint: { position: "absolute", width: 4, height: 4, borderRadius: 4, backgroundColor: colors.gold },
    orbitPointTop: { top: 6, left: "26%" },
    orbitPointBottom: { right: "20%", bottom: 13 },
    prestigeParticle: { position: "absolute", width: 5, height: 5, borderRadius: 5, backgroundColor: colors.gold, zIndex: 8 },
    cardShadow: { position: "absolute", height: 22, borderRadius: 100, backgroundColor: "rgba(0,0,0,0.44)", left: "11%", bottom: -28, transform: [{ scaleY: 0.42 }] },
    cardFace: { position: "absolute", borderRadius: 17, overflow: "hidden", backfaceVisibility: "hidden", shadowColor: "#000", shadowOpacity: 0.46, shadowRadius: 18, shadowOffset: { width: 0, height: 13 }, elevation: 12 },
    cardGradient: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 17, paddingVertical: 17 },
    cardOuterFrame: { position: "absolute", top: 7, right: 7, bottom: 7, left: 7, borderRadius: 13, borderWidth: 1.3, opacity: 0.78 },
    cardInnerFrame: { position: "absolute", top: 12, right: 12, bottom: 12, left: 12, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
    cardBrandRow: { position: "absolute", top: 20, left: 20, right: 20, flexDirection: "row", justifyContent: "space-between" },
    cardBrand: { color: colors.gold, fontSize: 8, letterSpacing: 1.8, fontWeight: "900" },
    cardEdition: { color: colors.muted, fontSize: 7, letterSpacing: 1.2, fontWeight: "800" },
    cardBackTitle: { color: colors.ivory, fontSize: 12, fontWeight: "900", textTransform: "uppercase", letterSpacing: 2.2, marginTop: 13 },
    cardBackMicro: { position: "absolute", bottom: 20, color: colors.muted, fontSize: 6.5, fontWeight: "800", letterSpacing: 1.4 },
    cardHighlight: { position: "absolute", top: -25, left: 19, width: 28, height: "130%", backgroundColor: "rgba(255,255,255,0.035)", transform: [{ rotateZ: "13deg" }] },
    cardFrontBrand: { position: "absolute", top: 20, color: colors.muted, fontSize: 7, letterSpacing: 1.3, fontWeight: "900" },
    cardFrontDivider: { position: "absolute", top: 37, width: 30, height: StyleSheet.hairlineWidth, backgroundColor: colors.gold, opacity: 0.55 },
    resultContent: { width: "100%", alignItems: "center", justifyContent: "center" },
    resultShine: { position: "absolute", top: -34, bottom: -34, width: 30, backgroundColor: "rgba(255,255,255,0.18)" },
    cardScoreLabel: { color: colors.muted, fontSize: 8, textTransform: "uppercase", letterSpacing: 1.5, fontWeight: "900", marginTop: 10 },
    cardScore: { fontSize: 54, lineHeight: 60, fontWeight: "900", fontVariant: ["tabular-nums"], letterSpacing: -2 },
    cardScoreScale: { color: colors.muted, fontSize: 8, fontWeight: "900", marginTop: -3 },
    cardMessageMark: { width: 18, height: 2, borderRadius: 2, marginTop: 8, marginBottom: 6 },
    cardMessageLabel: { color: colors.gold, fontSize: 7, textTransform: "uppercase", letterSpacing: 1.3, fontWeight: "900", marginBottom: 5 },
    cardMessage: { color: colors.ivory, fontSize: 10.8, lineHeight: 14.2, textAlign: "center", fontWeight: "700" },
    cardMessageCompact: { fontSize: 10, lineHeight: 13 },
    pedestal: { position: "absolute", bottom: 10, width: 190, height: 35, alignItems: "center", justifyContent: "center", zIndex: -1 },
    pedestalOuter: { position: "absolute", width: 190, height: 34, borderRadius: 100, borderWidth: 1, borderColor: colors.line, transform: [{ scaleY: 0.38 }] },
    pedestalInner: { position: "absolute", width: 132, height: 25, borderRadius: 100, borderWidth: 1, borderColor: colors.gold, opacity: 0.28, transform: [{ scaleY: 0.38 }] },
    pedestalCore: { width: 95, height: 19, borderRadius: 80, opacity: 0.65, transform: [{ scaleY: 0.36 }] },
    openButton: { alignSelf: "center", minWidth: 176, minHeight: 48, borderRadius: 24, overflow: "hidden", marginTop: 2, shadowColor: colors.gold, shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 4 },
    openButtonNarrow: { left: -18 },
    openButtonPressed: { transform: [{ scale: 0.97 }] },
    openButtonDisabled: { opacity: 0.48 },
    openButtonGradient: { minHeight: 48, paddingHorizontal: 22, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    openButtonText: { color: colors.ink, fontSize: 13, fontWeight: "900", letterSpacing: 0.7, textTransform: "uppercase" },
    ritualMetaRow: { minHeight: 50, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 10 },
    ritualMetaItem: { minHeight: 42, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 11, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft },
    ritualMetaStrong: { color: colors.ivory, fontSize: 12, fontWeight: "900" },
    ritualMetaLabel: { color: colors.muted, fontSize: 8, fontWeight: "800" },
    ritualHint: { color: colors.muted, fontSize: 10, lineHeight: 14, fontWeight: "700", maxWidth: 150 },
    premiumBadge: { minHeight: 36, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.panelSoft },
    premiumBadgeText: { color: colors.gold, fontSize: 9, fontWeight: "900" },
    statusMessage: { color: colors.muted, fontSize: 10, lineHeight: 15, fontWeight: "800", textAlign: "center", marginTop: 5, paddingHorizontal: 16 },
    bestScoreSurface: { flexDirection: "row", alignItems: "center", gap: 9, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, padding: 10, marginTop: 8 },
    bestScoreCopy: { flex: 1 },
    bestScore: { color: colors.gold, fontSize: 11, fontWeight: "900" },
    resultHint: { color: colors.muted, fontSize: 9, lineHeight: 13, fontWeight: "700", marginTop: 2 },
    boardCard: { borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 12, gap: 10, marginTop: 16, overflow: "hidden" },
    boardHeading: { flexDirection: "row", alignItems: "center", gap: 10 },
    boardIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: colors.panelSoft, borderWidth: 1, borderColor: colors.line },
    boardHeadingCopy: { flex: 1 },
    boardEyebrow: { color: colors.gold, fontSize: 7, letterSpacing: 1.5, fontWeight: "900" },
    boardTitle: { color: colors.ivory, fontSize: 18, fontWeight: "900", marginTop: 1 },
    boardNote: { color: colors.muted, fontSize: 9.5, lineHeight: 14, fontWeight: "700" },
    tabs: { flexDirection: "row", gap: 5 },
    tab: { flex: 1, minHeight: 34, borderRadius: 9, alignItems: "center", justifyContent: "center", paddingHorizontal: 4, backgroundColor: colors.panelSoft },
    tabActive: { backgroundColor: colors.gold },
    tabText: { color: colors.muted, fontSize: 9, fontWeight: "900" },
    tabTextActive: { color: colors.ink },
    leaderList: { borderRadius: 11, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
    leaderRow: { minHeight: 56, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, backgroundColor: colors.panelSoft },
    leaderRow1: { backgroundColor: "rgba(246,196,83,0.085)" },
    leaderRow2: { backgroundColor: "rgba(202,211,225,0.055)" },
    leaderRow3: { backgroundColor: "rgba(193,130,79,0.06)" },
    rankMedal: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel },
    rankGold: { backgroundColor: "rgba(246,196,83,0.2)" },
    rankSilver: { backgroundColor: "rgba(202,211,225,0.16)" },
    rankBronze: { backgroundColor: "rgba(193,130,79,0.17)" },
    rank: { color: colors.ivory, fontSize: 10, fontWeight: "900" },
    avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.navy, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
    avatarText: { color: colors.gold, fontSize: 12, fontWeight: "900" },
    leaderText: { flex: 1, minWidth: 0 },
    leaderName: { color: colors.ivory, fontSize: 12, fontWeight: "900" },
    leaderMeta: { color: colors.muted, fontSize: 9.5, fontWeight: "700", marginTop: 1 },
    leaderScore: { color: colors.gold, fontSize: 16, fontWeight: "900", fontVariant: ["tabular-nums"] },
    moreButton: { minHeight: 40, borderRadius: 9, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
    moreText: { color: colors.gold, fontSize: 11, fontWeight: "900" },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.64)", justifyContent: "center", padding: 18 },
    modalPanel: { borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: "center", padding: 18, gap: 10 },
    modalTitle: { color: colors.ivory, fontSize: 20, fontWeight: "900", textAlign: "center" },
    modalText: { color: colors.muted, lineHeight: 20, fontWeight: "700", textAlign: "center" },
    modalActions: { flexDirection: "row", gap: 8, marginTop: 6, alignSelf: "stretch" },
    modalCancel: { flex: 1, minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
    modalCancelText: { color: colors.ivory, fontWeight: "900" },
    modalConfirm: { flex: 1, minHeight: 44, borderRadius: 10, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
    modalConfirmText: { color: colors.ink, fontWeight: "900", textAlign: "center" }
  });
}
