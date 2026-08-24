import type { AdSettings } from "@/constants/ad-placements";

export type AdRouteKey =
  | "home"
  | "feed"
  | "gallery"
  | "events"
  | "stories"
  | "quiz"
  | "ranking"
  | "games"
  | "duels"
  | "chance-card"
  | "my-museum"
  | "leaderboards"
  | "support"
  | "messages"
  | "messages-conversation"
  | "profile"
  | "account"
  | "notifications"
  | "premium"
  | "settings"
  | "auth"
  | "artwork"
  | "recommendations"
  | "other";

const ROUTE_ALIASES: Record<string, AdRouteKey> = {
  "/": "home",
  "/index": "home",
  "/(tabs)": "home",
  "/(tabs)/index": "home",
  "/feed": "feed",
  "/(tabs)/feed": "feed",
  "/gallery": "gallery",
  "/(tabs)/gallery": "gallery",
  "/events": "events",
  "/(tabs)/events": "events",
  "/stories": "stories",
  "/quiz": "quiz",
  "/(tabs)/quiz": "quiz",
  "/ranking": "ranking",
  "/(tabs)/ranking": "ranking",
  "/games": "games",
  "/duels": "duels",
  "/chance-card": "chance-card",
  "/my-museum": "my-museum",
  "/leaderboards": "leaderboards",
  "/support": "support",
  "/messages": "messages",
  "/(tabs)/messages": "messages",
  "/profile": "profile",
  "/account": "account",
  "/(tabs)/account": "account",
  "/notifications": "notifications",
  "/premium": "premium",
  "/settings": "settings",
  "/recommendations": "recommendations",
  "/(tabs)/recommendations": "recommendations"
};

const CATEGORY_TOP_BANNER_ROUTES = new Set<AdRouteKey>([
  "feed",
  "gallery",
  "events",
  "stories",
  "quiz",
  "ranking",
  "games",
  "duels",
  "chance-card",
  "my-museum",
  "leaderboards",
  "support",
  "messages"
]);

const INTERSTITIAL_ROUTES = new Set<AdRouteKey>([
  "feed",
  "gallery",
  "events",
  "stories",
  "quiz",
  "games",
  "ranking",
  "duels",
  "chance-card",
  "leaderboards"
]);

const AD_FREE_UI_ROUTES = new Set<AdRouteKey>([
  "home",
  "profile",
  "account",
  "notifications",
  "premium",
  "settings",
  "auth",
  "messages-conversation"
]);

export function normalizeAdPathname(pathname: string) {
  const clean = pathname.split("?")[0]?.replace(/\/+$/, "") || "/";
  if (ROUTE_ALIASES[clean]) return clean;
  if (clean.startsWith("/profile/")) return "/profile";
  if (clean.startsWith("/messages/") && clean !== "/messages") return clean;
  if (clean.startsWith("/artwork/")) return clean;
  return clean;
}

export function resolveAdRouteKey(pathname: string): AdRouteKey {
  const normalized = normalizeAdPathname(pathname);
  if (ROUTE_ALIASES[normalized]) return ROUTE_ALIASES[normalized];
  if (normalized.startsWith("/profile/")) return "profile";
  if (normalized.startsWith("/messages/") && normalized !== "/messages") return "messages-conversation";
  if (normalized.startsWith("/artwork/")) return "artwork";
  return "other";
}

export function isCategoryTopBannerRoute(pathname: string) {
  return CATEGORY_TOP_BANNER_ROUTES.has(resolveAdRouteKey(pathname));
}

export function isInterstitialEligibleRoute(pathname: string) {
  return INTERSTITIAL_ROUTES.has(resolveAdRouteKey(pathname));
}

export function isAdFreeUiRoute(pathname: string) {
  const key = resolveAdRouteKey(pathname);
  if (AD_FREE_UI_ROUTES.has(key)) return true;
  if (key === "account" || key === "auth") return true;
  return false;
}

export function shouldShowFeedInlineAd(postIndex: number, settings: AdSettings) {
  const position = postIndex + 1;
  if (position < settings.feedInlineFirstIndex) return false;
  return (position - settings.feedInlineFirstIndex) % settings.feedInlineInterval === 0;
}
