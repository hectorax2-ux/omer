import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppTheme, getThemeColors } from "@/constants/theme";
import { radii, v2Colors } from "@/constants/design";
import { useReadingScale } from "@/providers/reading-preferences-provider";
import { PressableScale } from "@/components/ui/pressable-scale";
import { useLanguage } from "@/hooks/use-language";

const labelCopy = {
  tr: "Yazı boyutu",
  en: "Text size",
  ru: "Размер текста",
  uz: "Matn o'lchami"
};

// Reading font size control (A− / A+). Preference is held in ReadingPreferencesProvider
// for the app session; it is shared across all reading screens.
export function ReadingSizeControl({ theme }: { theme: AppTheme }) {
  const c = getThemeColors(theme);
  const { language } = useLanguage();
  const { increase, decrease, canIncrease, canDecrease, index, stepCount, reset } = useReadingScale();
  const styles = createStyles(c);

  return (
    <View style={styles.wrap}>
      <PressableScale onPress={reset} style={styles.labelWrap} hitSlop={6}>
        <Ionicons name="text" size={13} color={v2Colors.primary} />
        <Text style={styles.label} numberOfLines={1}>{labelCopy[language]}</Text>
      </PressableScale>
      <View style={styles.controls}>
        <PressableScale onPress={decrease} disabled={!canDecrease} style={[styles.button, !canDecrease && styles.buttonDisabled]} hitSlop={6}>
          <Text style={styles.buttonSmall}>A</Text>
          <Ionicons name="remove" size={12} color={v2Colors.primary} />
        </PressableScale>
        <View style={styles.dots}>
          {Array.from({ length: stepCount }, (_, dot) => (
            <View key={dot} style={[styles.dot, dot === index && styles.dotActive]} />
          ))}
        </View>
        <PressableScale onPress={increase} disabled={!canIncrease} style={[styles.button, !canIncrease && styles.buttonDisabled]} hitSlop={6}>
          <Text style={styles.buttonBig}>A</Text>
          <Ionicons name="add" size={12} color={v2Colors.primary} />
        </PressableScale>
      </View>
    </View>
  );
}

function createStyles(c: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    wrap: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 10,
      borderRadius: radii.pill,
      backgroundColor: v2Colors.surface1,
      borderWidth: 1,
      borderColor: v2Colors.border,
      paddingVertical: 6,
      paddingHorizontal: 8
    },
    labelWrap: { flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 6, flexShrink: 1, minWidth: 0 },
    label: { color: v2Colors.textSecondary, fontSize: 11.5, fontWeight: "700", letterSpacing: 0.2, flexShrink: 1 },
    controls: { flexDirection: "row", alignItems: "center", gap: 8 },
    button: {
      minWidth: 44,
      height: 32,
      borderRadius: radii.pill,
      backgroundColor: c.panel,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 1,
      paddingHorizontal: 8
    },
    buttonDisabled: { opacity: 0.4 },
    buttonSmall: { color: c.ivory, fontSize: 11, fontWeight: "800" },
    buttonBig: { color: c.ivory, fontSize: 16, fontWeight: "800" },
    dots: { flexDirection: "row", alignItems: "center", gap: 3 },
    dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "rgba(248,250,252,0.22)" },
    dotActive: { width: 12, backgroundColor: v2Colors.primary }
  });
}
