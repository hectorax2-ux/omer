import type { ComponentProps } from "react";
import { isStorePurchaseSupported } from "@/utils/iap-support";
import { PremiumPlansSectionFallback } from "@/components/premium-plans-section-fallback";

const PremiumPlansSectionStore = isStorePurchaseSupported()
  ? require("@/components/premium-plans-section-store").PremiumPlansSectionStore
  : null;

type Props = ComponentProps<typeof PremiumPlansSectionFallback>;

export function PremiumPlansSection(props: Props) {
  if (!PremiumPlansSectionStore) {
    return <PremiumPlansSectionFallback {...props} />;
  }
  return <PremiumPlansSectionStore {...props} />;
}
