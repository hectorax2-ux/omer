/** Invalidates pending work even for logout → login to the same UID. */
export function createAuthSessionScope() {
  let generation = 0;
  let uid = "";
  return {
    begin(nextUid: string) {
      uid = nextUid;
      generation += 1;
    },
    capture(expectedUid: string) {
      const captured = generation;
      return () => Boolean(expectedUid) && uid === expectedUid && generation === captured;
    },
    invalidate() {
      generation += 1;
      uid = "";
    }
  };
}

/** The lock includes the native account picker, not just Firebase's final write. */
export function createAuthActionLock() {
  let running = false;
  return async function run<T>(action: () => Promise<T>): Promise<T | undefined> {
    if (running) return undefined;
    running = true;
    try {
      return await action();
    } finally {
      running = false;
    }
  };
}

/** The screen, not the login form that Auth unmounts, owns the route handoff. */
export function createAuthNavigationIntent() {
  let pending = false;
  let revision = 0;
  return {
    begin() { pending = true; return ++revision; },
    cancel(request = revision) { if (request === revision) pending = false; },
    consume(authenticated: boolean, focused: boolean) {
      if (!focused) pending = false;
      if (!pending || !authenticated) return false;
      pending = false;
      return true;
    }
  };
}

/** Never log provider responses: they can contain ID/access tokens or emails. */
export function authErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) return "unknown";
  const code = error.code;
  return typeof code === "string" && /^[a-zA-Z0-9_/-]{1,80}$/.test(code) ? code : "unknown";
}

export function profileNeedsCompletion(profile: {
  role?: string;
  profileOnboardingCompleted?: boolean;
  username?: string;
  displayName?: string;
  bio?: string;
  country?: string;
}) {
  if (profile.role === "admin" || profile.profileOnboardingCompleted === true) return false;
  if (profile.profileOnboardingCompleted === false) return true;
  const username = typeof profile.username === "string" ? profile.username.trim().toLocaleLowerCase("en") : "";
  const displayName = typeof profile.displayName === "string" ? profile.displayName.trim().toLocaleLowerCase("en") : "";
  const bio = typeof profile.bio === "string" ? profile.bio.trim() : "";
  const country = typeof profile.country === "string" ? profile.country.trim() : "";
  const generated = /^(?:user|hz)[a-z0-9]{6,}$/i.test(username)
    || (/^[a-z0-9]{8,12}$/i.test(username) && /\d/.test(username));
  return /^(google|apple) ile hızlı kayıt\.?$/i.test(bio)
    || (!bio && !country && (!displayName || displayName === username))
    || (generated && (!displayName || displayName === username));
}
