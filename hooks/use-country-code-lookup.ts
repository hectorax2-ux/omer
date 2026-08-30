import { useEffect, useMemo } from "react";
import { useAccount } from "@/hooks/use-account";
import { useCommunityArt } from "@/hooks/use-community-art";
import { useCountryLookup } from "@/providers/country-lookup-provider";
import { useSocial } from "@/hooks/use-social";
import { resolveCountryCode, type CountryIdentity } from "@/utils/country-utils";

const emptyCountryIdentities: CountryIdentity[] = [];

export function useCountryCodeLookup(extraIdentities: CountryIdentity[] = emptyCountryIdentities) {
  const { suggestedUsers } = useSocial();
  const { account } = useAccount();
  const { items } = useCommunityArt();
  const { registerIdentities } = useCountryLookup();

  const identities = useMemo(() => {
    const merged: CountryIdentity[] = [
      {
        uid: account.uid,
        username: account.username,
        name: account.displayName,
        country: account.country,
        countryCode: account.countryCode ?? resolveCountryCode(account.country) ?? undefined
      },
      ...suggestedUsers.map((user) => ({
        uid: user.uid,
        username: user.username,
        name: user.name,
        country: user.country,
        countryId: user.countryId,
        countryCode: user.countryCode
      })),
      ...items.map((item) => ({
        uid: item.ownerId,
        username: item.uploaderUsername,
        name: item.artistName,
        country: item.ownerCountry
      })),
      ...extraIdentities
    ];
    return merged;
  }, [account.country, account.countryCode, account.displayName, account.uid, account.username, extraIdentities, items, suggestedUsers]);

  useEffect(() => {
    registerIdentities(identities);
  }, [identities, registerIdentities]);

  return useCountryLookup().lookupCountryCode;
}
