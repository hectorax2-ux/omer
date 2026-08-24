import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { AuthRequired } from "@/components/auth-required";
import { RewardedScoreGate } from "@/components/rewarded-score-gate";
import { getThemeColors } from "@/constants/theme";
import { useAccount } from "@/hooks/use-account";
import { useArtSystems } from "@/hooks/use-art-systems";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { duelCopy } from "@/app/i18n/duels";
import {
  canChangeProphecyPrediction,
  formatProphecyCountdown,
  getProphecyLastWriteAt,
  PREMIUM_PROPHECY_CHANGE_COOLDOWN_MS,
  type ProphecyPredictionTimes
} from "@/app/utils/prophecy-prediction";
import {
  buildDuelVoteCounts,
  calculateDuelPercentages,
  createOptimisticDuelVote,
  serverSnapshotIncludesOptimisticVote,
  type OptimisticDuelVote
} from "@/app/utils/duel-optimistic-vote";
import { getText, type ProphecyWeek } from "@/types/art-systems";

export default function DuelsScreen() {
  const { isAuthenticated } = useAccount();
  const { language } = useLanguage();
  if (!isAuthenticated) return <AuthRequired title={duelCopy(language).screenTitle} />;
  return <AuthenticatedDuelsScreen />;
}

function AuthenticatedDuelsScreen() {
  const { language } = useLanguage();
  const copy = duelCopy(language);
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const { width } = useWindowDimensions();
  const reducedMotion = useReducedMotion();
  const styles = useMemo(() => createStyles(colors, width), [colors, width]);
  const router = useRouter();
  const { account } = useAccount();
  const { duels, prophecyPredictions, prophecyPredictionTimes, prophecyWeeks, makeProphecyPrediction, userDuelVoteChanges, userDuelVotes, voteDuel } = useArtSystems();
  const [message, setMessage] = useState("");
  const [pendingVotes, setPendingVotes] = useState<Record<string, string>>({});
  const [optimisticVotes, setOptimisticVotes] = useState<Record<string, OptimisticDuelVote>>({});
  const [confirmingVote, setConfirmingVote] = useState<{ duelId: string; optionId: string } | null>(null);
  const [voteBusy, setVoteBusy] = useState(false);
  const voteInFlightRef = useRef(new Set<string>());
  const duelsRef = useRef(duels);
  duelsRef.current = duels;
  const [confirmingPrediction, setConfirmingPrediction] = useState<{ weekId: string; candidateId: string; isChange: boolean } | null>(null);
  const [prophecyGate, setProphecyGate] = useState<{ weekId: string; candidateId: string } | null>(null);
  const [section, setSection] = useState<"menu" | "artwork" | "artist" | "prophecyMenu" | "prophecyArtwork" | "prophecyArtist">("menu");
  const activeDuels = duels.filter((duel) => duel.active && (section === "artwork" ? duel.kind === "artwork" : section === "artist" ? duel.kind === "artist" : true));
  const duelRuleText = copy.duelRule;
  const arenaImages = duels.flatMap((duel) => [duel.sideA.image, duel.sideB.image]).filter(Boolean).slice(0, 3);

  useEffect(() => {
    const images = [...new Set([
      ...duels.flatMap((duel) => [duel.sideA.image, duel.sideB.image]),
      ...Object.values(prophecyWeeks).flatMap((week) => week.candidates.map((candidate) => candidate.image))
    ].filter(Boolean))];
    void Promise.all(images.map((image) => Image.prefetch(image).catch(() => false)));
  }, [duels, prophecyWeeks]);

  useEffect(() => {
    setOptimisticVotes((current) => {
      const reconciled = Object.entries(current).filter(([duelId, optimisticVote]) => {
        const duel = duels.find((item) => item.id === duelId);
        if (!duel) return true;
        return !serverSnapshotIncludesOptimisticVote(
          buildDuelVoteCounts(duel.sideA.id, duel.sideB.id, duel.votesA, duel.votesB),
          optimisticVote
        );
      });
      return reconciled.length === Object.keys(current).length ? current : Object.fromEntries(reconciled);
    });
  }, [duels]);

  function predict(weekId: string, candidateId: string) {
    const week = Object.values(prophecyWeeks).find((item) => item.id === weekId);
    if (!week) return;
    const existing = prophecyPredictions[weekId];
    const withinWindow = isWithinFirstHours(week.startsAt, 48);
    if (!withinWindow) return;
    if (existing && !account.isPremium) return;
    if (existing === candidateId) return;
    if (existing && !canChangeProphecyPrediction(prophecyPredictionTimes[weekId])) return;
    setConfirmingPrediction({ weekId, candidateId, isChange: !!existing });
  }

  function confirmVote(id: string, optionId: string) {
    setConfirmingVote({ duelId: id, optionId });
  }

  async function vote(id: string, optionId: string) {
    if (voteInFlightRef.current.has(id)) return;
    const duel = duelsRef.current.find((item) => item.id === id);
    if (!duel || (optionId !== duel.sideA.id && optionId !== duel.sideB.id)) return;
    const optimisticVote = createOptimisticDuelVote(
      buildDuelVoteCounts(duel.sideA.id, duel.sideB.id, duel.votesA, duel.votesB),
      optionId,
      userDuelVotes[id]
    );
    voteInFlightRef.current.add(id);
    setVoteBusy(true);
    setOptimisticVotes((current) => ({ ...current, [id]: optimisticVote }));
    try {
      const result = await voteDuel(id, optionId);
      setMessage(result.message);
      if (result.ok) {
        setPendingVotes((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
        setOptimisticVotes((current) => {
          const pendingOptimisticVote = current[id];
          if (!pendingOptimisticVote) return current;
          const completedVote = { ...pendingOptimisticVote, writeComplete: true };
          const latestDuel = duelsRef.current.find((item) => item.id === id);
          if (latestDuel && serverSnapshotIncludesOptimisticVote(
            buildDuelVoteCounts(latestDuel.sideA.id, latestDuel.sideB.id, latestDuel.votesA, latestDuel.votesB),
            completedVote
          )) {
            const next = { ...current };
            delete next[id];
            return next;
          }
          return { ...current, [id]: completedVote };
        });
      } else {
        setOptimisticVotes((current) => {
          const next = { ...current };
          delete next[id];
          return next;
        });
      }
    } finally {
      voteInFlightRef.current.delete(id);
      setVoteBusy(false);
      setConfirmingVote(null);
    }
  }

  function selectDuelOption(duelId: string, optionId: string, votedOptionId?: string, canUsePremiumChange = false) {
    setPendingVotes((current) => {
      const next = { ...current };
      if (votedOptionId && canUsePremiumChange && optionId === votedOptionId) {
        delete next[duelId];
        return next;
      }
      next[duelId] = optionId;
      return next;
    });
  }

  function confirmPrediction() {
    if (!confirmingPrediction) return;
    const { weekId, candidateId, isChange } = confirmingPrediction;
    setConfirmingPrediction(null);
    if (account.isPremium || isChange) {
      void makeProphecyPrediction(weekId, candidateId).then((result) => {
        setMessage(result.message);
      });
      return;
    }
    setProphecyGate({ weekId, candidateId });
  }

  return (
    <AppChrome title={copy.screenTitle} eyebrow="Art Atlas" showBackButton backToHome showFloatingShortcuts={false}>
      {message ? <Text style={styles.message}>{message}</Text> : null}
      {section === "menu" ? (
        <>
          <OracleArenaHero images={arenaImages} title={copy.chooseChallenge} subtitle={copy.menuHint} reducedMotion={reducedMotion} styles={styles} colors={colors} />
          <View style={styles.portalGrid}>
            <DuelMenuCard compact icon="images-outline" title={copy.artworkDuel} text={copy.artworkDuelText} accent="#27B5FF" onPress={() => setSection("artwork")} styles={styles} colors={colors} />
            <DuelMenuCard compact icon="brush-outline" title={copy.artistDuel} text={copy.artistDuelText} accent="#9B6CFF" onPress={() => setSection("artist")} styles={styles} colors={colors} />
          </View>
          <DuelMenuCard featured icon="sparkles-outline" title={copy.prophecyDuel} text={copy.prophecyDuelText} accent="#E942B8" onPress={() => setSection("prophecyMenu")} styles={styles} colors={colors} />
          <DuelMenuCard ranking icon="podium-outline" title={copy.leaderboard} text={copy.leaderboardText} accent={colors.gold} onPress={() => router.push({ pathname: "/leaderboards", params: { board: "prophecy" } })} styles={styles} colors={colors} />
        </>
      ) : null}

      {section !== "menu" ? (
        <Pressable onPress={() => setSection("menu")} style={styles.backToList}>
          <Ionicons name="chevron-back" size={18} color={colors.gold} />
          <Text style={styles.backToListText}>{copy.backToList}</Text>
        </Pressable>
      ) : null}

      {section === "prophecyMenu" ? (
        <>
          <DuelMenuCard icon="images-outline" title={copy.prophecyArtwork} text={copy.prophecyArtworkText} onPress={() => setSection("prophecyArtwork")} styles={styles} colors={colors} />
          <DuelMenuCard icon="brush-outline" title={copy.prophecyArtist} text={copy.prophecyArtistText} onPress={() => setSection("prophecyArtist")} styles={styles} colors={colors} />
        </>
      ) : null}

      {(section === "artwork" || section === "artist") ? activeDuels.map((duel) => {
        const votedOptionId = userDuelVotes[duel.id];
        const optimisticVote = optimisticVotes[duel.id];
        const pending = pendingVotes[duel.id];
        const selectedOptionId = pending ?? optimisticVote?.selectedOptionId ?? votedOptionId;
        const hasVoted = Boolean(votedOptionId || optimisticVote);
        const displayCounts = optimisticVote?.displayCounts
          ?? buildDuelVoteCounts(duel.sideA.id, duel.sideB.id, duel.votesA, duel.votesB);
        const percentages = calculateDuelPercentages(displayCounts, duel.sideA.id, duel.sideB.id, hasVoted ? selectedOptionId : undefined);
        const changeCount = userDuelVoteChanges[duel.id] ?? 0;
        const canUsePremiumChange = Boolean(votedOptionId) && !optimisticVote && account.isPremium && changeCount < 1;
        const canConfirmPremiumChange = canUsePremiumChange && pending && pending !== votedOptionId;
        const canInteract = !hasVoted || canUsePremiumChange;
        const canConfirm = !hasVoted ? !!pending : !!canConfirmPremiumChange;
        const statusText = getDuelStatusText(copy, hasVoted, account.isPremium, changeCount);
        return (
          <View key={duel.id} style={styles.card}>
            <View style={styles.cardHead}>
              <Ionicons name={duel.kind === "artist" ? "brush" : "images"} size={20} color={colors.gold} />
              <View style={styles.headText}>
                <Text style={styles.title}>{getText(duel.title, language)}</Text>
                <Text style={styles.meta}>{formatDate(duel.startsAt)} - {formatDate(duel.endsAt)}</Text>
              </View>
              <Text style={styles.live}>{duel.status === "active" ? "LIVE" : duel.status}</Text>
            </View>
            <Text style={styles.note}>{duelRuleText}</Text>
            <View style={styles.duelRow}>
              <DuelSide image={duel.sideA.image} title={getText(duel.sideA.title, language)} subtitle={getText(duel.sideA.subtitle, language)} percent={percentages[duel.sideA.id]} selected={selectedOptionId === duel.sideA.id} showResults={hasVoted} disabled={!canInteract} onPress={() => selectDuelOption(duel.id, duel.sideA.id, votedOptionId, canUsePremiumChange)} onInspect={duel.sideA.sourceId ? () => router.push({ pathname: duel.kind === "artist" ? "/artist/[id]" : "/artwork/[id]", params: { id: duel.sideA.sourceId as string } }) : undefined} inspectLabel={duel.kind === "artist" ? copy.inspectArtist : copy.inspectArtwork} styles={styles} colors={colors} pickLabel={copy.pick} pickedLabel={copy.picked} />
              <DuelSide image={duel.sideB.image} title={getText(duel.sideB.title, language)} subtitle={getText(duel.sideB.subtitle, language)} percent={percentages[duel.sideB.id]} selected={selectedOptionId === duel.sideB.id} showResults={hasVoted} disabled={!canInteract} onPress={() => selectDuelOption(duel.id, duel.sideB.id, votedOptionId, canUsePremiumChange)} onInspect={duel.sideB.sourceId ? () => router.push({ pathname: duel.kind === "artist" ? "/artist/[id]" : "/artwork/[id]", params: { id: duel.sideB.sourceId as string } }) : undefined} inspectLabel={duel.kind === "artist" ? copy.inspectArtist : copy.inspectArtwork} styles={styles} colors={colors} pickLabel={copy.pick} pickedLabel={copy.picked} />
            </View>
            {!canConfirm ? (
              <Text style={styles.statusNote}>{statusText}</Text>
            ) : (
              <Pressable disabled={!canConfirm} onPress={() => pending && confirmVote(duel.id, pending)} style={[styles.confirmButton, !canConfirm && styles.confirmDisabled]}>
                <Text style={styles.confirmText}>{copy.confirmVote}</Text>
              </Pressable>
            )}
          </View>
        );
      }) : null}

      {(section === "artwork" || section === "artist") && activeDuels.length === 0 ? (
        <View style={styles.card}>
          <View style={styles.cardHead}>
            <Ionicons name="hourglass-outline" size={22} color={colors.gold} />
            <Text style={styles.note}>{copy.duelPreparing}</Text>
          </View>
        </View>
      ) : null}

      {section === "prophecyArtwork" ? <ProphecyPanel week={prophecyWeeks.artwork} prediction={prophecyPredictions[prophecyWeeks.artwork.id]} predictionTimes={prophecyPredictionTimes[prophecyWeeks.artwork.id]} isPremium={account.isPremium} onPredict={predict} styles={styles} colors={colors} copy={copy} language={language} /> : null}
      {section === "prophecyArtist" ? <ProphecyPanel week={prophecyWeeks.artist} prediction={prophecyPredictions[prophecyWeeks.artist.id]} predictionTimes={prophecyPredictionTimes[prophecyWeeks.artist.id]} isPremium={account.isPremium} onPredict={predict} styles={styles} colors={colors} copy={copy} language={language} /> : null}
      <ConfirmModal
        visible={!!confirmingVote}
        title={copy.confirmVoteTitle}
        text={copy.confirmVoteBody}
        cancelText={copy.confirmVoteCancel}
        confirmText={copy.confirmVoteOk}
        onCancel={() => setConfirmingVote(null)}
        onConfirm={() => {
          if (confirmingVote) void vote(confirmingVote.duelId, confirmingVote.optionId);
        }}
        busy={voteBusy}
        styles={styles}
        colors={colors}
      />
      <ConfirmModal
        visible={!!confirmingPrediction}
        title={copy.confirmPredictionTitle}
        text={account.isPremium ? copy.confirmPredictionBodyPremium : copy.confirmPredictionBodyNormal}
        cancelText={copy.confirmPredictionCancel}
        confirmText={confirmingPrediction?.isChange ? copy.confirmPredictionChangeOk : copy.confirmPredictionOk}
        onCancel={() => setConfirmingPrediction(null)}
        onConfirm={confirmPrediction}
        styles={styles}
        colors={colors}
      />
      <Modal visible={!!prophecyGate} transparent animationType="fade" onRequestClose={() => setProphecyGate(null)}>
        <View style={styles.modalOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setProphecyGate(null)} />
          <View style={styles.confirmModal}>
            {prophecyGate ? (
              <RewardedScoreGate
                language={language}
                score="★"
                scoreLabel={copy.prophecyPick}
                onSubmit={async () => {
                  const result = await makeProphecyPrediction(prophecyGate.weekId, prophecyGate.candidateId);
                  setMessage(result.message);
                  setProphecyGate(null);
                }}
              />
            ) : null}
          </View>
        </View>
      </Modal>
    </AppChrome>
  );
}

function ConfirmModal({ visible, title, text, cancelText, confirmText, busy = false, onCancel, onConfirm, styles, colors }: { visible: boolean; title: string; text: string; cancelText: string; confirmText: string; busy?: boolean; onCancel: () => void; onConfirm: () => void; styles: ReturnType<typeof createStyles>; colors: ReturnType<typeof getThemeColors> }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        <View style={styles.confirmModal}>
          <Ionicons name="shield-checkmark-outline" size={34} color={colors.gold} />
          <Text style={styles.confirmTitle}>{title}</Text>
          <Text style={styles.confirmBody}>{text}</Text>
          <View style={styles.confirmRow}>
            <Pressable onPress={onCancel} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>{cancelText}</Text>
            </Pressable>
            <Pressable disabled={busy} onPress={onConfirm} style={[styles.confirmSmallButton, busy && styles.confirmDisabled]}>
              <Text style={styles.confirmText}>{confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function OracleArenaHero({ images, title, subtitle, reducedMotion, styles, colors }: { images: string[]; title: string; subtitle: string; reducedMotion: boolean; styles: ReturnType<typeof createStyles>; colors: ReturnType<typeof getThemeColors> }) {
  const motion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      motion.setValue(0.15);
      return;
    }
    const animation = Animated.loop(Animated.timing(motion, { toValue: 1, duration: 7800, easing: Easing.linear, useNativeDriver: true }));
    animation.start();
    return () => animation.stop();
  }, [motion, reducedMotion]);

  return (
    <LinearGradient colors={["rgba(36,38,98,0.92)", "rgba(45,20,80,0.95)", "rgba(93,25,80,0.88)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.heroCard}>
      <View style={styles.heroParticles} pointerEvents="none">
        <View style={[styles.heroParticle, { left: "12%", top: 28 }]} />
        <View style={[styles.heroParticle, { right: "16%", top: 42 }]} />
        <View style={[styles.heroParticle, { left: "22%", bottom: 24 }]} />
      </View>
      <Animated.View style={[styles.arenaOrbit, { transform: [{ rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ["0deg", "360deg"] }) }] }]}>
        {images.map((image, index) => (
          <View key={`${image}-${index}`} style={[styles.orbitArtwork, index === 0 ? styles.orbitArtworkTop : index === 1 ? styles.orbitArtworkRight : styles.orbitArtworkLeft]}>
            <Image source={{ uri: image }} style={styles.orbitArtworkImage} contentFit="cover" transition={150} />
          </View>
        ))}
      </Animated.View>
      <Animated.View style={[styles.arenaCore, { transform: [{ translateY: reducedMotion ? 0 : motion.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, -4, 1] }) }] }]}>
        <View style={styles.arenaCoreRing}><Ionicons name="flash" size={25} color="#FFF3C5" /></View>
      </Animated.View>
      <View style={styles.heroCopy}>
        <Text style={styles.heroEyebrow}>ART ATLAS · ORACLE</Text>
        <Text style={styles.heroTitle}>{title}</Text>
        <Text style={styles.heroSubtitle}>{subtitle}</Text>
      </View>
    </LinearGradient>
  );
}

