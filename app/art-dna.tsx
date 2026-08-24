import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppChrome } from "@/components/app-chrome";
import { getThemeColors } from "@/constants/theme";
import { useArtSystems } from "@/hooks/use-art-systems";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { fieldLimits, getText } from "@/types/art-systems";

export default function ArtDnaScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { analyzeArtDna, artDnaResult } = useArtSystems();
  const [text, setText] = useState("");
  const [message, setMessage] = useState("");
  const result = artDnaResult;

  function submit() {
    const response = analyzeArtDna(text);
    setMessage(response.message);
  }

  return (
    <AppChrome title={language === "tr" ? "Sanat DNA'sı" : "Art DNA"} eyebrow="Art Atlas" showBackButton backToHome>
      <View style={styles.card}>
        <Ionicons name="finger-print" size={34} color={colors.gold} />
        <Text style={styles.title}>{language === "tr" ? "Kendini anlat" : "Describe yourself"}</Text>
        <Text style={styles.text}>{language === "tr" ? "AI yalnızca burada kullanılır; uzun metin üretmez, hazır sonuç havuzundan en uygun sonucu seçer." : "AI is used only here; it selects the best prepared result instead of generating a long text."}</Text>
        <TextInput value={text} onChangeText={(value) => setText(value.slice(0, fieldLimits.artDna.max))} multiline maxLength={fieldLimits.artDna.max} placeholder={`${fieldLimits.artDna.min}-${fieldLimits.artDna.max} karakter`} placeholderTextColor={colors.muted} style={styles.input} />
        <Text style={styles.counter}>{text.length} / {fieldLimits.artDna.max}</Text>
        <Pressable onPress={submit} style={styles.button}><Text style={styles.buttonText}>{language === "tr" ? "Analiz et" : "Analyze"}</Text></Pressable>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
      {result ? (
        <View style={styles.card}>
          <Text style={styles.title}>{language === "tr" ? "Sonucun" : "Your result"}</Text>
          {result.movements.map((item) => (
            <View key={getText(item.label, language)} style={styles.row}>
              <Text style={styles.rowLabel}>{getText(item.label, language)}</Text>
              <View style={styles.bar}><View style={[styles.fill, { width: `${item.percent}%` }]} /></View>
              <Text style={styles.percent}>{item.percent}%</Text>
            </View>
          ))}
          <Text style={styles.body}>{getText(result.paragraph, language)}</Text>
          <Text style={styles.mood}>{getText(result.mood, language)}</Text>
        </View>
      ) : null}
    </AppChrome>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    card: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 14, gap: 12, marginBottom: 12 },
    title: { color: colors.ivory, fontSize: 20, fontWeight: "900" },
    text: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: "800" },
    input: { minHeight: 140, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panelSoft, color: colors.ivory, padding: 12, textAlignVertical: "top", fontWeight: "800" },
    counter: { color: colors.muted, textAlign: "right", fontSize: 12, fontWeight: "800" },
    button: { minHeight: 46, borderRadius: 8, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
    buttonText: { color: colors.ink, fontWeight: "900" },
    message: { color: colors.gold, fontWeight: "900", textAlign: "center" },
    row: { gap: 6 },
    rowLabel: { color: colors.ivory, fontWeight: "900" },
    bar: { height: 8, borderRadius: 4, backgroundColor: colors.panelSoft, overflow: "hidden" },
    fill: { height: "100%", backgroundColor: colors.gold },
    percent: { color: colors.gold, fontWeight: "900" },
    body: { color: colors.ivory, fontSize: 15, lineHeight: 23, fontWeight: "800" },
    mood: { color: colors.gold, fontWeight: "900" }
  });
}
