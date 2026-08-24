import { useEffect, useState } from "react";
import { useCountryLookup } from "@/providers/country-lookup-provider";
import { findUserByUsername } from "@/src/services/firebase/user-service";
import { invalidateCountryCache, readCachedCountryCode, writeCachedCountryCode } from "@/utils/country-cache";
import { normalizeCountryLookupKey, resolveCountryCodeFromUser, resolveCountryId } from "@/utils/country-utils";

export { invalidateCountryCache };

type ResolveCountryInput = {
  countryCode?: string | null;
  username?: string | null;
  uid?: string | null;
  name?: string | null;
};

export function useResolvedCountryCode(input: ResolveCountryInput) {
  const { lookupCountryCode, upsertIdentity } = useCountryLookup();
  const fallbackCode = input.countryCode?.trim() ? input.countryCode.trim().toUpperCase() : null;
  const lookupCode = lookupCountryCode([input.uid, input.username, input.name]);
  const usernameKey = input.username?.trim() ? normalizeCountryLookupKey(input.username) : "";
  const cachedCode = usernameKey ? readCachedCountryCode(usernameKey) : null;
  const [liveCode, setLiveCode] = useState<string | null>(null);

  useEffect(() => {
    if (!usernameKey) {
      setLiveCode(null);
      return;
    }
    let active = true;
    findUserByUsername(usernameKey)
      .then((profile) => {
        if (!active || !profile) return;
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
        setLiveCode(code);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [upsertIdentity, usernameKey]);

  return liveCode ?? lookupCode ?? cachedCode ?? fallbackCode;
}