function DuelMenuCard({ icon, title, text, accent, compact, featured, ranking, onPress, styles, colors }: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string; accent?: string; compact?: boolean; featured?: boolean; ranking?: boolean; onPress: () => void; styles: ReturnType<typeof createStyles>; colors: ReturnType<typeof getThemeColors> }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}. ${text}`} onPress={onPress} style={({ pressed }) => [styles.menuCard, compact && styles.portalCard, featured && styles.featuredPortal, ranking && styles.rankingPortal, pressed && styles.menuCardPressed]}>
      {featured ? <LinearGradient colors={["rgba(74,39,124,0.96)", "rgba(143,37,116,0.92)"]} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={StyleSheet.absoluteFill} /> : null}
      <View style={[styles.menuIcon, { borderColor: accent ?? colors.gold, backgroundColor: `${accent ?? colors.gold}1F` }]}>
        <Ionicons name={icon} size={compact ? 22 : 24} color={accent ?? colors.gold} />
      </View>
      <View style={styles.headText}>
        <Text style={[styles.title, compact && styles.portalTitle]} numberOfLines={compact ? 2 : 1}>{title}</Text>
        <Text style={[styles.meta, compact && styles.portalMeta]} numberOfLines={compact ? 2 : 1}>{text}</Text>
      </View>
      {!compact ? <Ionicons name="chevron-forward" size={18} color={ranking ? colors.gold : colors.muted} /> : null}
    </Pressable>
  );
}

function ProphecyPanel({
  week,
  prediction,
  predictionTimes,
  isPremium,
  onPredict,
  styles,
  colors,
  copy,
  language
}: {
  week: ReturnType<typeof useArtSystems>["prophecyWeek"];
  prediction?: string;
  predictionTimes?: ProphecyPredictionTimes;
  isPremium: boolean;
  onPredict: (weekId: string, candidateId: string) => void;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof getThemeColors>;
  copy: ReturnType<typeof duelCopy>;
  language: "tr" | "en" | "ru" | "uz";
}) {
  const router = useRouter();
  const weekStatus = (week as ProphecyWeek & { status?: string }).status;
  const isFinished = weekStatus === "finished" || !!week.winnerId;
  const withinWindow = week.id ? isWithinFirstHours(week.startsAt, 48) : false;
  const lastWriteAt = getProphecyLastWriteAt(predictionTimes);
  const changeCooldownEndsAt = prediction && isPremium && withinWindow && lastWriteAt
    ? new Date(new Date(lastWriteAt).getTime() + PREMIUM_PROPHECY_CHANGE_COOLDOWN_MS).toISOString()
    : undefined;
  const changeCooldownRemaining = useCountdown(changeCooldownEndsAt);

  if (!week.id || week.candidates.length === 0) {
    return (
      <View style={styles.card}>
        <View style={styles.cardHead}>
          <Ionicons name="hourglass-outline" size={20} color={colors.gold} />
          <View style={styles.headText}>
            <Text style={styles.title}>{copy.noActiveProphecy}</Text>
            <Text style={styles.meta}>{copy.noActiveProphecyHint}</Text>
          </View>
        </View>
      </View>
    );
  }
  const canCreate = !isFinished && !prediction && withinWindow;
  const canChange = !isFinished && !!prediction && isPremium && withinWindow && changeCooldownRemaining === 0;
  const predictionWindowEndsAt = new Date(new Date(week.startsAt).getTime() + 48 * 60 * 60 * 1000).toISOString();
  const activeChangeEndsAt = changeCooldownRemaining > 0 ? changeCooldownEndsAt : undefined;
  const winner = week.winnerId ? week.candidates.find((candidate) => candidate.id === week.winnerId) : undefined;
  const predictedCorrectly = !!prediction && !!week.winnerId && prediction === week.winnerId;
  return (
    <View style={styles.card}>
      {!isFinished ? (
        <ProphecyCountdown
          weekEndsAt={week.endsAt}
          windowEndsAt={withinWindow ? predictionWindowEndsAt : undefined}
          changeEndsAt={activeChangeEndsAt}
          copy={copy}
          styles={styles}
          colors={colors}
        />
      ) : null}
      <View style={styles.cardHead}>
        <Ionicons name={week.kind === "artist" ? "brush" : "images"} size={20} color={colors.gold} />
        <View style={styles.headText}>
          <Text style={styles.title}>{week.kind === "artist" ? copy.prophecyArtistTitle : copy.prophecyArtworkTitle}</Text>
          <Text style={styles.meta}>{getText(week.question, language)}</Text>
        </View>
      </View>
      <Text style={styles.note}>{isPremium ? copy.prophecyIntroPremium : copy.prophecyIntroNormal}</Text>
      {isFinished && winner ? (
        <View style={styles.lockedBox}>
          <Ionicons name="trophy-outline" size={18} color={colors.gold} />
          <Text style={styles.lockedText}>
            {`${copy.weeklyChampion}: ${getText(winner.title, language)}${predictedCorrectly ? ` · ${copy.weeklyChampionCorrect}` : prediction ? ` · ${copy.weeklyChampionWrong}` : ""}`}
          </Text>
        </View>
      ) : null}
      {!withinWindow && !prediction && !isFinished ? (
        <View style={styles.lockedBox}>
          <Ionicons name="lock-closed-outline" size={18} color={colors.gold} />
          <Text style={styles.lockedText}>{copy.prophecyWindowClosed}</Text>
        </View>
      ) : null}
      {prediction && isPremium && withinWindow && changeCooldownRemaining > 0 ? (
        <View style={styles.lockedBox}>
          <Ionicons name="timer-outline" size={18} color={colors.gold} />
          <Text style={styles.lockedText}>
            {`${copy.prophecyChangeBlocked} ${formatProphecyCountdown(changeCooldownRemaining)}`}
          </Text>
        </View>
      ) : null}
      <View style={styles.prophecyGrid}>
        {week.candidates.map((candidate) => (
          <View
            key={candidate.id}
            style={[
              styles.prophecyCard,
              prediction === candidate.id && styles.selected,
              week.winnerId === candidate.id && styles.selected,
              (!(canCreate || canChange) || isFinished) && styles.disabledCard
            ]}
          >
            <Pressable
              disabled={!(canCreate || canChange) || isFinished}
              onPress={() => onPredict(week.id, candidate.id)}
              style={styles.prophecySelectArea}
            >
              <Image source={{ uri: candidate.image }} style={styles.prophecyImage} contentFit="cover" />
              <Text style={styles.sideTitle} numberOfLines={1}>{getText(candidate.title, language)}</Text>
            </Pressable>
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={week.kind === "artist" ? copy.inspectArtist : copy.inspectArtwork}
              hitSlop={6}
              onPress={() => router.push({
                pathname: week.kind === "artist" ? "/artist/[id]" : "/artwork/[id]",
                params: { id: candidate.sourceId || candidate.id }
              })}
              style={styles.prophecyInspectBadge}
            >
              <Ionicons name="open-outline" size={11} color={colors.ivory} />
              <Text style={styles.prophecyInspectText} numberOfLines={1}>{copy.inspectShort}</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <Text style={styles.note}>
        {prediction
          ? isPremium && withinWindow && changeCooldownRemaining === 0
            ? copy.prophecyLockedPremium
            : copy.prophecyLocked
          : canCreate
            ? copy.prophecyPick
            : canChange
              ? copy.prophecyPickAgain
              : copy.prophecyNewWeek}
      </Text>
    </View>
  );
}

function ProphecyCountdown({
  weekEndsAt,
  windowEndsAt,
  changeEndsAt,
  copy,
  styles,
  colors
}: {
  weekEndsAt: string;
  windowEndsAt?: string;
  changeEndsAt?: string;
  copy: ReturnType<typeof duelCopy>;
  styles: ReturnType<typeof createStyles>;
  colors: ReturnType<typeof getThemeColors>;
}) {
  const weekRemaining = useCountdown(weekEndsAt);
  const windowRemaining = useCountdown(windowEndsAt);
  const changeRemaining = useCountdown(changeEndsAt);

  return (
    <View style={styles.countdownRow}>
      <Ionicons name="time-outline" size={13} color={colors.gold} />
      <Text style={styles.countdownText}>
        {copy.prophecyWeekCountdown}: <Text style={styles.countdownValue}>{formatProphecyCountdown(weekRemaining)}</Text>
        {windowEndsAt ? (
          <>
            {"  ·  "}
            {copy.prophecyWindowCountdown}: <Text style={styles.countdownValue}>{formatProphecyCountdown(windowRemaining)}</Text>
          </>
        ) : null}
        {changeEndsAt ? (
          <>
            {"  ·  "}
            {copy.prophecyChangeCountdown}: <Text style={styles.countdownValue}>{formatProphecyCountdown(changeRemaining)}</Text>
          </>
        ) : null}
      </Text>
    </View>
  );
}

function useCountdown(targetIso?: string) {
  const [remaining, setRemaining] = useState(() => getRemainingMs(targetIso));

  useEffect(() => {
    setRemaining(getRemainingMs(targetIso));
    if (!targetIso) return;
    const timer = setInterval(() => setRemaining(getRemainingMs(targetIso)), 1000);
    return () => clearInterval(timer);
  }, [targetIso]);

  return remaining;
}

function getRemainingMs(targetIso?: string) {
  if (!targetIso) return 0;
  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target)) return 0;
  return Math.max(0, target - Date.now());
}

function DuelSide({ image, title, subtitle, percent, selected, showResults, disabled, onPress, onInspect, inspectLabel, styles, colors, pickLabel, pickedLabel }: { image: string; title: string; subtitle: string; percent: number; selected: boolean; showResults: boolean; disabled: boolean; onPress: () => void; onInspect?: () => void; inspectLabel: string; styles: ReturnType<typeof createStyles>; colors: ReturnType<typeof getThemeColors>; pickLabel: string; pickedLabel: string }) {
  return (
    <Pressable disabled={disabled} onPress={onPress} style={[styles.sideCard, selected && styles.selected]}>
      <Image source={{ uri: image }} style={styles.sideImage} contentFit="cover" />
      <Text style={styles.sideTitle} numberOfLines={1}>{title}</Text>
      <Text style={styles.sideSubtitle} numberOfLines={1}>{subtitle}</Text>
      {showResults ? (
        <>
          <View style={styles.percentBar}><View style={[styles.percentFill, { width: `${percent}%`, backgroundColor: colors.gold }]} /></View>
          <Text style={styles.percentText}>{percent}%</Text>
        </>
      ) : (
        <Text style={styles.pickText}>{selected ? pickedLabel : pickLabel}</Text>
      )}
      {onInspect ? (
        <Pressable onPress={(event) => { event.stopPropagation(); onInspect(); }} style={styles.inspectButton}>
          <Ionicons name="book-outline" size={13} color={colors.gold} />
          <Text style={styles.inspectText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{inspectLabel}</Text>
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function isWithinFirstHours(startsAt: string, hours: number) {
  const start = new Date(startsAt).getTime();
  const now = Date.now();
  return now >= start && now <= start + hours * 60 * 60 * 1000;
}

function getDuelStatusText(copy: ReturnType<typeof duelCopy>, locked: boolean, isPremium: boolean, changeCount: number) {
  if (!locked) return copy.duelStatusPick;
  if (isPremium && changeCount < 1) return copy.duelStatusPremiumChange;
  return copy.duelStatusLocked;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

function createStyles(colors: ReturnType<typeof getThemeColors>, width = 390) {
  return StyleSheet.create({
    message: { color: colors.gold, fontWeight: "900", textAlign: "center", marginBottom: 10 },
    heroCard: { height: width >= 720 ? 224 : 204, borderRadius: 22, borderWidth: 1, borderColor: "rgba(224,194,255,0.25)", overflow: "hidden", alignItems: "center", justifyContent: "center", marginBottom: 14 },
    heroParticles: { ...StyleSheet.absoluteFillObject },
    heroParticle: { position: "absolute", width: 3, height: 3, borderRadius: 2, backgroundColor: "rgba(255,231,168,0.78)" },
    arenaOrbit: { position: "absolute", top: 22, width: 150, height: 150, borderRadius: 75, borderWidth: 1, borderColor: "rgba(208,177,255,0.34)" },
    orbitArtwork: { position: "absolute", width: 35, height: 46, borderRadius: 7, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,232,181,0.7)", backgroundColor: colors.panel },
    orbitArtworkTop: { left: 56, top: -16 },
    orbitArtworkRight: { right: -10, bottom: 18, transform: [{ rotate: "120deg" }] },
    orbitArtworkLeft: { left: -10, bottom: 18, transform: [{ rotate: "-120deg" }] },
    orbitArtworkImage: { width: "100%", height: "100%" },
    arenaCore: { width: 70, height: 70, borderRadius: 35, padding: 6, backgroundColor: "rgba(255,221,141,0.11)", borderWidth: 1, borderColor: "rgba(255,221,141,0.42)", alignItems: "center", justifyContent: "center", marginTop: -24 },
    arenaCoreRing: { width: 52, height: 52, borderRadius: 26, backgroundColor: "rgba(111,61,180,0.92)", borderWidth: 1, borderColor: "rgba(255,237,189,0.62)", alignItems: "center", justifyContent: "center" },
    heroCopy: { position: "absolute", left: 18, right: 18, bottom: 16, alignItems: "center" },
    heroEyebrow: { color: "rgba(255,229,174,0.82)", fontSize: 9, letterSpacing: 2.2, fontWeight: "900", marginBottom: 3 },
    heroTitle: { color: colors.ivory, fontSize: 19, fontWeight: "900" },
    heroSubtitle: { color: "rgba(247,239,255,0.76)", fontSize: 11, lineHeight: 15, fontWeight: "700", textAlign: "center", marginTop: 3 },
    portalGrid: { flexDirection: "row", gap: 10 },
    menuCard: { minHeight: 76, borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 12, padding: 12, marginBottom: 10, overflow: "hidden" },
    menuCardPressed: { opacity: 0.9, transform: [{ scale: 0.985 }] },
    portalCard: { flex: 1, minWidth: 0, minHeight: 118, flexDirection: "column", alignItems: "flex-start", gap: 8, borderColor: "rgba(147,174,255,0.3)" },
    featuredPortal: { minHeight: 84, borderColor: "rgba(239,123,214,0.48)" },
    rankingPortal: { minHeight: 68, borderColor: "rgba(217,184,101,0.38)", backgroundColor: "rgba(217,184,101,0.07)" },
    menuIcon: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
    portalTitle: { fontSize: 14, lineHeight: 17 },
    portalMeta: { fontSize: 10, lineHeight: 14 },
    backToList: { alignSelf: "flex-start", minHeight: 38, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, marginBottom: 10 },
    backToListText: { color: colors.ivory, fontSize: 12, fontWeight: "900" },
    card: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 12, gap: 12, marginBottom: 12 },
    cardHead: { flexDirection: "row", alignItems: "center", gap: 10 },
    headText: { flex: 1 },
    title: { color: colors.ivory, fontSize: 17, fontWeight: "900" },
    meta: { color: colors.muted, fontSize: 12, fontWeight: "800", marginTop: 2 },
    live: { color: colors.ink, backgroundColor: colors.gold, borderRadius: 7, paddingHorizontal: 8, paddingVertical: 4, fontSize: 10, fontWeight: "900" },
    duelRow: { flexDirection: "row", gap: 10 },
    sideCard: { flex: 1, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, overflow: "hidden", paddingBottom: 9 },
    selected: { borderColor: colors.gold },
    disabledCard: { opacity: 0.62 },
    sideImage: { width: "100%", aspectRatio: 1 },
    sideTitle: { color: colors.ivory, fontSize: 13, fontWeight: "900", marginHorizontal: 8, marginTop: 8 },
    sideSubtitle: { color: colors.muted, fontSize: 11, fontWeight: "800", marginHorizontal: 8, marginTop: 2 },
    percentBar: { height: 6, borderRadius: 3, backgroundColor: "rgba(255,255,255,0.14)", marginHorizontal: 8, marginTop: 8, overflow: "hidden" },
    percentFill: { height: "100%" },
    percentText: { color: colors.gold, fontSize: 12, fontWeight: "900", marginHorizontal: 8, marginTop: 5 },
    pickText: { color: colors.gold, fontSize: 12, fontWeight: "900", marginHorizontal: 8, marginTop: 8 },
    inspectButton: { minHeight: 34, borderTopWidth: 1, borderTopColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5, marginHorizontal: 8, marginTop: 8, paddingTop: 7 },
    inspectText: { color: colors.gold, fontSize: 11, fontWeight: "900", textDecorationLine: "underline" },
    confirmButton: { minHeight: 44, borderRadius: 8, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
    confirmSmallButton: { flex: 1, minHeight: 40, borderRadius: 8, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
    confirmDisabled: { opacity: 0.45 },
    confirmText: { color: colors.ink, fontWeight: "900" },
    modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.62)", alignItems: "center", justifyContent: "center", padding: 18 },
    confirmModal: { width: "100%", maxWidth: 420, borderRadius: 8, borderWidth: 1, borderColor: "rgba(217,184,101,0.42)", backgroundColor: colors.panel, padding: 18, gap: 12 },
    confirmTitle: { color: colors.ivory, fontSize: 18, fontWeight: "900", textAlign: "center" },
    confirmBody: { color: colors.muted, fontSize: 13, fontWeight: "800", lineHeight: 19, textAlign: "center" },
    confirmRow: { flexDirection: "row", gap: 8 },
    secondaryButton: { flex: 1, minHeight: 40, borderRadius: 8, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
    secondaryText: { color: colors.ivory, fontWeight: "900" },
    note: { color: colors.muted, fontSize: 12, fontWeight: "800", lineHeight: 17 },
    statusNote: { color: colors.gold, fontSize: 12, fontWeight: "900", lineHeight: 17, textAlign: "center" },
    lockedBox: { minHeight: 42, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 10 },
    lockedText: { color: colors.ivory, fontSize: 12, fontWeight: "900", flex: 1 },
    countdownRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 4, paddingHorizontal: 2, marginBottom: 2 },
    countdownText: { color: colors.muted, fontSize: 10, fontWeight: "800", flex: 1 },
    countdownValue: { color: colors.gold, fontWeight: "900", fontVariant: ["tabular-nums"] },
    prophecyGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    prophecyCard: { width: "48.5%", borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, overflow: "hidden" },
    prophecySelectArea: { paddingBottom: 8 },
    prophecyImage: { width: "100%", aspectRatio: 1.2 },
    prophecyInspectBadge: { position: "absolute", top: 7, right: 7, zIndex: 2, maxWidth: "72%", minHeight: 26, borderRadius: 13, borderWidth: 1, borderColor: "rgba(255,255,255,0.38)", backgroundColor: "rgba(22,14,9,0.82)", flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, paddingHorizontal: 8 },
    prophecyInspectText: { color: colors.ivory, fontSize: 9, fontWeight: "900" }
  });
}
