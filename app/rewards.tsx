import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { listPublishedRewardInfos } from "@/src/services/firebase/reward-service";
import { RewardInfoDocument } from "@/src/types/firestore";

const labels = {
  title: { tr: "Ödüller", en: "Awards", ru: "Награды", uz: "Mukofotlar" },
  eyebrow: { tr: "Yarışma bilgileri", en: "Challenge awards", ru: "Награды конкурсов", uz: "Tanlov mukofotlari" },
  intro: {
    tr: "Bu alanda haftalık yarışmaların ödülleri, seçilme kriterleri ve duyuruları paylaşılır.",
    en: "Weekly challenge prizes, selection criteria, and announcements are shared here.",
    ru: "Здесь публикуются награды недельных конкурсов, критерии отбора и объявления.",
    uz: "Bu yerda haftalik tanlov mukofotlari, tanlov mezonlari va e'lonlar ulashiladi."
  }
};

export default function RewardsScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [rewards, setRewards] = useState<RewardInfoDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    listPublishedRewardInfos(language)
      .then((items) => {
        if (active) setRewards(items);
      })
      .catch(() => {
        if (active) setRewards([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [language]);

  return (
    <AppChrome title={labels.title[language]} eyebrow={labels.eyebrow[language]} showBackButton backToHome>
      <Text style={styles.introText}>{labels.intro[language]}</Text>
      <Pressable onPress={() => router.push("/leaderboards")} style={styles.rankingShortcut}>
        <Ionicons name="podium-outline" size={17} color={colors.ink} />
        <View style={styles.shortcutTextBlock}>
          <Text style={styles.shortcutTitle}>{language === "tr" ? "Sıralamalar" : language === "ru" ? "Рейтинги" : language === "uz" ? "Reytinglar" : "Rankings"}</Text>
          <Text style={styles.shortcutText}>{language === "tr" ? "Resim Yarışması ve aktif yarışma listeleri" : language === "ru" ? "Активные конкурсы и списки" : language === "uz" ? "Faol tanlov va ro'yxatlar" : "Active challenge leaderboards"}</Text>
        </View>
      </Pressable>
      <View style={styles.list}>
        {loading ? <Text style={styles.emptyText}>{language === "tr" ? "Ödül bilgileri yükleniyor." : "Loading award notes."}</Text> : null}
        {!loading && rewards.length === 0 ? <Text style={styles.emptyText}>{language === "tr" ? "Henüz yayınlanmış ödül bilgisi yok." : "No published award notes yet."}</Text> : null}
        {rewards.map((award) => (
          <View key={award.id} style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name={toIconName(award.icon)} size={22} color={colors.gold} />
            </View>
            <View style={styles.textBlock}>
              <Text style={styles.title}>{localText(award.title, language)}</Text>
              <Text style={styles.text}>{localText(award.text || award.body, language)}</Text>
            </View>
          </View>
        ))}
      </View>
    </AppChrome>
  );
}

function localText(value: RewardInfoDocument["title"] | undefined, language: "tr" | "en" | "ru" | "uz") {
  return value?.[language] || value?.tr || value?.en || "";
}

function toIconName(value: string): keyof typeof Ionicons.glyphMap {
  return value && value in Ionicons.glyphMap ? value as keyof typeof Ionicons.glyphMap : "trophy-outline";
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    introText: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: "800", marginBottom: 10 },
    rankingShortcut: { minHeight: 50, borderRadius: 8, backgroundColor: colors.gold, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 12, marginBottom: 12 },
    shortcutTextBlock: { flex: 1 },
    shortcutTitle: { color: colors.ink, fontSize: 14, fontWeight: "900" },
    shortcutText: { color: colors.ink, opacity: 0.78, fontSize: 11, fontWeight: "800", marginTop: 2 },
    list: { gap: 10 },
    card: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", gap: 10, padding: 12 },
    iconWrap: { width: 38, height: 38, borderRadius: 8, backgroundColor: colors.panelSoft, alignItems: "center", justifyContent: "center" },
    textBlock: { flex: 1 },
    title: { color: colors.ivory, fontSize: 14, fontWeight: "900" },
    text: { color: colors.muted, fontSize: 12, lineHeight: 17, fontWeight: "700", marginTop: 4 },
    emptyText: { color: colors.muted, fontSize: 12, fontWeight: "800", lineHeight: 18 }
  });
}
