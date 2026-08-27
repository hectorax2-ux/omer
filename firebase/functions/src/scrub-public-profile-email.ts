import * as admin from "firebase-admin";
import { onDocumentWritten } from "firebase-functions/v2/firestore";

export const scrubPublicProfileEmail = onDocumentWritten("users/{userId}", async (event) => {
  const snapshot = event.data?.after;
  if (!snapshot?.exists) return;
  const profile = snapshot.data();
  if (!profile) return;
  const socialLinks = profile.socialLinks && typeof profile.socialLinks === "object"
    ? profile.socialLinks as Record<string, unknown>
    : undefined;
  if (!(typeof profile.email === "string" && profile.email.trim())
    && !(typeof socialLinks?.email === "string" && socialLinks.email.trim())) return;

  await snapshot.ref.update({
    email: admin.firestore.FieldValue.delete(),
    "socialLinks.email": admin.firestore.FieldValue.delete(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
});
