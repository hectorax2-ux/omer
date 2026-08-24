import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { AppChrome } from "@/components/app-chrome";
import { getThemeColors } from "@/constants/theme";
import { copy, uiCopy } from "@/data/content";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useLanguage } from "@/hooks/use-language";
import { useAccount } from "@/hooks/use-account";
import { v2Colors } from "@/constants/design";

export function AuthRequired({ title }: { title?: string }) {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();

  return (
    <AppChrome title={title ?? copy.account[language]} eyebrow={{
      tr: "Üyelik gerekli",
      en: "Account required",
      ru: "Требуется аккаунт",
      uz: "A'zolik kerak"
    }[language]}>
      <View style={styles.panel}>
        <Ionicons name="lock-closed" size={42} color={v2Colors.primary} />
        <Text style={styles.title}>{{
          tr: "Üyelik girişi gerekli",
          en: "Member login required",
          ru: "Нужен вход в аккаунт",
          uz: "A'zo sifatida kirish kerak"
        }[language]}</Text>
        <Text style={styles.text}>
          {{
            tr: "Bu alanı kullanmak için giriş yapmalı ya da yeni üyelik oluşturmalısın.",
            en: "Log in or create an account to use this area.",
            ru: "Чтобы использовать этот раздел, войдите или создайте аккаунт.",
            uz: "Bu bo'limdan foydalanish uchun kiring yoki yangi hisob yarating."
          }[language]}
        </Text>
        <Pressable onPress={() => router.push("/(tabs)/account")} style={styles.button}>
          <Text style={styles.buttonText}>{uiCopy.loginRegister[language]}</Text>
        </Pressable>
      </View>
    </AppChrome>
  );
}

export function EmailVerificationRequired({ title }: { title?: string }) {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const { resendVerificationEmail } = useAccount();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function resend() {
    setSending(true);
    const result = await resendVerificationEmail();
    setMessage(result.message);
    setSending(false);
  }

  return (
    <AppChrome title={title ?? copy.account[language]} eyebrow={{
      tr: "E-posta doğrulaması",
      en: "Email verification",
      ru: "Подтверждение e-mail",
      uz: "E-pochta tasdig'i"
    }[language]}>
      <View style={styles.panel}>
        <Ionicons name="mail-unread" size={42} color={v2Colors.primary} />
        <Text style={styles.title}>{{
          tr: "E-posta doğrulaması gerekli",
          en: "Email verification required",
          ru: "Нужно подтвердить e-mail",
          uz: "E-pochtani tasdiqlash kerak"
        }[language]}</Text>
        <Text style={styles.text}>
          {{
            tr: "Bu özellik için gelen kutunuzdaki doğrulama bağlantısına tıklamanız gerekir.",
            en: "Use this feature after clicking the verification link in your inbox.",
            ru: "Эта функция откроется после перехода по ссылке подтверждения.",
            uz: "Bu funksiya pochta qutingizdagi tasdiqlash havolasidan keyin ochiladi."
          }[language]}
        </Text>
        <Pressable onPress={resend} disabled={sending} style={[styles.button, sending && { opacity: 0.7 }]}>
          <Text style={styles.buttonText}>{sending ? "Gönderiliyor" : language === "tr" ? "Doğrulama e-postasını tekrar gönder" : "Resend verification email"}</Text>
        </Pressable>
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </AppChrome>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
return StyleSheet.create({
  panel: {
    minHeight: 260,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: v2Colors.border,
    backgroundColor: v2Colors.surface1,
    alignItems: "center",
    justifyContent: "center",
    padding: 22
  },
  title: {
    color: colors.ivory,
    fontSize: 24,
    fontWeight: "900",
    textAlign: "center",
    marginTop: 12
  },
  text: {
    color: colors.muted,
    textAlign: "center",
    lineHeight: 21,
    marginTop: 8
  },
  button: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: v2Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    marginTop: 18
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "900"
  },
  message: {
    color: v2Colors.primary,
    textAlign: "center",
    fontWeight: "800",
    marginTop: 10,
    lineHeight: 19
  }
});
}
