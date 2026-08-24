import { Animated, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useRef } from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { PressableScale } from "@/components/ui/pressable-scale";
import { SectionHeading } from "@/components/ui/section-heading";
import { homeLayout, radii, v2Colors } from "@/constants/design";
import { safeTextLayout } from "@/constants/text-layout";
import { AppTheme, getThemeColors } from "@/constants/theme";
import { useLanguage } from "@/hooks/use-language";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import type { HomeArtworkItem } from "../types";
import { reasonText } from "../ui-copy";
import { HomeImage } from "./home-image";

export function ArtworkRail({ theme, title, items, actionLabel, curatorLabel, curator = false, onAction, onOpen }: {
  theme: AppTheme;
  title: string;
  items: HomeArtworkItem[];
  actionLabel?: string;
  curatorLabel?: string;
  curator?: boolean;
  onAction?: () => void;
  onOpen: (id: string) => void;
}) {
  const { language } = useLanguage();
  const { width } = useWindowDimensions();
  const colors = getThemeColors(theme);
  const columns = width >= homeLayout.tabletMinWidth ? 3 : 2;
  const screenPadding = width < 360 ? 32 : width >= homeLayout.tabletMinWidth ? 56 : 36;
  const availableWidth = Math.min(width, homeLayout.tabletContentMaxWidth) - screenPadding;
  const cardWidth = Math.floor((availableWidth - homeLayout.railGap * (columns - 1)) / columns);
  const styles = createStyles(colors, cardWidth);
  if (!items.length) return null;

  return (
    <View style={styles.section}>
      {curator ? (
        <View style={styles.curatorHeading}>
          <View style={styles.curatorTitleBlock}>
            <View style={styles.curatorSignal}><Ionicons name="sparkles" size={12} color="#FFE09A" /></View>
            <View style={styles.curatorTitleCopy}>
              <Text style={styles.curatorEyebrow} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.86}>{curatorLabel}</Text>
              <Text style={styles.curatorTitle} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.9}>{title}</Text>
            </View>
          </View>
          {actionLabel && onAction ? (
            <PressableScale onPress={onAction} style={styles.action} accessibilityLabel={actionLabel} scaleTo={0.97}>
              <Text style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.84}>{actionLabel}</Text>
              <Ionicons name="arrow-forward" size={15} color={v2Colors.blue} />
            </PressableScale>
          ) : null}
        </View>
      ) : (
        <SectionHeading
          theme={theme}
          title={title}
          accent={v2Colors.blue}
          action={actionLabel && onAction ? (
          <PressableScale onPress={onAction} style={styles.action} accessibilityLabel={actionLabel}>
            <Text style={styles.actionText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.84}>{actionLabel}</Text>
            <Ionicons name="arrow-forward" size={15} color={v2Colors.blue} />
          </PressableScale>
          ) : undefined}
        />
      )}
      <View style={styles.rail}>
        {items.slice(0, 4).map((item) => (
          <CuratorArtworkCard
            key={item.id}
            item={item}
            reason={reasonText(item.reason, language)}
            curator={curator}
            onOpen={onOpen}
            styles={styles}
          />
        ))}
      </View>
    </View>
  );
}

