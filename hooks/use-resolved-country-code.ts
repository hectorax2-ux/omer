import { useEffect, useState } from "react";
import { useCountryLookup } from "@/providers/country-lookup-provider";
import { findUserByUsername } from "@/src/services/firebase/user-service";
import { invalidateCountryCache, readCachedCountryCode, writeCachedCountryCode } from "@/utils/country-cache";
import { normalizeCountryLookupKey, resolveCountryCode, resolveCountryCodeFromUser, resolveCountryId } from "@/utils/country-utils";

export { invalidateCountryCache };

type ResolveCountryInput = {
  countryCode?: string | null;
  username?: string | null;
  uid?: string | null;
  name?: string | null;
};

export function useResolvedCountryCode(input: ResolveCountryInput) {
  const { lookupCountryCode, upsertIdentity } = useCountryLookup();
  const fallbackCode = resolveCountryCode(input.countryCode ?? "");
  const lookupCode = lookupCountryCode([input.uid, input.username, input.name]);
  const usernameKey = input.username?.trim() ? normalizeCountryLookupKey(input.username) : "";
  const cachedCode = usernameKey ? readCachedCountryCode(usernameKey) : null;
  const identityKey = `${input.uid ?? ""}:${usernameKey}`;
  const readyCode = fallbackCode ?? lookupCode ?? cachedCode;
  const [resolved, setResolved] = useState<{ key: string; code: string } | null>(null);

  useEffect(() => {
    if (!usernameKey || readyCode) return;
    let active = true;
    findUserByUsername(usernameKey)
      .then((profile) => {
        if (!active || !profile || (input.uid && profile.uid !== input.uid)) return;
        const code = resolveCountryCodeFromUser({
          country: profile.country,
          countryId: resolveCountryId(profile.country),
          countryCode: profile.countryCode
        });
        if (!code) return;
        writeCachedCountryCode(usernameKey, code);
        upsertIdentity({
          uid: profile.uid,
          username: profile.username,
          name: profile.displayName,
          country: profile.country,
          countryId: resolveCountryId(profile.country),
          countryCode: code
        });
        setResolved({ key: identityKey, code });
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [identityKey, input.uid, readyCode, upsertIdentity, usernameKey]);

  return readyCode ?? (resolved?.key === identityKey ? resolved.code : null);
}
