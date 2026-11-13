/**
 * Cloudflare Workers keep module state between requests, but a request may
 * not wait on a promise or connection that belongs to another request: it
 * hangs or throws. And work that is still running when a response is sent
 * is cancelled, unless it is registered with waitUntil.
 *
 * These helpers keep shared "in flight" maps per request on Workers (and
 * shared as before everywhere else), and keep background work alive.
 */

type CloudflareContext = { ctx?: { waitUntil?: (promise: Promise<unknown>) => void } };

const isCloudflareWorker =
  typeof navigator !== "undefined" && navigator.userAgent === "Cloudflare-Workers";

const getCloudflareContext = (): (object & CloudflareContext) | undefined =>
  (globalThis as Record<symbol, (object & CloudflareContext) | undefined>)[
    Symbol.for("__cloudflare-context__")
  ];

/** A Map that is shared within one request on Workers, and global elsewhere. */
export const requestScopedMap = <K, V>(): Map<K, V> => {
  if (!isCloudflareWorker) return new Map<K, V>();
  const perRequest = new WeakMap<object, Map<K, V>>();
  const fallback = new Map<K, V>();
  const current = () => {
    const context = getCloudflareContext();
    if (!context) return fallback;
    let map = perRequest.get(context);
    if (!map) {
      map = new Map<K, V>();
      perRequest.set(context, map);
    }
    return map;
  };
  return new Proxy(fallback, {
    get(_target, property) {
      const map = current();
      const value = Reflect.get(map, property, map);
      return typeof value === "function" ? value.bind(map) : value;
    },
  });
};

/** Runs work after the response without it being cancelled on Workers. */
export const runInBackground = (promise: Promise<unknown>) => {
  const handled = promise.catch(() => {});
  getCloudflareContext()?.ctx?.waitUntil?.(handled);
};
