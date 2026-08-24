import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useMessaging } from "@/hooks/use-messaging";

type IconName = keyof typeof Ionicons.glyphMap;

export function useMessageBadgeCount() {
  const { unreadConversationCount, requestCount } = useMessaging();
  return unreadConversationCount + requestCount;
}

export function MessagesTabIcon({ name, color, focused }: { name: IconName; color: string; focused: boolean }) {
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const badgeCount = useMessageBadgeCount();
  const styles = createStyles(colors);

  return (
    <View style={styles.wrap}>
      <Ionicons name={focused ? name : (`${name}-outline` as IconName)} size={22} color={color} />
      {badgeCount > 0 ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badgeCount > 99 ? "99+" : String(badgeCount)}</Text>
        </View>
      ) : null}
    </View>
  );
}

export function MessageBadgeBubble({ colors }: { colors: ReturnType<typeof getThemeColors> }) {
  const badgeCount = useMessageBadgeCount();
  if (!badgeCount) return null;
  const styles = createStyles(colors);
  return (
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{badgeCount > 99 ? "99+" : String(badgeCount)}</Text>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    wrap: { width: 30, height: 24, alignItems: "center", justifyContent: "center" },
    badge: {
      position: "absolute",
      top: -4,
      right: -8,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 4,
      backgroundColor: colors.gold,
      alignItems: "center",
      justifyContent: "center"
    },
    badgeText: { color: "#15120d", fontSize: 10, fontWeight: "800" }
  });
}
