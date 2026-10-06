type CacheEntry<T> = { value: T; expiresAt: number };
const cacheStore = new Map<string, CacheEntry<unknown>>();
const inFlightStore = new Map<string, Promise<unknown>>();

// Private server results stay in memory; auth transitions reset this cache.
export async function getCachedQuery<T>(key: string, ttlMs: number, fetcher: () => Promise<T>, options?: { force?: boolean }): Promise<T> {
  if (!options?.force) {
    const cached = cacheStore.get(key) as CacheEntry<T> | undefined;
    if (cached && cached.expiresAt > Date.now()) return cached.value;
  }
  const pending = inFlightStore.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const request = Promise.resolve().then(fetcher).then(value => {
    // Invalidated or superseded requests must not restore stale entries.
    if (inFlightStore.get(key) === request) cacheStore.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }).finally(() => {
    if (inFlightStore.get(key) === request) inFlightStore.delete(key);
  });
  inFlightStore.set(key, request);
  return request;
}
export function invalidateQueryCache(key: string): void { cacheStore.delete(key); inFlightStore.delete(key); }
export function invalidateQueryCacheByPrefix(prefix: string): void {
  for (const key of new Set([...cacheStore.keys(), ...inFlightStore.keys()])) if (key.startsWith(prefix)) invalidateQueryCache(key);
}
export function resetQueryCache(): void {
  cacheStore.clear(); inFlightStore.clear();
  // Remove results persisted by earlier versions of the app as well.
  try {
    for (let i = window.sessionStorage.length - 1; i >= 0; i--) {
      const key = window.sessionStorage.key(i); if (key?.startsWith('query_cache:')) window.sessionStorage.removeItem(key);
    }
  } catch { /* Storage can be disabled; memory invalidation still works. */ }
}
