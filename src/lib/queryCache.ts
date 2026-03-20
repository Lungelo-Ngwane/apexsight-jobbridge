type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();
const inFlightStore = new Map<string, Promise<unknown>>();
const STORAGE_PREFIX = "query_cache:";

function getStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function getStorageKey(key: string) {
  return `${STORAGE_PREFIX}${key}`;
}

function loadPersistedEntry<T>(key: string): CacheEntry<T> | null {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(getStorageKey(key));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEntry<T> | null;
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.expiresAt !== "number" ||
      !("value" in parsed)
    ) {
      storage.removeItem(getStorageKey(key));
      return null;
    }

    if (parsed.expiresAt <= Date.now()) {
      storage.removeItem(getStorageKey(key));
      return null;
    }

    return parsed;
  } catch {
    storage.removeItem(getStorageKey(key));
    return null;
  }
}

function persistEntry<T>(key: string, entry: CacheEntry<T>): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(getStorageKey(key), JSON.stringify(entry));
  } catch {
    // Ignore quota or serialization issues and continue with memory cache only.
  }
}

function removePersistedEntry(key: string): void {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(getStorageKey(key));
  } catch {
    // Ignore storage access failures.
  }
}

export async function getCachedQuery<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  options?: { force?: boolean },
): Promise<T> {
  const force = Boolean(options?.force);
  const now = Date.now();

  if (!force) {
    const cached = cacheStore.get(key) as CacheEntry<T> | undefined;
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const persisted = loadPersistedEntry<T>(key);
    if (persisted) {
      cacheStore.set(key, persisted as CacheEntry<unknown>);
      return persisted.value;
    }
  }

  const pending = inFlightStore.get(key) as Promise<T> | undefined;
  if (pending) {
    return pending;
  }

  const request = fetcher()
    .then((value) => {
      const entry = {
        value,
        expiresAt: Date.now() + ttlMs,
      };
      cacheStore.set(key, entry);
      persistEntry(key, entry);
      inFlightStore.delete(key);
      return value;
    })
    .catch((error) => {
      inFlightStore.delete(key);
      throw error;
    });

  inFlightStore.set(key, request);
  return request;
}

export function invalidateQueryCache(key: string): void {
  cacheStore.delete(key);
  inFlightStore.delete(key);
  removePersistedEntry(key);
}

export function invalidateQueryCacheByPrefix(prefix: string): void {
  for (const key of cacheStore.keys()) {
    if (key.startsWith(prefix)) {
      cacheStore.delete(key);
    }
  }

  for (const key of inFlightStore.keys()) {
    if (key.startsWith(prefix)) {
      inFlightStore.delete(key);
    }
  }

  const storage = getStorage();
  if (!storage) return;

  try {
    for (let index = storage.length - 1; index >= 0; index -= 1) {
      const storageKey = storage.key(index);
      if (!storageKey?.startsWith(STORAGE_PREFIX)) continue;

      const cacheKey = storageKey.slice(STORAGE_PREFIX.length);
      if (cacheKey.startsWith(prefix)) {
        storage.removeItem(storageKey);
      }
    }
  } catch {
    // Ignore storage access failures.
  }
}
