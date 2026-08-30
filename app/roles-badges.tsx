import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { badgeItems, getRoleItem, roleItems, TaxonomyItem } from "@/constants/profile-taxonomy";
import { getThemeColors } from "@/constants/theme";
import { hexAlpha, radii } from "@/constants/design";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";

type Lang = "tr" | "en" | "ru" | "uz";

const copy = {
  title: { tr: "Roller & Rozetler", en: "Roles & Badges", ru: "Роли и значки", uz: "Rollar va nishonlar" },
  kicker: { tr: "ART ATLAS • TOPLULUK", en: "ART ATLAS • COMMUNITY", ru: "ART ATLAS • СООБЩЕСТВО", uz: "ART ATLAS • HAMJAMIYAT" },
  intro: { tr: "Sanat yolculuğundaki kimliğini ve kazandığın unvanları keşfet.", en: "Discover your identity and achievements across your art journey.", ru: "Откройте свою роль и достижения в мире искусства.", uz: "San’at yo‘lingizdagi shaxsiyat va yutuqlaringizni kashf eting." },
  current: { tr: "SENİN ROLÜN", en: "YOUR ROLE", ru: "ВАША РОЛЬ", uz: "SIZNING ROLINGIZ" },
  request: { tr: "Bir rol veya rozet için başvur", en: "Apply for a role or badge", ru: "Подать заявку на роль или значок", uz: "Rol yoki nishon uchun ariza bering" },
  roles: { tr: "ROL KOLEKSİYONU", en: "ROLE COLLECTION", ru: "КОЛЛЕКЦИЯ РОЛЕЙ", uz: "ROLLAR TO‘PLAMI" },
  badges: { tr: "ROZET VİTRİNİ", en: "BADGE SHOWCASE", ru: "ВИТРИНА ЗНАЧКОВ", uz: "NISHONLAR VITRINASI" },
  earned: { tr: "Kazanıldı", en: "Earned", ru: "Получено", uz: "Olingan" },
  locked: { tr: "Nasıl alınır?", en: "How to earn", ru: "Как получить", uz: "Qanday olinadi" },
  close: { tr: "Kapat", en: "Close", ru: "Закрыть", uz: "Yopish" }
} as const;

export default function RolesBadgesScreen() {
  const { language } = useLanguage();
  const { account } = useAccount();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const compact = useWindowDimensions().width < 360;
  const styles = useMemo(() => createStyles(colors, compact), [colors, compact]);
  const router = useRouter();
  const [detail, setDetail] = useState<{ item: TaxonomyItem<string>; earned: boolean } | null>(null);
  const currentRole = getRoleItem(account.role);
  const earnedBadges = new Set([...(account.badges ?? []), ...(account.isPremium ? ["premium"] : [])]);

  function requestRole() {
    router.push({ pathname: "/support", params: { category: "account", subcategory: "Rol / rozet", subject: "Rol / rozet talebi", topic: "İstediğin rol veya rozet:\n\nDetay:\n" } });
  }

  return <>
    <AppChrome title={copy.title[language]} eyebrow="Art Atlas" showBackButton backToHome>
      <View style={styles.hero}>
        <Text style={styles.kicker}>{copy.kicker[language]}</Text>
        <Text style={styles.heroTitle}>{copy.title[language]}</Text>
        <Text style={styles.heroText}>{copy.intro[language]}</Text>
        <View style={styles.currentRole}>
          <View style={styles.currentIcon}><Ionicons name={currentRole.icon} size={26} color={colors.gold} /></View>
          <View style={styles.currentCopy}>
            <Text style={styles.currentLabel}>{copy.current[language]}</Text>
            <Text style={styles.currentTitle}>{currentRole.label[language]}</Text>
            <Text style={styles.currentBody} numberOfLines={2}>{currentRole.description[language]}</Text>
          </View>
        </View>
      </View>
      <Collection title={copy.roles[language]} items={roleItems} language={language} isEarned={(item) => item.id === account.role} onSelect={(item, earned) => setDetail({ item, earned })} styles={styles} colors={colors} />
      <Collection title={copy.badges[language]} items={badgeItems} language={language} isEarned={(item) => earnedBadges.has(item.id)} onSelect={(item, earned) => setDetail({ item, earned })} styles={styles} colors={colors} />
      <Pressable onPress={requestRole} style={({ pressed }) => [styles.requestButton, pressed && styles.pressed]}>
        <Ionicons name="paper-plane-outline" size={17} color={colors.gold} />
        <Text style={styles.requestText}>{copy.request[language]}</Text>
        <Ionicons name="chevron-forward" size={16} color={colors.muted} />
      </Pressable>
    </AppChrome>
    <Modal visible={Boolean(detail)} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
      <View style={styles.modalOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setDetail(null)} />
        <View style={styles.modalCard}>
          <View style={[styles.modalIcon, { opacity: detail?.earned ? 1 : 0.55 }]}><Ionicons name={detail?.item.icon ?? "ribbon"} size={28} color={colors.gold} /></View>
          <Text style={styles.modalState}>{detail?.earned ? copy.earned[language] : copy.locked[language]}</Text>
          <Text style={styles.modalTitle}>{detail?.item.label[language]}</Text>
          <Text style={styles.modalBody}>{detail?.item.description[language]}</Text>
          <Pressable onPress={() => setDetail(null)} style={styles.closeButton}><Text style={styles.closeText}>{copy.close[language]}</Text></Pressable>
        </View>
      </View>
    </Modal>
  </>;
}

