import { useMemo, useState } from "react";
import { Pressable, Share, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { AppChrome } from "@/components/app-chrome";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { APP_INVITE_URL } from "@/constants/app-links";

const inviteCopy = {
  tr: { screen: "Arkadaşını davet et", title: "Sanatı birlikte keşfedin", share: "Davet bağlantısını paylaş", copy: "İndirme bağlantısını kopyala", copied: "İndirme bağlantısı kopyalandı.", message: "Art Atlas'ı indir, sanatı birlikte keşfedelim:" },
  en: { screen: "Invite a friend", title: "Discover art together", share: "Share invitation link", copy: "Copy download link", copied: "Download link copied.", message: "Download Art Atlas and let's discover art together:" },
  ru: { screen: "Пригласить друга", title: "Открывайте искусство вместе", share: "Поделиться приглашением", copy: "Копировать ссылку для скачивания", copied: "Ссылка для скачивания скопирована.", message: "Скачайте Art Atlas — давайте открывать искусство вместе:" },
  uz: { screen: "Do'stingizni taklif qiling", title: "San'atni birga kashf eting", share: "Taklif havolasini ulashish", copy: "Yuklab olish havolasini nusxalash", copied: "Yuklab olish havolasi nusxalandi.", message: "Art Atlas'ni yuklab oling va san'atni birga kashf etaylik:" }
};

export default function InviteScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [message, setMessage] = useState("");

  async function shareInvite() {
    const result = await Share.share({
      title: inviteCopy[language].screen,
      message: `${inviteCopy[language].message}\n${APP_INVITE_URL}`,
      url: APP_INVITE_URL
    }).catch(() => null);
    if (result) return;
    await copyInvite();
  }

  async function copyInvite() {
    await Clipboard.setStringAsync(APP_INVITE_URL);
    setMessage(inviteCopy[language].copied);
  }

  return (
    <AppChrome title={inviteCopy[language].screen} eyebrow="Art Atlas" showBackButton backToHome>
      <View style={styles.card}>
        <Ionicons name="share-social" size={42} color={colors.gold} />
        <Text style={styles.title}>{inviteCopy[language].title}</Text>
        <Pressable onPress={() => void copyInvite()} hitSlop={8}><Text style={styles.text}>{APP_INVITE_URL}</Text></Pressable>
        <Pressable onPress={() => void shareInvite()} style={styles.button}>
          <Ionicons name="paper-plane-outline" size={17} color={colors.ink} />
          <Text style={styles.buttonText}>{inviteCopy[language].share}</Text>
        </Pressable>
        <Pressable onPress={() => void copyInvite()} style={styles.copyButton}><Ionicons name="copy-outline" size={16} color={colors.gold} /><Text style={styles.copyText}>{inviteCopy[language].copy}</Text></Pressable>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </AppChrome>
  );
}
function createStyles(colors: ReturnType<typeof getThemeColors>) {
return StyleSheet.create({
  card: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, alignItems: "center", gap: 12, padding: 24 },
  title: { color: colors.ivory, fontSize: 22, fontWeight: "900", textAlign: "center" },
  text: { color: colors.gold, fontWeight: "900", textAlign: "center" },
  button: { minHeight: 46, borderRadius: 8, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", alignSelf: "stretch", flexDirection: "row", gap: 7 },
  buttonText: { color: colors.ink, fontWeight: "900" },
  copyButton: { minHeight: 40, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  copyText: { color: colors.gold, fontWeight: "900" },
  message: { color: colors.ivory, fontSize: 12, fontWeight: "800" }
});
}
