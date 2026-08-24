import { useMemo, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { applyAdPrivacyPreference } from "@/components/ad-consent";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { AdPersonalizationPreference } from "@/utils/ad-privacy-preference";

type Props = {
  visible: boolean;
  initialPreference: AdPersonalizationPreference | null;
  onClose: () => void;
  onSaved: (preference: AdPersonalizationPreference) => void;
};

const copy = {
  title: {
    tr: "Reklam gizlilik tercihleri",
    en: "Ad privacy preferences",
    ru: "Настройки рекламной конфиденциальности",
    uz: "Reklama maxfiylik sozlamalari"
  },
  intro: {
    tr: "Art Atlas'ta sponsorlu içerikler gösterilebilir. Kişiselleştirilmiş içerikler ilgi alanlarınıza göre seçilir; kapalıyken yalnızca genel içerikler gösterilir.",
    en: "Art Atlas may show sponsored content. Personalized content uses your interests; when off, only general content is shown.",
    ru: "Art Atlas может показывать спонсорский контент. Персонализированный контент учитывает интересы; если выключен — только общий контент.",
    uz: "Art Atlas homiy kontentni ko'rsatishi mumkin. Shaxsiylashtirilgan kontent qiziqishlaringizga moslanadi; o'chirilganda faqat umumiy kontent ko'rsatiladi."
  },
  personalized: {
    tr: "Kişiselleştirilmiş reklamlara izin ver",
    en: "Allow personalized ads",
    ru: "Разрешить персонализированную рекламу",
    uz: "Shaxsiylashtirilgan reklamalarga ruxsat berish"
  },
  save: {
    tr: "Kaydet",
    en: "Save",
    ru: "Сохранить",
    uz: "Saqlash"
  }
};

export function AdPrivacyModal({ visible, initialPreference, onClose, onSaved }: Props) {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [allowPersonalized, setAllowPersonalized] = useState(initialPreference === "personalized");

  function handleOpen() {
    setAllowPersonalized(initialPreference === "personalized");
  }

  async function handleSave() {
    const preference: AdPersonalizationPreference = allowPersonalized ? "personalized" : "non_personalized";
    await applyAdPrivacyPreference(preference);
    onSaved(preference);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} onShow={handleOpen}>
      <View style={styles.backdrop}>
        <View style={styles.panel}>
          <View style={styles.header}>
            <Text style={styles.title}>{copy.title[language]}</Text>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={22} color={colors.ivory} />
            </Pressable>
          </View>
          <Text style={styles.intro}>{copy.intro[language]}</Text>
          <Pressable onPress={() => setAllowPersonalized((value) => !value)} style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>{copy.personalized[language]}</Text>
            <View style={[styles.switchTrack, allowPersonalized && styles.switchTrackActive]}>
              <View style={[styles.switchKnob, allowPersonalized && styles.switchKnobActive]} />
            </View>
          </Pressable>
          <Pressable onPress={() => void handleSave()} style={styles.saveButton}>
            <Text style={styles.saveText}>{copy.save[language]}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "center", padding: 18 },
    panel: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 16, gap: 12 },
    header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
    title: { color: colors.ivory, fontSize: 18, fontWeight: "900", flex: 1 },
    closeButton: { width: 36, height: 36, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    intro: { color: colors.muted, fontSize: 13, lineHeight: 20, fontWeight: "700" },
    toggleRow: { minHeight: 46, borderRadius: 8, backgroundColor: colors.panelSoft, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, paddingHorizontal: 12 },
    toggleLabel: { color: colors.ivory, fontWeight: "800", flex: 1 },
    switchTrack: { width: 46, height: 26, borderRadius: 13, backgroundColor: "rgba(255,255,255,0.16)", borderWidth: 1, borderColor: colors.line, padding: 3, justifyContent: "center" },
    switchTrackActive: { backgroundColor: colors.gold, borderColor: colors.gold },
    switchKnob: { width: 18, height: 18, borderRadius: 9, backgroundColor: colors.ivory },
    switchKnobActive: { alignSelf: "flex-end", backgroundColor: colors.ink },
    saveButton: { minHeight: 44, borderRadius: 8, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
    saveText: { color: colors.ink, fontWeight: "900" }
  });
}
