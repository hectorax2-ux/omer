import { useEffect, useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { AuthRequired } from "@/components/auth-required";
import { QuizAccessPrompt } from "@/components/quiz-access-prompt";
import { RewardedScoreGate } from "@/components/rewarded-score-gate";
import { areRewardedAdRequirementsEnabled } from "@/constants/ad-feature-flags";
import { getThemeColors } from "@/constants/theme";
import { copy } from "@/data/content";
import { useAccount } from "@/hooks/use-account";
import { useAds } from "@/hooks/use-ads";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { useRegisterRefresh } from "@/providers/refresh-provider";
import {
  getActiveWeeklyQuizPack,
  listQuizLeaderboard,
  listRecentPublishedWeeklyQuizWeekIds,
  resolveQuizWeekIdFromPack
} from "@/src/services/firebase/quiz-week-service";
import {
  DEFAULT_WEEKLY_QUIZ_POINTS_PER_SECOND,
  DEFAULT_WEEKLY_QUIZ_SECONDS,
  scoreCorrectAnswer,
  visibleQuizOptionsForLanguage
} from "@/firebase/shared/quiz-week";
import {
  grantWeeklyEntry,
  markWeeklyScoreAdDone,
  needsWeeklyEntryAd
} from "@/utils/quiz-access-storage";
import type { LanguageCode, QuizDocument, QuizQuestion } from "@/src/types/firestore";
import { prefetchImageUrls } from "@/utils/image-prefetch";

const DEFAULT_QUESTION_SECONDS = DEFAULT_WEEKLY_QUIZ_SECONDS;

const weeklyPageCopy = {
  title: { tr: "Haftalık Quiz Yarışması", en: "Weekly Quiz Challenge", ru: "Еженедельная викторина", uz: "Haftalik quiz tanlovi" },
  eyebrow: { tr: "OYUNLAR", en: "GAMES", ru: "ИГРЫ", uz: "O'YINLAR" }
} as const;

export default function QuizScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ info?: string }>();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { account, isAuthenticated, canBrowsePublicContent, canJoinWeeklyQuiz, completeWeeklyQuiz } = useAccount();
  const { adsEnabled } = useAds();
  const rewardedAdRequirementsEnabled = areRewardedAdRequirementsEnabled();
  const [started, setStarted] = useState(false);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(DEFAULT_QUESTION_SECONDS);
  const [scoreApplied, setScoreApplied] = useState<boolean | null>(null);
  const [showRanking, setShowRanking] = useState(false);
  const [exitPromptVisible, setExitPromptVisible] = useState(false);
  const [infoMode, setInfoMode] = useState<"weekly" | null>(() => params.info === "1" ? "weekly" : null);
  const [accessPromptMode, setAccessPromptMode] = useState<"weekly" | null>(null);
  const [rankingWeekOpen, setRankingWeekOpen] = useState(false);
  const [rankingWeekId, setRankingWeekId] = useState("");
  const [rankingWeekOptions, setRankingWeekOptions] = useState<string[]>([]);
  const [weeklyQuiz, setWeeklyQuiz] = useState<QuizDocument | null>(null);
  const [quizLoading, setQuizLoading] = useState(true);
  const [leaderboard, setLeaderboard] = useState<{ name: string; score: number; city: string }[]>([]);
  const [refreshCounter, setRefreshCounter] = useState(0);
  useRegisterRefresh(() => setRefreshCounter((value) => value + 1));
  const quizQuestions = weeklyQuiz?.questions ?? [];
  const question = quizQuestions[index];
  const activeWeeklyId = resolveQuizWeekIdFromPack(weeklyQuiz ?? undefined);
  const hasWeeklyQuiz = Boolean(weeklyQuiz?.questions?.length);
  const canJoinScoredWeekly = hasWeeklyQuiz && canJoinWeeklyQuiz(activeWeeklyId);
  const hasCompletedWeekly = hasWeeklyQuiz && !canJoinWeeklyQuiz(activeWeeklyId);
  const canEarnScore = canJoinScoredWeekly;
  const questionSeconds = questionSecondsFor(question);
  const completed = answered >= quizQuestions.length;
  const result = useMemo(() => (!question || choice === null ? null : choice === question.answerIndex), [choice, question]);

  useEffect(() => {
    let mounted = true;
    setQuizLoading(true);
    getActiveWeeklyQuizPack(refreshCounter > 0)
      .then((result) => {
        if (!mounted) return;
        setWeeklyQuiz(result);
        if (result) void prefetchImageUrls(result.questions.map((item) => item.image || item.imageURL));
      })
      .catch(() => {
        if (mounted) setWeeklyQuiz(null);
      })
      .finally(() => {
        if (mounted) setQuizLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [refreshCounter]);

  useEffect(() => {
    if (!showRanking) return;
    let mounted = true;
    const weekId = rankingWeekId || activeWeeklyId;
    listQuizLeaderboard(weekId, 200)
      .then((items) => {
        if (mounted) setLeaderboard(items);
      })
      .catch(() => {
        if (mounted) setLeaderboard([]);
      });
    return () => {
      mounted = false;
    };
  }, [showRanking, activeWeeklyId, rankingWeekId]);

  useEffect(() => {
    if (!showRanking) return;
    let mounted = true;
    listRecentPublishedWeeklyQuizWeekIds(5)
      .then((weekIds) => {
        if (!mounted) return;
        const nextWeekIds = weekIds.length ? weekIds : [activeWeeklyId];
        setRankingWeekOptions(nextWeekIds);
        setRankingWeekId((current) => current && nextWeekIds.includes(current) ? current : nextWeekIds[0]);
      })
      .catch(() => {
        if (mounted) {
          setRankingWeekOptions([activeWeeklyId]);
          setRankingWeekId(activeWeeklyId);
        }
      });
    return () => {
      mounted = false;
    };
  }, [showRanking, activeWeeklyId]);

  useEffect(() => {
    if (showRanking || !started || completed || choice !== null || !canEarnScore) {
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          clearInterval(timer);
          passQuestion();
          return questionSeconds;
        }

        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showRanking, started, completed, choice, index, canEarnScore, questionSeconds]);

  if (!isAuthenticated) {
    return <AuthRequired title={weeklyPageCopy.title[language]} />;
  }

  if (showRanking) {
    return (
      <AppChrome title={copy.ranking[language]} eyebrow={weeklyPageCopy.title[language]}>
        <Pressable onPress={() => { setShowRanking(false); setRankingWeekOpen(false); }} style={styles.backButton}>
          <Ionicons name="arrow-back" size={18} color={colors.gold} />
          <Text style={styles.backText}>{weeklyPageCopy.title[language]}</Text>
        </Pressable>
        {rankingWeekOptions.length > 1 ? (
          <View style={styles.rankingWeekFilter}>
            <Pressable onPress={() => setRankingWeekOpen((value) => !value)} style={styles.rankingWeekToggle}>
              <Text style={styles.rankingWeekToggleText}>
                {language === "tr" ? "Hafta" : language === "ru" ? "Неделя" : language === "uz" ? "Hafta" : "Week"}: {rankingWeekId || activeWeeklyId}
              </Text>
              <Ionicons name={rankingWeekOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.gold} />
            </Pressable>
            {rankingWeekOpen ? (
              <View style={styles.rankingWeekList}>
                {rankingWeekOptions.map((weekId) => (
                  <Pressable
                    key={weekId}
                    onPress={() => {
                      setRankingWeekId(weekId);
                      setRankingWeekOpen(false);
                    }}
                    style={[styles.rankingWeekItem, rankingWeekId === weekId && styles.rankingWeekItemActive]}
                  >
                    <Text style={[styles.rankingWeekItemText, rankingWeekId === weekId && styles.rankingWeekItemTextActive]}>{weekId}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>
        ) : null}
        <View style={styles.rankList}>
          {leaderboard.length === 0 ? (
            <View style={styles.emptyRanking}>
              <Ionicons name="cloud-outline" size={28} color={colors.gold} />
              <Text style={styles.emptyRankingText}>{language === "tr" ? "Henüz sıralama kaydı yok." : language === "ru" ? "Пока нет записей рейтинга." : language === "uz" ? "Hozircha reyting yozuvi yo'q." : "No leaderboard entries yet."}</Text>
            </View>
          ) : leaderboard.map((item, itemIndex) => (
            <View key={`${item.name}-${itemIndex}`} style={styles.rankRow}>
              <Text style={styles.rankNo}>{itemIndex + 1}</Text>
              <View style={styles.rankPerson}>
                <Text style={styles.rankName}>{item.name}</Text>
                <Text style={styles.rankCity}>{item.city}</Text>
              </View>
              <Text style={styles.rankScore}>{item.score}</Text>
            </View>
          ))}
        </View>
      </AppChrome>
    );
  }

  async function requestStartQuiz() {
    if (!canBrowsePublicContent) return;
    const sourceQuestions = weeklyQuiz?.questions ?? [];
    if (sourceQuestions.length === 0) return;

    if (canJoinScoredWeekly) {
      const needsAd = await needsWeeklyEntryAd({
        weekId: activeWeeklyId,
        isPremium: account.isPremium || account.isAdmin,
        adsEnabled,
        canEarnScore: true
      });
      if (needsAd) {
        setAccessPromptMode("weekly");
        return;
      }
    }

    startQuiz();
  }

  async function grantAccessAndStart() {
    await grantWeeklyEntry(activeWeeklyId);
    setAccessPromptMode(null);
    startQuiz();
  }

  async function handleWeeklyPress() {
    if (!hasWeeklyQuiz || quizLoading) return;
    if (!canBrowsePublicContent) return;

    if (hasCompletedWeekly || account.isPremium || account.isAdmin || !adsEnabled) {
      setInfoMode("weekly");
      return;
    }

    const needsAd = await needsWeeklyEntryAd({
      weekId: activeWeeklyId,
      isPremium: account.isPremium || account.isAdmin,
      adsEnabled,
      canEarnScore: true
    });
    if (needsAd) {
      setAccessPromptMode("weekly");
      return;
    }

    setInfoMode("weekly");
  }

  function startQuiz() {
    if (!canBrowsePublicContent) return;
    const sourceQuestions = weeklyQuiz?.questions ?? [];
    if (sourceQuestions.length === 0) return;
    const continuingSameMode = answered > 0 && answered < quizQuestions.length;
    setStarted(true);
    if (continuingSameMode) {
      setChoice(null);
      setSecondsLeft(questionSecondsFor(quizQuestions[answered]));
      setScoreApplied(null);
      return;
    }
    setIndex(0);
    setChoice(null);
    setScore(0);
    setAnswered(0);
    setSecondsLeft(questionSecondsFor(sourceQuestions[0]));
    setScoreApplied(null);
  }

  function finishQuiz(finalScore: number, finalAnswered: number) {
    if (finalAnswered >= quizQuestions.length) {
      if (canEarnScore && weeklyQuiz) {
        setScoreApplied(null);
      } else {
        setScoreApplied(canEarnScore);
      }
    }
  }

  function chooseAnswer(optionIndex: number) {
    const timeScore = scoreCorrectAnswer(secondsLeft, DEFAULT_WEEKLY_QUIZ_POINTS_PER_SECOND);
    const nextScore = canEarnScore && optionIndex === question.answerIndex ? score + timeScore : score;
    const nextAnswered = answered + 1;

    setChoice(optionIndex);
    setAnswered(nextAnswered);
    setScore(nextScore);
    finishQuiz(nextScore, nextAnswered);
  }

  function passQuestion() {
    const nextAnswered = answered + 1;
    setAnswered(nextAnswered);
    finishQuiz(score, nextAnswered);
    if (nextAnswered < quizQuestions.length) {
      setChoice(null);
      setSecondsLeft(questionSecondsFor(quizQuestions[nextAnswered]));
      setIndex((value) => (value + 1) % quizQuestions.length);
    }
  }

  function nextQuestion() {
    setChoice(null);
    setSecondsLeft(questionSecondsFor(quizQuestions[(index + 1) % quizQuestions.length]));
    setIndex((value) => (value + 1) % quizQuestions.length);
  }

  function confirmExitQuiz() {
    setExitPromptVisible(false);

    if (choice !== null) {
      if (answered < quizQuestions.length) {
        setIndex((value) => (value + 1) % quizQuestions.length);
      }
      setChoice(null);
      setSecondsLeft(questionSecondsFor(quizQuestions[answered]));
      setStarted(false);
      return;
    }

    const nextAnswered = answered + 1;
    setAnswered(nextAnswered);
    finishQuiz(score, nextAnswered);
    if (nextAnswered < quizQuestions.length) {
      setIndex((value) => (value + 1) % quizQuestions.length);
    }

    setChoice(null);
    setSecondsLeft(questionSecondsFor(quizQuestions[Math.min(answered + 1, quizQuestions.length - 1)]));
    setStarted(false);
  }

  if (!started) {
    const weeklyLocked = !hasWeeklyQuiz && !quizLoading;
    return (
      <AppChrome title={weeklyPageCopy.title[language]} eyebrow={weeklyPageCopy.eyebrow[language]}>
        <QuizAccessPrompt
          visible={accessPromptMode !== null}
          mode="weekly"
          language={language}
          onClose={() => setAccessPromptMode(null)}
          onGranted={() => void grantAccessAndStart()}
        />
        <Modal visible={infoMode !== null} transparent animationType="fade" onRequestClose={() => setInfoMode(null)}>
          <View style={styles.modalBackdrop}>
            <View style={styles.modalPanel}>
              <Ionicons name="trophy" size={32} color={colors.gold} />
              <Text style={styles.modalTitle}>{language === "tr" ? "Haftalık yarışmaya başlansın mı?" : language === "ru" ? "Начать недельный конкурс?" : language === "uz" ? "Haftalik tanlov boshlansinmi?" : "Start weekly challenge?"}</Text>
              <Text style={styles.modalText}>{language === "tr" ? "Her soru 30 saniyedir. İlk 15 saniye okuma süresidir; sonra puan 15'ten düşer. İlk tur puanın sıralamaya yazılır." : language === "ru" ? "На каждый вопрос дается 30 секунд. Первые 15 секунд — на чтение; затем очки уменьшаются с 15. Первый результат идет в рейтинг." : language === "uz" ? "Har savol 30 soniya. Dastlabki 15 soniya o'qish uchun; keyin ball 15 dan kamayadi. Birinchi tur reytingga yoziladi." : "Each question has 30 seconds. The first 15 seconds are for reading; then the score counts down from 15. First score counts."}</Text>
              <View style={styles.modalActions}>
                <Pressable onPress={() => setInfoMode(null)} style={styles.modalCancel}>
                  <Text style={styles.modalCancelText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{language === "tr" ? "Vazgeç" : language === "ru" ? "Отмена" : language === "uz" ? "Bekor qilish" : "Cancel"}</Text>
                </Pressable>
                <Pressable onPress={() => { setInfoMode(null); void requestStartQuiz(); }} style={styles.modalConfirm}>
                  <Text style={styles.modalConfirmText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{language === "tr" ? "Yarışmaya başla" : language === "ru" ? "Начать" : language === "uz" ? "Tanlovni boshlash" : "Start"}</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
        <View style={styles.quizActions}>
          <Pressable onPress={() => setShowRanking(true)} style={styles.rankingButton}>
            <Ionicons name="podium" size={18} color={colors.ink} />
            <Text style={styles.rankingButtonText}>{copy.ranking[language]}</Text>
          </Pressable>
          <Pressable onPress={() => router.push("/rewards")} style={styles.rewardButton}>
            <Ionicons name="ribbon" size={18} color={colors.gold} />
            <Text style={styles.rewardButtonText}>{language === "tr" ? "Ödüller" : language === "ru" ? "Награды" : language === "uz" ? "Mukofotlar" : "Awards"}</Text>
          </Pressable>
        </View>
        <View style={styles.modeGrid}>
          {!canBrowsePublicContent ? (
            <View style={styles.verifyNotice}>
              <Ionicons name="mail-unread-outline" size={20} color={colors.gold} />
              <Text style={styles.verifyNoticeText}>{language === "tr" ? "Haftalık yarışmaya katılmak için e-posta adresinizi doğrulayın." : language === "ru" ? "Подтвердите адрес электронной почты, чтобы участвовать в еженедельном конкурсе." : language === "uz" ? "Haftalik tanlovda qatnashish uchun elektron pochtangizni tasdiqlang." : "Verify your email to join the weekly challenge."}</Text>
            </View>
          ) : null}
          <Pressable onPress={() => void handleWeeklyPress()} style={[styles.modeCard, weeklyLocked && styles.lockedModeCard]}>
            <Ionicons name="trophy" size={30} color={colors.gold} />
            <Text style={styles.modeTitle}>{language === "tr" ? "Haftalık yarışma" : language === "ru" ? "Еженедельный конкурс" : language === "uz" ? "Haftalik tanlov" : "Weekly challenge"}</Text>
            <Text style={styles.modeText}>
              {!hasWeeklyQuiz
                ? language === "tr"
                  ? "Henüz yayınlanmış haftalık quiz yok."
                  : "No weekly quiz published yet."
                : language === "tr"
                  ? account.isPremium || account.isAdmin
                    ? "Premium üyelikle doğrudan katıl. İlk tur sıralamaya yansır."
                    : canJoinScoredWeekly
                      ? rewardedAdRequirementsEnabled
                        ? "Sıralamaya katılmak için kısa sponsorlu içerik izlemen gerekir. İlk tur puanlıdır."
                        : "İlk tur puanlıdır ve sıralamaya yansır."
                      : "Bu haftanın puanın kesinleşti. Tekrar turu pratik içindir."
                  : account.isPremium || account.isAdmin
                    ? "Join directly with Premium. First score counts."
                    : canJoinScoredWeekly
                      ? rewardedAdRequirementsEnabled
                        ? "Watch a short sponsored clip to join the leaderboard for your first scored round."
                        : "Your first scored round counts toward the leaderboard."
                      : "This week's score is final. Retry rounds are practice only."}
            </Text>
          </Pressable>
        </View>
        <View style={styles.intro}>
          <Ionicons name={canJoinScoredWeekly ? "timer" : hasCompletedWeekly ? "book" : "calendar"} size={42} color={colors.gold} />
          <Text style={styles.introTitle}>{weeklyPageCopy.title[language]}</Text>
          <Text style={styles.introText}>
            {!hasWeeklyQuiz && !quizLoading
              ? language === "tr"
                ? "Henüz yayınlanmış haftalık quiz yok. Admin panelinden bu haftayı planlayıp yayınladığınızda burada görünecek."
                : language === "en"
                  ? "No weekly quiz has been published yet. It will appear here once planned and published from the admin panel."
                  : language === "ru"
                    ? "Опубликованного недельного квиза пока нет. Он появится здесь после публикации в админ-панели."
                    : "Hozircha haftalik quiz e'lon qilinmagan. Admin paneldan nashr qilinganda bu yerda ko'rinadi."
              : canJoinScoredWeekly
                ? language === "tr"
                  ? "Her soruyu çözmek için 30 saniyen var. İlk 15 saniye okuma süresidir; son 15 saniyede puan 15'ten geriye düşer. Süre dolarsa soru pas geçilir. Haftada yalnızca bir kez puanlı yarışmaya katılabilirsin."
                  : language === "en"
                    ? "You have 30 seconds per question. The first 15 seconds are for reading; during the final 15 seconds, the score counts down from 15. Timeout skips the question. You can join the scored challenge once per week."
                    : language === "ru"
                      ? "На каждый вопрос дается 30 секунд. Первые 15 секунд — на чтение; в последние 15 секунд очки уменьшаются с 15. При истечении времени вопрос пропускается. В рейтинг можно войти один раз в неделю."
                      : "Har bir savol uchun 30 soniya bor. Dastlabki 15 soniya o'qish uchun; oxirgi 15 soniyada ball 15 dan kamayadi. Vaqt tugasa savol o'tkaziladi. Haftada faqat bir marta ballli tanlovga qatnashishingiz mumkin."
                : hasCompletedWeekly
                  ? language === "tr"
                    ? "Bu haftanın puanın kesinleşti. Soruları tekrar görebilir ve pratik yapabilirsin; bu tur puanlamaya girmez."
                    : language === "en"
                      ? "This week's score is final. You can view and practice the questions again; this round will not be scored."
                      : language === "ru"
                        ? "Результат этой недели уже закреплен. Можно снова смотреть вопросы и тренироваться без начисления очков."
                        : "Bu haftalik ballingiz yakunlandi. Savollarni qayta ko'rib mashq qilishingiz mumkin; bu tur ball bermaydi."
                  : language === "tr"
                    ? "Haftalık yarışmaya hazırsın. İlk tur puanın sıralamaya yazılır."
                    : "You are ready for the weekly challenge. Your first score counts toward the leaderboard."}
          </Text>
          {quizLoading ? (
            <Text style={styles.waitingText}>{language === "tr" ? "Sorular yükleniyor..." : language === "ru" ? "Вопросы загружаются..." : language === "uz" ? "Savollar yuklanmoqda..." : "Loading questions..."}</Text>
          ) : null}
          <Pressable
            onPress={() => void handleWeeklyPress()}
            disabled={weeklyLocked || !canBrowsePublicContent}
            style={[styles.startButton, (weeklyLocked || !canBrowsePublicContent) && styles.startButtonDisabled]}
          >
            <Text style={styles.startText}>{copy.begin[language]}</Text>
          </Pressable>
        </View>
      </AppChrome>
    );
  }

  if (completed) {
    const weeklyScorePending = canEarnScore && !account.isAdmin && weeklyQuiz && scoreApplied === null;
    return (
      <AppChrome title={weeklyPageCopy.title[language]} eyebrow={weeklyPageCopy.eyebrow[language]}>
        <View style={styles.summary}>
          <Ionicons name="ribbon" size={40} color={colors.gold} />
          <Text style={styles.summaryTitle}>{copy.finished[language]}</Text>
          {weeklyScorePending ? (
            <RewardedScoreGate
              language={language}
              score={score}
              scoreLabel={copy.points[language]}
              onSubmit={async () => {
                if (!weeklyQuiz) return;
                completeWeeklyQuiz(activeWeeklyId, score, weeklyQuiz.id);
                await markWeeklyScoreAdDone(activeWeeklyId);
                setScoreApplied(true);
              }}
            />
          ) : (
            <>
              <Text style={styles.summaryScore}>{score} {copy.points[language]}</Text>
              <Text style={styles.summaryText}>
                {account.isAdmin
                  ? language === "tr"
                    ? "Admin test turu tamamlandı. Sonuç sıralamaya kaydedilmedi."
                    : language === "ru"
                      ? "Тестовый раунд администратора завершён. Результат не добавлен в рейтинг."
                      : language === "uz"
                        ? "Admin sinov turi yakunlandi. Natija reytingga yozilmadi."
                        : "Admin test round completed. The result was not added to the leaderboard."
                  : scoreApplied
                  ? language === "tr"
                    ? "İlk tur puanın kesinleşti ve üyelik hesabına yazıldı."
                    : language === "en"
                      ? "Your first-round score is final and has been saved to your account."
                      : language === "ru"
                        ? "Ваш результат первого круга закреплен и сохранен в аккаунте."
                        : "Birinchi tur ballingiz yakunlandi va hisobingizga yozildi."
                  : language === "tr"
                    ? "Bu tekrar turuydu. Soruları çözdün ama puan toplamına yansıtılmadı."
                    : language === "en"
                      ? "This was a retry round. You solved the questions, but no score was added."
                      : language === "ru"
                        ? "Это был повторный круг. Вопросы решены, но очки не добавлены."
                        : "Bu takroriy tur edi. Savollar yechildi, ammo ball qo'shilmadi."}
              </Text>
              {scoreApplied && !account.isAdmin ? <Text style={styles.summaryMeta}>{copy.points[language]}: {account.totalScore}</Text> : null}
            </>
          )}
          <Pressable onPress={startQuiz} style={styles.restartButton}>
            <Text style={styles.restartText}>{copy.restart[language]}</Text>
          </Pressable>
        </View>
      </AppChrome>
    );
  }

  if (!question) {
    return (
      <AppChrome title={weeklyPageCopy.title[language]} eyebrow={weeklyPageCopy.eyebrow[language]}>
        <View style={styles.summary}>
          <Ionicons name="cloud-outline" size={40} color={colors.gold} />
          <Text style={styles.summaryTitle}>{language === "tr" ? "Yayınlanmış soru yok" : language === "ru" ? "Нет опубликованных вопросов" : language === "uz" ? "E'lon qilingan savol yo'q" : "No published questions"}</Text>
          <Text style={styles.summaryText}>{language === "tr" ? "Yeni haftalık quiz soruları eklendiğinde bu alan otomatik dolacak." : language === "ru" ? "Когда появятся новые вопросы недельной викторины, этот раздел заполнится автоматически." : language === "uz" ? "Yangi haftalik quiz savollari qo'shilganda bu bo'lim avtomatik to'ldiriladi." : "This area will fill automatically when new weekly quiz questions are added."}</Text>
        </View>
      </AppChrome>
    );
  }

  return (
    <AppChrome title={weeklyPageCopy.title[language]} eyebrow={weeklyPageCopy.eyebrow[language]} scroll={false} showTopAd={false}>
      <Modal visible={exitPromptVisible} transparent animationType="fade" onRequestClose={() => setExitPromptVisible(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <Ionicons name="alert-circle-outline" size={30} color={colors.gold} />
            <Text style={styles.modalTitle}>{language === "tr" ? "Yarışmadan çıkılsın mı?" : language === "ru" ? "Выйти из конкурса?" : language === "uz" ? "Tanlovdan chiqilsinmi?" : "Exit the challenge?"}</Text>
            <Text style={styles.modalText}>{language === "tr" ? "Bu soruda çıkarsan mevcut soru yanlış kabul edilecek. Yarışmaya tekrar girdiğinde bir sonraki sorudan devam edeceksin." : language === "ru" ? "Если выйти сейчас, текущий вопрос будет засчитан как неправильный. При возвращении конкурс продолжится со следующего вопроса." : language === "uz" ? "Hozir chiqsangiz, joriy savol noto'g'ri deb hisoblanadi. Tanlovga qaytganda keyingi savoldan davom etasiz." : "If you exit now, this question will count as wrong. When you reopen the challenge, you will continue from the next question."}</Text>
            <View style={styles.modalActions}>
              <Pressable onPress={() => setExitPromptVisible(false)} style={styles.modalCancel}>
                <Text style={styles.modalCancelText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{language === "tr" ? "Devam et" : "Continue"}</Text>
              </Pressable>
              <Pressable onPress={confirmExitQuiz} style={styles.modalConfirm}>
                <Text style={styles.modalConfirmText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.72}>{language === "tr" ? "Geri dön" : "Go back"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      <View style={styles.activeScreen}>
        <Pressable onPress={() => setExitPromptVisible(true)} style={styles.exitButton}>
          <Ionicons name="arrow-back" size={17} color={colors.gold} />
          <Text style={styles.exitButtonText}>{weeklyPageCopy.title[language]}</Text>
        </Pressable>
        {canEarnScore ? (
          <View style={styles.scoreBar}>
            <Text style={styles.scoreText}>{copy.points[language]}: {score}</Text>
            <View style={styles.timerPill}>
              <Ionicons name="timer" size={16} color={colors.ink} />
              <Text style={styles.timerText}>{secondsLeft}s</Text>
            </View>
            <Text style={styles.scoreText}>{answered} / {quizQuestions.length}</Text>
          </View>
        ) : (
          <View style={styles.practiceBar}>
            <Ionicons name="book-outline" size={18} color={colors.gold} />
            <Text style={styles.practiceText}>
              {language === "tr" ? "Tekrar modu - puanlama yok" : language === "en" ? "Practice mode - no scoring" : language === "ru" ? "Тренировка - без очков" : "Mashq rejimi - ball yo'q"}
            </Text>
          </View>
        )}
        <View style={styles.card}>
          {question.image || question.imageURL ? (
            <View style={styles.imageFrame}>
              <Image source={{ uri: question.image || question.imageURL }} style={styles.image} contentFit="contain" transition={300} />
            </View>
          ) : null}
          <View style={styles.body}>
            <View style={styles.questionHead}>
              <Text style={styles.count}>{index + 1} / {quizQuestions.length}</Text>
              {canEarnScore ? <Text style={styles.inlineTimer}>{secondsLeft}s</Text> : null}
            </View>
            <Text style={styles.question} numberOfLines={3} adjustsFontSizeToFit>{getQuestionText(question, language)}</Text>
            <View style={styles.options}>
              {visibleQuizOptionsForLanguage(question.options, language).map(({ index: slotIndex, text, label }) => {
                const selected = choice === slotIndex;
                const correct = choice !== null && slotIndex === question.answerIndex;
                return (
                  <Pressable
                    key={`${slotIndex}-${text}`}
                    disabled={choice !== null}
                    onPress={() => chooseAnswer(slotIndex)}
                    style={[styles.option, selected && styles.selected, correct && styles.correct]}
                  >
                    <Text style={styles.optionLetter}>{label}</Text>
                    <Text style={styles.optionText} numberOfLines={2} adjustsFontSizeToFit>{text}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.resultRow}>
              {choice !== null ? (
                <>
                  <View style={[styles.resultBadge, result ? styles.resultGood : styles.resultBad]}>
                    <Ionicons name={result ? "checkmark" : "play-skip-forward"} size={17} color={colors.ivory} />
                    <Text style={styles.resultText}>
                      {choice === -1
                        ? language === "tr" ? "Pas geçildi" : language === "en" ? "Passed" : language === "ru" ? "Пропущено" : "O'tkazildi"
                        : result ? copy.correct[language] : copy.wrong[language]}
                    </Text>
                  </View>
                  <Pressable onPress={nextQuestion} style={styles.nextButton}>
                    <Text style={styles.nextText}>{copy.next[language]}</Text>
                  </Pressable>
                </>
              ) : (
                <Text style={styles.waitingText}>
                  {language === "tr" ? "Bir şık seç." : language === "en" ? "Choose an option." : language === "ru" ? "Выберите вариант." : "Variant tanlang."}
                </Text>
              )}
            </View>
          </View>
        </View>
      </View>
    </AppChrome>
  );
}

function questionSecondsFor(item: QuizQuestion | undefined) {
  return Math.max(item?.seconds && item.seconds > 0 ? item.seconds : 0, DEFAULT_WEEKLY_QUIZ_SECONDS);
}

function getQuestionText(question: QuizQuestion, language: LanguageCode) {
  return question.question[language] || question.question.tr || question.question.en || Object.values(question.question)[0] || "";
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
return StyleSheet.create({
  rankingButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    backgroundColor: colors.gold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 0
  },
  quizActions: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12
  },
  rewardButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 8
  },
  rewardButtonText: {
    color: colors.ivory,
    fontWeight: "900"
  },
  rankingButtonText: {
    color: colors.ink,
    fontWeight: "900"
  },
  backButton: {
    alignSelf: "flex-start",
    minHeight: 40,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 12
  },
  backText: {
    color: colors.ivory,
    fontWeight: "900"
  },
  rankList: {
    gap: 10
  },
  emptyRanking: {
    minHeight: 120,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    backgroundColor: colors.panel
  },
  emptyRankingText: {
    color: colors.muted,
    fontWeight: "800",
    textAlign: "center"
  },
  rankRow: {
    minHeight: 62,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 12
  },
  rankNo: {
    width: 32,
    color: colors.gold,
    fontSize: 18,
    fontWeight: "900"
  },
  rankPerson: {
    flex: 1
  },
  rankName: {
    color: colors.ivory,
    fontWeight: "900"
  },
  rankCity: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "800"
  },
  rankScore: {
    color: colors.gold,
    fontWeight: "900"
  },
  rankingWeekFilter: {
    marginBottom: 10,
    gap: 6
  },
  rankingWeekToggle: {
    minHeight: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 10
  },
  rankingWeekToggleText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  rankingWeekList: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    overflow: "hidden"
  },
  rankingWeekItem: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  rankingWeekItemActive: {
    backgroundColor: colors.gold
  },
  rankingWeekItemText: {
    color: colors.ivory,
    fontSize: 12,
    fontWeight: "800"
  },
  rankingWeekItemTextActive: {
    color: colors.ink
  },
  activeScreen: {
    flex: 1,
    padding: 12,
    gap: 8
  },
  exitButton: {
    alignSelf: "flex-start",
    minHeight: 36,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 10
  },
  exitButtonText: {
    color: colors.ivory,
    fontWeight: "900"
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.52)",
    justifyContent: "center",
    padding: 18
  },
  modalPanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    alignItems: "center",
    padding: 18,
    gap: 10
  },
  modalTitle: {
    color: colors.ivory,
    fontSize: 20,
    fontWeight: "900",
    textAlign: "center"
  },
  modalText: {
    color: colors.muted,
    lineHeight: 21,
    fontWeight: "700",
    textAlign: "center"
  },
  modalActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 6,
    alignSelf: "stretch"
  },
  modalCancel: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  modalCancelText: {
    color: colors.ivory,
    fontWeight: "900"
  },
  modalConfirm: {
    flex: 1,
    minHeight: 42,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12
  },
  modalConfirmText: {
    color: colors.ink,
    fontWeight: "900"
  },
  intro: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    alignItems: "center",
    padding: 22
  },
  introTitle: {
    color: colors.ivory,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 12
  },
  introText: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginTop: 10
  },
  modeGrid: {
    alignSelf: "stretch",
    gap: 10,
    marginTop: 8,
    marginBottom: 12
  },
  modeCard: {
    minHeight: 92,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    padding: 12,
    justifyContent: "center",
    gap: 7
  },
  lockedModeCard: {
    opacity: 0.58
  },
  startButtonDisabled: {
    opacity: 0.58
  },
  verifyNotice: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(217,184,101,0.36)",
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    padding: 11
  },
  verifyNoticeText: {
    flex: 1,
    color: colors.muted,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "800"
  },
  modeTitle: {
    color: colors.ivory,
    fontSize: 15,
    fontWeight: "900"
  },
  modeText: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "700"
  },
  startButton: {
    minHeight: 50,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    marginTop: 18
  },
  startText: {
    color: colors.ink,
    fontSize: 17,
    fontWeight: "900"
  },
  card: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel
  },
  scoreBar: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    marginBottom: 0
  },
  scoreText: {
    color: colors.gold,
    fontWeight: "900"
  },
  timerPill: {
    minWidth: 64,
    minHeight: 30,
    borderRadius: 8,
    backgroundColor: colors.gold,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5
  },
  timerText: {
    color: colors.ink,
    fontWeight: "900"
  },
  practiceBar: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    marginBottom: 0
  },
  practiceText: {
    color: colors.muted,
    fontWeight: "900"
  },
  imageFrame: {
    width: "100%",
    height: 132,
    backgroundColor: colors.panelSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  image: {
    width: "100%",
    height: "100%"
  },
  body: {
    padding: 10
  },
  questionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4
  },
  count: {
    color: colors.gold,
    fontWeight: "900"
  },
  inlineTimer: {
    color: colors.gold,
    fontWeight: "900"
  },
  question: {
    color: colors.ivory,
    fontSize: 17,
    fontWeight: "900",
    lineHeight: 21,
    minHeight: 42,
    marginBottom: 8
  },
  options: {
    gap: 7
  },
  option: {
    minHeight: 38,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 10
  },
  selected: {
    borderColor: colors.gold
  },
  correct: {
    backgroundColor: "rgba(71, 119, 107, 0.55)",
    borderColor: colors.jade
  },
  optionLetter: {
    color: colors.gold,
    fontWeight: "900",
    width: 24
  },
  optionText: {
    color: colors.ivory,
    flex: 1,
    fontWeight: "700"
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 42,
    marginTop: 8
  },
  resultBadge: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  resultGood: {
    backgroundColor: colors.jade
  },
  resultBad: {
    backgroundColor: colors.wine
  },
  resultText: {
    color: colors.ivory,
    fontWeight: "900"
  },
  nextButton: {
    flex: 1,
    minHeight: 40,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10
  },
  nextText: {
    color: colors.ink,
    fontWeight: "900",
    textAlign: "center"
  },
  waitingText: {
    flex: 1,
    color: colors.muted,
    fontWeight: "800",
    textAlign: "center"
  },
  summary: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    alignItems: "center",
    padding: 22
  },
  summaryTitle: {
    color: colors.ivory,
    fontSize: 26,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 12
  },
  summaryScore: {
    color: colors.gold,
    fontSize: 34,
    fontWeight: "900",
    marginTop: 10
  },
  summaryText: {
    color: colors.muted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 8
  },
  summaryMeta: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: "900",
    marginTop: 12
  },
  restartButton: {
    minHeight: 48,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    marginTop: 18
  },
  restartText: {
    color: colors.ink,
    fontWeight: "900"
  }
});
}
