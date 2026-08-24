import { useMemo } from "react";
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { premiumCopy } from "@/app/i18n/premium";
import { AppTheme, getThemeColors } from "@/constants/theme";
import { PremiumProductView } from "@/hooks/premium-product-types";
import { PremiumPlan } from "@/constants/premiumProducts";
import { Language } from "@/types/content";
import { t } from "@/utils/localized-text";

type Props = {
  products: PremiumProductView[];
  language: Language;
  theme: AppTheme;
  purchasingId: string | null;
  disabled?: boolean;
  disabledLabel?: string;
  currentPlan?: PremiumPlan | null;
  onSelect: (productId: PremiumProductView["id"]) => void;
};

export function PremiumPlanCards({ products, language, theme, purchasingId, disabled = false, disabledLabel, currentPlan, onSelect }: Props) {
  const colors = getThemeColors(theme);
  const { width } = useWindowDimensions();
  const compact = width < 390;
  const styles = useMemo(() => createStyles(colors, compact), [colors, compact]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>{t(premiumCopy.plansTitle, language)}</Text>
      <View style={styles.row}>
        {products.map((product) => {
          const featured = product.badge === "best";
          const popular = product.badge === "popular";
          const busy = purchasingId === product.id;
          const isCurrentPlan = currentPlan === product.plan;
          const cardDisabled = disabled || isCurrentPlan || Boolean(purchasingId);
          return (
            <View key={product.id} style={[styles.cardShell, featured && styles.cardShellFeatured]}>
              <LinearGradient
                colors={
                  featured
                    ? ["rgba(217,184,101,0.22)", "rgba(8,12,24,0.96)"]
                    : popular
                      ? ["rgba(217,184,101,0.12)", "rgba(8,12,24,0.94)"]
                      : ["rgba(18,22,34,0.96)", "rgba(6,8,14,0.98)"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[styles.card, featured && styles.cardFeatured]}
              >
                {product.badgeLabel ? (
                  <View style={[styles.badge, featured && styles.badgeFeatured, popular && styles.badgePopular]}>
                    <Text style={styles.badgeText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                      {product.badgeLabel}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.badgeSpacer} />
                )}
                <Text style={styles.duration} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
                  {t(product.duration, language)}
                </Text>
                <Text
                  style={styles.price}
                  numberOfLines={2}
                  adjustsFontSizeToFit
                  minimumFontScale={0.65}
                >
                  {product.priceLabel}
                </Text>
                <Text style={styles.planName} numberOfLines={2} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {t(product.name, language)}
                </Text>
                <Pressable
                  onPress={() => onSelect(product.id)}
                  disabled={cardDisabled}
                  style={[styles.selectButton, featured && styles.selectButtonFeatured, cardDisabled && styles.selectButtonDisabled]}
                >
                  <Text style={[styles.selectButtonText, featured && styles.selectButtonTextFeatured]} numberOfLines={1}>
                    {busy
                      ? t(premiumCopy.purchasing, language)
                      : isCurrentPlan
                        ? t(premiumCopy.currentPlan, language)
                      : cardDisabled && disabledLabel
                        ? disabledLabel
                        : t(premiumCopy.selectPlan, language)}
                  </Text>
                </Pressable>
              </LinearGradient>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function createStyles(colors: ReturnType<typeof getThemeColors>, compact: boolean) {
  return StyleSheet.create({
    wrap: { marginTop: 12, gap: 8 },
    sectionTitle: {
      color: colors.gold,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.1,
      textTransform: "uppercase"
    },
    row: {
      flexDirection: "row",
      alignItems: "stretch",
      gap: compact ? 6 : 8
    },
    cardShell: {
      flex: 1,
      minWidth: 0,
      borderRadius: 14,
      overflow: "hidden"
    },
    cardShellFeatured: {
      shadowColor: colors.gold,
      shadowOpacity: 0.22,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 4 },
      elevation: 4
    },
    card: {
      flex: 1,
      minHeight: compact ? 132 : 148,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: "rgba(217,184,101,0.22)",
      paddingHorizontal: compact ? 6 : 8,
      paddingVertical: compact ? 8 : 10,
      gap: compact ? 4 : 5,
      alignItems: "center"
    },
    cardFeatured: {
      borderColor: "rgba(217,184,101,0.52)"
    },
    badge: {
      alignSelf: "center",
      borderRadius: 999,
      paddingHorizontal: compact ? 5 : 6,
      paddingVertical: 2,
      backgroundColor: "rgba(217,184,101,0.14)",
      borderWidth: 1,
      borderColor: "rgba(217,184,101,0.28)",
      maxWidth: "100%"
    },
    badgeFeatured: {
      backgroundColor: "rgba(217,184,101,0.24)",
      borderColor: "rgba(217,184,101,0.5)"
    },
    badgePopular: {
      backgroundColor: "rgba(217,184,101,0.16)"
    },
    badgeSpacer: {
      height: compact ? 14 : 16
    },
    badgeText: {
      color: colors.gold,
      fontSize: compact ? 7 : 8,
      fontWeight: "900",
      letterSpacing: 0.4,
      textTransform: "uppercase",
      textAlign: "center"
    },
    duration: {
      color: colors.ivory,
      fontSize: compact ? 13 : 14,
      fontWeight: "900",
      textAlign: "center"
    },
    price: {
      color: colors.gold,
      fontSize: compact ? 14 : 16,
      fontWeight: "900",
      textAlign: "center",
      minHeight: compact ? 34 : 38,
      width: "100%"
    },
    planName: {
      color: colors.muted,
      fontSize: compact ? 9 : 10,
      fontWeight: "700",
      textAlign: "center",
      lineHeight: compact ? 12 : 13,
      minHeight: compact ? 24 : 26,
      width: "100%"
    },
    selectButton: {
      width: "100%",
      minHeight: compact ? 30 : 34,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "rgba(217,184,101,0.34)",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "rgba(217,184,101,0.08)",
      marginTop: "auto"
    },
    selectButtonFeatured: {
      backgroundColor: colors.gold,
      borderColor: colors.gold
    },
    selectButtonDisabled: {
      opacity: 0.55
    },
    selectButtonText: {
      color: colors.gold,
      fontWeight: "900",
      fontSize: compact ? 10 : 11
    },
    selectButtonTextFeatured: {
      color: colors.ink
    }
  });
}
