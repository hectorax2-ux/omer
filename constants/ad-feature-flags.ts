export function areRewardedAdRequirementsEnabled() {
  return process.env.EXPO_PUBLIC_REWARDED_AD_REQUIREMENTS_ENABLED === "true";
}
