import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { AppChrome } from "@/components/app-chrome";
import { AuthRequired } from "@/components/auth-required";
import { timelineGameCopy } from "@/app/i18n/timeline-game";
import { getThemeColors } from "@/constants/theme";
import {
  TIMELINE_GAME_SECONDS,
  TIMELINE_ITEM_COUNT,
  isTimelineGameType,
  scoreTimelineGame,
  shuffleTimelineItems,
  type TimelineGameType
} from "@/firebase/shared/timeline-game";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import {
  activateTimelineGame,
  completeTimelineGame,
  consumePreparedTimelineGame,
  peekPreparedTimelineGame,
  prepareTimelineGameQueue,
  timelineLocalizedText,
  type PreparedTimelineGame,
  type TimelineGameItem,
  type TimelineGameResult
} from "@/src/services/firebase/timeline-game-service";
import { markPerformanceEvent } from "@/utils/performance";

type Phase = "rules" | "drawing" | "activating" | "active" | "submitting" | "result" | "error";

export default function TimelineGameScreen() {
  const params = useLocalSearchParams<{ type?: string }>();
  const gameType: TimelineGameType = isTimelineGameType(params.type) ? params.type : "artwork";
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const { width, height } = useWindowDimensions();
  const { isAuthenticated, canBrowsePublicContent } = useAccount();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors, width, height), [colors, height, width]);
  const router = useRouter();
  const navigation = useNavigation();
  const [phase, setPhase] = useState<Phase>("rules");
  const [prepared, setPrepared] = useState<PreparedTimelineGame | null>(null);
  const [slotItems, setSlotItems] = useState<TimelineGameItem[]>([]);
  const [available, setAvailable] = useState<TimelineGameItem[]>([]);
  const [ordered, setOrdered] = useState<(TimelineGameItem | null)[]>(() => emptyTimelineOrder());
  const [startedAtMs, setStartedAtMs] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [result, setResult] = useState<TimelineGameResult | null>(null);
  const [failedImageIds, setFailedImageIds] = useState<Set<string>>(new Set());
  const [completionPromptVisible, setCompletionPromptVisible] = useState(false);
  const [exitPromptVisible, setExitPromptVisible] = useState(false);
  const [allowNavigation, setAllowNavigation] = useState(false);
  const [prepareVersion, setPrepareVersion] = useState(0);
  const [errorKey, setErrorKey] = useState<"notEnoughContent" | "dailyLimit" | "networkError" | "resultRetry">("networkError");
  const animationTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const frozenElapsedRef = useRef<number | null>(null);
  const pendingNavigationRef = useRef<(() => void) | null>(null);
  const serverClockRef = useRef({ serverNowMs: 0, monotonicMs: 0 });
  const readyMarkedRef = useRef(false);

  useEffect(() => {
    markPerformanceEvent("GAME_VISIBLE", { game: `timeline-${gameType}` });
  }, [gameType]);

  const title = gameType === "artwork" ? timelineGameCopy.artworkTitle[language] : timelineGameCopy.artistTitle[language];
  const directionLabel = prepared?.direction === "newest-first" ? timelineGameCopy.newestFirst[language] : timelineGameCopy.oldestFirst[language];
  const directionIcon = prepared?.direction === "newest-first" ? "arrow-down" : "arrow-up";
  const directionPrompt = (
    gameType === "artwork"
      ? prepared?.direction === "newest-first" ? timelineGameCopy.artworkNewestPrompt : timelineGameCopy.artworkOldestPrompt
      : prepared?.direction === "newest-first" ? timelineGameCopy.artistNewestPrompt : timelineGameCopy.artistOldestPrompt
  )[language];
  const timedOut = elapsedSeconds >= TIMELINE_GAME_SECONDS;
  const potentialScore = scoreTimelineGame(TIMELINE_ITEM_COUNT, elapsedSeconds).finalScore;
  const activeGame = phase === "active" || phase === "submitting";
  const orderedItems = ordered.filter((item): item is TimelineGameItem => item !== null);

  usePreventRemove(activeGame && !allowNavigation, ({ data }) => {
    pendingNavigationRef.current = () => navigation.dispatch(data.action);
    setExitPromptVisible(true);
  });

  useEffect(() => {
    if (!allowNavigation || !pendingNavigationRef.current) return;
    const navigate = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    navigate();
  }, [allowNavigation]);

  useEffect(() => {
    if (!isAuthenticated || !canBrowsePublicContent) return;
    let mounted = true;
    const cached = peekPreparedTimelineGame(gameType);
    const preparation = cached
      ? Promise.resolve(cached)
      : prepareTimelineGameQueue(gameType).then((sessions) => sessions[0]);
    preparation
      .then((session) => {
        if (!session) throw new Error("Timeline game could not be prepared");
        if (!mounted) return;
        const shuffled = shuffleTimelineItems(session.items);
        setPrepared(session);
        if (!readyMarkedRef.current) {
          readyMarkedRef.current = true;
          markPerformanceEvent("GAME_READY", { game: `timeline-${gameType}`, source: cached ? "memory" : "network" });
        }
        serverClockRef.current = { serverNowMs: session.serverNowMs, monotonicMs: performance.now() };
        setSlotItems(shuffled);
        setAvailable(shuffled);
        void preloadTimelineImages(session.items).then((failed) => {
          if (mounted) setFailedImageIds(failed);
        });
        if (session.status === "active" && session.startedAtMs) {
          setStartedAtMs(session.startedAtMs);
          setPhase("active");
        }
      })
      .catch((error: unknown) => {
        if (!mounted) return;
        setErrorKey(errorCopyKey(error));
        setPhase("error");
      });
    return () => {
      mounted = false;
      if (animationTimer.current) clearInterval(animationTimer.current);
    };
  }, [canBrowsePublicContent, gameType, isAuthenticated, prepareVersion]);

  useEffect(() => {
    if (phase !== "active") return;
    const update = () => {
      const serverNowMs = serverClockRef.current.serverNowMs + performance.now() - serverClockRef.current.monotonicMs;
      setElapsedSeconds(Math.max(0, Math.floor((serverNowMs - startedAtMs) / 1000)));
    };
    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [phase, startedAtMs]);

  if (!isAuthenticated) return <AuthRequired title={title} />;

  async function beginDraw() {
    if (!prepared || phase !== "rules") return;
    setPhase("drawing");
    const drawStartedAt = Date.now();
    animationTimer.current = setInterval(() => {
      setSlotItems((current) => current.map((_, index) => prepared.items[(index + Math.floor(Math.random() * prepared.items.length)) % prepared.items.length]));
      if (Date.now() - drawStartedAt < 3000) return;
      if (animationTimer.current) clearInterval(animationTimer.current);
      animationTimer.current = null;
      const finalItems = shuffleTimelineItems(prepared.items);
      setSlotItems(finalItems);
      setAvailable(finalItems);
      setPhase("activating");
      activateTimelineGame(prepared.sessionId)
        .then((session) => {
          consumePreparedTimelineGame(gameType, prepared.sessionId);
          void prepareTimelineGameQueue(gameType).catch(() => undefined);
          serverClockRef.current = { serverNowMs: session.serverNowMs, monotonicMs: performance.now() };
          setStartedAtMs(session.startedAtMs);
          setOrdered(emptyTimelineOrder());
          setElapsedSeconds(0);
          setPhase("active");
        })
        .catch((error: unknown) => {
          setErrorKey(errorCopyKey(error));
          setPhase("error");
        });
    }, 110);
  }

  function selectItem(item: TimelineGameItem) {
    if (phase !== "active" || orderedItems.length >= TIMELINE_ITEM_COUNT) return;
    setAvailable((current) => current.filter((candidate) => candidate.id !== item.id));
    setOrdered((current) => {
      if (current.some((candidate) => candidate?.id === item.id)) return current;
      const next = [...current];
      const emptyIndex = next.findIndex((candidate) => candidate === null);
      if (emptyIndex >= 0) next[emptyIndex] = item;
      return next;
    });
  }

  function undoItem(item: TimelineGameItem) {
    if (phase !== "active") return;
    setOrdered((current) => current.map((candidate) => candidate?.id === item.id ? null : candidate));
    setAvailable((current) => current.some((candidate) => candidate.id === item.id) ? current : [...current, item]);
  }

  function requestCompletion() {
    if (orderedItems.length !== TIMELINE_ITEM_COUNT || !prepared) return;
    setCompletionPromptVisible(true);
  }

  function requestNavigation(navigate: () => void) {
    if (!activeGame) {
      navigate();
      return;
    }
    pendingNavigationRef.current = navigate;
    setExitPromptVisible(true);
  }

  function confirmExit() {
    setExitPromptVisible(false);
    setAllowNavigation(true);
  }

  async function submitResult() {
    if (!prepared || orderedItems.length !== TIMELINE_ITEM_COUNT) return;
    const serverNowMs = serverClockRef.current.serverNowMs + performance.now() - serverClockRef.current.monotonicMs;
    const completionElapsedSeconds = frozenElapsedRef.current ?? Math.max(elapsedSeconds, Math.floor((serverNowMs - startedAtMs) / 1000));
    frozenElapsedRef.current = completionElapsedSeconds;
    setCompletionPromptVisible(false);
    setElapsedSeconds(completionElapsedSeconds);
    setPhase("submitting");
    try {
      const nextResult = await completeTimelineGame(prepared.sessionId, orderedItems.map((item) => item.id), completionElapsedSeconds);
      setResult(nextResult);
      setElapsedSeconds(nextResult.elapsedSeconds);
      setPhase("result");
    } catch {
      setErrorKey("resultRetry");
      setPhase("error");
    }
  }

  function retry() {
    if (errorKey === "resultRetry") {
      void submitResult();
      return;
    }
    setPrepared(null);
    setPhase("rules");
    setPrepareVersion((value) => value + 1);
  }

  return (
    <AppChrome
      title={title}
      eyebrow="Art Atlas"
      showBackButton
      showBottomDock={phase === "result" || phase === "error"}
      onNavigationRequest={requestNavigation}
      fixedFooterHeight={66}
      fixedFooter={activeGame ? (
        <View style={styles.completionDock}>
          <View style={styles.completionStatus}>
            <Ionicons name={orderedItems.length === TIMELINE_ITEM_COUNT ? "checkmark-circle" : "layers-outline"} size={19} color={orderedItems.length === TIMELINE_ITEM_COUNT ? colors.gold : colors.muted} />
            <View style={styles.completionStatusCopy}>
              <Text style={styles.completionCount}>{orderedItems.length} / {TIMELINE_ITEM_COUNT}</Text>
              <Text style={styles.completionLabel} numberOfLines={1}>
                {orderedItems.length === TIMELINE_ITEM_COUNT ? timelineGameCopy.orderReady[language] : timelineGameCopy.placed[language]}
              </Text>
            </View>
          </View>
          <Pressable
            accessibilityRole="button"
            disabled={orderedItems.length !== TIMELINE_ITEM_COUNT || phase === "submitting"}
            onPress={requestCompletion}
            style={[styles.completionButton, (orderedItems.length !== TIMELINE_ITEM_COUNT || phase === "submitting") && styles.disabled]}
          >
            <Text style={styles.completionButtonText} numberOfLines={1} adjustsFontSizeToFit>
              {phase === "submitting" ? timelineGameCopy.submitting[language] : timelineGameCopy.complete[language]}
            </Text>
            {phase !== "submitting" ? <Ionicons name="arrow-forward" size={17} color={colors.ink} /> : null}
          </Pressable>
        </View>
      ) : undefined}
    >
      <DecisionModal
        visible={completionPromptVisible}
        icon="checkmark-circle-outline"
        title={title}
        message={timelineGameCopy.completeQuestion[language]}
        cancelLabel={timelineGameCopy.cancel[language]}
        confirmLabel={timelineGameCopy.confirm[language]}
        onCancel={() => setCompletionPromptVisible(false)}
        onConfirm={() => void submitResult()}
        colors={colors}
        styles={styles}
      />
      <DecisionModal
        visible={exitPromptVisible}
        icon="warning-outline"
        title={timelineGameCopy.leaveTitle[language]}
        message={timelineGameCopy.leaveWarning[language]}
        cancelLabel={timelineGameCopy.stay[language]}
        confirmLabel={timelineGameCopy.leave[language]}
        onCancel={() => {
          pendingNavigationRef.current = null;
          setExitPromptVisible(false);
        }}
        onConfirm={confirmExit}
        colors={colors}
        styles={styles}
      />
      {phase === "rules" ? (
        <RulesModal title={title} ready={Boolean(prepared)} onCancel={() => router.back()} onReady={beginDraw} colors={colors} styles={styles} language={language} />
      ) : null}

      {phase === "drawing" || phase === "activating" ? (
        <View style={styles.preparationPanel}>
          <View style={styles.preparationDirectionHero}>
            <View style={styles.preparationIcon}>
              <Ionicons name={directionIcon} size={30} color={colors.gold} />
            </View>
            <View style={styles.preparationDirectionCopy}>
              <Text style={styles.preparationEyebrow}>{timelineGameCopy.mission[language]}</Text>
              <Text style={styles.preparationDirectionText} numberOfLines={1} adjustsFontSizeToFit>{directionLabel}</Text>
            </View>
          </View>
          <Text style={styles.preparationPrompt}>{directionPrompt}</Text>
          <Text style={styles.preparationStatus}>{phase === "drawing" ? timelineGameCopy.preparingQuestion[language] : timelineGameCopy.secureStart[language]}</Text>
          <View style={styles.preparationBoard}>
            <View style={styles.timelineBoard}>
              <View style={styles.boardPanel}>
                <View style={styles.boardHeadingRow}>
                  <Text style={styles.boardTitle} numberOfLines={1}>{timelineGameCopy.availableItems[language]}</Text>
                  <Text style={styles.boardCounter}>{TIMELINE_ITEM_COUNT}</Text>
                </View>
                <Text style={styles.boardHint} numberOfLines={1}>{timelineGameCopy.preparingQuestion[language]}</Text>
                <View style={styles.compactList}>
                  {slotItems.map((item, index) => (
                    <PoolTile
                      key={`${index}-${item.id}`}
                      item={item}
                      selected={false}
                      interactive={false}
                      failedImage={failedImageIds.has(item.id)}
                      onPress={() => undefined}
                      styles={styles}
                      language={language}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.orderPanel}>
                <View style={styles.boardHeadingRow}>
                  <Text style={styles.boardTitle} numberOfLines={1}>{timelineGameCopy.yourOrder[language]}</Text>
                  <Text style={styles.boardCounter}>0/{TIMELINE_ITEM_COUNT}</Text>
                </View>
                <Text style={styles.boardHint} numberOfLines={1}>{directionLabel}</Text>
                <View style={styles.compactList}>
                  {Array.from({ length: TIMELINE_ITEM_COUNT }).map((_, index) => (
                    <OrderTile key={index} index={index + 1} failedImage={false} onPress={() => undefined} styles={styles} language={language} />
                  ))}
                </View>
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {phase === "active" || phase === "submitting" ? (
        <View style={styles.gameWrap} pointerEvents={phase === "submitting" ? "none" : "auto"}>
          <View style={styles.missionCard}>
            <View style={styles.missionIcon}>
              <Ionicons name={directionIcon} size={23} color={colors.gold} />
            </View>
            <View style={styles.missionCopy}>
              <Text style={styles.missionEyebrow}>{timelineGameCopy.mission[language]}</Text>
              <Text style={styles.missionDirection} numberOfLines={1} adjustsFontSizeToFit>{directionLabel}</Text>
              <Text style={styles.missionPrompt}>{directionPrompt}</Text>
            </View>
          </View>
          <View style={styles.statRow}>
            <Stat label={timelineGameCopy.time[language]} value={`${elapsedSeconds}s`} styles={styles} />
            <Stat label={timelineGameCopy.potentialScore[language]} value={String(potentialScore)} styles={styles} />
            <Stat label={timelineGameCopy.selectionsLeft[language]} value={String(TIMELINE_ITEM_COUNT - orderedItems.length)} styles={styles} />
          </View>
          {timedOut ? <Text style={styles.timeout}>{timelineGameCopy.timeoutWarning[language]}</Text> : null}
          <View style={styles.timelineBoard}>
            <View style={styles.boardPanel}>
              <View style={styles.boardHeadingRow}>
                <Text style={styles.boardTitle} numberOfLines={1} adjustsFontSizeToFit>{timelineGameCopy.availableItems[language]}</Text>
                <Text style={styles.boardCounter}>{available.length}/{TIMELINE_ITEM_COUNT}</Text>
              </View>
              <Text style={styles.boardHint} numberOfLines={1}>{timelineGameCopy.chooseItems[language]}</Text>
              <View style={styles.compactList}>
                {slotItems.map((item) => (
                  <PoolTile
                    key={item.id}
                    item={item}
                    selected={!available.some((candidate) => candidate.id === item.id)}
                    failedImage={failedImageIds.has(item.id)}
                    onPress={() => selectItem(item)}
                    styles={styles}
                    language={language}
                  />
                ))}
              </View>
            </View>
            <View style={styles.orderPanel}>
              <View style={styles.boardHeadingRow}>
                <Text style={styles.boardTitle} numberOfLines={1} adjustsFontSizeToFit>{timelineGameCopy.yourOrder[language]}</Text>
                <Text style={styles.boardCounter}>{orderedItems.length}/{TIMELINE_ITEM_COUNT}</Text>
              </View>
              <Text style={styles.boardHint} numberOfLines={1}>{directionLabel}</Text>
              <View style={styles.compactList}>
                {Array.from({ length: TIMELINE_ITEM_COUNT }).map((_, index) => (
                  <OrderTile
                    key={ordered[index]?.id ?? `empty-${index}`}
                    item={ordered[index] ?? undefined}
                    index={index + 1}
                    failedImage={ordered[index] ? failedImageIds.has(ordered[index].id) : false}
                    onPress={() => ordered[index] && undoItem(ordered[index])}
                    styles={styles}
                    language={language}
                  />
                ))}
              </View>
            </View>
          </View>
        </View>
      ) : null}

      {phase === "result" && result ? (
        <ResultView result={result} ordered={orderedItems} gameType={gameType} onReplay={() => router.replace({ pathname: "/timeline-game", params: { type: gameType } })} colors={colors} styles={styles} language={language} />
      ) : null}

      {phase === "error" ? (
        <View style={styles.panel}>
          <Ionicons name="cloud-offline-outline" size={34} color={colors.gold} />
          <Text style={styles.heading}>{timelineGameCopy[errorKey][language]}</Text>
          {(errorKey === "networkError" || errorKey === "resultRetry") ? (
            <Pressable onPress={retry} style={styles.primary}><Text style={styles.primaryText}>{timelineGameCopy.retry[language]}</Text></Pressable>
          ) : null}
          <Pressable onPress={() => router.replace("/games")} style={styles.secondary}><Text style={styles.secondaryText}>{timelineGameCopy.backToGames[language]}</Text></Pressable>
        </View>
      ) : null}
    </AppChrome>
  );
}

function DecisionModal({ visible, icon, title, message, cancelLabel, confirmLabel, onCancel, onConfirm, colors, styles }: { visible: boolean; icon: keyof typeof Ionicons.glyphMap; title: string; message: string; cancelLabel: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void; colors: ReturnType<typeof getThemeColors>; styles: ReturnType<typeof createStyles> }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.decisionPanel}>
          <Ionicons name={icon} size={34} color={colors.gold} />
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.decisionMessage}>{message}</Text>
          <View style={styles.modalActions}>
            <Pressable onPress={onCancel} style={styles.modalCancel}><Text style={styles.secondaryText}>{cancelLabel}</Text></Pressable>
            <Pressable onPress={onConfirm} style={styles.modalReady}><Text style={styles.primaryText}>{confirmLabel}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function RulesModal({ title, ready, onCancel, onReady, colors, styles, language }: { title: string; ready: boolean; onCancel: () => void; onReady: () => void; colors: ReturnType<typeof getThemeColors>; styles: ReturnType<typeof createStyles>; language: "tr" | "en" | "ru" | "uz" }) {
  const rules = ["ruleRandom", "ruleChronology", "rulePosition", "ruleTime", "ruleTimeout", "ruleBest"] as const;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalPanel}>
          <Ionicons name="time-outline" size={34} color={colors.gold} />
          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalLead}>{timelineGameCopy.shortRule[language]}</Text>
          <View style={styles.ruleList}>
            {rules.map((key) => <Text key={key} style={styles.ruleText}>• {timelineGameCopy[key][language]}</Text>)}
          </View>
          {!ready ? (
            <View style={styles.modalPreparing}>
              <Ionicons name="images-outline" size={18} color={colors.gold} />
              <View style={styles.modalPreparingCopy}>
                <Text style={styles.modalPreparingTitle}>{timelineGameCopy.preparingQuestion[language]}</Text>
                <Text style={styles.modalPreparingText}>{timelineGameCopy.preparingImages[language]}</Text>
              </View>
            </View>
          ) : null}
          <View style={styles.modalActions}>
            <Pressable onPress={onCancel} style={styles.modalCancel}><Text style={styles.secondaryText}>{timelineGameCopy.cancel[language]}</Text></Pressable>
            <Pressable disabled={!ready} onPress={onReady} style={[styles.modalReady, !ready && styles.disabled]}><Text style={styles.primaryText}>{timelineGameCopy.ready[language]}</Text></Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ResultView({ result, ordered, gameType, onReplay, colors, styles, language }: { result: TimelineGameResult; ordered: TimelineGameItem[]; gameType: TimelineGameType; onReplay: () => void; colors: ReturnType<typeof getThemeColors>; styles: ReturnType<typeof createStyles>; language: "tr" | "en" | "ru" | "uz" }) {
  const router = useRouter();
  const expectedById = new Map(result.correctItems.map((item, index) => [item.id, index]));
  const resultById = new Map(result.correctItems.map((item) => [item.id, item]));
  const openItem = (id: string) => router.push({ pathname: gameType === "artwork" ? "/artwork/[id]" : "/artist/[id]", params: { id } });
  return (
    <View style={styles.resultWrap}>
      {result.newRecord ? <Text style={styles.record}>{timelineGameCopy.newRecord[language]}</Text> : null}
      <Text style={styles.resultScore}>{result.correctPositions} / {TIMELINE_ITEM_COUNT} {timelineGameCopy.correct[language]}</Text>
      <View style={styles.statRow}>
        <Stat label={timelineGameCopy.score[language]} value={String(result.score)} styles={styles} />
        <Stat label={timelineGameCopy.time[language]} value={`${result.elapsedSeconds}s`} styles={styles} />
        <Stat label={timelineGameCopy.dailyBest[language]} value={String(result.dailyBest)} styles={styles} />
      </View>
      {result.timedOut ? <Text style={styles.timeout}>{timelineGameCopy.timeoutWarning[language]}</Text> : null}
      <View style={styles.resultComparison}>
        <View style={styles.resultColumn}>
          <View style={styles.resultColumnHeader}>
            <Ionicons name="person-outline" size={16} color={colors.gold} />
            <Text style={styles.resultColumnTitle} numberOfLines={1} adjustsFontSizeToFit>{timelineGameCopy.yourOrder[language]}</Text>
          </View>
          <View style={styles.resultCompactList}>
            {ordered.map((item, index) => {
              const resolved = resultById.get(item.id);
              const correct = expectedById.get(item.id) === index;
              return (
                <Pressable key={item.id} onPress={() => openItem(item.id)} style={[styles.resultCompactRow, correct ? styles.resultCompactCorrect : styles.resultCompactWrong]}>
                  <Text style={styles.resultPosition}>{index + 1}</Text>
                  <TimelineImage item={item} styles={styles} />
                  <View style={styles.resultCompactCopy}>
                    <Text style={styles.resultCompactTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{timelineLocalizedText(item.title, language)}</Text>
                    <Text style={styles.resultCompactMeta} numberOfLines={1}>{resolved?.year ?? ""} · {timelineLocalizedText(item.subtitle, language)}</Text>
                  </View>
                  <Ionicons name={correct ? "checkmark-circle" : "close-circle"} size={14} color={correct ? colors.jade : colors.wine} />
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={[styles.resultColumn, styles.resultCorrectColumn]}>
          <View style={styles.resultColumnHeader}>
            <Ionicons name="checkmark-done" size={16} color={colors.gold} />
            <Text style={styles.resultColumnTitle} numberOfLines={1} adjustsFontSizeToFit>{timelineGameCopy.correctOrder[language]}</Text>
          </View>
          <View style={styles.resultCompactList}>
            {result.correctItems.map((item, index) => (
              <Pressable key={item.id} onPress={() => openItem(item.id)} style={styles.resultCompactRow}>
                <Text style={styles.resultPosition}>{index + 1}</Text>
                <TimelineImage item={item} styles={styles} />
                <View style={styles.resultCompactCopy}>
                  <Text style={styles.resultCompactTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{timelineLocalizedText(item.title, language)}</Text>
                  <Text style={styles.resultCompactMeta} numberOfLines={1}>{item.year} · {timelineLocalizedText(item.subtitle, language)}</Text>
                </View>
                <Ionicons name="chevron-forward" size={13} color={colors.gold} />
              </Pressable>
            ))}
          </View>
        </View>
      </View>
      <Text style={styles.hint}>{timelineGameCopy.reviewItems[language]}</Text>
      <Pressable onPress={() => router.push({ pathname: "/timeline-leaderboard", params: { type: gameType } })} style={styles.primary}><Text style={styles.primaryText}>{timelineGameCopy.leaderboard[language]}</Text></Pressable>
      <View style={styles.resultActions}>
        <Pressable onPress={onReplay} style={styles.secondary}><Text style={styles.secondaryText}>{timelineGameCopy.playAgain[language]}</Text></Pressable>
        <Pressable onPress={() => router.replace("/games")} style={styles.secondary}><Text style={styles.secondaryText}>{timelineGameCopy.backToGames[language]}</Text></Pressable>
      </View>
    </View>
  );
}

function PoolTile({ item, selected, interactive = true, failedImage, onPress, styles, language }: { item: TimelineGameItem; selected: boolean; interactive?: boolean; failedImage: boolean; onPress: () => void; styles: ReturnType<typeof createStyles>; language: "tr" | "en" | "ru" | "uz" }) {
  return (
    <Pressable disabled={selected || !interactive} onPress={onPress} style={[styles.poolTile, selected && styles.poolTileSelected]}>
      <BoardImage item={item} failed={failedImage} style="pool" styles={styles} />
      <View style={styles.compactTextWrap}>
        <Text style={styles.poolTileTitle} numberOfLines={2}>{timelineLocalizedText(item.title, language)}</Text>
        <Text style={styles.poolTileSubtitle} numberOfLines={1}>{timelineLocalizedText(item.subtitle, language)}</Text>
      </View>
      {selected ? <View style={styles.selectedMark}><Ionicons name="checkmark-circle" size={18} color="#d2b879" /></View> : interactive ? <Ionicons name="chevron-forward" size={13} color="#d2b879" /> : null}
    </Pressable>
  );
}

function OrderTile({ item, index, failedImage, onPress, styles, language }: { item?: TimelineGameItem; index: number; failedImage: boolean; onPress: () => void; styles: ReturnType<typeof createStyles>; language: "tr" | "en" | "ru" | "uz" }) {
  return (
    <Pressable disabled={!item} onPress={onPress} style={[styles.orderTile, item && styles.orderTileFilled]}>
      <Text style={styles.orderBadge}>{index}</Text>
      {item ? (
        <>
          <BoardImage item={item} failed={failedImage} style="order" styles={styles} />
          <View style={styles.compactTextWrap}>
            <Text style={styles.orderTileTitle} numberOfLines={2}>{timelineLocalizedText(item.title, language)}</Text>
            <Text style={styles.orderTileSubtitle} numberOfLines={1}>{timelineLocalizedText(item.subtitle, language)}</Text>
          </View>
          <View style={styles.orderUndo}><Ionicons name="arrow-undo" size={12} color="#f7e8c1" /></View>
        </>
      ) : <View style={styles.emptyOrder}><Ionicons name="add" size={15} color="#8f7955" /><View style={styles.emptyOrderLine} /></View>}
    </Pressable>
  );
}

function BoardImage({ item, failed, style, styles }: { item: TimelineGameItem; failed: boolean; style: "pool" | "order" | "slot"; styles: ReturnType<typeof createStyles> }) {
  const imageStyle = style === "pool" ? styles.poolImage : style === "order" ? styles.orderImage : styles.slotImage;
  if (!item.image || failed) return <View style={[imageStyle, styles.imagePlaceholder]}><Ionicons name={item.kind === "artist" ? "person-outline" : "image-outline"} size={18} color="#d2b879" /></View>;
  return <Image source={{ uri: item.image }} style={imageStyle} contentFit="cover" cachePolicy="memory-disk" />;
}

function TimelineImage({ item, styles }: { item: TimelineGameItem; styles: ReturnType<typeof createStyles> }) {
  if (!item.image) return <View style={[styles.itemImage, styles.imagePlaceholder]}><Ionicons name="person-outline" size={22} color="#d2b879" /></View>;
  return <Image source={{ uri: item.image }} style={styles.itemImage} contentFit="cover" cachePolicy="memory-disk" transition={120} />;
}

function Stat({ label, value, styles }: { label: string; value: string; styles: ReturnType<typeof createStyles> }) {
  return <View style={styles.stat}><Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>{label}</Text><Text style={styles.statValue}>{value}</Text></View>;
}

function errorCopyKey(error: unknown): "notEnoughContent" | "dailyLimit" | "networkError" {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("TIMELINE_NOT_ENOUGH_CONTENT")) return "notEnoughContent";
  if (message.includes("TIMELINE_DAILY_LIMIT_REACHED")) return "dailyLimit";
  return "networkError";
}

function emptyTimelineOrder() {
  return Array<TimelineGameItem | null>(TIMELINE_ITEM_COUNT).fill(null);
}

async function preloadTimelineImages(items: TimelineGameItem[]) {
  const results = await Promise.all(items.map(async (item) => {
    if (!item.image) return item.id;
    const loaded = await Promise.race([
      Image.prefetch(item.image, { cachePolicy: "memory-disk" }).catch(() => false),
      new Promise<boolean>((resolve) => setTimeout(() => resolve(false), 4_000))
    ]);
    return loaded ? null : item.id;
  }));
  return new Set(results.filter((id): id is string => id !== null));
}

function createStyles(colors: ReturnType<typeof getThemeColors>, width = 390, height = 844) {
  const compactHeight = height < 760;
  const compactWidth = width < 375;
  const rowHeight = compactHeight ? 38 : height < 850 ? 42 : 46;
  const rowImageSize = rowHeight - 4;
  return StyleSheet.create({
    gameWrap: { gap: 8 },
    panel: { borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 16, alignItems: "center", gap: 14 },
    heading: { color: colors.ivory, fontSize: 19, lineHeight: 25, fontWeight: "900", textAlign: "center" },
    preparationPanel: { borderRadius: 14, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 14, alignItems: "center", gap: 7 },
    preparationDirectionHero: { alignSelf: "stretch", minHeight: 66, borderRadius: 12, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.panelSoft, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 7 },
    preparationIcon: { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center" },
    preparationDirectionCopy: { flex: 1, minWidth: 0 },
    preparationEyebrow: { color: colors.gold, fontSize: 11, letterSpacing: 2, fontWeight: "900" },
    preparationDirectionText: { color: colors.ivory, fontSize: compactHeight ? 21 : 26, lineHeight: compactHeight ? 25 : 30, fontWeight: "900", textTransform: "uppercase" },
    preparationPrompt: { color: colors.ivory, fontSize: 14, lineHeight: 18, fontWeight: "900", textAlign: "center" },
    preparationStatus: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: "800", textAlign: "center", marginBottom: 3 },
    preparationBoard: { alignSelf: "stretch", marginTop: 3 },
    missionCard: { minHeight: compactHeight ? 64 : 72, borderRadius: 12, borderWidth: 1, borderColor: colors.line, borderLeftWidth: 4, borderLeftColor: colors.gold, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 11, paddingVertical: 7 },
    missionIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.panelSoft, alignItems: "center", justifyContent: "center" },
    missionCopy: { flex: 1, minWidth: 0 },
    missionEyebrow: { color: colors.gold, fontSize: 10, letterSpacing: 0.8, fontWeight: "900" },
    missionDirection: { color: colors.ivory, fontSize: compactHeight ? 17 : 20, lineHeight: compactHeight ? 20 : 23, fontWeight: "900", textTransform: "uppercase" },
    missionPrompt: { color: colors.muted, fontSize: compactHeight ? 10 : 11, lineHeight: compactHeight ? 12 : 14, fontWeight: "800", marginTop: 1 },
    statRow: { flexDirection: "row", gap: 6 },
    stat: { flex: 1, minHeight: 48, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, padding: 5, alignItems: "center", justifyContent: "center" },
    statLabel: { color: colors.muted, fontSize: 9, fontWeight: "800", textAlign: "center" },
    statValue: { color: colors.gold, fontSize: 16, fontWeight: "900", marginTop: 1 },
    timeout: { borderRadius: 8, backgroundColor: colors.wine, color: colors.ivory, fontSize: 11, lineHeight: 15, fontWeight: "900", textAlign: "center", padding: 7 },
    sectionTitle: { color: colors.ivory, fontSize: 18, fontWeight: "900", marginTop: 6 },
    hint: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: "700", textAlign: "center" },
    orderList: { gap: 7 },
    itemCard: { minHeight: 70, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 10, padding: 8 },
    itemImage: { width: compactHeight ? 27 : 34, height: compactHeight ? 27 : 34, borderRadius: 5, backgroundColor: colors.panelSoft },
    imagePlaceholder: { alignItems: "center", justifyContent: "center" },
    itemTextWrap: { flex: 1, minWidth: 0 },
    itemTitle: { color: colors.ivory, fontSize: 14, lineHeight: 18, fontWeight: "900" },
    itemSubtitle: { color: colors.muted, fontSize: 11, lineHeight: 15, fontWeight: "700", marginTop: 2 },
    position: { minWidth: 24, color: colors.gold, fontWeight: "900" },
    primary: { minHeight: 48, borderRadius: 10, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", paddingHorizontal: 16 },
    primaryText: { color: colors.ink, fontWeight: "900", textAlign: "center" },
    completionDock: {
      width: "100%",
      maxWidth: 560,
      minHeight: 62,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: compactWidth ? 10 : 12,
      paddingVertical: 8,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.32,
      shadowRadius: 12,
      elevation: 12
    },
    completionStatus: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 7 },
    completionStatusCopy: { flex: 1, minWidth: 0 },
    completionCount: { color: colors.ivory, fontSize: compactWidth ? 13 : 14, lineHeight: 17, fontWeight: "900" },
    completionLabel: { color: colors.muted, fontSize: compactWidth ? 9 : 10, lineHeight: 13, fontWeight: "800" },
    completionButton: { minWidth: compactWidth ? 120 : 142, minHeight: 44, borderRadius: 12, backgroundColor: colors.gold, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingHorizontal: compactWidth ? 10 : 14 },
    completionButtonText: { color: colors.ink, fontSize: compactWidth ? 11 : 12, fontWeight: "900", textAlign: "center", flexShrink: 1 },
    secondary: { flex: 1, minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
    secondaryText: { color: colors.ivory, fontWeight: "900", textAlign: "center" },
    disabled: { opacity: 0.42 },
    timelineBoard: { flexDirection: "row", alignItems: "stretch", gap: 7 },
    boardPanel: { flex: 1.08, minWidth: 0, borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: compactWidth ? 5 : 7 },
    orderPanel: { flex: 0.92, minWidth: 0, borderRadius: 12, borderWidth: 1, borderColor: colors.gold, backgroundColor: colors.panelSoft, padding: compactWidth ? 5 : 7 },
    boardHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
    boardTitle: { flexShrink: 1, color: colors.ivory, fontSize: compactWidth ? 10 : 11.5, fontWeight: "900" },
    boardCounter: { color: colors.gold, fontSize: 9, fontWeight: "900", marginLeft: 3 },
    boardHint: { color: colors.muted, fontSize: compactWidth ? 7.5 : 8.5, lineHeight: 11, fontWeight: "700", marginBottom: 4 },
    compactList: { gap: 3 },
    poolTile: { height: rowHeight, borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, flexDirection: "row", alignItems: "center", gap: compactWidth ? 3 : 5, paddingHorizontal: 2, overflow: "hidden" },
    poolTileSelected: { borderColor: colors.gold, opacity: 0.58 },
    poolImage: { width: rowImageSize, height: rowImageSize, borderRadius: 4, backgroundColor: colors.panelSoft },
    compactTextWrap: { flex: 1, minWidth: 0, justifyContent: "center" },
    poolTileTitle: { color: colors.ivory, fontSize: compactHeight ? 9 : 10.5, lineHeight: compactHeight ? 10.5 : 12.5, fontWeight: "900" },
    poolTileSubtitle: { color: colors.muted, fontSize: compactHeight ? 8 : 9, lineHeight: compactHeight ? 9.5 : 11, fontWeight: "700" },
    selectedMark: { width: 18, alignItems: "center", justifyContent: "center" },
    orderTile: { height: rowHeight, borderRadius: 6, borderWidth: 1, borderStyle: "dashed", borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: compactWidth ? 3 : 4, paddingLeft: 3, paddingRight: 2, overflow: "hidden" },
    orderTileFilled: { borderStyle: "solid", borderColor: colors.gold },
    orderImage: { width: rowImageSize, height: rowImageSize, borderRadius: 4, marginLeft: 17, backgroundColor: colors.panelSoft },
    orderTileTitle: { color: colors.ivory, fontSize: compactHeight ? 8.8 : 10, lineHeight: compactHeight ? 10.5 : 12, fontWeight: "900" },
    orderTileSubtitle: { color: colors.muted, fontSize: compactHeight ? 7.8 : 8.8, lineHeight: compactHeight ? 9 : 10, fontWeight: "700" },
    orderBadge: { position: "absolute", zIndex: 3, left: 3, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: colors.gold, color: colors.ink, fontSize: 9, lineHeight: 16, fontWeight: "900", textAlign: "center", overflow: "hidden" },
    orderUndo: { width: 17, height: 17, borderRadius: 9, backgroundColor: "rgba(20,14,10,0.82)", alignItems: "center", justifyContent: "center" },
    emptyOrder: { flex: 1, marginLeft: 21, flexDirection: "row", alignItems: "center", gap: 5 },
    emptyOrderLine: { flex: 1, height: 1, backgroundColor: colors.line, marginRight: 5 },
    slotGrid: { alignSelf: "stretch", flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: 6, marginTop: 7 },
    slotCard: { width: "18%", height: 76, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, alignItems: "center", overflow: "hidden" },
    slotImage: { width: "100%", height: 52, backgroundColor: colors.panelSoft },
    slotText: { width: "100%", color: colors.ivory, fontSize: 8, lineHeight: 10, fontWeight: "800", textAlign: "center", paddingHorizontal: 2, paddingVertical: 3 },
    modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.62)", justifyContent: "center", padding: 18 },
    modalPanel: { width: "100%", maxWidth: 460, alignSelf: "center", borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 18, alignItems: "center", gap: 10 },
    decisionPanel: { width: "100%", maxWidth: 420, alignSelf: "center", borderRadius: 12, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 18, alignItems: "center", gap: 10 },
    decisionMessage: { color: colors.muted, fontSize: 14, lineHeight: 21, fontWeight: "700", textAlign: "center" },
    modalTitle: { color: colors.ivory, fontSize: 22, fontWeight: "900", textAlign: "center" },
    modalLead: { color: colors.gold, lineHeight: 20, fontWeight: "900", textAlign: "center" },
    ruleList: { alignSelf: "stretch", gap: 6, marginVertical: 4 },
    ruleText: { color: colors.muted, fontSize: 13, lineHeight: 18, fontWeight: "700" },
    modalActions: { alignSelf: "stretch", flexDirection: "row", gap: 8, marginTop: 5 },
    modalCancel: { flex: 1, minHeight: 46, borderRadius: 10, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
    modalReady: { flex: 1.35, minHeight: 46, borderRadius: 10, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
    modalPreparing: { alignSelf: "stretch", borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, flexDirection: "row", alignItems: "center", gap: 9, padding: 9 },
    modalPreparingCopy: { flex: 1, minWidth: 0 },
    modalPreparingTitle: { color: colors.ivory, fontSize: 12, fontWeight: "900" },
    modalPreparingText: { color: colors.muted, fontSize: 10, lineHeight: 14, fontWeight: "700", marginTop: 2 },
    resultWrap: { gap: 12 },
    record: { alignSelf: "center", borderRadius: 999, backgroundColor: colors.gold, color: colors.ink, fontSize: 15, fontWeight: "900", paddingHorizontal: 18, paddingVertical: 8 },
    resultScore: { color: colors.ivory, fontSize: 28, fontWeight: "900", textAlign: "center" },
    resultRow: { minHeight: 48, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10 },
    resultRowText: { flex: 1, color: colors.ivory, fontWeight: "800" },
    resultItem: { minHeight: 70, borderRadius: 9, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 8, padding: 8 },
    resultComparison: { flexDirection: "row", alignItems: "flex-start", gap: 7 },
    resultColumn: { flex: 1, minWidth: 0, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: compactWidth ? 5 : 7 },
    resultCorrectColumn: { borderColor: colors.gold, backgroundColor: colors.panelSoft },
    resultColumnHeader: { minHeight: 28, flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 2, marginBottom: 5 },
    resultColumnTitle: { flex: 1, color: colors.ivory, fontSize: compactWidth ? 10 : 12, fontWeight: "900" },
    resultCompactList: { gap: 4 },
    resultCompactRow: { minHeight: compactHeight ? 34 : 42, borderRadius: 6, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, flexDirection: "row", alignItems: "center", gap: compactWidth ? 3 : 5, padding: 3 },
    resultCompactCorrect: { borderColor: colors.jade },
    resultCompactWrong: { borderColor: colors.wine },
    resultPosition: { minWidth: compactWidth ? 14 : 17, color: colors.gold, fontSize: compactHeight ? 8 : 10, fontWeight: "900", textAlign: "center" },
    resultCompactCopy: { flex: 1, minWidth: 0 },
    resultCompactTitle: { color: colors.ivory, fontSize: compactHeight ? 7.8 : 9.2, lineHeight: compactHeight ? 9 : 11, fontWeight: "900" },
    resultCompactMeta: { color: colors.muted, fontSize: compactHeight ? 6.7 : 7.8, lineHeight: compactHeight ? 8 : 10, fontWeight: "700" },
    resultActions: { flexDirection: "row", gap: 8 }
  });
}
