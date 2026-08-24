import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors as darkColors } from "@/constants/theme";

type ThemeColors = typeof darkColors;

export function ArtworkGridCommentBadge({ count, colors }: { count: number; colors: ThemeColors }) {
  const styles = createStyles(colors);
  return (
    <View style={styles.badge}>
      <Ionicons name="chatbubble-outline" size={11} color={colors.gold} />
      <Text style={styles.count}>{count}</Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    badge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 3,
      flexShrink: 0
    },
    count: {
      color: colors.gold,
      fontSize: 10,
      fontWeight: "900",
      minWidth: 10,
      textAlign: "right"
    }
  });
}
