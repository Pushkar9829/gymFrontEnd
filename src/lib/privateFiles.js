/**
 * In-memory cache of small private images (profile photo thumbnails) so lists and the check-in desk
 * show them instantly after the first load. The server sends them with no-store, so the browser cache
 * never keeps them; this cache lives only in this tab and is emptied on logout.
 */
const MAX = 300;
const cache = new Map(); // path -> { promise, url }

/** Object URL of a cached thumbnail, or null if not loaded yet. */
export function peekPrivateImage(path) {
  return cache.get(path)?.url || null;
}

/** Loads (once) a small private image and returns its object URL. */
export function loadPrivateImage(client, path) {
  const hit = cache.get(path);
  if (hit) {
    cache.delete(path); // most recently used last
    cache.set(path, hit);
    return hit.promise;
  }
  const entry = { url: null };
  entry.promise = client.get(path, { responseType: 'blob' }).then((r) => {
    entry.url = URL.createObjectURL(r.data);
    return entry.url;
  });
  entry.promise.catch(() => cache.get(path) === entry && cache.delete(path));
  cache.set(path, entry);
  if (cache.size > MAX) {
    const [oldest, old] = cache.entries().next().value;
    cache.delete(oldest);
    old.promise.then((u) => URL.revokeObjectURL(u)).catch(() => {});
  }
  return entry.promise;
}

export function clearPrivateImages() {
  for (const e of cache.values()) e.promise.then((u) => URL.revokeObjectURL(u)).catch(() => {});
  cache.clear();
}
