import { collection, getDocs, limit, query, startAfter, type QueryDocumentSnapshot } from "firebase/firestore";
import { firestoreDb } from "./core";
import { resolveCountryCode, resolveCountryId, type CountryIdentity } from "@/utils/country-utils";

export async function loadCountryDirectory() {
  const identities: CountryIdentity[] = [];
  const batchSize = 400;
  let cursor: QueryDocumentSnapshot | undefined;

  while (true) {
    const pageQuery = cursor
      ? query(collection(firestoreDb, "users"), startAfter(cursor), limit(batchSize))
      : query(collection(firestoreDb, "users"), limit(batchSize));
    const snapshot = await getDocs(pageQuery);
    snapshot.docs.forEach((item) => {
      const data = item.data();
      const username = typeof data.username === "string" ? data.username.trim() : "";
      if (!username) return;
      const country = typeof data.country === "string" ? data.country.trim() : "";
      const countryCode = typeof data.countryCode === "string" && data.countryCode.trim()
        ? data.countryCode.trim().toUpperCase()
        : resolveCountryCode(country) ?? undefined;
      identities.push({
        uid: item.id,
        username,
        name: typeof data.displayName === "string" && data.displayName.trim() ? data.displayName.trim() : username,
        country: country || undefined,
        countryId: typeof data.countryId === "string" && data.countryId.trim()
          ? data.countryId.trim()
          : resolveCountryId(country),
        countryCode
      });
    });
    if (snapshot.docs.length < batchSize) break;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }

  return identities;
}
