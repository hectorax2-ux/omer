import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { aboutTopics } from "@/app/about";

type TopicId = keyof typeof aboutTopics;

export default function AboutDetailScreen() {
  const { topic } = useLocalSearchParams<{ topic: string }>();
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const c = getThemeColors(theme);
  const styles = useMemo(() => createStyles(c), [c]);
  const id = (topic && topic in aboutTopics ? topic : "vision") as TopicId;
  const item = aboutTopics[id];

  return (
    <AppChrome title={item.title[language]} eyebrow="Art Atlas" showBackButton>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name={item.icon} size={28} color={c.gold} />
        </View>
        <Text style={styles.title}>{item.title[language]}</Text>
        <Text style={styles.summary}>{item.summary[language]}</Text>
        <Text style={styles.body}>{item.body[language]}</Text>
      </View>
    </AppChrome>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    card: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 18 },
    iconWrap: { width: 52, height: 52, borderRadius: 8, backgroundColor: colors.panelSoft, alignItems: "center", justifyContent: "center", marginBottom: 14 },
    title: { color: colors.ivory, fontSize: 24, fontWeight: "900" },
    summary: { color: colors.gold, fontSize: 15, lineHeight: 22, fontWeight: "900", marginTop: 10 },
    body: { color: colors.ivory, fontSize: 15, lineHeight: 24, fontWeight: "700", marginTop: 16 }
  });
}