function CuratorArtworkCard({ item, reason, curator, onOpen, styles }: { item: HomeArtworkItem; reason: string; curator: boolean; onOpen: (id: string) => void; styles: ReturnType<typeof createStyles> }) {
  const press = useRef(new Animated.Value(0)).current;
  const reducedMotion = useReducedMotion();

  function animate(toValue: number) {
    if (reducedMotion) {
      press.setValue(toValue ? 0.35 : 0);
      return;
    }
    Animated.spring(press, { toValue, useNativeDriver: true, speed: 34, bounciness: 4 }).start();
  }

  return (
    <PressableScale
      onPress={() => onOpen(item.id)}
      onPressIn={() => animate(1)}
      onPressOut={() => animate(0)}
      wrapStyle={[styles.cardWrap, curator && styles.curatorCardWrap]}
      style={[styles.card, curator && styles.curatorCard]}
      scaleTo={0.985}
      dimTo={1}
      accessibilityLabel={`${item.title}, ${item.artist}`}
      accessibilityHint={reason}
    >
      <Animated.View style={[styles.imageMotion, { transform: [{ scale: press.interpolate({ inputRange: [0, 1], outputRange: [1, 1.025] }) }, { translateY: press.interpolate({ inputRange: [0, 1], outputRange: [0, 2] }) }] }]}>
        <HomeImage uri={item.image} style={styles.image} contentFit="cover" transition={220} />
      </Animated.View>
      <LinearGradient colors={["rgba(6,7,18,0.02)", "rgba(6,7,18,0.94)"]} style={styles.scrim} pointerEvents="none" />
      <View style={[styles.reasonPill, curator && styles.curatorTag]}>
        <Ionicons name="sparkles" size={10} color="#F3D28B" />
        <Text style={styles.reason} numberOfLines={1}>{reason}</Text>
      </View>
      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.88}>{item.title}</Text>
        <Text style={styles.meta} numberOfLines={1}>{[item.artist, item.year].filter(Boolean).join(" · ")}</Text>
      </View>
      {curator ? <View style={styles.innerFrame} pointerEvents="none" /> : null}
    </PressableScale>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>, cardWidth: number) {
  return StyleSheet.create({
    section: { marginTop: 24 },
    curatorHeading: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 12 },
    curatorTitleBlock: { flex: 1, minWidth: 0, flexDirection: "row", alignItems: "center", gap: 10 },
    curatorSignal: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: "rgba(246,196,83,0.44)", backgroundColor: "rgba(124,58,237,0.2)", alignItems: "center", justifyContent: "center" },
    curatorTitleCopy: { flex: 1, minWidth: 0 },
    curatorEyebrow: { ...safeTextLayout, color: "rgba(246,196,83,0.84)", fontSize: 9, lineHeight: 12, letterSpacing: 1.35, fontWeight: "900", textTransform: "uppercase" },
    curatorTitle: { ...safeTextLayout, color: v2Colors.text, fontSize: 20, lineHeight: 24, fontWeight: "900", marginTop: 1 },
    action: { minHeight: homeLayout.minimumTouchTarget, flexDirection: "row", alignItems: "center", gap: 5, paddingLeft: 10 },
    actionText: { ...safeTextLayout, color: v2Colors.blue, fontSize: 12.5, lineHeight: 16, fontWeight: "800" },
    rail: { flexDirection: "row", flexWrap: "wrap", gap: homeLayout.railGap },
    cardWrap: { width: cardWidth },
    curatorCardWrap: { shadowColor: "#5D46C8", shadowOpacity: 0.28, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 7 },
    card: { width: "100%", aspectRatio: 0.82, borderRadius: radii.lg, overflow: "hidden", backgroundColor: colors.panel },
    curatorCard: { borderWidth: 1, borderColor: "rgba(142,124,255,0.52)", backgroundColor: "#0D1020" },
    imageMotion: { ...StyleSheet.absoluteFillObject },
    image: { width: "100%", height: "100%", backgroundColor: colors.panelSoft },
    scrim: { ...StyleSheet.absoluteFillObject },
    reasonPill: { position: "absolute", left: 12, top: 12, maxWidth: "84%", minHeight: 27, borderRadius: radii.pill, paddingHorizontal: 9, flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(10,11,26,0.64)" },
    reason: { ...safeTextLayout, color: "rgba(255,248,233,0.88)", fontSize: 9.5, lineHeight: 13, fontWeight: "800" },
    curatorTag: { minHeight: 24, borderRadius: 9, borderWidth: 1, borderColor: "rgba(246,196,83,0.2)", backgroundColor: "rgba(14,12,34,0.74)" },
    body: { position: "absolute", left: 14, right: 14, bottom: 13 },
    title: { ...safeTextLayout, color: v2Colors.text, fontSize: 16, lineHeight: 20, fontWeight: "800" },
    meta: { ...safeTextLayout, color: v2Colors.textSecondary, fontSize: 11.5, lineHeight: 16, fontWeight: "600", marginTop: 3 },
    innerFrame: { ...StyleSheet.absoluteFillObject, borderRadius: radii.lg - 1, borderWidth: 1, borderColor: "rgba(255,255,255,0.08)" }
  });
}
