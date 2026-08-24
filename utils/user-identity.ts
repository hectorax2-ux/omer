export type AccountIdentity = {
  uid?: string | null;
  username: string;
  displayName?: string;
};

export function normalizeIdentityKey(value: string) {
  return value.trim().toLocaleLowerCase("tr");
}

export function matchesUsername(value: string | undefined, username: string, legacyUsernames: string[] = []) {
  if (!value) return false;
  const key = normalizeIdentityKey(value);
  if (key === normalizeIdentityKey(username)) return true;
  return legacyUsernames.some((legacy) => normalizeIdentityKey(legacy) === key);
}

export function isSameAccountUser(
  user: { uid?: string | null; username?: string | null },
  account: AccountIdentity
) {
  if (account.uid && user.uid && account.uid === user.uid) return true;
  if (account.username && user.username && normalizeIdentityKey(user.username) === normalizeIdentityKey(account.username)) {
    return true;
  }
  return false;
}

export function dedupeSuggestedUsers(users: { uid?: string; username?: string }[]) {
  const seenUids = new Set<string>();
  const seenUsernames = new Set<string>();
  return users.filter((user) => {
    const uid = user.uid?.trim();
    const username = user.username?.trim();
    if (uid) {
      const normalizedUid = normalizeIdentityKey(uid);
      if (seenUids.has(normalizedUid)) return false;
      seenUids.add(normalizedUid);
    }
    if (username) {
      const normalizedUsername = normalizeIdentityKey(username);
      if (seenUsernames.has(normalizedUsername)) return false;
      seenUsernames.add(normalizedUsername);
    }
    return Boolean(uid || username);
  });
}

export function isAuthoredByPost(
  post: { authorId?: string; username: string },
  account: AccountIdentity,
  legacyUsernames: string[] = []
) {
  if (account.uid && post.authorId && post.authorId === account.uid) return true;
  if (post.authorId && matchesUsername(post.authorId, account.username, legacyUsernames)) return true;
  return matchesUsername(post.username, account.username, legacyUsernames);
}

export function isOwnedArtwork(
  item: { ownerId?: string; uploaderUsername?: string; artistName?: string },
  account: AccountIdentity,
  legacyUsernames: string[] = []
) {
  if (account.uid && item.ownerId && item.ownerId === account.uid) return true;
  if (item.ownerId && matchesUsername(item.ownerId, account.username, legacyUsernames)) return true;
  if (item.uploaderUsername && matchesUsername(item.uploaderUsername, account.username, legacyUsernames)) return true;
  if (account.displayName && item.artistName && normalizeIdentityKey(item.artistName) === normalizeIdentityKey(account.displayName)) {
    return true;
  }
  return matchesUsername(item.artistName, account.username, legacyUsernames);
}

export function belongsToProfilePost(
  post: { authorId?: string; username: string },
  profile: { uid?: string; username: string },
  legacyUsernames: string[] = []
) {
  if (profile.uid && post.authorId && post.authorId === profile.uid) return true;
  if (post.authorId && matchesUsername(post.authorId, profile.username, legacyUsernames)) return true;
  return matchesUsername(post.username, profile.username, legacyUsernames);
}

export function belongsToProfileArtwork(
  item: { ownerId?: string; uploaderUsername?: string; artistName?: string },
  profile: { uid?: string; username: string; displayName?: string },
  legacyUsernames: string[] = []
) {
  if (profile.uid && item.ownerId && item.ownerId === profile.uid) return true;
  if (item.ownerId && matchesUsername(item.ownerId, profile.username, legacyUsernames)) return true;
  if (item.uploaderUsername && matchesUsername(item.uploaderUsername, profile.username, legacyUsernames)) return true;
  if (profile.displayName && item.artistName && normalizeIdentityKey(item.artistName) === normalizeIdentityKey(profile.displayName)) {
    return true;
  }
  return matchesUsername(item.artistName, profile.username, legacyUsernames);
}

export function isProfileVisibleArtwork(item: {
  profileVisible?: boolean;
  approved?: boolean;
  deleted?: boolean;
  deletedByUser?: boolean;
}) {
  if (item.deletedByUser || item.deleted) return false;
  return item.profileVisible ?? item.approved ?? false;
}

export function isActiveCompetitionArtwork(
  item: {
    source?: "competition" | "profile";
    competitionWeekArchived?: boolean;
    weekId?: string;
  },
  activeWeekId: string
) {
  if ((item.source ?? "competition") !== "competition") return false;
  if (item.competitionWeekArchived) return false;
  if (item.weekId && item.weekId !== activeWeekId) return false;
  return true;
}

export function canDeleteArtworkFromProfile(
  item: {
    source?: "competition" | "profile";
    competitionWeekArchived?: boolean;
    weekId?: string;
  },
  activeWeekId: string
) {
  return !isActiveCompetitionArtwork(item, activeWeekId);
}

export function isOwnedMuseum(
  museum: { id?: string; ownerId?: string; ownerUsername: string },
  account: AccountIdentity,
  legacyUsernames: string[] = []
) {
  if (account.uid && museum.ownerId) return museum.ownerId === account.uid;
  if (account.uid && museum.id && museum.id === account.uid) return true;
  return matchesUsername(museum.ownerUsername, account.username, legacyUsernames);
}

export function belongsToProfileMuseum(
  museum: { id?: string; ownerId?: string; ownerUsername: string },
  profile: { uid?: string; username: string },
  legacyUsernames: string[] = []
) {
  if (profile.uid && museum.ownerId) return museum.ownerId === profile.uid;
  if (profile.uid && museum.id && museum.id === profile.uid) return true;
  return matchesUsername(museum.ownerUsername, profile.username, legacyUsernames);
}

export function isOwnedTimeCapsule(
  capsule: { ownerId?: string; ownerUsername: string },
  account: AccountIdentity,
  legacyUsernames: string[] = []
) {
  if (account.uid && capsule.ownerId) return capsule.ownerId === account.uid;
  return matchesUsername(capsule.ownerUsername, account.username, legacyUsernames);
}
