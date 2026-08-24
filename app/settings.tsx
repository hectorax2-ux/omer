import { ReactNode, useEffect, useMemo, useState } from "react";
import { Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { AdPrivacyModal } from "@/components/ad-privacy-modal";
import { prepareAdPrivacy, showAdPrivacyOptions } from "@/components/ad-consent";
import { accountLegalTexts, legalUrls } from "@/constants/store-legal";
import { storeLegalTexts } from "@/constants/store-legal-platform";
import { AppTheme, getThemeColors } from "@/constants/theme";
import { languages, uiCopy } from "@/data/content";
import { useAccount } from "@/hooks/use-account";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import {
  AdPersonalizationPreference,
  adPrivacyStatusLabel,
  getAdPersonalizationPreference
} from "@/utils/ad-privacy-preference";
import {
  defaultNotificationPreferences,
  loadNotificationPreferences,
  saveNotificationPreferences,
  type NotificationPreferences
} from "@/src/services/firebase/notification-preferences-service";

type SupportedLanguage = "tr" | "en" | "ru" | "uz";

const themeOptions: Array<{
  id: AppTheme;
  icon: keyof typeof Ionicons.glyphMap;
  title: Record<SupportedLanguage, string>;
  description: Record<SupportedLanguage, string>;
  swatches: string[];
}> = [
  {
    id: "dark",
    icon: "moon-outline",
    title: { tr: "Koyu", en: "Dark", ru: "Темная", uz: "Qorong'i" },
    description: { tr: "Galeri hissi veren siyah, altın ve bronz denge.", en: "A gallery-like balance of black, gold, and bronze.", ru: "Галерейный баланс черного, золота и бронзы.", uz: "Galereya kayfiyatidagi qora, oltin va bronza muvozanati." },
    swatches: ["#090806", "#15120e", "#d2b879", "#9a8061"]
  },
  {
    id: "light",
    icon: "sunny-outline",
    title: { tr: "Açık", en: "Light", ru: "Светлая", uz: "Yorug'" },
    description: { tr: "Krem, yumuşak kahve ve temiz okuma alanı.", en: "Cream, soft brown, and clean reading surfaces.", ru: "Кремовый, мягкий коричневый и чистое чтение.", uz: "Krem, mayin jigarrang va toza o'qish maydoni." },
    swatches: ["#f7f1e7", "#fffaf2", "#98712b", "#4f6d61"]
  },
  {
    id: "vangogh",
    icon: "star-outline",
    title: { tr: "Van Gogh", en: "Van Gogh", ru: "Ван Гог", uz: "Van Gog" },
    description: { tr: "Yıldızlı Gece'den gelen derin mavi ve sıcak sarı.", en: "Deep blues and warm yellows inspired by Starry Night.", ru: "Глубокий синий и теплый желтый в духе Звездной ночи.", uz: "Yulduzli tundagi ko'k va iliq sariq ohanglar." },
    swatches: ["#091628", "#173a5f", "#f2c85b", "#78a995"]
  },
  {
    id: "monet",
    icon: "leaf-outline",
    title: { tr: "Claude Monet", en: "Claude Monet", ru: "Клод Моне", uz: "Klod Mone" },
    description: { tr: "Nilüfer, bahçe, pastel mavi-yeşil ve lavanta dokusu.", en: "Water lilies, gardens, pastel blue-green, and lavender accents.", ru: "Кувшинки, сад, пастельные сине-зеленые и лавандовые тона.", uz: "Nilufar, bog', pastel ko'k-yashil va lavanda ohanglari." },
    swatches: ["#edf7f2", "#dcefe8", "#75a99a", "#a890b2"]
  },
  {
    id: "dali",
    icon: "hourglass-outline",
    title: { tr: "Salvador Dalí", en: "Salvador Dalí", ru: "Сальвадор Дали", uz: "Salvador Dali" },
    description: { tr: "Sürreal çöl sıcaklığı, kum, altın ve lacivert gölge.", en: "Surreal desert warmth with sand, gold, and navy shadows.", ru: "Сюрреалистичная пустыня: песок, золото и темно-синие тени.", uz: "Syurreal cho'l iliqligi, qum, oltin va to'q ko'k soya." },
    swatches: ["#17110b", "#3a291a", "#d9b56a", "#0b1324"]
  },
  {
    id: "picasso",
    icon: "shapes-outline",
    title: { tr: "Pablo Picasso", en: "Pablo Picasso", ru: "Пабло Пикассо", uz: "Pablo Pikasso" },
    description: { tr: "Kübist, modern, mavi-gri zemin ve terakota vurgular.", en: "Cubist and modern with blue-gray fields and terracotta accents.", ru: "Кубистская современность: сине-серый фон и терракота.", uz: "Kubistik zamonaviylik, ko'k-kulrang fon va terrakota urg'ular." },
    swatches: ["#f1eadc", "#d9d5cd", "#566983", "#a96345"]
  }
] satisfies {
  id: AppTheme;
  icon: keyof typeof Ionicons.glyphMap;
  title: Record<SupportedLanguage, string>;
  description: Record<SupportedLanguage, string>;
  swatches: string[];
}[];

export default function SettingsScreen() {
  const router = useRouter();
  const { language, setLanguage } = useLanguage();
  const { account, updateAccount, canUseMemberFeatures, isAuthenticated, saveAccountProfile } = useAccount();
  const { theme, setTheme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPreferences>(defaultNotificationPreferences);
  const [legalModal, setLegalModal] = useState<null | "account" | "terms" | "privacy" | "permissions">(null);
  const [adPrivacyModalOpen, setAdPrivacyModalOpen] = useState(false);
  const [adPrivacyPreference, setAdPrivacyPreference] = useState<AdPersonalizationPreference | null>(null);
  const modalContent = legalModal ? getLegalModalContent(legalModal, language) : null;
  const notificationLabels = getNotificationLabels(language);
  const adPrivacyPanelTitle = {
    tr: "Gizlilik ve reklamlar",
    en: "Privacy and ads",
    ru: "Конфиденциальность и реклама",
    uz: "Maxfiylik va reklamalar"
  } as const;
  const adPrivacyLabels = {
    tr: "Reklam gizlilik tercihleri",
    en: "Ad privacy preferences",
    ru: "Настройки рекламной конфиденциальности",
    uz: "Reklama maxfiylik sozlamalari"
  } as const;
  const communityGuidelinesLabels = {
    tr: "Topluluk kuralları",
    en: "Community guidelines",
    ru: "Правила сообщества",
    uz: "Hamjamiyat qoidalari"
  } as const;

  useEffect(() => {
    void (async () => {
      await prepareAdPrivacy();
      setAdPrivacyPreference(await getAdPersonalizationPreference());
    })();
  }, []);

  useEffect(() => {
    if (!account.uid) return;
    loadNotificationPreferences(account.uid).then((settings) => {
      setNotificationsEnabled(settings.enabled);
      setNotificationPrefs(settings.preferences);
    }).catch(() => undefined);
  }, [account.uid]);

  function toggleNotificationsEnabled() {
    const next = !notificationsEnabled;
    setNotificationsEnabled(next);
    if (account.uid) void saveNotificationPreferences(account.uid, next, notificationPrefs).catch(() => undefined);
  }

  function toggleNotificationPreference(key: keyof NotificationPreferences) {
    setNotificationPrefs((current) => {
      const next = { ...current, [key]: !current[key] };
      if (account.uid) void saveNotificationPreferences(account.uid, notificationsEnabled, next).catch(() => undefined);
      return next;
    });
  }

  async function openAdPrivacyOptions() {
    if (Platform.OS === "web") {
      setAdPrivacyModalOpen(true);
      return;
    }

    try {
      await showAdPrivacyOptions();
      await prepareAdPrivacy();
      setAdPrivacyPreference(await getAdPersonalizationPreference());
    } catch {
      setAdPrivacyModalOpen(true);
    }
  }

  return (
    <AppChrome title={uiCopy.settings[language]} eyebrow="Art Atlas" showBackButton backToHome showTopAd={false}>
      <AdPrivacyModal
        visible={adPrivacyModalOpen}
        initialPreference={adPrivacyPreference}
        onClose={() => setAdPrivacyModalOpen(false)}
        onSaved={setAdPrivacyPreference}
      />
      <Modal visible={!!legalModal} transparent animationType="fade" onRequestClose={() => setLegalModal(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalPanel}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalContent?.title}</Text>
              <Pressable onPress={() => setLegalModal(null)} style={styles.closeButton}>
                <Ionicons name="close" size={22} color={colors.ivory} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalText}>{modalContent?.body}</Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <SettingPanel title={uiCopy.changeLanguage[language]} icon="language">
        <View style={styles.chips}>
          {languages.map((item) => (
            <Pressable key={item.code} onPress={() => setLanguage(item.code)} style={[styles.chip, language === item.code && styles.chipActive]}>
              <Text style={[styles.chipText, language === item.code && styles.chipTextActive]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </SettingPanel>

      <SettingPanel title={uiCopy.theme[language]} icon="contrast">
        <View style={styles.themeGrid}>
          {themeOptions.map((item) => {
            const optionColors = getThemeColors(item.id);
            const active = theme === item.id;
            return (
              <Pressable key={item.id} onPress={() => setTheme(item.id)} style={[styles.themeCard, active && styles.themeCardActive]}>
                <View style={[styles.themePreview, { backgroundColor: optionColors.panelSoft, borderColor: optionColors.line }]}>
                  <Ionicons name={item.icon} size={18} color={optionColors.gold} />
                  <View style={styles.themeSwatchStrip}>
                    {item.swatches.slice(0, 3).map((swatch) => <View key={swatch} style={[styles.themePreviewSwatch, { backgroundColor: swatch }]} />)}
                  </View>
                </View>
                <View style={styles.themeTextBlock}>
                  <Text style={styles.themeTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>{item.title[language]}</Text>
                </View>
                {active ? <Ionicons name="checkmark-circle" size={16} color={colors.gold} style={styles.themeCheck} /> : null}
              </Pressable>
            );
          })}
        </View>
      </SettingPanel>

      <SettingPanel title={uiCopy.notificationPreferences[language]} icon="notifications">
        <ToggleRow label={uiCopy.receiveNotifications[language]} value={notificationsEnabled} onPress={toggleNotificationsEnabled} />
        {notificationsEnabled ? (
          <View style={styles.notificationDetails}>
            <ToggleRow
              compact
              label={notificationLabels.follows}
              value={notificationPrefs.follows}
              onPress={() => toggleNotificationPreference("follows")}
            />
            <ToggleRow
              compact
              label={notificationLabels.likes}
              value={notificationPrefs.likes}
              onPress={() => toggleNotificationPreference("likes")}
            />
            <ToggleRow compact label={notificationLabels.comments} value={notificationPrefs.comments} onPress={() => toggleNotificationPreference("comments")} />
            <ToggleRow compact label={notificationLabels.messages} value={notificationPrefs.messages} onPress={() => toggleNotificationPreference("messages")} />
            <ToggleRow
              compact
              label={notificationLabels.system}
              value={notificationPrefs.system}
              onPress={() => toggleNotificationPreference("system")}
            />
            <ToggleRow
              compact
              label={notificationLabels.contests}
              value={notificationPrefs.contests}
              onPress={() => toggleNotificationPreference("contests")}
            />
            <ToggleRow
              compact
              label={notificationLabels.important}
              value={notificationPrefs.important}
              onPress={() => toggleNotificationPreference("important")}
            />
            <ToggleRow
              compact
              label={notificationLabels.duels}
              value={notificationPrefs.duels}
              onPress={() => toggleNotificationPreference("duels")}
            />
            <ToggleRow
              compact
              label={notificationLabels.seer}
              value={notificationPrefs.seer}
              onPress={() => toggleNotificationPreference("seer")}
            />
            <ToggleRow
              compact
              label={notificationLabels.badges}
              value={notificationPrefs.badges}
              onPress={() => toggleNotificationPreference("badges")}
            />
            <ToggleRow
              compact
              label={notificationLabels.chance}
              value={notificationPrefs.chance}
              onPress={() => toggleNotificationPreference("chance")}
            />
            <ToggleRow
              compact
              label={notificationLabels.timeCapsule}
              value={notificationPrefs.timeCapsule}
              onPress={() => toggleNotificationPreference("timeCapsule")}
            />
          </View>
        ) : null}
      </SettingPanel>

      <SettingPanel title={uiCopy.countryDiscoveryTitle[language]} icon="earth">
        <ToggleRow
          label={uiCopy.countryDiscovery[language]}
          value={account.isDiscoverableByCountry}
          onPress={async () => {
            const next = !account.isDiscoverableByCountry;
            updateAccount({ isProfileVisible: true, isDiscoverableByCountry: next });
            if (canUseMemberFeatures) {
              await saveAccountProfile({ isDiscoverableByCountry: next });
            }
          }}
        />
      </SettingPanel>

      <SettingPanel title={adPrivacyPanelTitle[language]} icon="shield-checkmark-outline">
        <LegalRow
          title={adPrivacyLabels[language]}
          subtitle={adPrivacyStatusLabel(adPrivacyPreference, language)}
          onPress={() => void openAdPrivacyOptions()}
        />
        <Text style={styles.helperText}>
          {Platform.OS === "web"
            ? {
                tr: "Web sürümünde tercih tarayıcıda saklanır. Mobil uygulamada Google consent formu da açılabilir.",
                en: "On web, your choice is saved in the browser. The mobile app may also open Google's consent form.",
                ru: "В веб-версии выбор сохраняется в браузере. В мобильном приложении может открыться форма Google.",
                uz: "Webda tanlov brauzerda saqlanadi. Mobil ilovada Google consent formasi ham ochilishi mumkin."
              }[language]
            : {
                tr: "Google reklam tercih formunu açar. Form açılmazsa manuel seçim ekranı gösterilir.",
                en: "Opens Google's ad preference form. If unavailable, a manual choice screen is shown.",
                ru: "Открывает форму рекламных предпочтений Google. Если недоступна — ручной выбор.",
                uz: "Google reklama sozlamalari formasini ochadi. Bo'lmasa qo'lda tanlash ekrani ko'rsatiladi."
              }[language]}
        </Text>
      </SettingPanel>

      <SettingPanel title={uiCopy.accountLegal[language]} icon="document-text">
        {isAuthenticated ? (
          <LegalRow
            title={{ tr: "Engellenen kullanıcılar", en: "Blocked users", ru: "Заблокированные пользователи", uz: "Bloklangan foydalanuvchilar" }[language]}
            onPress={() => router.push("/blocked-users")}
          />
        ) : null}
        <LegalRow title={communityGuidelinesLabels[language]} onPress={() => router.push("/community-guidelines")} />
        <LegalRow title={uiCopy.accountSettings[language]} onPress={() => setLegalModal("account")} />
        <LegalRow title={uiCopy.terms[language]} onPress={() => setLegalModal("terms")} />
        <LegalRow title={uiCopy.privacy[language]} onPress={() => setLegalModal("privacy")} />
        <LegalRow title={uiCopy.permissions[language]} onPress={() => setLegalModal("permissions")} />
        <LegalRow title={uiCopy.dataDeletion[language]} onPress={() => Linking.openURL(legalUrls.dataDeletion).catch(() => undefined)} external />
      </SettingPanel>

      <SettingPanel title={uiCopy.legalDocuments[language]} icon="globe-outline">
        <LegalRow title={uiCopy.terms[language]} subtitle={legalUrls.terms} onPress={() => router.push("/terms-of-use")} />
        <LegalRow title={uiCopy.privacy[language]} subtitle={legalUrls.privacy} onPress={() => router.push("/privacy-policy")} />
        <LegalRow title={uiCopy.permissions[language]} subtitle={legalUrls.permissions} onPress={() => Linking.openURL(legalUrls.permissions).catch(() => undefined)} external />
        <LegalRow title={uiCopy.support[language]} subtitle={legalUrls.support} onPress={() => Linking.openURL(legalUrls.support).catch(() => undefined)} external />
      </SettingPanel>
    </AppChrome>
  );
}

function getNotificationLabels(language: "tr" | "en" | "ru" | "uz") {
  return {
    follows: {
      tr: "Takip bildirimleri",
      en: "Follow notifications",
      ru: "Подписки",
      uz: "Kuzatish bildirishnomalari"
    }[language],
    likes: {
      tr: "Beğeni bildirimleri",
      en: "Like notifications",
      ru: "Лайки",
      uz: "Like bildirishnomalari"
    }[language],
    comments: {
      tr: "Yorum bildirimleri",
      en: "Comment notifications",
      ru: "Комментарии",
      uz: "Izoh bildirishnomalari"
    }[language],
    messages: {
      tr: "Mesaj bildirimleri",
      en: "Message notifications",
      ru: "Сообщения",
      uz: "Xabar bildirishnomalari"
    }[language],
    system: {
      tr: "Sistem bildirimleri",
      en: "System notifications",
      ru: "Системные уведомления",
      uz: "Tizim bildirishnomalari"
    }[language],
    contests: {
      tr: "Yarışma, haftanın enleri ve ödüller",
      en: "Challenges, image contests, and awards",
      ru: "Конкурсы, лучшее недели и награды",
      uz: "Tanlov, rasm tanlovi va mukofotlar"
    }[language],
    important: {
      tr: "Önemli bildirimler",
      en: "Important notifications",
      ru: "Важные уведомления",
      uz: "Muhim bildirishnomalar"
    }[language],
    duels: {
      tr: "Düello ve yeni eşleşme bildirimleri",
      en: "Duel and new matchup notifications",
      ru: "Дуэли и новые пары",
      uz: "Duel va yangi juftlik bildirishnomalari"
    }[language],
    seer: {
      tr: "Kahin sonucu ve puan bildirimleri",
      en: "Seer result and point notifications",
      ru: "Результаты предсказаний и очки",
      uz: "Kahin natijasi va ball bildirishnomalari"
    }[language],
    badges: {
      tr: "Rozet kazanımı bildirimleri",
      en: "Badge achievement notifications",
      ru: "Получение значков",
      uz: "Nishon yutish bildirishnomalari"
    }[language],
    chance: {
      tr: "Şans kartı bildirimleri",
      en: "Chance card notifications",
      ru: "Карта удачи",
      uz: "Omad kartasi bildirishnomalari"
    }[language],
    timeCapsule: {
      tr: "Zaman kapsülü hatırlatmaları",
      en: "Time capsule reminders",
      ru: "Напоминания капсулы времени",
      uz: "Vaqt kapsulasi eslatmalari"
    }[language]
  };
}

function getLegalModalContent(kind: "account" | "terms" | "privacy" | "permissions", language: "tr" | "en" | "ru" | "uz") {
  if (kind === "account") {
    return {
      title: uiCopy.accountSettings[language],
      body: accountLegalTexts[language]
    };
  }

  const titles = {
    terms: uiCopy.terms[language],
    privacy: uiCopy.privacy[language],
    permissions: uiCopy.permissions[language]
  };
  return { title: titles[kind], body: storeLegalTexts[kind][language] };
}

function SettingPanel({ title, icon, children }: { title: string; icon: keyof typeof Ionicons.glyphMap; children: ReactNode }) {
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.panel}>
      <View style={styles.header}>
        <Ionicons name={icon} size={19} color={colors.gold} />
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

function ToggleRow({ label, value, onPress, compact = false }: { label: string; value: boolean; onPress: () => void; compact?: boolean }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => createStyles(getThemeColors(theme)), [theme]);
  return (
    <Pressable onPress={onPress} style={[styles.toggleRow, compact && styles.toggleRowCompact]}>
      <Text style={[styles.rowLabel, compact && styles.rowLabelCompact]} numberOfLines={2}>{label}</Text>
      <View style={[styles.switchTrack, value && styles.switchTrackActive]}>
        <View style={[styles.switchKnob, value && styles.switchKnobActive]} />
      </View>
    </Pressable>
  );
}

function LegalRow({ title, subtitle, onPress, external = false }: { title: string; subtitle?: string; onPress: () => void; external?: boolean }) {
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <Pressable onPress={onPress} style={styles.toggleRow}>
      <View style={styles.legalRowText}>
        <Text style={styles.rowLabel} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={styles.legalSubtitle} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      <Ionicons name={external ? "open-outline" : "chevron-forward"} size={18} color={colors.muted} />
    </Pressable>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
return StyleSheet.create({
  panel: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 14, gap: 12, marginBottom: 12 },
  header: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { color: colors.ivory, fontSize: 16, fontWeight: "900", flex: 1 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { minHeight: 36, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, alignItems: "center", justifyContent: "center", paddingHorizontal: 12, flexGrow: 1 },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.ivory, fontWeight: "900", textAlign: "center" },
  chipTextActive: { color: colors.ink },
  themeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  themeCard: { width: "48%", minHeight: 60, flexGrow: 1, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, flexDirection: "row", alignItems: "center", gap: 8, padding: 8 },
  themeCardActive: { borderColor: colors.gold, backgroundColor: colors.glass },
  themePreview: { width: 38, height: 42, borderRadius: 8, borderWidth: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  themeSwatchStrip: { flexDirection: "row", gap: 3 },
  themePreviewSwatch: { width: 7, height: 7, borderRadius: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" },
  themeTextBlock: { flex: 1, minWidth: 0 },
  themeTitle: { color: colors.ivory, fontSize: 12, fontWeight: "900" },
  themeCheck: { flexShrink: 0 },
  toggleRow: { minHeight: 44, borderRadius: 8, backgroundColor: colors.panelSoft, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: 12, paddingVertical: 7 },
  toggleRowCompact: { minHeight: 38, backgroundColor: "transparent", borderWidth: 1, borderColor: colors.line },
  rowLabel: { color: colors.ivory, fontWeight: "800", lineHeight: 18, flex: 1, minWidth: 0 },
  legalRowText: { flex: 1, minWidth: 0, gap: 2 },
  legalSubtitle: { color: colors.muted, fontSize: 11, lineHeight: 15, fontWeight: "700" },
  helperText: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: "700" },
  rowLabelCompact: { fontSize: 12 },
  notificationDetails: { gap: 7 },
  switchTrack: { width: 46, height: 26, flexShrink: 0, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 1, borderColor: colors.line, padding: 3, justifyContent: "center" },
  switchTrackActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  switchKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.muted, alignSelf: "flex-start" },
  switchKnobActive: { backgroundColor: colors.ink, alignSelf: "flex-end" },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "center",
    padding: 18
  },
  modalPanel: {
    maxHeight: "78%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(217,184,101,0.34)",
    backgroundColor: colors.panel,
    padding: 16
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10
  },
  modalTitle: {
    color: colors.ivory,
    fontSize: 19,
    fontWeight: "900",
    flex: 1
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: colors.panelSoft,
    alignItems: "center",
    justifyContent: "center"
  },
  modalText: {
    color: colors.ivory,
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700"
  }
});
}
