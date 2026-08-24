import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { storeLegalTexts } from "@/constants/store-legal-platform";
import { AppTheme, getThemeColors, isBrightTheme } from "@/constants/theme";
import { ThemePickerModal, getThemePickerLabel } from "@/components/theme-picker-modal";
import { uiCopy } from "@/data/content";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { useLegal } from "@/hooks/use-legal";

export function LegalGate() {
  const { language, hasChosenLanguage } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors, theme), [colors, theme]);
  const { hasAcceptedLegal, isLegalReady, acceptLegal } = useLegal();
  const [checked, setChecked] = useState(false);
  const [themePickerOpen, setThemePickerOpen] = useState(false);

  return (
    <>
      <Modal visible={hasChosenLanguage && isLegalReady && !hasAcceptedLegal} transparent animationType="fade">
        <View style={styles.backdrop}>
          <View style={styles.panel}>
            <Text style={styles.brand}>Art Atlas</Text>
            <Text style={styles.title}>
              {language === "tr" ? "Kullanım ve gizlilik onayı" : language === "ru" ? "Согласие с условиями" : language === "uz" ? "Foydalanish roziligi" : "Terms and privacy consent"}
            </Text>
            <ScrollView style={styles.textBox} showsVerticalScrollIndicator={false}>
              <LegalBlock title={uiCopy.terms[language]} text={storeLegalTexts.terms[language]} />
              <LegalBlock title={uiCopy.privacy[language]} text={storeLegalTexts.privacy[language]} />
              <LegalBlock title={uiCopy.permissions[language]} text={storeLegalTexts.permissions[language]} />
              <View style={styles.themeBlock}>
                <Text style={styles.themeTitle}>
                  {{
                    tr: "Lütfen kullanmak istediğiniz temayı seçin.",
                    en: "Please choose the theme you want to use.",
                    ru: "Выберите тему, которую хотите использовать.",
                    uz: "Foydalanmoqchi bo‘lgan mavzuni tanlang."
                  }[language]}
                </Text>
                <Text style={styles.themeHelp}>
                  {{
                    tr: "Tema daha sonra Ayarlar bölümünden veya üst açılır menüden değiştirilebilir.",
                    en: "You can change the theme later from Settings or the top dropdown menu.",
                    ru: "Позже тему можно изменить в настройках или верхнем выпадающем меню.",
                    uz: "Keyin mavzuni Sozlamalar bo‘limidan yoki yuqoridagi ochiladigan menyudan o‘zgartirishingiz mumkin."
                  }[language]}
                </Text>
                <Pressable onPress={() => setThemePickerOpen(true)} style={styles.themeSelectButton}>
                  <Ionicons name="color-palette-outline" size={18} color={colors.gold} />
                  <Text style={styles.themeSelectText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.76}>
                    {getThemePickerLabel(theme, language)}
                  </Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.muted} />
                </Pressable>
              </View>
            </ScrollView>
            <Pressable onPress={() => setChecked((value) => !value)} style={styles.checkRow}>
              <Ionicons name={checked ? "checkbox" : "square-outline"} size={23} color={colors.gold} />
              <Text style={styles.checkText}>
                {{
                  tr: "Kullanım şartlarını, gizlilik politikasını ve izin açıklamalarını kabul ediyorum.",
                  en: "I accept the terms, privacy policy, and permission notices.",
                  ru: "Я принимаю условия, политику конфиденциальности и уведомления о разрешениях.",
                  uz: "Foydalanish shartlari, maxfiylik siyosati va ruxsat izohlarini qabul qilaman."
                }[language]}
              </Text>
            </Pressable>
            <Pressable onPress={acceptLegal} disabled={!checked} style={[styles.button, !checked && styles.buttonDisabled]}>
              <Text style={styles.buttonText}>{{
                tr: "Kabul et ve devam et",
                en: "Accept and continue",
                ru: "Принять и продолжить",
                uz: "Qabul qilish va davom etish"
              }[language]}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
      <ThemePickerModal visible={themePickerOpen} onClose={() => setThemePickerOpen(false)} />
    </>
  );
}

function LegalBlock({ title, text }: { title: string; text: string }) {
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors, theme), [colors, theme]);
  return (
    <View style={styles.block}>
      <Text style={styles.blockTitle}>{title}</Text>
      <Text style={styles.blockText}>{text}</Text>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>, theme: AppTheme) {
const isLight = isBrightTheme(theme);
return StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: isLight ? "rgba(246,241,232,0.88)" : theme === "vangogh" ? "rgba(9,22,40,0.88)" : theme === "dali" ? "rgba(23,17,11,0.88)" : "rgba(0,0,0,0.86)",
    justifyContent: "center",
    padding: 18
  },
  panel: {
    maxHeight: "88%",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(217,184,101,0.34)",
    backgroundColor: colors.panel,
    padding: 18
  },
  brand: {
    color: colors.gold,
    fontSize: 13,
    fontWeight: "900",
    textTransform: "uppercase"
  },
  title: {
    color: colors.ivory,
    fontSize: 23,
    fontWeight: "900",
    marginTop: 8,
    marginBottom: 12
  },
  textBox: {
    maxHeight: 360
  },
  block: {
    borderRadius: 8,
    backgroundColor: colors.panelSoft,
    padding: 12,
    marginBottom: 10
  },
  blockTitle: {
    color: colors.gold,
    fontWeight: "900",
    marginBottom: 5
  },
  blockText: {
    color: colors.ivory,
    lineHeight: 20,
    fontWeight: "700"
  },
  themeBlock: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(217,184,101,0.32)",
    backgroundColor: colors.panelSoft,
    padding: 12,
    marginBottom: 10
  },
  themeTitle: {
    color: colors.ivory,
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 5
  },
  themeHelp: {
    color: colors.muted,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "800",
    marginBottom: 10
  },
  themeSelectButton: {
    minHeight: 42,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    gap: 9
  },
  themeSelectText: {
    flex: 1,
    color: colors.ivory,
    fontWeight: "900"
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 9,
    marginTop: 12
  },
  checkText: {
    color: colors.ivory,
    flex: 1,
    lineHeight: 19,
    fontWeight: "800"
  },
  button: {
    minHeight: 46,
    borderRadius: 8,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 14
  },
  buttonDisabled: {
    opacity: 0.45
  },
  buttonText: {
    color: colors.ink,
    fontWeight: "900"
  }
});
}
