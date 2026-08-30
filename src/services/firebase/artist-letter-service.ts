import { getFunctions, httpsCallable } from "firebase/functions";
import { firebaseApp } from "./core";

export type SubmitArtistLetterInput = {
  artistId: string;
  artistName: string;
  title: string;
  note: string;
  language: "tr" | "en" | "ru" | "uz";
  timeZone: string;
};

export async function submitArtistLetterRemote(input: SubmitArtistLetterInput) {
  const callable = httpsCallable<SubmitArtistLetterInput, { ok: boolean; id: string }>(getFunctions(firebaseApp, "us-central1"), "submitArtistLetter");
  const result = await callable(input);
  return result.data;
}
