import { doc, getDoc, serverTimestamp, writeBatch } from "firebase/firestore";
import { firestoreDb } from "./core";
import { firestoreQuery, getDocument, listDocuments } from "./firestore-helpers";
import { CommunityImageCommentDocument, CommunityImageDocument, PostCommentDocument, PostDocument } from "@/src/types/firestore";
import { PersonalMuseumDocument, SeerScoreDocument } from "./art-systems-service";

const BATCH_LIMIT = 400;

type IdentitySyncInput = {
  uid: string;
  username: string;
  displayName: string;
  previousUsername?: string;
  photoURL?: string;
};

type PendingUpdate = {
  collection: string;
  id: string;
  data: Record<string, unknown>;
};

function collectLegacyUsername(target: Set<string>, username: string | undefined, currentUsername: string) {
  if (!username) return;
  if (username !== currentUsername) target.add(username);
}

async function commitUpdates(updates: PendingUpdate[]) {
  for (let index = 0; index < updates.length; index += BATCH_LIMIT) {
    const batch = writeBatch(firestoreDb);
    for (const item of updates.slice(index, index + BATCH_LIMIT)) {
      batch.update(doc(firestoreDb, item.collection, item.id), {
        ...item.data,
        updatedAt: serverTimestamp()
      });
    }
    await batch.commit();
  }
}

export async function syncUserIdentityDenormalizedFields(input: IdentitySyncInput) {
  const { uid, username, displayName, previousUsername, photoURL } = input;
  const legacyUsernames = new Set<string>();
  if (previousUsername) legacyUsernames.add(previousUsername);
  const updates: PendingUpdate[] = [];

  const posts = await listDocuments<PostDocument>("posts", [firestoreQuery.where("authorId", "==", uid)]);
  for (const post of posts) {
    collectLegacyUsername(legacyUsernames, post.authorUsername, username);
    if (post.authorUsername !== username || post.authorDisplayName !== displayName || (photoURL !== undefined && post.authorPhotoURL !== photoURL)) {
      updates.push({
        collection: "posts",
        id: post.id,
        data: {
          authorUsername: username,
          authorDisplayName: displayName,
          ...(photoURL !== undefined ? { authorPhotoURL: photoURL } : {})
        }
      });
    }
  }

  if (previousUsername) {
    const legacyPosts = await listDocuments<PostDocument>("posts", [firestoreQuery.where("authorUsername", "==", previousUsername)]);
    for (const post of legacyPosts) {
      if (post.authorId && post.authorId !== uid) continue;
      collectLegacyUsername(legacyUsernames, post.authorUsername, username);
      updates.push({
        collection: "posts",
        id: post.id,
        data: { authorId: uid, authorUsername: username, authorDisplayName: displayName }
      });
    }
  }

  const comments = await listDocuments<PostCommentDocument>("postComments", [firestoreQuery.where("authorId", "==", uid)]);
  for (const comment of comments) {
    collectLegacyUsername(legacyUsernames, comment.authorUsername, username);
    if (comment.authorUsername !== username || comment.authorDisplayName !== displayName) {
      updates.push({
        collection: "postComments",
        id: comment.id,
        data: { authorUsername: username, authorDisplayName: displayName }
      });
    }
  }

  const imageComments = await listDocuments<CommunityImageCommentDocument>("communityImageComments", [firestoreQuery.where("authorId", "==", uid)]);
  for (const comment of imageComments) {
    collectLegacyUsername(legacyUsernames, comment.authorUsername, username);
    if (comment.authorUsername !== username || comment.authorDisplayName !== displayName) {
      updates.push({
        collection: "communityImageComments",
        id: comment.id,
        data: { authorUsername: username, authorDisplayName: displayName }
      });
    }
  }

  const images = await listDocuments<CommunityImageDocument>("communityImages", [firestoreQuery.where("ownerId", "==", uid)]);
  for (const image of images) {
    collectLegacyUsername(legacyUsernames, image.ownerUsername, username);
    if (image.ownerUsername !== username || image.ownerDisplayName !== displayName) {
      updates.push({
        collection: "communityImages",
        id: image.id,
        data: { ownerUsername: username, ownerDisplayName: displayName }
      });
    }
  }

  if (previousUsername) {
    const legacyImages = await listDocuments<CommunityImageDocument>("communityImages", [firestoreQuery.where("ownerUsername", "==", previousUsername)]);
    for (const image of legacyImages) {
      if (image.ownerId && image.ownerId !== uid) continue;
      collectLegacyUsername(legacyUsernames, image.ownerUsername, username);
      updates.push({
        collection: "communityImages",
        id: image.id,
        data: { ownerId: uid, ownerUsername: username, ownerDisplayName: displayName }
      });
    }
  }

  type ChanceDrawDoc = { id: string; uid: string; username: string; displayName?: string };
  const chanceDraws = await listDocuments<ChanceDrawDoc>("chanceCardDraws", [firestoreQuery.where("uid", "==", uid)]);
  for (const draw of chanceDraws) {
    collectLegacyUsername(legacyUsernames, draw.username, username);
    if (draw.username !== username || draw.displayName !== displayName) {
      updates.push({
        collection: "chanceCardDraws",
        id: draw.id,
        data: { username, displayName }
      });
    }
  }

  const seerSnapshot = await getDoc(doc(firestoreDb, "seerScores", uid));
  if (seerSnapshot.exists()) {
    const seer = seerSnapshot.data() as SeerScoreDocument;
    if (seer.username !== username || seer.displayName !== displayName) {
      updates.push({
        collection: "seerScores",
        id: uid,
        data: { username, displayName }
      });
    }
  }

  type ArtStoryDoc = { id: string; authorId?: string; authorUsername?: string; authorDisplayName?: string };
  const stories = await listDocuments<ArtStoryDoc>("artStories", [firestoreQuery.where("authorId", "==", uid)]);
  for (const story of stories) {
    collectLegacyUsername(legacyUsernames, story.authorUsername, username);
    if (story.authorUsername !== username || story.authorDisplayName !== displayName) {
      updates.push({
        collection: "artStories",
        id: story.id,
        data: { authorUsername: username, authorDisplayName: displayName }
      });
    }
  }

  for (const legacyUsername of legacyUsernames) {
    const museums = await listDocuments<PersonalMuseumDocument>("personalMuseums", [firestoreQuery.where("ownerUsername", "==", legacyUsername)]);
    for (const museum of museums) {
      if (museum.ownerId && museum.ownerId !== uid) continue;
      updates.push({
        collection: "personalMuseums",
        id: museum.id,
        data: { ownerId: uid, ownerUsername: username, ownerName: displayName }
      });
    }

    type TimeCapsuleDoc = { id: string; ownerId?: string; ownerUsername: string };
    const capsules = await listDocuments<TimeCapsuleDoc>("timeCapsules", [firestoreQuery.where("ownerUsername", "==", legacyUsername)]);
    for (const capsule of capsules) {
      if (capsule.ownerId && capsule.ownerId !== uid) continue;
      updates.push({
        collection: "timeCapsules",
        id: capsule.id,
        data: { ownerId: uid, ownerUsername: username }
      });
    }
  }

  const ownedMuseums = await listDocuments<PersonalMuseumDocument>("personalMuseums", [firestoreQuery.where("ownerId", "==", uid)]);
  for (const museum of ownedMuseums) {
    if (museum.ownerUsername !== username || museum.ownerName !== displayName || museum.ownerId !== uid) {
      updates.push({
        collection: "personalMuseums",
        id: museum.id,
        data: { ownerId: uid, ownerUsername: username, ownerName: displayName }
      });
    }
  }

  const directMuseum = await getDocument<PersonalMuseumDocument>("personalMuseums", uid);
  if (directMuseum && (directMuseum.ownerUsername !== username || directMuseum.ownerName !== displayName || directMuseum.ownerId !== uid)) {
    updates.push({
      collection: "personalMuseums",
      id: directMuseum.id,
      data: { ownerId: uid, ownerUsername: username, ownerName: displayName }
    });
  }

  const deduped = new Map<string, PendingUpdate>();
  for (const item of updates) {
    deduped.set(`${item.collection}:${item.id}`, item);
  }

  if (deduped.size) {
    await commitUpdates([...deduped.values()]);
  }
}

