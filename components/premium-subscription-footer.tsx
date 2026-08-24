import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { premiumCopy } from "@/app/i18n/premium";
import { premiumPlatformCopy } from "@/constants/premium-platform";
import { GOOGLE_PREMIUM_PRODUCT_ID } from "@/constants/premiumProducts";
import { legalUrls } from "@/constants/store-legal";
import { AppTheme, getThemeColors } from "@/constants/theme";
import { Language } from "@/types/content";
import { t } from "@/utils/localized-text";

type Props = {
  language: Language;
  theme: AppTheme;
  showRestore?: boolean;
  restoring?: boolean;
  onRestore?: () => void;
  showManage?: boolean;
};

export function PremiumSubscriptionFooter({ language, theme, showRestore = false, restoring = false, onRestore, showManage = false }: Props) {
  const colors = getThemeColors(theme);
  const styles = createStyles(colors);
  const router = useRouter();

  return (
    <View style={styles.wrap}>
      <Text style={styles.disclosure}>{t(premiumPlatformCopy.autoRenewDisclosure, language)}</Text>
      <View style={styles.linksRow}>
        <Pressable onPress={() => router.push("/terms-of-use")}>
          <Text style={styles.link}>{t(premiumCopy.termsLink, language)}</Text>
        </Pressable>
        {premiumPlatformCopy.eulaLink ? (
          <>
            <Text style={styles.separator}>·</Text>
            <Pressable onPress={() => Linking.openURL(legalUrls.eula).catch(() => undefined)}>
              <Text style={styles.link}>{t(premiumPlatformCopy.eulaLink, language)}</Text>
            </Pressable>
          </>
        ) : null}
        <Text style={styles.separator}>·</Text>
        <Pressable onPress={() => router.push("/privacy-policy")}>
          <Text style={styles.link}>{t(premiumCopy.privacyLink, language)}</Text>
        </Pressable>
      </View>
      {showRestore && onRestore ? (
        <Pressable onPress={onRestore} disabled={restoring} style={styles.restoreButton}>
          <Text style={styles.restoreText}>
            {restoring ? t(premiumCopy.restoringPurchases, language) : t(premiumCopy.restorePurchases, language)}
          </Text>
        </Pressable>
      ) : null}
      {showManage ? (
        <Pressable
          onPress={() => Linking.openURL(`https://play.google.com/store/account/subscriptions?sku=${GOOGLE_PREMIUM_PRODUCT_ID}&package=com.artatlas.app`).catch(() => undefined)}
          style={styles.restoreButton}
        >
          <Text style={styles.restoreText}>{t(premiumCopy.manageSubscription, language)}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    wrap: {
      marginTop: 12,
      gap: 8,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: "rgba(217,184,101,0.16)"
    },
    disclosure: {
      color: colors.muted,
      fontSize: 10,
      lineHeight: 15,
      fontWeight: "600",
      textAlign: "center"
    },
    linksRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      flexWrap: "wrap",
      gap: 6
    },
    link: {
      color: colors.gold,
      fontSize: 11,
      fontWeight: "800",
      textDecorationLine: "underline"
    },
    separator: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "700"
    },
    restoreButton: {
      alignSelf: "center",
      paddingHorizontal: 10,
      paddingVertical: 6
    },
    restoreText: {
      color: colors.ivory,
      fontSize: 11,
      fontWeight: "800",
      textDecorationLine: "underline"
    }
  });
}
