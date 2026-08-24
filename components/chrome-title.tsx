import { useEffect, useRef, useState } from "react";
import { Animated, StyleProp, StyleSheet, Text, TextStyle, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { AppTheme, getThemeColors } from "@/constants/theme";
import { hexAlpha } from "@/constants/design";

type Props = {
  title: string;
  theme: AppTheme;
  fontSize: number;
  compact?: boolean;
  maxWidth?: number;
};

export function ChromeTitle({ title, theme, fontSize, compact = false, maxWidth }: Props) {
  const colors = getThemeColors(theme);
  const styles = createStyles(colors, fontSize, compact);
  const museumText = compact ? styles.pageTitleCompact : styles.pageTitle;
  const wrapStyle = maxWidth ? { maxWidth } : undefined;

  if (title === "Art Atlas") {
    return <BrandWordmark styles={styles} museumText={museumText} colors={colors} wrapStyle={wrapStyle} />;
  }

  const layout = resolveTitleLines(title);

  if (layout.singleWord) {
    return (
      <View style={[styles.pageWrap, wrapStyle]}>
        <Text
          style={museumText}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.52}
          ellipsizeMode="clip"
        >
          {layout.lines[0]}
        </Text>
        <PageOrnament colors={colors} styles={styles} />
      </View>
    );
  }

  if (layout.twoWordWrap) {
    return (
      <View style={[styles.pageWrap, wrapStyle]}>
        <Text
          style={museumText}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.58}
          ellipsizeMode="clip"
        >
          {layout.lines[0]}
        </Text>
        <PageOrnament colors={colors} styles={styles} />
      </View>
    );
  }

  return (
    <View style={[styles.pageWrap, wrapStyle]}>
      {layout.lines.map((line, index) => (
        <Text
          key={`${index}-${line}`}
          style={[museumText, index > 0 ? styles.pageTitleSecondLine : null]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.58}
          ellipsizeMode="clip"
        >
          {line}
        </Text>
      ))}
      <PageOrnament colors={colors} styles={styles} />
    </View>
  );
}

