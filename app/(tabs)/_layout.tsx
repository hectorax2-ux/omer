import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getThemeColors } from "@/constants/theme";
import { navigationLayout } from "@/constants/design";
import { copy, uiCopy } from "@/data/content";
import { NavigationTransition } from "@/components/navigation-transition";
import { FloatingTabBar } from "@/components/floating-tab-bar";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { emitScrollToTop } from "@/utils/scroll-to-top";
import { MessagesTabIcon } from "@/components/messages-tab-icon";

type IconName = keyof typeof Ionicons.glyphMap;

function TabIcon({ name, color, focused }: { name: IconName; color: string; focused: boolean }) {
  return <Ionicons name={focused ? name : (`${name}-outline` as IconName)} size={22} color={color} />;
}

export default function TabsLayout() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const insets = useSafeAreaInsets();
  const transitionTokenRef = useRef(0);
  const readyFrameRef = useRef<number | null>(null);
  const [pendingTransition, setPendingTransition] = useState<{ token: number; routeKey: string; label: string } | null>(null);

  const startTransition = useCallback((routeKey: string, label: string) => {
    transitionTokenRef.current += 1;
    if (readyFrameRef.current !== null) cancelAnimationFrame(readyFrameRef.current);
    readyFrameRef.current = null;
    setPendingTransition({ token: transitionTokenRef.current, routeKey, label });
  }, []);

  const finishTransition = useCallback((routeKey: string) => {
    const token = transitionTokenRef.current;
    if (readyFrameRef.current !== null) cancelAnimationFrame(readyFrameRef.current);
    readyFrameRef.current = requestAnimationFrame(() => {
      readyFrameRef.current = null;
      setPendingTransition((current) => current?.token === token && current.routeKey === routeKey ? null : current);
    });
  }, []);

  const cancelTransition = useCallback((routeKey: string) => {
    setPendingTransition((current) => current?.routeKey === routeKey ? null : current);
  }, []);

  useEffect(() => {
    if (!pendingTransition) return undefined;
    const timeout = setTimeout(() => {
      setPendingTransition((current) => current?.token === pendingTransition.token ? null : current);
    }, 4000);
    return () => clearTimeout(timeout);
  }, [pendingTransition]);

  useEffect(() => () => {
    if (readyFrameRef.current !== null) cancelAnimationFrame(readyFrameRef.current);
  }, []);

  return (
    <View style={styles.root}>
      <Tabs
        tabBar={(props) => (
          <FloatingTabBar
            {...props}
            onTransitionStart={startTransition}
            onTransitionReady={finishTransition}
            onTransitionCancel={cancelTransition}
          />
        )}
        screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
        animation: "none",
        tabBarActiveTintColor: colors.ivory,
        tabBarInactiveTintColor: colors.muted,
        tabBarShowLabel: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: "transparent",
          borderTopWidth: 0,
          elevation: 0,
          height: 0
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "800"
        }
        }}
      >
      <Tabs.Screen
        name="index"
        listeners={({ navigation }) => ({ tabPress: () => navigation.isFocused() && emitScrollToTop("index") })}
        options={{
          lazy: false,
          title: "Home",
          tabBarLabel: "Art",
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />
        }}
      />
      <Tabs.Screen
        name="gallery"
        listeners={({ navigation }) => ({ tabPress: () => navigation.isFocused() && emitScrollToTop("gallery") })}
        options={{
          lazy: false,
          title: copy.gallery[language],
          tabBarLabel: copy.gallery[language],
          tabBarIcon: ({ color, focused }) => <TabIcon name="easel" color={color} focused={focused} />
        }}
      />
      <Tabs.Screen
        name="quiz"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="feed"
        listeners={({ navigation }) => ({ tabPress: () => navigation.isFocused() && emitScrollToTop("feed") })}
        options={{
          lazy: false,
          title: uiCopy.feedDiscover[language],
          tabBarLabel: uiCopy.feedDiscover[language],
          tabBarIcon: ({ color, focused }) => <TabIcon name="newspaper" color={color} focused={focused} />
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          href: null,
          title: copy.events[language],
          tabBarLabel: copy.events[language],
          tabBarIcon: ({ color, focused }) => <TabIcon name="calendar" color={color} focused={focused} />
        }}
      />
      <Tabs.Screen
        name="ranking"
        options={{
          href: null,
          title: copy.communityArt[language],
          tabBarLabel: copy.communityArt[language],
          tabBarIcon: ({ color, focused }) => <TabIcon name="color-palette" color={color} focused={focused} />
        }}
      />
      <Tabs.Screen
        name="messages"
        listeners={({ navigation }) => ({ tabPress: () => navigation.isFocused() && emitScrollToTop("messages") })}
        options={{
          lazy: false,
          title: language === "tr" ? "Mesajlar" : language === "ru" ? "Сообщения" : language === "uz" ? "Xabarlar" : "Messages",
          tabBarLabel: language === "tr" ? "Mesajlar" : "Messages",
          tabBarIcon: ({ color, focused }) => <MessagesTabIcon name="mail" color={color} focused={focused} />
        }}
      />
      <Tabs.Screen
        name="recommendations"
        options={{
          href: null,
          title: copy.recommendations[language],
          tabBarLabel: copy.recommendations[language],
          tabBarIcon: ({ color, focused }) => <TabIcon name="bookmarks" color={color} focused={focused} />
        }}
      />
      <Tabs.Screen
        name="account"
        listeners={({ navigation }) => ({ tabPress: () => navigation.isFocused() && emitScrollToTop("account") })}
        options={{
          lazy: false,
          title: copy.account[language],
          tabBarLabel: copy.account[language],
          tabBarIcon: ({ color, focused }) => <TabIcon name="person-circle" color={color} focused={focused} />
        }}
      />
      </Tabs>
      <NavigationTransition
        visible={Boolean(pendingTransition)}
        label={pendingTransition?.label}
        bottomInset={navigationLayout.floatingBarHeight + Math.max(insets.bottom, navigationLayout.minimumBottomInset)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 }
});
