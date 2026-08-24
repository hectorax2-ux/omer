export function profileRouteParam(input: {
  username?: string | null;
  name?: string | null;
  displayName?: string | null;
  uid?: string | null;
}) {
  const uid = input.uid?.trim();
  if (uid) return uid;
  const username = input.username?.trim();
  if (username) return username;
  const displayName = input.displayName?.trim() || input.name?.trim();
  if (displayName) return displayName;
  return "";
}
