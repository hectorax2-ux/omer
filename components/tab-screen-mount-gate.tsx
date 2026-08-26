import { ReactNode, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useIsFocused } from "@react-navigation/native";
import { getThemeColors } from "@/constants/theme";
import { v2Colors } from "@/constants/design";
import { safeTextLayout } from "@/constants/text-layout";
import { useAppTheme } from "@/hooks/use-app-theme";

export function TabScreenMountGate({ title, eyebrow = "ART ATLAS", children }: { title: string; eyebrow?: string; children: ReactNode }) {
  const focused = useIsFocused();
  const [contentMounted, setContentMounted] = useState(false);
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);

  useEffect(() => {
    if (!focused || contentMounted) return undefined;
    const frame = requestAnimationFrame(() => setContentMounted(true));
    return () => cancelAnimationFrame(frame);
  }, [contentMounted, focused]);

  if (contentMounted) return children;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.ink }]}>
      <View style={[styles.header, { borderBottomColor: colors.line, backgroundColor: colors.glass }]}>
        <View style={styles.titleBlock}>
          <Text style={[styles.eyebrow, { color: colors.bronze }]}>{eyebrow}</Text>
          <Text style={[styles.title, { color: colors.ivory }]} numberOfLines={2}>{title}</Text>
        </View>
        <View style={styles.headerActions}><View style={styles.headerButton} /><View style={styles.headerButton} /><View style={styles.headerButton} /></View>
      </View>
      <View style={styles.viewport}>
        <View style={[styles.controlShell, { backgroundColor: colors.panelSoft }]} />
        <View style={styles.row}>
          <View style={[styles.cardShell, { backgroundColor: colors.panel }]} />
          <View style={[styles.cardShell, { backgroundColor: colors.panel }]} />
          <View style={[styles.cardShell, { backgroundColor: colors.panel }]} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { minHeight: 62, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 18, paddingVertical: 8, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  titleBlock: { flex: 1, minWidth: 0 },
  eyebrow: { ...safeTextLayout, fontSize: 8.5, lineHeight: 11, fontWeight: "900", letterSpacing: 1.2 },
  title: { ...safeTextLayout, fontSize: 18, lineHeight: 22, fontWeight: "900", marginTop: 1 },
  headerActions: { flexDirection: "row", gap: 7 },
  headerButton: { width: 34, height: 34, borderRadius: 17, borderWidth: StyleSheet.hairlineWidth, borderColor: v2Colors.border, backgroundColor: v2Colors.surface1 },
  viewport: { paddingHorizontal: 18, paddingTop: 18, gap: 14 },
  controlShell: { height: 46, borderRadius: 18, opacity: 0.78 },
  row: { flexDirection: "row", gap: 8 },
  cardShell: { flex: 1, minHeight: 150, borderRadius: 18, opacity: 0.72 }
});
