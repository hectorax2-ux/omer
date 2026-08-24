import { useMemo } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppTheme, appThemes, getThemeColors, isBrightTheme } from "@/constants/theme";
import { uiCopy } from "@/data/content";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";

type Language = "tr" | "en" | "ru" | "uz";

export function getThemePickerLabel(theme: AppTheme, language: Language) {
  if (theme === "dark") return uiCopy.dark[language];
  if (theme === "light") return uiCopy.light[language];
  if (theme === "vangogh") return uiCopy.vanGogh[language];
  if (theme === "monet") return uiCopy.monet[language];
  if (theme === "dali") return uiCopy.dali[language];
  return uiCopy.picasso[language];
}

export function ThemePickerModal({
  visible,
  onClose,
  onThemeSelected,
  required = false
}: {
  visible: boolean;
  onClose: () => void;
  onThemeSelected?: (theme: AppTheme) => void;
  required?: boolean;
}) {
  const { language } = useLanguage();
  const { theme, setTheme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors, theme), [colors, theme]);

  function chooseTheme(nextTheme: AppTheme) {
    setTheme(nextTheme);
    onThemeSelected?.(nextTheme);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={required ? () => undefined : onClose}>
      <View style={styles.overlay}>
        {!required ? <Pressable style={StyleSheet.absoluteFill} onPress={onClose} /> : null}
        <View style={styles.panel}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>Art Atlas{required ? " · 1 / 2" : ""}</Text>
              <Text style={styles.title}>
                {language === "tr" ? "Tema seç" : language === "ru" ? "Выбор темы" : language === "uz" ? "Mavzuni tanlang" : "Choose theme"}
              </Text>
            </View>
            {!required ? (
              <Pressable onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={22} color={colors.ivory} />
              </Pressable>
            ) : null}
          </View>
          <Text style={styles.help}>
            {language === "tr"
              ? "Tema daha sonra Ayarlar bölümünden veya üst açılır menüden değiştirilebilir."
              : language === "ru"
                ? "Позже тему можно изменить в настройках или верхнем меню."
                : language === "uz"
                  ? "Keyin mavzuni Sozlamalar bo‘limidan yoki yuqori menyudan o‘zgartirish mumkin."
                  : "You can change the theme later from Settings or the top menu."}
          </Text>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.grid}>
            {appThemes.map((item) => {
              const itemColors = getThemeColors(item);
              const selected = theme === item;
              return (
                <Pressable key={item} onPress={() => chooseTheme(item)} style={[styles.card, selected && styles.cardActive]}>
                  <View style={styles.swatches}>
                    <View style={[styles.swatch, { backgroundColor: itemColors.ink }]} />
                    <View style={[styles.swatch, { backgroundColor: itemColors.panel }]} />
                    <View style={[styles.swatch, { backgroundColor: itemColors.gold }]} />
                  </View>
                  <Text style={styles.cardText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.78}>
                    {getThemePickerLabel(item, language)}
                  </Text>
                  {selected ? (
                    <View style={styles.selectedBadge}>
                      <Ionicons name="checkmark" size={13} color={colors.ink} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>, theme: AppTheme) {
  const bright = isBrightTheme(theme);
  return StyleSheet.create({
    overlay: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      padding: 18,
      backgroundColor: bright ? "rgba(35,28,18,0.28)" : "rgba(0,0,0,0.68)"
    },
    panel: {
      width: "100%",
      maxWidth: 460,
      maxHeight: "82%",
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panel,
      padding: 16
    },
    header: {
      flexDirection: "row",
      alignItems: "flex-start",
      justifyContent: "space-between",
      gap: 12
    },
    eyebrow: {
      color: colors.gold,
      fontSize: 11,
      fontWeight: "900",
      letterSpacing: 1,
      textTransform: "uppercase"
    },
    title: {
      color: colors.ivory,
      fontSize: 24,
      fontWeight: "900",
      marginTop: 4
    },
    closeButton: {
      width: 36,
      height: 36,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.line,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: colors.panelSoft
    },
    help: {
      color: colors.muted,
      fontSize: 12,
      fontWeight: "800",
      lineHeight: 18,
      marginTop: 10,
      marginBottom: 14
    },
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      justifyContent: "space-between",
      rowGap: 10,
      paddingBottom: 2
    },
    card: {
      width: "48.5%",
      minHeight: 74,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panelSoft,
      padding: 10,
      justifyContent: "space-between",
      overflow: "hidden"
    },
    cardActive: {
      borderColor: colors.gold,
      backgroundColor: bright ? "rgba(152,113,43,0.12)" : "rgba(210,184,121,0.12)"
    },
    swatches: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 10
    },
    swatch: {
      width: 18,
      height: 18,
      borderRadius: 9,
      borderWidth: 1,
      borderColor: colors.line,
      marginRight: -4
    },
    cardText: {
      color: colors.ivory,
      fontSize: 13,
      fontWeight: "900"
    },
    selectedBadge: {
      position: "absolute",
      right: 8,
      top: 8,
      width: 20,
      height: 20,
      borderRadius: 10,
      backgroundColor: colors.gold,
      alignItems: "center",
      justifyContent: "center"
    }
  });
}
