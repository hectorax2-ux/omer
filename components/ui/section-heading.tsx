import { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { EqualHeightHeaderSlot } from "@/components/ui/equal-height-header-slot";
import { v2Colors } from "@/constants/design";
import { safeTextLayout } from "@/constants/text-layout";
import { AppTheme, getThemeColors } from "@/constants/theme";

type Props = {
  theme: AppTheme;
  title: string;
  caption?: string;
  action?: ReactNode;
  accent?: string;
  titleSlotLines?: number;
};

// Consistent section header: a gold accent tick + a strong title, replacing the
// old faint uppercase bronze labels. Gives every list a confident anchor.
export function SectionHeading({ theme, title, caption, action, accent, titleSlotLines }: Props) {
  const c = getThemeColors(theme);
  const accentColor = accent ?? v2Colors.primary;
  return (
    <View style={styles.row}>
      <View style={styles.textWrap}>
        <EqualHeightHeaderSlot lineHeight={27} lines={titleSlotLines ?? 1}>
          <View style={styles.titleRow}>
            <View style={[styles.tick, { backgroundColor: accentColor }]} />
            <Text style={[styles.title, { color: c.ivory }]} maxFontSizeMultiplier={1.25}>{title}</Text>
          </View>
        </EqualHeightHeaderSlot>
        {caption ? <Text style={[styles.caption, { color: c.muted }]} numberOfLines={1}>{caption}</Text> : null}
      </View>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 4,
    marginBottom: 14
  },
  textWrap: { flex: 1, minWidth: 0 },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 28 },
  tick: { width: 4, height: 21, borderRadius: 999 },
  title: { ...safeTextLayout, flex: 1, fontSize: 21, lineHeight: 27, fontWeight: "800", letterSpacing: -0.25 },
  caption: { ...safeTextLayout, fontSize: 12, fontWeight: "600", marginTop: 3, marginLeft: 13, letterSpacing: 0.2 },
  action: { flexShrink: 0 }
});
