import { useEffect, useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppTheme, getThemeColors, isBrightTheme } from "@/constants/theme";
import { navigationLayout, v2Colors } from "@/constants/design";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { useMessageBadgeCount } from "@/components/messages-tab-icon";
import { beginPerformanceMarker, markPerformanceEvent } from "@/utils/performance";
import { beginNavigationPerformanceLock } from "@/hooks/use-runtime-performance-mode";
import { useGlobalSearchParams, usePathname } from "expo-router";
import { beginNavigationTransition, completeNavigationTransition, navigationLocationKey } from "@/utils/navigation-transition-store";

type IconName = keyof typeof Ionicons.glyphMap;

const visibleRoutes = new Set(["index", "gallery", "feed", "messages", "account"]);

const routeIcons: Record<string, IconName> = {
  index: "home",
  gallery: "easel",
  feed: "newspaper",
  messages: "mail",
  account: "person-circle"
};

export function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { theme } = useAppTheme();
  const { language } = useLanguage();
  const colors = getThemeColors(theme);
  const messageBadgeCount = useMessageBadgeCount();
  const styles = createStyles(theme, colors);
  const activeTone = "#ffffff";
  const [optimisticRouteKey, setOptimisticRouteKey] = useState<string | null>(null);
  const transitionRequest = useRef<number | null>(null);
  const pathname = usePathname();
  const params = useGlobalSearchParams<Record<string, string | string[]>>();

  const tabs = state.routes.filter((route) => visibleRoutes.has(route.name));
  const activeRouteKey = state.routes[state.index]?.key;

  useEffect(() => {
    if (optimisticRouteKey !== activeRouteKey) return;
    setOptimisticRouteKey(null);
    if (transitionRequest.current !== null) {
      completeNavigationTransition(transitionRequest.current);
      transitionRequest.current = null;
    }
  }, [activeRouteKey, optimisticRouteKey]);

  function showImmediateSelection(routeKey: string) {
    if (routeKey === activeRouteKey) {
      setOptimisticRouteKey(null);
      return;
    }
    setOptimisticRouteKey(routeKey);
  }

  const tabItems = tabs.map((route) => {
    const routeIndex = state.routes.findIndex((item) => item.key === route.key);
    const focused = state.index === routeIndex;
    const selected = optimisticRouteKey ? optimisticRouteKey === route.key : focused;
    const icon = routeIcons[route.name] ?? "ellipse";
    const label = descriptors[route.key].options.title ?? route.name;
    const compactLabel = shortLabel(String(label), route.name, language);

    function onPress() {
      beginPerformanceMarker("NAV_TAP", { route: route.name });
      markPerformanceEvent("NAV_TOUCH_RECEIVED", { route: route.name });
      const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
      if (event.defaultPrevented) {
        setOptimisticRouteKey(null);
        if (transitionRequest.current !== null) completeNavigationTransition(transitionRequest.current);
        transitionRequest.current = null;
        return;
      }
      if (focused) {
        if (transitionRequest.current !== null) completeNavigationTransition(transitionRequest.current);
        transitionRequest.current = null;
        return;
      }
      markPerformanceEvent("NAV_ACTION_DISPATCH", { route: route.name });
      try {
        navigation.navigate(route.name, route.params);
      } catch (error) {
        setOptimisticRouteKey(null);
        if (transitionRequest.current !== null) completeNavigationTransition(transitionRequest.current);
        transitionRequest.current = null;
        throw error;
      }
      markPerformanceEvent("NAV_ACTION_DISPATCHED", { route: route.name });
    }

    return (
      <Pressable accessibilityRole="tab" accessibilityLabel={compactLabel} accessibilityState={{ selected }} key={route.key} onPressIn={() => {
        if (focused) return;
        beginNavigationPerformanceLock();
        showImmediateSelection(route.key);
        transitionRequest.current = beginNavigationTransition(navigationLocationKey(pathname, params), compactLabel);
      }} onPress={onPress} style={styles.tab}>
        {selected ? <LinearGradient colors={[v2Colors.primary, v2Colors.violet]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.activePill} /> : null}
        <View style={styles.tabInner}>
          <View style={styles.iconWrap}>
            <Ionicons
              name={selected ? icon : (`${icon}-outline` as IconName)}
              size={21}
              color={selected ? activeTone : colors.muted}
            />
            {route.name === "messages" && messageBadgeCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{messageBadgeCount > 99 ? "99+" : String(messageBadgeCount)}</Text>
              </View>
            ) : null}
          </View>
          <Text style={[styles.label, selected && styles.activeLabel]} numberOfLines={1}>
            {compactLabel}
          </Text>
        </View>
      </Pressable>
    );
  });

  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, navigationLayout.minimumBottomInset) }]}>
      <View style={styles.pill}>{tabItems}</View>
    </View>
  );
}

