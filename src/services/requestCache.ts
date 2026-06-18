const cache = new Map<string, { data: unknown; expiry: number }>();
const inflight = new Map<string, Promise<unknown>>();

export function cachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 5 * 60 * 1000,
): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expiry > Date.now()) {
    return Promise.resolve(hit.data as T);
  }

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = fetcher()
    .then((data) => {
      cache.set(key, { data, expiry: Date.now() + ttlMs });
      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}


export function cachedFetch1<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs = 5 * 60 * 1000,
): Promise<T> {

  console.log('cachedFetch key:', key);

  const hit = cache.get(key);
  if (hit && hit.expiry > Date.now()) {
    console.log('Returning from cache');
    return Promise.resolve(hit.data as T);
  }

  console.log('Calling fetcher...');

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = fetcher()
    .then((data) => {
      console.log('Fetcher Success:', data);

      cache.set(key, {
        data,
        expiry: Date.now() + ttlMs,
      });

      inflight.delete(key);
      return data;
    })
    .catch((err) => {
      console.error('Fetcher Error:', err);

      inflight.delete(key);
      throw err;
    });

  inflight.set(key, promise);
  return promise;
}

export function invalidateCache(prefix?: string) {
  if (!prefix) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) cache.delete(key);
  }
}
