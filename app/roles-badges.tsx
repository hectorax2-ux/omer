import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { badgeItems, roleItems, TaxonomyItem } from "@/constants/profile-taxonomy";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";

type Lang = "tr" | "en" | "ru" | "uz";

const copy = {
  title: { tr: "Roller / Rozetler", en: "Roles / Badges", ru: "Роли / значки", uz: "Rollar / nishonlar" },
  intro: {
    tr: "Roller ve rozetler topluluk katkısına göre verilir. Talep için destek bölümündeki ilgili yere başvurun. Her kullanıcı Art Atlas'a Sanatsever rozetiyle başlar.",
    en: "Roles and badges are earned through community contribution. To request one, open a support ticket under the related category. Every member starts with the Art lover badge.",
    ru: "Роли и значки присваиваются за вклад в сообщество. Для запроса создайте обращение в поддержку. Каждый участник начинает со значка любителя искусства.",
    uz: "Rollar va nishonlar jamiyat hissasi uchun beriladi. So'rov uchun yordam bo'limiga murojaat qiling. Har bir a'zo San'atsevar nishoni bilan boshlaydi."
  },
  request: { tr: "Rol/rozet talep et", en: "Request role/badge", ru: "Запросить роль/значок", uz: "Rol/nishon so'rash" },
  roles: { tr: "Roller", en: "Roles", ru: "Роли", uz: "Rollar" },
  badges: { tr: "Rozetler", en: "Badges", ru: "Значки", uz: "Nishonlar" }
};

export default function RolesBadgesScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  function requestRole() {
    router.push({
      pathname: "/support",
      params: {
        category: "account",
        subcategory: "Rol / rozet",
        subject: "Rol / rozet talebi",
        topic: "İstediğin rol veya rozet:\n\nDetay:\n"
      }
    });
  }

  return (
    <AppChrome title={copy.title[language]} eyebrow="Art Atlas" showBackButton backToHome>
      <View style={styles.hero}>
        <Ionicons name="ribbon" size={34} color={colors.gold} />
        <Text style={styles.heroTitle}>{copy.title[language]}</Text>
        <Text style={styles.heroText}>{copy.intro[language]}</Text>
        <Pressable onPress={requestRole} style={styles.requestButton}>
          <Ionicons name="help-circle-outline" size={18} color={colors.ink} />
          <Text style={styles.requestText}>{copy.request[language]}</Text>
        </Pressable>
      </View>
      <Section title={copy.roles[language]} items={roleItems} language={language} styles={styles} colors={colors} />
      <Section title={copy.badges[language]} items={badgeItems} language={language} styles={styles} colors={colors} />
    </AppChrome>
  );
}

function Section({ title, items, language, styles, colors }: { title: string; items: TaxonomyItem<string>[]; language: Lang; styles: ReturnType<typeof createStyles>; colors: ReturnType<typeof getThemeColors> }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <View style={styles.iconBox}>
            <Ionicons name={item.icon} size={20} color={colors.gold} />
          </View>
          <View style={styles.cardText}>
            <Text style={styles.cardTitle}>{item.label[language]}</Text>
            <Text style={styles.cardBody}>{item.description[language]}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    hero: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 16, gap: 10, marginBottom: 14 },
    heroTitle: { color: colors.ivory, fontSize: 24, fontWeight: "900" },
    heroText: { color: colors.muted, fontSize: 13, lineHeight: 20, fontWeight: "700" },
    requestButton: { minHeight: 44, borderRadius: 8, backgroundColor: colors.gold, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 14, marginTop: 2 },
    requestText: { color: colors.ink, fontWeight: "900" },
    section: { gap: 8, marginBottom: 16 },
    sectionTitle: { color: colors.ivory, fontSize: 17, fontWeight: "900", marginBottom: 2 },
    card: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", gap: 10, padding: 12 },
    iconBox: { width: 38, height: 38, borderRadius: 8, backgroundColor: colors.panelSoft, alignItems: "center", justifyContent: "center" },
    cardText: { flex: 1, minWidth: 0 },
    cardTitle: { color: colors.ivory, fontSize: 15, fontWeight: "900" },
    cardBody: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: "700", marginTop: 3 }
  });
}
