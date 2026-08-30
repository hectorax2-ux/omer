import type { SuggestedUser } from "@/src/services/firebase/profile-discovery-service";
import { resolveCountryCode, resolveCountryCodeFromUser } from "@/utils/country-utils";

export function rankProfileDiscoveryUsers(
  users: SuggestedUser[],
  options: { followingUids: string[]; countryId?: string; interests?: string[]; dayKey?: string }
) {
  const followingUids = new Set(options.followingUids);
  const interests = new Set((options.interests ?? []).map(normalize));
  const now = Date.now();
  const dayKey = options.dayKey ?? new Date(now).toISOString().slice(0, 10);
  const countryCode = resolveCountryCode(options.countryId);
  const userCountries = new Map(users.map((user) => [user, resolveCountryCodeFromUser(user)]));
  return [...users].sort((left, right) => {
    const score = (user: SuggestedUser) => {
      const completeness = Number(Boolean(user.image)) + Number(Boolean(user.bio)) + Number(Boolean(user.countryId || user.country));
      const activity = user.lastActiveMinutesAgo === undefined ? 0 : Math.max(0, 28 - user.lastActiveMinutesAgo / 180);
      const newMember = user.createdAtMs && now - user.createdAtMs < 30 * 86_400_000 ? 18 : 0;
      const sharedInterests = (user.interests ?? []).filter((item) => interests.has(normalize(item))).length;
      return (user.uid && !followingUids.has(user.uid) ? 38 : 0)
        + completeness * 7
        + activity
        + newMember
        + Math.max(0, 16 - Math.log2((user.followersCount ?? 0) + 1) * 3)
        + (countryCode && userCountries.get(user) ? userCountries.get(user) === countryCode ? 3 : 9 : 0)
        + sharedInterests * 6
        + dailyFairness(user.uid || user.username, dayKey);
    };
    return score(right) - score(left) || left.username.localeCompare(right.username, "tr");
  });
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("tr");
}

function dailyFairness(identity: string, dayKey: string) {
  return Array.from(`${dayKey}:${identity}`).reduce((hash, character) => ((hash << 5) - hash + character.charCodeAt(0)) | 0, 0) % 13;
}
