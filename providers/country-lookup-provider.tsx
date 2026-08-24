import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAccount } from "@/hooks/use-account";
import { useRegisterRefresh } from "@/providers/refresh-provider";
import { loadCountryDirectory } from "@/src/services/firebase/country-directory-service";
import { invalidateCountryCache } from "@/utils/country-cache";
import { buildCountryCodeLookup, lookupCountryCode, resolveCountryCode, resolveCountryId, type CountryIdentity } from "@/utils/country-utils";

type CountryLookupContextValue = {
  lookupCountryCode: (keys: (string | undefined | null)[]) => string | null;
  registerIdentities: (identities: CountryIdentity[]) => void;
  upsertIdentity: (identity: CountryIdentity) => void;
};

const CountryLookupContext = createContext<CountryLookupContextValue>({
  lookupCountryCode: () => null,
  registerIdentities: () => undefined,
  upsertIdentity: () => undefined
});

export function CountryLookupProvider({ children }: PropsWithChildren) {
  const { account, isAuthenticated } = useAccount();
  const [directoryIdentities, setDirectoryIdentities] = useState<CountryIdentity[]>([]);
  const [runtimeIdentities, setRuntimeIdentities] = useState<CountryIdentity[]>([]);
  const [refreshCounter, setRefreshCounter] = useState(0);

  useRegisterRefresh(() => setRefreshCounter((value) => value + 1), { scope: ["/account", "/discover", "/profile"] });

  useEffect(() => {
    if (!isAuthenticated) {
      setDirectoryIdentities([]);
      return;
    }
    let active = true;
    loadCountryDirectory()
      .then((items) => {
        if (active) setDirectoryIdentities(items);
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [isAuthenticated, refreshCounter]);

  const upsertIdentity = useCallback((identity: CountryIdentity) => {
    setRuntimeIdentities((current) => {
      const next = current.filter((item) => item.uid !== identity.uid && item.username !== identity.username);
      next.push(identity);
      return next;
    });
    setDirectoryIdentities((current) => {
      const next = current.filter((item) => item.uid !== identity.uid && item.username !== identity.username);
      next.push(identity);
      return next;
    });
    invalidateCountryCache([identity.uid, identity.username, identity.name]);
  }, []);

  useEffect(() => {
    if (!account.uid || !account.username) return;
    upsertIdentity({
      uid: account.uid,
      username: account.username,
      name: account.displayName,
      country: account.country,
      countryId: resolveCountryId(account.country),
      countryCode: resolveCountryCode(account.country) ?? undefined
    });
  }, [account.country, account.displayName, account.uid, account.username, upsertIdentity]);

  const registerIdentities = useCallback((identities: CountryIdentity[]) => {
    setRuntimeIdentities((current) => areCountryIdentitiesEqual(current, identities) ? current : identities);
  }, []);

  const lookupMap = useMemo(
    () => buildCountryCodeLookup([...directoryIdentities, ...runtimeIdentities]),
    [directoryIdentities, runtimeIdentities]
  );

  const value = useMemo(
    () => ({
      lookupCountryCode: (keys: (string | undefined | null)[]) => lookupCountryCode(lookupMap, keys),
      registerIdentities,
      upsertIdentity
    }),
    [lookupMap, registerIdentities, upsertIdentity]
  );

  return <CountryLookupContext.Provider value={value}>{children}</CountryLookupContext.Provider>;
}

export function useCountryLookup() {
  return useContext(CountryLookupContext);
}

function areCountryIdentitiesEqual(a: CountryIdentity[], b: CountryIdentity[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  return a.every((item, index) => {
    const other = b[index];
    return item.uid === other.uid
      && item.username === other.username
      && item.name === other.name
      && item.country === other.country
      && item.countryId === other.countryId
      && item.countryCode === other.countryCode;
  });
}