export async function syncUserCountryDenormalizedFields(input: {
  uid: string;
  country: string;
  countryCode: string;
}) {
  const { uid, countryCode } = input;
  const updates: PendingUpdate[] = [];

  type CountryDoc = { id: string; countryCode?: string };
  const chanceDraws = await listDocuments<CountryDoc>("chanceCardDraws", [firestoreQuery.where("uid", "==", uid)]);
  for (const draw of chanceDraws) {
    if (draw.countryCode !== countryCode) {
      updates.push({ collection: "chanceCardDraws", id: draw.id, data: { countryCode } });
    }
  }

  const jigsawAttempts = await listDocuments<CountryDoc>("jigsawAttempts", [firestoreQuery.where("uid", "==", uid)]);
  for (const attempt of jigsawAttempts) {
    if (attempt.countryCode !== countryCode) {
      updates.push({ collection: "jigsawAttempts", id: attempt.id, data: { countryCode } });
    }
  }

  const guessAttempts = await listDocuments<CountryDoc>("guessArtworkAttempts", [firestoreQuery.where("uid", "==", uid)]);
  for (const attempt of guessAttempts) {
    if (attempt.countryCode !== countryCode) {
      updates.push({ collection: "guessArtworkAttempts", id: attempt.id, data: { countryCode } });
    }
  }

  const seerSnapshot = await getDoc(doc(firestoreDb, "seerScores", uid));
  if (seerSnapshot.exists()) {
    const seer = seerSnapshot.data() as SeerScoreDocument & { countryCode?: string };
    if (seer.countryCode !== countryCode) {
      updates.push({ collection: "seerScores", id: uid, data: { countryCode } });
    }
  }

  if (updates.length) {
    await commitUpdates(updates);
  }
}