function shortLabel(title: string, routeName: string, language: string) {
  const labels: Record<string, Record<string, string>> = {
    index: { tr: "Ana", ru: "Дом", uz: "Bosh", en: "Home" },
    gallery: { tr: "Eserler", ru: "Работы", uz: "Asarlar", en: "Art" },
    feed: { tr: "Keşfet", ru: "Лента", uz: "Kashf", en: "Feed" },
    messages: { tr: "Mesajlar", ru: "Сообщ.", uz: "Xabarlar", en: "Messages" },
    account: { tr: "Üyelik", ru: "Аккаунт", uz: "A'zolik", en: "Account" }
  };
  if (labels[routeName]?.[language]) return labels[routeName][language];
  if (title.length <= 10) return title;
  return title.slice(0, 9) + "…";
}

function createStyles(theme: AppTheme, colors: ReturnType<typeof getThemeColors>) {
  const isLight = isBrightTheme(theme);
  return StyleSheet.create({
    outer: {
      position: "absolute",
      left: 16,
      right: 16,
      bottom: 0,
      alignItems: "center"
    },
    pill: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      width: "100%",
      maxWidth: 420,
      minHeight: navigationLayout.floatingBarHeight,
      borderRadius: 999,
      overflow: "hidden",
      borderWidth: 1,
      borderColor: isLight ? "rgba(99,102,241,0.18)" : "rgba(255,255,255,0.10)",
      backgroundColor: isLight ? "rgba(248,250,252,0.86)" : colors.glass,
      paddingHorizontal: 6,
      paddingVertical: 6,
      shadowColor: "#000000",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: Platform.OS === "android" ? 0 : 0.18,
      shadowRadius: Platform.OS === "android" ? 0 : 6,
      elevation: Platform.OS === "android" ? 1 : 4
    },
    tab: {
      flex: 1,
      minHeight: 50,
      alignItems: "center",
      justifyContent: "center",
      position: "relative"
    },
    activePill: {
      ...StyleSheet.absoluteFillObject,
      margin: 2,
      borderRadius: 999,
      backgroundColor: v2Colors.primary
    },
    tabInner: {
      alignItems: "center",
      justifyContent: "center",
      gap: 2,
      zIndex: 1
    },
    iconWrap: {
      width: 28,
      height: 24,
      alignItems: "center",
      justifyContent: "center"
    },
    label: {
      color: colors.muted,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.2,
      maxWidth: 64,
      textAlign: "center"
    },
    activeLabel: { color: "#ffffff", fontWeight: "800" },
    badge: {
      position: "absolute",
      top: -5,
      right: -10,
      minWidth: 16,
      height: 16,
      borderRadius: 8,
      paddingHorizontal: 4,
      backgroundColor: v2Colors.magenta,
      alignItems: "center",
      justifyContent: "center"
    },
    badgeText: {
      color: "#ffffff",
      fontSize: 9,
      fontWeight: "800"
    }
  });
}
