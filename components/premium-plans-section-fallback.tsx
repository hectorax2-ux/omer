import { Text, TextStyle } from "react-native";
import { PremiumSubscriptionFooter } from "@/components/premium-subscription-footer";
import { usePremiumProductsFallback } from "@/hooks/use-premium-products-fallback";
import { premiumCopy } from "@/app/i18n/premium";
import { premiumPlatformCopy } from "@/constants/premium-platform";
import { AppTheme } from "@/constants/theme";
import { Language } from "@/types/content";
import { t } from "@/utils/localized-text";

type Props = {
  language: Language;
  theme: AppTheme;
  isPremium: boolean;
  statusTextStyle: TextStyle;
};

export function PremiumPlansSectionFallback({ language, theme, isPremium, statusTextStyle }: Props) {
  const { statusMessage } = usePremiumProductsFallback(language);

  return (
    <>
      <Text style={statusTextStyle}>
        {isPremium ? t(premiumCopy.activeMember, language) : t(premiumPlatformCopy.storeUnavailable, language)}
      </Text>
      {statusMessage ? <Text style={statusTextStyle}>{statusMessage}</Text> : null}
      <PremiumSubscriptionFooter language={language} theme={theme} />
    </>
  );
}