// The wordmark carries the app's identity, so it gets a living, gilded treatment: a
// slow light glint sweeps across the letters (like sun catching gold leaf on a museum
// plaque), a faceted diamond breathes between the words, and a classical filet-and-
// lozenge rule anchors it. All native-driver animation, no layout thrash.
function BrandWordmark({
  styles,
  museumText,
  colors,
  wrapStyle
}: {
  styles: ReturnType<typeof createStyles>;
  museumText: StyleProp<TextStyle>;
  colors: ReturnType<typeof getThemeColors>;
  wrapStyle?: { maxWidth: number };
}) {
  const shimmer = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const [glyphWidth, setGlyphWidth] = useState(0);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(1500),
        Animated.timing(shimmer, { toValue: 1, duration: 1250, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [shimmer]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 1500, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0, duration: 1500, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const diamondStyle = {
    transform: [
      { rotate: "45deg" },
      { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.3] }) }
    ],
    opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] })
  };

  const shimmerTransform = {
    transform: [
      { translateX: shimmer.interpolate({ inputRange: [0, 1], outputRange: [-70, glyphWidth + 40] }) },
      { rotate: "18deg" }
    ]
  };

  return (
    <View style={[styles.brandWrap, wrapStyle]}>
      <View style={styles.brandGlyphs} onLayout={(event) => setGlyphWidth(Math.round(event.nativeEvent.layout.width))}>
        <View style={styles.brandRow}>
          <Text style={[museumText, styles.brandArt]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58}>
            {formatTitleLine("Art")}
          </Text>
          <Animated.View style={[styles.brandDiamond, diamondStyle]} />
          <Text style={[museumText, styles.brandAtlas]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.58}>
            {formatTitleLine("Atlas")}
          </Text>
        </View>
        {glyphWidth > 0 ? (
          <Animated.View pointerEvents="none" style={[styles.shimmer, shimmerTransform]}>
            <LinearGradient
              colors={["transparent", hexAlpha("#ffffff", 0.5), hexAlpha(colors.gold, 0.35), "transparent"]}
              locations={[0, 0.5, 0.62, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
          </Animated.View>
        ) : null}
      </View>
      <View style={styles.ornamentRow}>
        <LinearGradient colors={["transparent", colors.gold]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ornamentFiletLeft} />
        <View style={[styles.ornamentLozenge, { backgroundColor: colors.gold }]} />
        <LinearGradient colors={[colors.gold, "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.ornamentFiletRight} />
      </View>
    </View>
  );
}

function PageOrnament({ colors, styles }: { colors: ReturnType<typeof getThemeColors>; styles: ReturnType<typeof createStyles> }) {
  return (
    <View style={styles.pageOrnamentRow}>
      <View style={[styles.pageLozenge, { backgroundColor: colors.gold }]} />
      <LinearGradient colors={[colors.gold, "transparent"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.pageFilet} />
    </View>
  );
}

function resolveTitleLines(title: string) {
  const trimmed = title.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length <= 1) {
    return { singleWord: true, twoWordWrap: false, lines: [formatTitleLine(trimmed)] };
  }
  if (words.length === 2) {
    return { singleWord: false, twoWordWrap: true, lines: [formatTitleLine(words.join(" "))] };
  }
  const mid = Math.ceil(words.length / 2);
  return {
    singleWord: false,
    twoWordWrap: false,
    lines: [formatTitleLine(words.slice(0, mid).join(" ")), formatTitleLine(words.slice(mid).join(" "))]
  };
}

function formatTitleLine(value: string) {
  return value.toLocaleUpperCase("tr");
}

function createStyles(colors: ReturnType<typeof getThemeColors>, fontSize: number, compact: boolean) {
  const titleSize = compact ? Math.min(fontSize, 14) : fontSize;
  const museumBase = {
    color: colors.ivory,
    fontWeight: "800" as const,
    letterSpacing: compact ? 0.4 : 0.7,
    flexShrink: 1
  };

  return StyleSheet.create({
    brandWrap: { minWidth: 0, flexShrink: 1, overflow: "hidden" },
    brandGlyphs: { alignSelf: "flex-start", position: "relative", overflow: "hidden" },
    brandRow: { flexDirection: "row", alignItems: "center", gap: 7, minWidth: 0 },
    brandArt: {
      ...museumBase,
      fontSize: titleSize,
      lineHeight: titleSize * 1.14
    },
    brandAtlas: {
      ...museumBase,
      color: colors.gold,
      fontWeight: "900",
      fontSize: titleSize,
      lineHeight: titleSize * 1.14,
      textShadowColor: hexAlpha(colors.gold, 0.45),
      textShadowOffset: { width: 0, height: 0 },
      textShadowRadius: 12
    },
    brandDiamond: {
      width: 7,
      height: 7,
      borderRadius: 1.5,
      backgroundColor: colors.gold
    },
    shimmer: {
      position: "absolute",
      top: -8,
      bottom: -8,
      width: 34
    },
    ornamentRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 5,
      gap: 4
    },
    ornamentFiletLeft: { width: 20, height: 2, borderRadius: 1 },
    ornamentFiletRight: { width: 40, height: 2, borderRadius: 1 },
    ornamentLozenge: {
      width: 5,
      height: 5,
      borderRadius: 1,
      transform: [{ rotate: "45deg" }]
    },
    pageWrap: { minWidth: 0, flexShrink: 1, overflow: "hidden" },
    pageTitle: {
      ...museumBase,
      fontSize: titleSize,
      lineHeight: titleSize * 1.22
    },
    pageTitleCompact: {
      ...museumBase,
      fontSize: titleSize,
      lineHeight: titleSize * 1.18
    },
    pageTitleSecondLine: {
      marginTop: 1
    },
    pageOrnamentRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 4,
      gap: 4
    },
    pageLozenge: {
      width: 4.5,
      height: 4.5,
      borderRadius: 1,
      transform: [{ rotate: "45deg" }],
      opacity: 0.9
    },
    pageFilet: { width: 26, height: 1.5, borderRadius: 1, opacity: 0.85 }
  });
}
