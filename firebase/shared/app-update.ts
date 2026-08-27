export const APP_UPDATE_LANGUAGES = ["tr", "en", "ru", "uz"] as const;

export type AppUpdateLanguage = (typeof APP_UPDATE_LANGUAGES)[number];
export type AppUpdatePlatform = "ios" | "android";
export type AppUpdateType = "optional" | "required";
export type LocalizedUpdateText = Partial<Record<AppUpdateLanguage, string>>;

export type AppUpdateConfig = {
  enabled: boolean;
  version: string;
  build: number;
  updateType: AppUpdateType | null;
  storeUrl: string;
  title: LocalizedUpdateText;
  message: LocalizedUpdateText;
};

export function parseAppUpdateConfig(data: Record<string, unknown>): AppUpdateConfig {
  return {
    enabled: data.enabled === true,
    version: typeof data.version === "string" ? data.version.trim() : "",
    build: parseNativeBuild(data.build),
    updateType: data.updateType === "optional" || data.updateType === "required" ? data.updateType : null,
    storeUrl: typeof data.storeUrl === "string" ? data.storeUrl.trim() : "",
    title: localizedText(data.title),
    message: localizedText(data.message)
  };
}

export function parseNativeBuild(value: unknown) {
  if (typeof value === "number") return Number.isSafeInteger(value) && value > 0 ? value : 0;
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) return 0;
  const build = Number(value.trim());
  return Number.isSafeInteger(build) && build > 0 ? build : 0;
}

export function isPlatformStoreUrl(platform: AppUpdatePlatform, value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    if (platform === "ios") {
      return url.hostname === "apps.apple.com" && /\/id6792671640(?:[/?#]|$)/.test(url.pathname);
    }
    return url.hostname === "play.google.com"
      && url.pathname === "/store/apps/details"
      && url.searchParams.get("id") === "com.artatlas.app";
  } catch {
    return false;
  }
}

export function shouldPresentAppUpdate(config: AppUpdateConfig, platform: AppUpdatePlatform, installedBuild: number, remoteVerified: boolean) {
  if (!config.enabled || !config.updateType) return null;
  if (!Number.isSafeInteger(installedBuild) || installedBuild <= 0) return null;
  if (!Number.isSafeInteger(config.build) || config.build <= 0 || installedBuild >= config.build) return null;
  if (!isPlatformStoreUrl(platform, config.storeUrl)) return null;
  if (config.updateType === "required" && !remoteVerified) return null;
  return { required: config.updateType === "required" };
}

function localizedText(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    APP_UPDATE_LANGUAGES
      .map((language) => [language, typeof source[language] === "string" ? source[language].trim() : ""] as const)
      .filter((entry) => Boolean(entry[1]))
  ) as LocalizedUpdateText;
}
