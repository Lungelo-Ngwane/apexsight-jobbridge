type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const cacheStore = new Map<string, CacheEntry<unknown>>();
const inFlightStore = new Map<string, Promise<unknown>>();

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
  }

  const pending = inFlightStore.get(key) as Promise<T> | undefined;
  if (pending) {
    return pending;
  }

  const request = fetcher()
    .then((value) => {
      cacheStore.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
      });
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
}
