import { useMemo, useState } from "react";
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { areRewardedAdRequirementsEnabled } from "@/constants/ad-feature-flags";
import { getThemeColors } from "@/constants/theme";
import { useAccount } from "@/hooks/use-account";
import { useAds } from "@/hooks/use-ads";
import { useAppTheme } from "@/hooks/use-app-theme";

type Language = "tr" | "en" | "ru" | "uz";

const copy = {
  weeklyTitle: {
    tr: "Haftalık yarışmaya katıl",
    en: "Join weekly challenge",
    ru: "Участие в недельном конкурсе",
    uz: "Haftalik tanlovga qo'shilish"
  },
  dailyTitle: {
    tr: "Günlük teste başla",
    en: "Start daily test",
    ru: "Начать ежедневный тест",
    uz: "Kunlik testni boshlash"
  },
  premiumWeekly: {
    tr: "Premium üyeler doğrudan haftalık yarışmaya katılır ve puanları sıralamaya yazılır.",
    en: "Premium members join the weekly challenge directly and their score counts toward the leaderboard.",
    ru: "Premium-участники сразу входят в недельный конкурс, и их результат идет в рейтинг.",
    uz: "Premium a'zolar to'g'ridan-to'g'ri haftalik tanlovga kiradi va balli reytingga yoziladi."
  },
  premiumDaily: {
    tr: "Premium üyeler günlük teste doğrudan girebilir.",
    en: "Premium members can enter the daily test directly.",
    ru: "Premium-участники могут сразу начать ежедневный тест.",
    uz: "Premium a'zolar kunlik testga to'g'ridan-to'g'ri kira oladi."
  },
  adWeekly: {
    tr: "Sıralamaya katılmak için kısa sponsorlu içeriği izlemen gerekir. İzledikten sonra bu haftanın puanlı turuna başlayabilirsin.",
    en: "Watch a short sponsored clip to join the leaderboard. After watching, you can start this week's scored round.",
    ru: "Чтобы попасть в рейтинг, посмотрите короткую рекламу. После этого можно начать недельный тур с очками.",
    uz: "Reytingga kirish uchun qisqa homiylik kontentini ko'ring. Keyin shu haftaning ballli turini boshlaysiz."
  },
  adDaily: {
    tr: "Günlük teste girmek için kısa sponsorlu içeriği izlemen gerekir. Bugün için bir kez yeterlidir.",
    en: "Watch a short sponsored clip to enter today's daily test. One view is enough for today.",
    ru: "Чтобы начать ежедневный тест, посмотрите короткую рекламу. На сегodnya достаточно одного просмотра.",
    uz: "Kunlik testga kirish uchun qisqa reklamani ko'ring. Bugun uchun bir marta yetadi."
  },
  watch: {
    tr: "Reklamı izle ve başla",
    en: "Watch ad and start",
    ru: "Смотреть и начать",
    uz: "Reklamani ko'rib boshlash"
  },
  continuePremium: {
    tr: "Devam et",
    en: "Continue",
    ru: "Продолжить",
    uz: "Davom etish"
  },
  cancel: {
    tr: "Vazgeç",
    en: "Cancel",
    ru: "Отмена",
    uz: "Bekor qilish"
  },
  failed: {
    tr: "Reklam tamamlanamadı. Erişim açılmadı.",
    en: "The ad was not completed. Access was not granted.",
    ru: "Реклама не завершена. Доступ не открыт.",
    uz: "Reklama yakunlanmadi. Kirish ochilmadi."
  }
};

export function QuizAccessPrompt({
  visible,
  mode,
  language,
  onClose,
  onGranted
}: {
  visible: boolean;
  mode: "weekly" | "daily";
  language: Language;
  onClose: () => void;
  onGranted: () => void;
}) {
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { account } = useAccount();
  const { adsEnabled, showRewardedAd } = useAds();
  const [phase, setPhase] = useState<"idle" | "watching" | "failed">("idle");
  const skipAd = account.isPremium || !adsEnabled || !areRewardedAdRequirementsEnabled();
  const title = mode === "weekly" ? copy.weeklyTitle[language] : copy.dailyTitle[language];
  const body = skipAd
    ? mode === "weekly" ? copy.premiumWeekly[language] : copy.premiumDaily[language]
    : mode === "weekly" ? copy.adWeekly[language] : copy.adDaily[language];

  async function confirm() {
    if (skipAd) {
      onGranted();
      return;
    }
    setPhase("watching");
    const completed = await showRewardedAd("admob_rewarded");
    if (!completed) {
      setPhase("failed");
      return;
    }
    setPhase("idle");
    onGranted();
  }

  function close() {
    setPhase("idle");
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <Ionicons name={mode === "weekly" ? "trophy" : "shuffle"} size={32} color={colors.gold} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.text}>{body}</Text>
          {phase === "failed" ? <Text style={styles.failed}>{copy.failed[language]}</Text> : null}
          <View style={styles.actions}>
            <Pressable onPress={close} style={styles.cancel}>
              <Text style={styles.cancelText}>{copy.cancel[language]}</Text>
            </Pressable>
            <Pressable disabled={phase === "watching"} onPress={() => void confirm()} style={[styles.confirm, phase === "watching" && styles.confirmDisabled]}>
              {phase === "watching" ? (
                <ActivityIndicator color={colors.ink} />
              ) : (
                <Text style={styles.confirmText}>{skipAd ? copy.continuePremium[language] : copy.watch[language]}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.52)", justifyContent: "center", padding: 18 },
    panel: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: "center", padding: 18, gap: 10 },
    title: { color: colors.ivory, fontSize: 20, fontWeight: "900", textAlign: "center" },
    text: { color: colors.muted, lineHeight: 21, fontWeight: "700", textAlign: "center" },
    failed: { color: colors.wine, fontSize: 12, fontWeight: "800", textAlign: "center" },
    actions: { flexDirection: "row", gap: 8, marginTop: 6, alignSelf: "stretch" },
    cancel: { flex: 1, minHeight: 42, borderRadius: 8, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
    cancelText: { color: colors.ivory, fontWeight: "900" },
    confirm: { flex: 1, minHeight: 42, borderRadius: 8, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", paddingHorizontal: 12 },
    confirmDisabled: { opacity: 0.7 },
    confirmText: { color: colors.ink, fontWeight: "900", textAlign: "center" }
  });
}
