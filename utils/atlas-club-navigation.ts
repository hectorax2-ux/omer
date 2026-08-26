const shortcutAllowedRoutes = new Set([
  "/",
  "/artists",
  "/countries",
  "/duels",
  "/events",
  "/feed",
  "/gallery",
  "/games",
  "/journey",
  "/leaderboards",
  "/museum-find",
  "/museums",
  "/ranking",
  "/chance-card",
  "/recommendations",
  "/rewards",
  "/account",
  "/stories",
  "/weekly-winners"
]);

type ShortcutVisibilityOptions = {
  keyboardFocused?: boolean;
};

export function getAppShortcutVisibility(pathname: string, options: ShortcutVisibilityOptions = {}) {
  const normalizedPathname = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  const profileScreen = normalizedPathname.startsWith("/profile/");
  const allowed = !options.keyboardFocused && (shortcutAllowedRoutes.has(normalizedPathname) || profileScreen);
  return {
    showAtlasClub: allowed,
    showPremium: allowed
  };
}

export function shouldShowAtlasClub(pathname: string) {
  return getAppShortcutVisibility(pathname).showAtlasClub;
}
