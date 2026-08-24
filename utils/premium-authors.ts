type PremiumLookupUser = {
  username: string;
  isPremium?: boolean;
};

export function buildActivePremiumUsernameSet(
  users: PremiumLookupUser[],
  currentUsername: string,
  currentIsPremium: boolean
) {
  const premiumUsernames = new Set<string>();
  if (currentIsPremium && currentUsername) {
    premiumUsernames.add(normalizeUsername(currentUsername));
  }
  users.forEach((user) => {
    if (user.isPremium && user.username) {
      premiumUsernames.add(normalizeUsername(user.username));
    }
  });
  return premiumUsernames;
}

export function isActivePremiumAuthor(username: string, premiumUsernames: Set<string>) {
  return premiumUsernames.has(normalizeUsername(username));
}

function normalizeUsername(username: string) {
  return username.replace(/^@+/, "").trim().toLocaleLowerCase("tr");
}
