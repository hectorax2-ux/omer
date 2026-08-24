import { useMemo } from "react";
import { StyleProp, StyleSheet, Text, TextStyle, View, ViewStyle } from "react-native";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useResolvedCountryCode } from "@/hooks/use-resolved-country-code";

export function CountryBadge({ code, compact = false }: { code: string; compact?: boolean }) {
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createBadgeStyles(colors, compact), [colors, compact]);
  return (
    <View style={styles.badge}>
      <Text style={styles.text}>{code}</Text>
    </View>
  );
}

export function UserNameWithCountry({
  name,
  countryCode,
  username,
  uid,
  nameStyle,
  style,
  numberOfLines = 1
}: {
  name: string;
  countryCode?: string | null;
  username?: string | null;
  uid?: string | null;
  nameStyle?: StyleProp<TextStyle>;
  style?: StyleProp<ViewStyle>;
  numberOfLines?: number;
}) {
  const resolvedCountryCode = useResolvedCountryCode({ countryCode, username, uid, name });
  return (
    <View style={[rowStyles.row, style]}>
      <Text style={[rowStyles.name, nameStyle]} numberOfLines={numberOfLines}>{name}</Text>
      {resolvedCountryCode ? <CountryBadge code={resolvedCountryCode} /> : null}
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexShrink: 1,
    minWidth: 0
  },
  name: {
    flexShrink: 1
  }
});

function createBadgeStyles(colors: ReturnType<typeof getThemeColors>, compact: boolean) {
  return StyleSheet.create({
    badge: {
      paddingHorizontal: compact ? 4 : 5,
      paddingVertical: compact ? 0 : 1,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: "rgba(217, 184, 101, 0.32)",
      backgroundColor: "rgba(217, 184, 101, 0.08)"
    },
    text: {
      color: colors.gold,
      fontSize: compact ? 8 : 9,
      fontWeight: "900",
      letterSpacing: 0.35
    }
  });
}
