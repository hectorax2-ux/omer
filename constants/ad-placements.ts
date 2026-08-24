export type AdPlacementId =
  | "home_manual"
  | "category_top"
  | "category_footer"
  | "discover_inline"
  | "profile_banner"
  | "weekly_top"
  | "artwork_detail_bottom"
  | "artwork_detail_sheet"
  | "books_films"
  | "support"
  | "popup_interstitial"
  | "quiz_start"
  | "quiz_finish"
  | "admob_rewarded";

export type AdPlacementGroup = "banner" | "overlay" | "rewarded";

export type AdPlacementDefinition = {
  id: AdPlacementId;
  label: string;
  group: AdPlacementGroup;
  screen: string;
};

/** Aktif reklam alanları — admin panel ve uygulama aynı listeyi kullanır. */
export const ACTIVE_AD_PLACEMENTS: AdPlacementDefinition[] = [
  { id: "home_manual", label: "Ana sayfa banner", group: "banner", screen: "Ana sayfa (üst grid altı)" },
  { id: "category_top", label: "Sayfa üst banner", group: "banner", screen: "AppChrome üst şerit" },
  { id: "category_footer", label: "Sayfa alt banner", group: "banner", screen: "Sayfa altları" },
  { id: "discover_inline", label: "Keşfet satır arası", group: "banner", screen: "Feed — 7. gönderiden sonra, her 8 gönderide" },
  { id: "profile_banner", label: "Profil / hesap banner", group: "banner", screen: "Profil ve hesap sekmesi" },
  { id: "weekly_top", label: "Yarışma üst banner", group: "banner", screen: "Resim yarışması üst" },
  { id: "artwork_detail_bottom", label: "Eser detay alt banner", group: "banner", screen: "Eser detay sayfası alt" },
  { id: "books_films", label: "Kitap & film sayfası", group: "banner", screen: "Etkinlikler / öneriler" },
  { id: "support", label: "Destek sayfası", group: "banner", screen: "Destek" },
  { id: "popup_interstitial", label: "Sayfa geçiş pop-up", group: "overlay", screen: "8 sayfa geçişinde, oturumda en fazla 2" },
  { id: "quiz_start", label: "Quiz başlangıç", group: "overlay", screen: "Quiz başlatılınca" },
  { id: "quiz_finish", label: "Quiz bitiş", group: "overlay", screen: "Quiz bitince" },
  { id: "artwork_detail_sheet", label: "Eser detay alt sheet", group: "overlay", screen: "Eser açılınca alttan" },
  { id: "admob_rewarded", label: "Ödüllü reklam (boost)", group: "rewarded", screen: "Yarışma — yukarı taşıma" }
];

export const DEFAULT_AD_SETTINGS = {
  interstitialPageInterval: 8,
  interstitialCooldownSeconds: 180,
  interstitialInitialDelaySeconds: 120,
  interstitialMaxPerSession: 2,
  bottomSheetCooldownSeconds: 180,
  feedInlineInterval: 8,
  feedInlineFirstIndex: 7
} as const;

export type AdSettings = {
  interstitialPageInterval: number;
  interstitialCooldownSeconds: number;
  interstitialInitialDelaySeconds: number;
  interstitialMaxPerSession: number;
  bottomSheetCooldownSeconds: number;
  feedInlineInterval: number;
  feedInlineFirstIndex: number;
};

export type AdReason = "page" | "quiz-start" | "quiz-finish";

export function overlayPlacementForReason(reason: AdReason): AdPlacementId {
  if (reason === "quiz-start") return "quiz_start";
  if (reason === "quiz-finish") return "quiz_finish";
  return "popup_interstitial";
}

const LEGACY_PLACEMENT_MAP: Record<string, AdPlacementId> = {
  home: "home_manual",
  home_banner: "home_manual",
  feed: "discover_inline",
  profile: "profile_banner",
  weekly: "weekly_top",
  artworkDetail: "artwork_detail_bottom",
  gallery: "books_films",
  quiz: "quiz_start",
  menu: "category_top",
  admob_banner: "category_top",
  admob_interstitial: "popup_interstitial"
};

export function normalizeAdPlacement(placement: string): AdPlacementId | string {
  if (ACTIVE_AD_PLACEMENTS.some((item) => item.id === placement)) {
    return placement as AdPlacementId;
  }
  return LEGACY_PLACEMENT_MAP[placement] ?? placement;
}

export function isOverlayPlacement(placement: string) {
  const normalized = normalizeAdPlacement(placement);
  return ACTIVE_AD_PLACEMENTS.find((item) => item.id === normalized)?.group === "overlay";
}
