export type NotificationAudience = "all" | "premium" | "artists" | "galleries" | "country";

export type NotificationTargetAccount = {
  uid?: string;
  role?: string;
  appRole?: string;
  country?: string;
  countryCode?: string;
  isPremium?: boolean;
  badges?: string[];
  systemBadges?: string[];
  adminBadges?: string[];
  staffBadges?: string[];
  isDisabled?: boolean;
};

export function notificationAudienceMatches(audience: string | undefined, account: NotificationTargetAccount) {
  if (!audience || audience === "all") return true;
  if (audience === "premium") {
    return Boolean(account.isPremium)
      || [account.badges, account.systemBadges, account.adminBadges, account.staffBadges].some((badges) => badges?.includes("premium"));
  }
  if (audience === "artists") {
    return [account.role, account.appRole, ...(account.badges ?? []), ...(account.adminBadges ?? []), ...(account.staffBadges ?? [])]
      .some((value) => value === "artist");
  }
  if (audience === "galleries") {
    return [account.role, account.appRole, ...(account.badges ?? []), ...(account.adminBadges ?? []), ...(account.staffBadges ?? [])]
      .some((value) => value === "verified_gallery" || value === "gallery" || value === "museum" || value === "curator");
  }
  return audience === "country";
}

export function notificationTargetsAccount(
  notification: Record<string, unknown>,
  account: NotificationTargetAccount,
  language: string
) {
  if (notification.isDeleted === true || notification.status !== "published" || account.isDisabled === true) return false;
  const targetUser = typeof notification.recipientId === "string"
    ? notification.recipientId
    : typeof notification.userId === "string" ? notification.userId : "";
  const targetRole = typeof notification.role === "string" ? notification.role : "";
  const targetCountry = typeof notification.country === "string" ? notification.country : "";
  const targetLanguage = typeof notification.language === "string" ? notification.language : "all";
  const metadata = notification.metadata && typeof notification.metadata === "object"
    ? notification.metadata as Record<string, unknown>
    : {};
  const audience = typeof metadata.audience === "string" ? metadata.audience : "all";
  const accountCountry = account.countryCode || account.country || "";
  const countryMatches = !targetCountry
    || targetCountry.trim().toLocaleLowerCase("tr") === accountCountry.trim().toLocaleLowerCase("tr");

  return (!targetUser || targetUser === "all" || targetUser === account.uid)
    && (!targetRole || targetRole === "all" || targetRole === account.role || targetRole === account.appRole)
    && countryMatches
    && (targetLanguage === "all" || targetLanguage === language)
    && notificationAudienceMatches(audience, account);
}
