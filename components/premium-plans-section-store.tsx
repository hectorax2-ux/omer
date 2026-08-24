import { Pressable, StyleSheet, Text, TextStyle, View } from "react-native";
import { PremiumPlanCards } from "@/components/premium-plan-cards";
import { PremiumSubscriptionFooter } from "@/components/premium-subscription-footer";
import { usePremiumProductsIap } from "@/hooks/use-premium-products-iap";
import { premiumCopy } from "@/app/i18n/premium";
import { premiumPlatformCopy } from "@/constants/premium-platform";
import { AppTheme, getThemeColors } from "@/constants/theme";
import { Language } from "@/types/content";
import { t } from "@/utils/localized-text";

type Props = {
  language: Language;
  theme: AppTheme;
  isPremium: boolean;
  statusTextStyle: TextStyle;
};

export function PremiumPlansSectionStore({ language, theme, isPremium, statusTextStyle }: Props) {
  const {
    products,
    pricesReady,
    priceLoadFailed,
    purchaseReady,
    storeLoadFailed,
    retryLoadProducts,
    purchasingId,
    restoring,
    purchase,
    restore,
    statusMessage,
    currentPlan,
    canChangePlans
  } = usePremiumProductsIap(language);
  const styles = createStyles(getThemeColors(theme));

  return (
    <>
      {pricesReady ? (
        <PremiumPlanCards
          products={products}
          language={language}
          theme={theme}
          purchasingId={purchasingId}
          disabled={(!canChangePlans && isPremium) || !purchaseReady}
          disabledLabel={!purchaseReady ? t(premiumCopy.storePreparingButton, language) : undefined}
          currentPlan={currentPlan}
          onSelect={(productId) => { void purchase(productId); }}
        />
      ) : (
        <View style={styles.priceStateCard}>
          <Text style={styles.priceStateTitle}>
            {priceLoadFailed
              ? t(premiumCopy.subscriptionPricesUnavailable, language)
              : t(premiumCopy.subscriptionPricesLoading, language)}
          </Text>
          {priceLoadFailed ? (
            <Pressable style={styles.retryButton} onPress={retryLoadProducts}>
              <Text style={styles.retryButtonText}>{t(premiumCopy.retrySubscriptionPrices, language)}</Text>
            </Pressable>
          ) : null}
        </View>
      )}
      {pricesReady && !purchaseReady ? (
        <View style={styles.storeStateRow}>
          <Text style={styles.storeStateText}>
            {storeLoadFailed
              ? t(premiumPlatformCopy.storeProductUnavailable, language)
              : t(premiumCopy.storeConnecting, language)}
          </Text>
          {storeLoadFailed ? (
            <Pressable style={styles.compactRetryButton} onPress={retryLoadProducts}>
              <Text style={styles.retryButtonText}>{t(premiumCopy.retrySubscriptionPrices, language)}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {statusMessage ? <Text style={statusTextStyle}>{statusMessage}</Text> : null}
      <PremiumSubscriptionFooter
        language={language}
        theme={theme}
        showRestore
        showManage={canChangePlans}
        restoring={restoring}
        onRestore={() => { void restore(); }}
      />
    </>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>) {
  return StyleSheet.create({
    priceStateCard: {
      marginTop: 12,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: "rgba(217,184,101,0.24)",
      backgroundColor: "rgba(18,22,34,0.88)",
      paddingHorizontal: 16,
      paddingVertical: 18,
      gap: 12
    },
    priceStateTitle: {
      color: colors.ivory,
      fontSize: 14,
      fontWeight: "800",
      lineHeight: 20,
      textAlign: "center"
    },
    retryButton: {
      alignSelf: "center",
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "rgba(217,184,101,0.45)",
      backgroundColor: "rgba(217,184,101,0.12)",
      paddingHorizontal: 18,
      paddingVertical: 9
    },
    retryButtonText: {
      color: colors.gold,
      fontSize: 12,
      fontWeight: "900"
    },
    storeStateRow: {
      marginTop: 8,
      alignItems: "center",
      gap: 8
    },
    storeStateText: {
      color: colors.muted,
      fontSize: 11,
      fontWeight: "700",
      lineHeight: 16,
      textAlign: "center"
    },
    compactRetryButton: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: "rgba(217,184,101,0.38)",
      paddingHorizontal: 14,
      paddingVertical: 7
    }
  });
}
