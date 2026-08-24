import { useMemo } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { BlurView } from "expo-blur";
import { languages, copy } from "@/data/content";
import { AppTheme, getThemeColors, isBrightTheme } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { Language } from "@/types/content";

type Props = {
  expanded: boolean;
  onClose: () => void;
};

export function LanguageMenu({ expanded, onClose }: Props) {
  const { language, setLanguage } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors, theme), [colors, theme]);

  function choose(nextLanguage: Language) {
    setLanguage(nextLanguage);
    onClose();
  }

  if (!expanded) {
    return null;
  }

  return (
    <BlurView intensity={24} tint={isBrightTheme(theme) ? "light" : "dark"} style={styles.menu}>
      <Text style={styles.title}>{copy.chooseLanguage[language]}</Text>
      {languages.map((item) => (
        <Pressable
          key={item.code}
          onPress={() => choose(item.code)}
          style={[styles.option, item.code === language && styles.optionActive]}
        >
          <Text style={styles.optionCode}>{item.label}</Text>
          <Text style={styles.optionText}>{item.nativeName}</Text>
        </Pressable>
      ))}
    </BlurView>
  );
}

export function LanguageGate() {
  const { confirmLanguage, hasChosenLanguage, isLanguageReady } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors, theme), [colors, theme]);

  return (
    <Modal visible={!isLanguageReady || !hasChosenLanguage} transparent animationType="fade">
      <View style={styles.gateBackdrop}>
        <View style={styles.gatePanel}>
          <Text style={styles.brand}>Art Atlas</Text>
          {isLanguageReady ? <View style={styles.gateGrid}>
            {languages.map((item) => (
              <Pressable key={item.code} onPress={() => confirmLanguage(item.code)} style={styles.gateOption}>
                <Text style={styles.gateCode}>{item.label}</Text>
                <Text style={styles.gateName}>{item.nativeName}</Text>
              </Pressable>
            ))}
          </View> : null}
        </View>
      </View>
    </Modal>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>, theme: AppTheme) {
const isLight = isBrightTheme(theme);
return StyleSheet.create({
  menu: {
    position: "absolute",
    right: 18,
    top: 58,
    zIndex: 20,
    width: 184,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: "hidden",
    padding: 10
  },
  title: {
    color: colors.muted,
    fontSize: 12,
    marginBottom: 8,
    textTransform: "uppercase",
  },
  option: {
    minHeight: 44,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 10
  },
  optionActive: {
    backgroundColor: "rgba(212, 175, 55, 0.16)"
  },
  optionCode: {
    width: 32,
    color: colors.gold,
    fontWeight: "800"
  },
  optionText: {
    color: colors.ivory,
    flex: 1
  },
  gateBackdrop: {
    flex: 1,
    backgroundColor: isLight ? "rgba(246,241,232,0.94)" : theme === "vangogh" ? "rgba(9,22,40,0.94)" : theme === "dali" ? "rgba(23,17,11,0.94)" : "rgba(16, 16, 15, 0.94)",
    justifyContent: "center",
    padding: 22
  },
  gatePanel: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    padding: 22
  },
  brand: {
    color: colors.gold,
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: 0,
    textTransform: "uppercase",
    marginBottom: 18
  },
  gateGrid: {
    gap: 10
  },
  gateOption: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panelSoft,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 14
  },
  gateCode: {
    color: colors.gold,
    fontWeight: "900",
    fontSize: 17,
    width: 42
  },
  gateName: {
    color: colors.ivory,
    fontSize: 16,
    fontWeight: "700"
  }
});
}
