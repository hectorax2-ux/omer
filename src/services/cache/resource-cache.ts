import AsyncStorage from "@react-native-async-storage/async-storage";

type StoredResource<T> = {
  schemaVersion: number;
  savedAt: number;
  value: T;
};

type MemoryResource<T> = StoredResource<T> & {
  networkValidatedAt: number;
  lastAccessedAt: number;
};

const CACHE_PREFIX = "art-atlas:resource-v1:";
const SCHEMA_VERSION = 1;
const MAX_MEMORY_ENTRIES = 48;
const RESOURCE_CACHE_POLICIES = [
  { prefixes: ["artworks:", "artwork:", "artists:", "artist:", "art-stories:", "museums:", "museum:"], diskAgeMs: 7 * 24 * 60 * 60 * 1000, networkFreshMs: 5 * 60 * 1000 },
  { prefixes: ["account:", "profile:"], diskAgeMs: 24 * 60 * 60 * 1000, networkFreshMs: 60 * 1000 },
  { prefixes: ["discovery-posts:"], diskAgeMs: 24 * 60 * 60 * 1000, networkFreshMs: 30 * 1000 },
  { prefixes: ["users:"], diskAgeMs: 24 * 60 * 60 * 1000, networkFreshMs: 2 * 60 * 1000 },
  { prefixes: ["community-images:"], diskAgeMs: 24 * 60 * 60 * 1000, networkFreshMs: 60 * 1000 },
  { prefixes: ["messages:"], diskAgeMs: 24 * 60 * 60 * 1000, networkFreshMs: 0 }
] as const;
const DEFAULT_CACHE_POLICY = { diskAgeMs: 72 * 60 * 60 * 1000, networkFreshMs: 2 * 60 * 1000 };
const memoryCache = new Map<string, MemoryResource<unknown>>();
const pendingDiskReads = new Map<string, Promise<unknown | null>>();
const inFlightRequests = new Map<string, Promise<unknown>>();

function persistResource<T>(key: string, stored: StoredResource<T>) {
  return new Promise<void>((resolve) => {
    setTimeout(() => {
      AsyncStorage.setItem(`${CACHE_PREFIX}${key}`, JSON.stringify(stored)).catch(() => undefined).finally(resolve);
    }, 0);
  });
}

export function peekResourceCache<T>(key: string) {
  const resource = memoryCache.get(key);
  if (!resource) return null;
  resource.lastAccessedAt = Date.now();
  return resource.value as T;
}

export function peekLargestResourceArray<T>(prefix: string) {
  const match = [...memoryCache.entries()]
    .filter(([key, resource]) => key.startsWith(prefix) && Array.isArray(resource.value))
    .sort(([, a], [, b]) => (b.value as unknown[]).length - (a.value as unknown[]).length)[0];
  if (!match) return null;
  match[1].lastAccessedAt = Date.now();
  return match[1].value as T[];
}

export async function loadResourceCache<T>(key: string, validate: (value: unknown) => value is T): Promise<T | null> {
  const memory = memoryCache.get(key);
  if (memory && validate(memory.value)) {
    memory.lastAccessedAt = Date.now();
    return memory.value as T;
  }

  const pending = pendingDiskReads.get(key);
  if (pending) return pending as Promise<T | null>;

  const read = AsyncStorage.getItem(`${CACHE_PREFIX}${key}`)
    .then((raw) => {
      if (!raw) return null;
      const stored = JSON.parse(raw) as StoredResource<unknown>;
      if (stored.schemaVersion !== SCHEMA_VERSION || !validate(stored.value)) {
        void AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`).catch(() => undefined);
        return null;
      }
      setMemoryResource(key, { ...stored, networkValidatedAt: 0, lastAccessedAt: Date.now() });
      return stored.value as T;
    })
    .catch(() => {
      void AsyncStorage.removeItem(`${CACHE_PREFIX}${key}`).catch(() => undefined);
      return null;
    })
    .finally(() => pendingDiskReads.delete(key));

  pendingDiskReads.set(key, read);
  return read;
}

export async function refreshResourceCache<T>(key: string, load: () => Promise<T>, force = false): Promise<T> {
  const policy = resourceCachePolicy(key);
  const memory = memoryCache.get(key);
  if (!force && policy.networkFreshMs > 0 && memory?.networkValidatedAt && Date.now() - memory.networkValidatedAt < policy.networkFreshMs) {
    memory.lastAccessedAt = Date.now();
    return memory.value as T;
  }

  const pending = inFlightRequests.get(key);
  if (pending) return pending as Promise<T>;

  const request = load()
    .then((value) => {
      const stored: MemoryResource<T> = {
        schemaVersion: SCHEMA_VERSION,
        savedAt: Date.now(),
        networkValidatedAt: Date.now(),
        lastAccessedAt: Date.now(),
        value
      };
      setMemoryResource(key, stored);
      void persistResource(key, {
        schemaVersion: stored.schemaVersion,
        savedAt: stored.savedAt,
        value: stored.value
      } satisfies StoredResource<T>);
      return value;
    })
    .finally(() => inFlightRequests.delete(key));

  inFlightRequests.set(key, request);
  return request;
}

export function saveResourceCache<T>(key: string, value: T) {
  const stored: MemoryResource<T> = {
    schemaVersion: SCHEMA_VERSION,
    savedAt: Date.now(),
    networkValidatedAt: Date.now(),
    lastAccessedAt: Date.now(),
    value
  };
  setMemoryResource(key, stored);
  return persistResource(key, {
    schemaVersion: stored.schemaVersion,
    savedAt: stored.savedAt,
    value: stored.value
  } satisfies StoredResource<T>);
}

export function isResourceArray<T>(value: unknown, validateItem: (item: unknown) => item is T): value is T[] {
  return Array.isArray(value) && value.every(validateItem);
}

function setMemoryResource<T>(key: string, resource: MemoryResource<T>) {
  memoryCache.set(key, resource as MemoryResource<unknown>);
  if (memoryCache.size <= MAX_MEMORY_ENTRIES) return;
  const oldestKey = [...memoryCache.entries()]
    .filter(([entryKey]) => entryKey !== key)
    .sort(([, a], [, b]) => a.lastAccessedAt - b.lastAccessedAt)[0]?.[0];
  if (oldestKey) memoryCache.delete(oldestKey);
}

function resourceCachePolicy(key: string) {
  return RESOURCE_CACHE_POLICIES.find((policy) => policy.prefixes.some((prefix) => key.startsWith(prefix))) ?? DEFAULT_CACHE_POLICY;
}
