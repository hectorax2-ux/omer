import type { SuggestedUser } from "@/providers/social-provider";

export type UserIdentityRef = {
  uid?: string;
  ownerId?: string;
  authorId?: string;
  username?: string;
  authorUsername?: string;
  uploaderUsername?: string;
  ownerUsername?: string;
  displayName?: string;
  author?: string;
  authorDisplayName?: string;
  artistName?: string;
  ownerName?: string;
  name?: string;
};

export type SuspendedIdentityIndex = {
  uids: Set<string>;
  usernames: Set<string>;
  names: Set<string>;
};

export function normalizeSuspensionKey(value?: string) {
  return (value ?? "").trim().toLocaleLowerCase("tr");
}

export function buildSuspendedIdentityIndex(users: SuggestedUser[]): SuspendedIdentityIndex {
  const uids = new Set<string>();
  const usernames = new Set<string>();
  const names = new Set<string>();

  users.forEach((user) => {
    if (!user.isDisabled) return;
    if (user.uid) uids.add(user.uid);
    const username = normalizeSuspensionKey(user.username);
    if (username) usernames.add(username);
    const name = normalizeSuspensionKey(user.name);
    if (name) names.add(name);
  });

  return { uids, usernames, names };
}

export function isSuspendedIdentity(index: SuspendedIdentityIndex, identity: UserIdentityRef) {
  const uid = identity.uid ?? identity.ownerId ?? identity.authorId;
  if (uid && index.uids.has(uid)) return true;

  const usernameKeys = [
    identity.username,
    identity.authorUsername,
    identity.uploaderUsername,
    identity.ownerUsername
  ]
    .map(normalizeSuspensionKey)
    .filter(Boolean);
  if (usernameKeys.some((key) => index.usernames.has(key))) return true;

  const nameKeys = [
    identity.displayName,
    identity.author,
    identity.authorDisplayName,
    identity.artistName,
    identity.ownerName,
    identity.name
  ]
    .map(normalizeSuspensionKey)
    .filter(Boolean);
  if (nameKeys.some((key) => index.names.has(key))) return true;

  return false;
}
