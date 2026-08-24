import { Language } from "@/types/content";
import { LocalizedCopy } from "@/utils/localized-text";

// Apple App Store Connect subscription Product IDs. Kept unchanged for the existing
// StoreKit integration.
export type PremiumProductId =
  | "com.artatlas.app.premium.monthly"
  | "com.artatlas.app.premium.quarterly"
  | "com.artatlas.app.premium.yearly";

export type GooglePremiumProductId = "art_atlas_premium";
export type PremiumStoreProductId = PremiumProductId | GooglePremiumProductId;

// Stable, store-agnostic plan keys. These are what we persist in Firebase
// (premiumPlan) so backend logic never depends on a raw store SKU.
export type PremiumPlan = "monthly" | "quarterly" | "yearly";

// Canonical subscription lifecycle states mirrored from Apple into Firebase.
export type PremiumSubscriptionStatus = "active" | "expired" | "cancelled";

export type PremiumPlanBadge = "best" | "popular" | null;

export type PremiumProductDefinition = {
  id: PremiumProductId;
  plan: PremiumPlan;
  badge: PremiumPlanBadge;
  name: LocalizedCopy;
  duration: LocalizedCopy;
  perk: LocalizedCopy;
};

export const PREMIUM_PRODUCT_IDS: PremiumProductId[] = [
  "com.artatlas.app.premium.monthly",
  "com.artatlas.app.premium.quarterly",
  "com.artatlas.app.premium.yearly"
];

export const GOOGLE_PREMIUM_PRODUCT_ID: GooglePremiumProductId = "art_atlas_premium";
export const GOOGLE_PREMIUM_BASE_PLANS: Record<PremiumPlan, PremiumPlan> = {
  monthly: "monthly",
  quarterly: "quarterly",
  yearly: "yearly"
};

// Store SKU -> plan key. Used on the client and mirrored on the server.
export const PREMIUM_PRODUCT_PLAN: Record<PremiumProductId, PremiumPlan> = {
  "com.artatlas.app.premium.monthly": "monthly",
  "com.artatlas.app.premium.quarterly": "quarterly",
  "com.artatlas.app.premium.yearly": "yearly"
};

// Plan key -> subscription length in months. Only used as a fallback expiry when
// Apple's verified expiresDate is unavailable; verified data always wins.
export const PREMIUM_PLAN_DURATION_MONTHS: Record<PremiumPlan, number> = {
  monthly: 1,
  quarterly: 3,
  yearly: 12
};

export const PREMIUM_PRODUCT_CATALOG: PremiumProductDefinition[] = [
  {
    id: "com.artatlas.app.premium.monthly",
    plan: "monthly",
    badge: null,
    name: {
      tr: "Aylık",
      en: "Monthly",
      ru: "Месяц",
      uz: "Oylik"
    },
    duration: {
      tr: "1 ay",
      en: "1 month",
      ru: "1 месяц",
      uz: "1 oy"
    },
    perk: {
      tr: "Esnek başlangıç",
      en: "Flexible start",
      ru: "Гибкий старт",
      uz: "Moslashuvchan boshlash"
    }
  },
  {
    id: "com.artatlas.app.premium.quarterly",
    plan: "quarterly",
    badge: "popular",
    name: {
      tr: "3 Aylık",
      en: "3 Months",
      ru: "3 месяца",
      uz: "3 oy"
    },
    duration: {
      tr: "3 ay",
      en: "3 months",
      ru: "3 месяца",
      uz: "3 oy"
    },
    perk: {
      tr: "Daha uzun keyif",
      en: "More time to enjoy",
      ru: "Больше времени",
      uz: "Ko'proq vaqt"
    }
  },
  {
    id: "com.artatlas.app.premium.yearly",
    plan: "yearly",
    badge: "best",
    name: {
      tr: "Yıllık",
      en: "Yearly",
      ru: "Год",
      uz: "Yillik"
    },
    duration: {
      tr: "12 ay",
      en: "12 months",
      ru: "12 месяцев",
      uz: "12 oy"
    },
    perk: {
      tr: "En avantajlı plan",
      en: "Best value plan",
      ru: "Самый выгодный план",
      uz: "Eng foydali reja"
    }
  }
];

export function isPremiumProductId(value: string): value is PremiumProductId {
  return PREMIUM_PRODUCT_IDS.includes(value as PremiumProductId);
}

export function isPremiumStoreProductId(value: string): value is PremiumStoreProductId {
  return isPremiumProductId(value) || value === GOOGLE_PREMIUM_PRODUCT_ID;
}

export function premiumPlanForProduct(productId: string, basePlanId?: string | null): PremiumPlan | null {
  if (isPremiumProductId(productId)) return PREMIUM_PRODUCT_PLAN[productId];
  if (productId !== GOOGLE_PREMIUM_PRODUCT_ID || !basePlanId) return null;
  return isPremiumPlan(basePlanId) ? basePlanId : null;
}

export function isPremiumPlan(value: unknown): value is PremiumPlan {
  return value === "monthly" || value === "quarterly" || value === "yearly";
}

export function isPremiumSubscriptionStatus(value: unknown): value is PremiumSubscriptionStatus {
  return value === "active" || value === "expired" || value === "cancelled";
}

export function premiumBadgeLabel(badge: PremiumPlanBadge, language: Language) {
  if (badge === "best") {
    return {
      tr: "En avantajlı",
      en: "Best value",
      ru: "Выгоднее всего",
      uz: "Eng foydali"
    }[language];
  }
  if (badge === "popular") {
    return {
      tr: "Popüler",
      en: "Popular",
      ru: "Популярное",
      uz: "Ommabop"
    }[language];
  }
  return "";
}
