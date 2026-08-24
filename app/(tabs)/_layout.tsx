import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { getThemeColors } from "@/constants/theme";
import { copy, uiCopy } from "@/data/content";
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

  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        lazy: true,
        freezeOnBlur: true,
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
          title: "Home",
          tabBarLabel: "Art",
          tabBarIcon: ({ color, focused }) => <TabIcon name="home" color={color} focused={focused} />
        }}
      />
      <Tabs.Screen
        name="gallery"
        listeners={({ navigation }) => ({ tabPress: () => navigation.isFocused() && emitScrollToTop("gallery") })}
        options={{
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
          title: copy.account[language],
          tabBarLabel: copy.account[language],
          tabBarIcon: ({ color, focused }) => <TabIcon name="person-circle" color={color} focused={focused} />
        }}
      />
    </Tabs>
  );
}
