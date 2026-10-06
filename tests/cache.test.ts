import { beforeEach,describe,expect,it,vi } from 'vitest';
import { getCachedQuery,invalidateQueryCache,resetQueryCache } from '../src/lib/queryCache';
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
beforeEach(() => { resetQueryCache(); vi.useRealTimers(); });
describe('private query cache', () => {
  it('deduplicates requests and expires cached results', async () => {
    vi.useFakeTimers(); const fetch = vi.fn().mockResolvedValue('result');
    expect(await Promise.all([getCachedQuery('private', 100, fetch), getCachedQuery('private', 100, fetch)])).toEqual(['result','result']);
    expect(fetch).toHaveBeenCalledTimes(1);
    await getCachedQuery('private', 100, fetch); expect(fetch).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(101); await getCachedQuery('private', 100, fetch); expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('cannot restore another account results after reset while a request is pending', async () => {
    const old = deferred<string>(); const oldRequest = getCachedQuery('private', 1000, () => old.promise);
    await Promise.resolve(); resetQueryCache();
    await getCachedQuery('private',1000,async () => 'new account'); old.resolve('old account'); await oldRequest;
    expect(await getCachedQuery('private',1000,async () => 'unexpected')).toBe('new account');
  });
  it('retries failed requests and removes legacy private session storage', async () => {
    sessionStorage.setItem('query_cache:private','private data'); resetQueryCache(); expect(sessionStorage.length).toBe(0);
    await expect(getCachedQuery('private',100,async () => { throw new Error('offline'); })).rejects.toThrow('offline');
    invalidateQueryCache('private'); expect(await getCachedQuery('private',100,async () => 'recovered')).toBe('recovered');
  });
});