function Collection({ title, items, language, isEarned, onSelect, styles, colors }: { title: string; items: TaxonomyItem<string>[]; language: Lang; isEarned: (item: TaxonomyItem<string>) => boolean; onSelect: (item: TaxonomyItem<string>, earned: boolean) => void; styles: ReturnType<typeof createStyles>; colors: ReturnType<typeof getThemeColors> }) {
  return <View style={styles.section}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <View style={styles.grid}>{items.map((item) => {
      const earned = isEarned(item);
      return <Pressable key={item.id} onPress={() => onSelect(item, earned)} style={({ pressed }) => [styles.card, !earned && styles.lockedCard, pressed && styles.pressed]}>
        <View style={[styles.iconBox, !earned && styles.lockedIcon]}><Ionicons name={item.icon} size={20} color={earned ? colors.gold : colors.muted} /></View>
        <Text style={[styles.cardTitle, !earned && styles.lockedText]} numberOfLines={2}>{item.label[language]}</Text>
        <Text style={styles.cardHint} numberOfLines={1}>{earned ? copy.earned[language] : copy.locked[language]}</Text>
      </Pressable>;
    })}</View>
  </View>;
}

function createStyles(colors: ReturnType<typeof getThemeColors>, compact: boolean) {
  return StyleSheet.create({
    hero: { borderRadius: radii.lg, borderWidth: 1, borderColor: hexAlpha(colors.gold, 0.18), backgroundColor: colors.panel, padding: compact ? 14 : 17, marginBottom: 20 },
    kicker: { color: colors.gold, fontSize: 9, lineHeight: 13, fontWeight: "800", letterSpacing: 1.4 },
    heroTitle: { color: colors.ivory, fontSize: compact ? 22 : 26, lineHeight: compact ? 27 : 31, fontWeight: "900", marginTop: 5 },
    heroText: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: "600", marginTop: 5 },
    currentRole: { minHeight: 92, borderRadius: radii.md, backgroundColor: hexAlpha(colors.navy, 0.62), borderWidth: 1, borderColor: hexAlpha(colors.gold, 0.2), flexDirection: "row", alignItems: "center", gap: 12, padding: 12, marginTop: 15 },
    currentIcon: { width: 52, height: 52, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: hexAlpha(colors.gold, 0.1), borderWidth: 1, borderColor: hexAlpha(colors.gold, 0.22) },
    currentCopy: { flex: 1, minWidth: 0 },
    currentLabel: { color: colors.gold, fontSize: 8.5, lineHeight: 12, fontWeight: "900", letterSpacing: 1.2 },
    currentTitle: { color: colors.ivory, fontSize: 18, lineHeight: 22, fontWeight: "900", marginTop: 1 },
    currentBody: { color: colors.muted, fontSize: 10.5, lineHeight: 15, fontWeight: "600", marginTop: 2 },
    section: { marginBottom: 20 },
    sectionTitle: { color: colors.muted, fontSize: 10, lineHeight: 14, fontWeight: "900", letterSpacing: 1.5, marginBottom: 9 },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: compact ? 8 : 10 },
    card: { width: compact ? "48.5%" : "48.6%", minHeight: 126, borderRadius: radii.md, borderWidth: 1, borderColor: hexAlpha(colors.gold, 0.2), backgroundColor: colors.panel, padding: 12 },
    lockedCard: { opacity: 0.64, borderColor: colors.line },
    pressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
    iconBox: { width: 38, height: 38, borderRadius: 13, backgroundColor: hexAlpha(colors.gold, 0.1), alignItems: "center", justifyContent: "center" },
    lockedIcon: { backgroundColor: colors.panelSoft },
    cardTitle: { color: colors.ivory, fontSize: compact ? 13 : 14, lineHeight: 18, fontWeight: "900", marginTop: 9 },
    lockedText: { color: colors.muted },
    cardHint: { color: colors.muted, fontSize: 9, lineHeight: 13, fontWeight: "700", marginTop: "auto" },
    requestButton: { minHeight: 50, borderRadius: radii.md, borderWidth: 1, borderColor: hexAlpha(colors.gold, 0.22), backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, marginBottom: 8 },
    requestText: { color: colors.ivory, fontSize: 13, fontWeight: "800", flex: 1 },
    modalOverlay: { flex: 1, backgroundColor: "rgba(3,6,18,0.78)", alignItems: "center", justifyContent: "center", padding: 22 },
    modalCard: { width: "100%", maxWidth: 390, borderRadius: radii.lg, backgroundColor: colors.panel, borderWidth: 1, borderColor: hexAlpha(colors.gold, 0.24), padding: 20, alignItems: "center" },
    modalIcon: { width: 58, height: 58, borderRadius: 20, backgroundColor: hexAlpha(colors.gold, 0.1), alignItems: "center", justifyContent: "center" },
    modalState: { color: colors.gold, fontSize: 9, lineHeight: 13, fontWeight: "900", letterSpacing: 1.2, marginTop: 12 },
    modalTitle: { color: colors.ivory, fontSize: 21, lineHeight: 26, fontWeight: "900", marginTop: 3, textAlign: "center" },
    modalBody: { color: colors.muted, fontSize: 13, lineHeight: 20, fontWeight: "600", marginTop: 8, textAlign: "center" },
    closeButton: { minHeight: 42, borderRadius: 999, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", paddingHorizontal: 28, marginTop: 18 },
    closeText: { color: colors.ink, fontSize: 12, fontWeight: "900" }
  });
}
