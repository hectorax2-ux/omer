import { collection, getDocs, limit, query, startAfter, type QueryDocumentSnapshot } from "firebase/firestore";
import { firestoreDb } from "./core";
import { getCountryProfileFields, resolveCountryId, type CountryIdentity } from "@/utils/country-utils";

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
      const countryFields = getCountryProfileFields({
        country,
        countryCode: typeof data.countryCode === "string" ? data.countryCode : "",
        countryId: typeof data.countryId === "string" ? data.countryId : ""
      });
      identities.push({
        uid: item.id,
        username,
        name: typeof data.displayName === "string" && data.displayName.trim() ? data.displayName.trim() : username,
        country: countryFields.country || undefined,
        countryId: resolveCountryId(countryFields.countryCode),
        countryCode: countryFields.countryCode || undefined
      });
    });
    if (snapshot.docs.length < batchSize) break;
    cursor = snapshot.docs[snapshot.docs.length - 1];
  }

  return identities;
}
