const admin = require("firebase-admin");

if (!admin.apps.length) admin.initializeApp();

async function scrubPublicProfileEmails() {
  const firestore = admin.firestore();
  const snapshot = await firestore.collection("users").get();
  const targets = snapshot.docs.filter((document) => {
    const profile = document.data();
    return typeof profile.email === "string" && profile.email.trim()
      || typeof profile.socialLinks?.email === "string" && profile.socialLinks.email.trim();
  });

  const chunks = Array.from({ length: Math.ceil(targets.length / 400) }, (_, index) => targets.slice(index * 400, (index + 1) * 400));
  await chunks.reduce(async (previous, documents) => {
    await previous;
    const batch = firestore.batch();
    documents.forEach((document) => batch.update(document.ref, {
      email: admin.firestore.FieldValue.delete(),
      "socialLinks.email": admin.firestore.FieldValue.delete(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }));
    await batch.commit();
  }, Promise.resolve());

  console.log(`Scrubbed public email fields from ${targets.length} user profiles.`);
}

scrubPublicProfileEmails().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
