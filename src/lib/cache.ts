const store = new Map<string, { data: any; expires: number }>();

export function cacheSet(key: string, data: any, ttlMs = 300_000) {
  store.set(key, { data, expires: Date.now() + ttlMs });
}

export function cacheGet(key: string): any | null {
  const entry = store.get(key);
  if (!entry || entry.expires < Date.now()) {
    store.delete(key);
    return null;
  }
  return entry.data;
}
