import { Account } from "@/providers/account-provider";
import { RestrictionType } from "@/types/backend";

export function canUseAdminTools(account: Account) {
  return account.isAdmin || account.staffBadges.includes("moderator") || account.staffBadges.includes("editor");
}

export function canManageRoles(account: Account) {
  return account.isAdmin;
}

export function canBypassAds(account: Account) {
  return account.isPremium || account.isAdmin || account.staffBadges.includes("moderator") || account.staffBadges.includes("editor");
}

export function canReportContent(account: Account) {
  return account.isPremium || account.isAdmin || account.role !== "art_lover" || account.staffBadges.length > 0;
}

export function restrictionLabel(type: RestrictionType, language: "tr" | "en" | "ru" | "uz") {
  const labels = {
    discover_post: { tr: "Keşfet paylaşım cezası", en: "Discover posting restriction", ru: "Ограничение публикаций", uz: "Post cheklovi" },
    image_upload: { tr: "Görsel yükleme cezası", en: "Image upload restriction", ru: "Ограничение загрузки", uz: "Rasm yuklash cheklovi" },
    contest_entry: { tr: "Yarışma katılım cezası", en: "Contest entry restriction", ru: "Ограничение конкурса", uz: "Tanlov cheklovi" },
    support_create: { tr: "Destek talebi cezası", en: "Support request restriction", ru: "Ограничение поддержки", uz: "Yordam cheklovi" }
  };

  return labels[type][language];
}

