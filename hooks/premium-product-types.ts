import { PremiumProductDefinition, PremiumStoreProductId } from "@/constants/premiumProducts";

export type PremiumProductView = PremiumProductDefinition & {
  storeProductId: PremiumStoreProductId;
  basePlanId?: string;
  offerToken?: string;
  storePrice: string;
  currency: string;
  priceLabel: string;
  badgeLabel: string;
};
