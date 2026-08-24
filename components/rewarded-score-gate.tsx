import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { areRewardedAdRequirementsEnabled } from "@/constants/ad-feature-flags";
import { getThemeColors } from "@/constants/theme";
import { useAccount } from "@/hooks/use-account";
import { useAds } from "@/hooks/use-ads";
import { useAppTheme } from "@/hooks/use-app-theme";

type Language = "tr" | "en" | "ru" | "uz";

const copy = {
  premiumNote: {
    tr: "Premium üyelerde puan sıralamaya otomatik yansır.",
    en: "Premium members are ranked automatically.",
    ru: "У Premium результат сразу попадает в рейтинг.",
    uz: "Premium a'zolarda ball avtomatik reytingga tushadi."
  },
  requirement: {
    tr: "Puanını sıralamaya eklemek için kısa sponsorlu içeriği izlemen gerekir.",
    en: "Watch a short sponsored clip to add your score to the leaderboard.",
    ru: "Посмотрите короткую рекламу, чтобы добавить результат в рейтинг.",
    uz: "Ballingizni reytingga qo'shish uchun qisqa homiylik kontentini ko'ring."
  },
  watch: {
    tr: "Reklamı izle",
    en: "Watch ad",
    ru: "Смотреть",
    uz: "Reklamani ko'rish"
  },
  thanks: {
    tr: "Teşekkürler! Puanın sıralamaya eklendi.",
    en: "Thank you! Your score was added to the leaderboard.",
    ru: "Спасибо! Ваш результат добавлен в рейтинг.",
    uz: "Rahmat! Ballingiz reytingga qo'shildi."
  },
  failed: {
    tr: "Reklam tamamlanamadı. Puan sıralamaya eklenmedi.",
    en: "The ad was not completed. Your score was not ranked.",
    ru: "Реклама не завершена. Результат не добавлен в рейтинг.",
    uz: "Reklama yakunlanmadi. Ball reytingga qo'shilmadi."
  },
  waiting: {
    tr: "Puanın kaydediliyor…",
    en: "Saving your score…",
    ru: "Сохранение результата…",
    uz: "Ball saqlanmoqda…"
  }
};

export function RewardedScoreGate({
  language,
  score,
  scoreLabel,
  onSubmit,
  placement = "admob_rewarded",
  enabled = true
}: {
  language: Language;
  score: number | string;
  scoreLabel?: string;
  onSubmit: () => void | Promise<void>;
  placement?: "admob_rewarded";
  enabled?: boolean;
}) {
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { account } = useAccount();
  const { adsEnabled, showRewardedAd } = useAds();
  const [phase, setPhase] = useState<"idle" | "watching" | "submitting" | "done" | "failed">("idle");
  const skipAd = !areRewardedAdRequirementsEnabled() || !adsEnabled || account.isPremium;
  const submittedRef = useRef(false);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  useEffect(() => {
    if (!enabled || !skipAd || submittedRef.current) return;
    submittedRef.current = true;
    let active = true;
    setPhase("submitting");
    Promise.resolve(onSubmitRef.current())
      .then(() => {
        if (active) setPhase("done");
      })
      .catch(() => {
        if (active) setPhase("failed");
      });
    return () => {
      active = false;
    };
  }, [enabled, skipAd]);

  async function watchAd() {
    if (phase === "watching" || phase === "submitting" || phase === "done") return;
    setPhase("watching");
    const completed = await showRewardedAd(placement);
    if (!completed) {
      setPhase("failed");
      return;
    }
    setPhase("submitting");
    try {
      await onSubmit();
      setPhase("done");
    } catch {
      setPhase("failed");
    }
  }

  if (!enabled) return null;

  return (
    <View style={styles.wrap}>
      {scoreLabel ? <Text style={styles.label}>{scoreLabel}</Text> : null}
      <Text style={styles.score}>{score}</Text>
      {phase === "done" ? (
        <View style={styles.thanksRow}>
          <Ionicons name="checkmark-circle" size={18} color={colors.gold} />
          <Text style={styles.thanks}>{copy.thanks[language]}</Text>
        </View>
      ) : phase === "failed" ? (
        <Text style={styles.failed}>{copy.failed[language]}</Text>
      ) : skipAd ? (
        <Text style={styles.note}>{account.isPremium ? copy.premiumNote[language] : copy.waiting[language]}</Text>
      ) : (
        <>
          <Text style={styles.note}>{copy.requirement[language]}</Text>
          <Pressable disabled={phase === "watching" || phase === "submitting"} onPress={() => void watchAd()} style={[styles.button, (phase === "watching" || phase === "submitting") && styles.buttonDisabled]}>
            {phase === "watching" || phase === "submitting" ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <Text style={styles.buttonText}>{copy.watch[language]}</Text>
            )}
          </Pressable>
          {phase === "submitting" ? <Text style={styles.note}>{copy.waiting[language]}</Text> : null}
        </>
      )}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    wrap: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panelSoft,
      padding: 14,
      gap: 10,
      marginTop: 10
    },
    label: { color: colors.muted, fontSize: 12, fontWeight: "800", textAlign: "center" },
    score: { color: colors.gold, fontSize: 36, fontWeight: "900", textAlign: "center", fontVariant: ["tabular-nums"] },
    note: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: "700", textAlign: "center" },
    thanksRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
    thanks: { color: colors.ivory, fontSize: 13, fontWeight: "800", textAlign: "center", flex: 1 },
    failed: { color: colors.wine, fontSize: 12, fontWeight: "800", textAlign: "center" },
    button: {
      minHeight: 44,
      borderRadius: 8,
      backgroundColor: colors.gold,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 16
    },
    buttonDisabled: { opacity: 0.7 },
    buttonText: { color: colors.ink, fontWeight: "900" }
  });
}
