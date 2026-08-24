import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppChrome } from "@/components/app-chrome";
import { PremiumPlansSection } from "@/components/premium-plans-section";
import { premiumBenefits, premiumCopy } from "@/app/i18n/premium";
import { premiumPlatformCopy } from "@/constants/premium-platform";
import { getThemeColors } from "@/constants/theme";
import { useAppTheme } from "@/hooks/use-app-theme";
import { useAccount } from "@/hooks/use-account";
import { useLanguage } from "@/hooks/use-language";
import { isStorePurchaseSupported } from "@/utils/iap-support";
import { t } from "@/utils/localized-text";

const copy = {
  title: { tr: "Art Atlas Premium", en: "Art Atlas Premium", ru: "Art Atlas Premium", uz: "Art Atlas Premium" }
};

export default function PremiumScreen() {
  const { language } = useLanguage();
  const { theme } = useAppTheme();
  const { account } = useAccount();
  const colors = getThemeColors(theme);
  const styles = useMemo(() => createStyles(colors), [colors]);
  const storeAvailable = isStorePurchaseSupported();

  return (
    <AppChrome title="Premium" eyebrow="Art Atlas" showBackButton backToHome showTopAd={false}>
      <View style={styles.hero}>
        <View style={styles.heroBadge}>
          <Ionicons name="diamond" size={22} color={colors.gold} />
        </View>
        <Text style={styles.title}>{copy.title[language]}</Text>
        {account.isPremium ? (
          <View style={styles.activeBadge}>
            <Text style={styles.activeBadgeText}>{t(premiumCopy.activeMember, language)}</Text>
          </View>
        ) : null}
        <Text style={styles.text}>{t(premiumPlatformCopy.intro, language)}</Text>
        {!storeAvailable ? <Text style={styles.note}>{t(premiumPlatformCopy.storeUnavailable, language)}</Text> : null}
      </View>

      <PremiumPlansSection
        language={language}
        theme={theme}
        isPremium={account.isPremium}
        statusTextStyle={styles.status}
      />

      <View style={styles.benefitsSection}>
        <Text style={styles.benefitsHeading}>{t(premiumCopy.benefitsHeading, language)}</Text>
        <View style={styles.benefitsList}>
          {premiumBenefits.map((item) => (
            <View key={item.id} style={styles.benefitCard}>
              <View style={styles.benefitIconWrap}>
                <Ionicons name={item.icon} size={16} color={colors.gold} />
              </View>
              <View style={styles.benefitContent}>
                <Text style={styles.benefitTitle}>{t(item.title, language)}</Text>
                <Text style={styles.benefitBody}>{t(item.body, language)}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </AppChrome>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    hero: {
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "rgba(217,184,101,0.28)",
      backgroundColor: colors.panel,
      padding: 14,
      gap: 8,
      alignItems: "center"
    },
    heroBadge: {
      width: 44,
      height: 44,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: "rgba(217,184,101,0.32)",
      backgroundColor: "rgba(217,184,101,0.1)",
      alignItems: "center",
      justifyContent: "center"
    },
    title: { color: colors.ivory, fontSize: 22, fontWeight: "900", textAlign: "center" },
    activeBadge: {
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
      backgroundColor: "rgba(217,184,101,0.14)",
      borderWidth: 1,
      borderColor: "rgba(217,184,101,0.34)"
    },
    activeBadgeText: { color: colors.gold, fontSize: 11, fontWeight: "900", textTransform: "uppercase" },
    text: { color: colors.muted, fontSize: 12, lineHeight: 18, fontWeight: "700", textAlign: "center" },
    note: { color: colors.gold, fontSize: 11, lineHeight: 16, fontWeight: "700", textAlign: "center" },
    status: {
      color: colors.gold,
      fontSize: 12,
      lineHeight: 18,
      fontWeight: "800",
      textAlign: "center",
      marginTop: 10
    },
    benefitsSection: { marginTop: 14, gap: 10 },
    benefitsHeading: {
      color: colors.ivory,
      fontSize: 15,
      fontWeight: "900",
      letterSpacing: 0.2
    },
    benefitsList: { gap: 8 },
    benefitCard: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.line,
      backgroundColor: colors.panelSoft,
      padding: 12,
      flexDirection: "row",
      gap: 11,
      alignItems: "flex-start"
    },
    benefitIconWrap: {
      width: 32,
      height: 32,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(217,184,101,0.22)",
      backgroundColor: "rgba(217,184,101,0.08)",
      alignItems: "center",
      justifyContent: "center",
      marginTop: 1
    },
    benefitContent: { flex: 1, gap: 4 },
    benefitTitle: {
      color: colors.ivory,
      fontSize: 13,
      lineHeight: 18,
      fontWeight: "900"
    },
    benefitBody: {
      color: colors.muted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700"
    }
  });
}
