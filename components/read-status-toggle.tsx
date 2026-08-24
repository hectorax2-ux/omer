import { useMemo } from "react";
import { Pressable, StyleSheet, Text, ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { Language } from "@/types/content";
import { v2Colors } from "@/constants/design";

const labels = {
  read: { tr: "Okundu", en: "Read", ru: "Прочитано", uz: "O'qildi" },
  unread: { tr: "Okunmadı", en: "Unread", ru: "Не прочитано", uz: "O'qilmadi" }
};

type Props = {
  language: Language;
  isRead: boolean;
  onPress: () => void;
  style?: ViewStyle;
};

export function ReadStatusToggle({ language, isRead, onPress, style }: Props) {
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected: isRead }}
      style={({ pressed }) => [
        styles.chip,
        isRead && styles.chipActive,
        pressed && styles.chipPressed,
        style
      ]}
    >
      <Ionicons
        name={isRead ? "checkmark-circle" : "radio-button-off"}
        size={14}
        color={isRead ? "#ffffff" : v2Colors.primary}
      />
      <Text style={[styles.text, isRead && styles.textActive]}>
        {isRead ? labels.read[language] : labels.unread[language]}
      </Text>
    </Pressable>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      minHeight: 32,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(99,102,241,0.28)",
      backgroundColor: v2Colors.surface1,
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    chipActive: {
      backgroundColor: v2Colors.primary,
      borderColor: v2Colors.primary
    },
    chipPressed: {
      opacity: 0.82
    },
    text: {
      color: v2Colors.primary,
      fontSize: 11,
      fontWeight: "900"
    },
    textActive: {
      color: "#ffffff"
    }
  });
}
