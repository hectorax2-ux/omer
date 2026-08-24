import AsyncStorage from "@react-native-async-storage/async-storage";
import type { UserProfileDocument } from "@/src/types/firestore";
import { normalizeIdentityKey } from "@/utils/user-identity";

const CACHE_PREFIX = "art-atlas:profile-v1";
const MAX_CACHE_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const memoryProfiles = new Map<string, ProfileCacheEnvelope>();
const memoryIdentityIndex = new Map<string, string>();

type ProfileCacheEnvelope = {
  schemaVersion: 1;
  uid: string;
  usernameKey: string;
  savedAt: number;
  profile: UserProfileDocument;
};

export function peekProfileCache(identity: string, knownUid?: string) {
  const uid = resolveMemoryUid(identity, knownUid);
  if (!uid) return null;
  return validEnvelope(memoryProfiles.get(uid), uid) ? memoryProfiles.get(uid)?.profile ?? null : null;
}

export async function loadProfileCache(identity: string, knownUid?: string) {
  const identityKey = normalizeIdentityKey(identity);
  const indexedUid = memoryIdentityIndex.get(identityKey)
    ?? await AsyncStorage.getItem(profileIdentityStorageKey(identityKey));
  const directUid = knownUid?.trim() || (looksLikeUid(identity) ? identity.trim() : indexedUid ?? "");
  if (!directUid) return null;
  const memory = memoryProfiles.get(directUid);
  if (validEnvelope(memory, directUid) && envelopeMatchesIdentity(memory, identityKey, knownUid)) return memory.profile;

  const raw = await AsyncStorage.getItem(profileStorageKey(directUid));
  const parsed = raw ? safeJson<ProfileCacheEnvelope>(raw) : null;
  if (!validEnvelope(parsed, directUid) || !envelopeMatchesIdentity(parsed, identityKey, knownUid)) return null;
  memoryProfiles.set(directUid, parsed);
  memoryIdentityIndex.set(parsed.usernameKey, directUid);
  return parsed.profile;
}

export async function saveProfileCache(profile: UserProfileDocument) {
  if (!profile.uid || !profile.username) return;
  const usernameKey = normalizeIdentityKey(profile.username);
  const envelope: ProfileCacheEnvelope = {
    schemaVersion: 1,
    uid: profile.uid,
    usernameKey,
    savedAt: Date.now(),
    profile
  };
  memoryProfiles.set(profile.uid, envelope);
  memoryIdentityIndex.set(usernameKey, profile.uid);
  await Promise.all([
    AsyncStorage.setItem(profileStorageKey(profile.uid), JSON.stringify(envelope)),
    AsyncStorage.setItem(profileIdentityStorageKey(usernameKey), profile.uid)
  ]);
}

function resolveMemoryUid(identity: string, knownUid?: string) {
  if (knownUid?.trim()) return knownUid.trim();
  if (looksLikeUid(identity)) return identity.trim();
  return memoryIdentityIndex.get(normalizeIdentityKey(identity));
}

function envelopeMatchesIdentity(envelope: ProfileCacheEnvelope, identityKey: string, knownUid?: string) {
  if (knownUid?.trim() || looksLikeUid(identityKey)) return true;
  return envelope.usernameKey === identityKey;
}

function validEnvelope(value: ProfileCacheEnvelope | null | undefined, uid: string): value is ProfileCacheEnvelope {
  return Boolean(
    value
    && value.schemaVersion === 1
    && value.uid === uid
    && value.profile?.uid === uid
    && value.usernameKey === normalizeIdentityKey(value.profile.username)
    && Date.now() - value.savedAt <= MAX_CACHE_AGE_MS
  );
}

function looksLikeUid(value: string) {
  const trimmed = value.trim();
  return trimmed.length >= 20 && !trimmed.includes(" ");
}

function profileStorageKey(uid: string) {
  return `${CACHE_PREFIX}:uid:${uid}`;
}

function profileIdentityStorageKey(identityKey: string) {
  return `${CACHE_PREFIX}:identity:${identityKey}`;
}

function safeJson<T>(raw: string) {
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
