interface DashboardSessionCacheEnvelope<T> {
  timestamp: number;
  data: T;
}

export interface DashboardSessionCache<T> {
  key: string;
  ttlMs: number;
  data: T | null;
  expiresAt: number;
  request: Promise<T> | null;
}

const canUseSessionStorage = () => typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";

export const createDashboardSessionCache = <T,>(key: string, ttlMs: number): DashboardSessionCache<T> => ({
  key,
  ttlMs,
  data: null,
  expiresAt: 0,
  request: null,
});

// How long past TTL we still return stale data (rather than blocking on a fresh fetch)
const STALE_GRACE_MS = 20 * 60 * 1000;

export const getDashboardSessionCache = <T,>(cache: DashboardSessionCache<T>): T | null => {
  const now = Date.now();
  if (cache.data !== null && now < cache.expiresAt) {
    return cache.data;
  }

  if (!canUseSessionStorage()) {
    cache.data = null;
    cache.expiresAt = 0;
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(cache.key);
    if (!raw) {
      cache.data = null;
      cache.expiresAt = 0;
      return null;
    }

    const parsed = JSON.parse(raw) as DashboardSessionCacheEnvelope<T>;
    const timestamp = Number(parsed?.timestamp || 0) || 0;
    if (!timestamp) {
      window.sessionStorage.removeItem(cache.key);
      cache.data = null;
      cache.expiresAt = 0;
      return null;
    }

    const age = now - timestamp;

    if (age >= cache.ttlMs + STALE_GRACE_MS) {
      // Too old — discard and force a fresh fetch
      window.sessionStorage.removeItem(cache.key);
      cache.data = null;
      cache.expiresAt = 0;
      return null;
    }

    // Within TTL → fresh hit
    // Within grace window (TTL..TTL+STALE_GRACE_MS) → return stale data;
    // caller should still trigger a background refresh (expiresAt in the past signals staleness)
    cache.data = parsed.data;
    cache.expiresAt = timestamp + cache.ttlMs; // may be in the past if stale
    return parsed.data;
  } catch {
    window.sessionStorage.removeItem(cache.key);
    cache.data = null;
    cache.expiresAt = 0;
    return null;
  }
};

export const setDashboardSessionCache = <T,>(cache: DashboardSessionCache<T>, data: T) => {
  const timestamp = Date.now();
  cache.data = data;
  cache.expiresAt = timestamp + cache.ttlMs;

  if (!canUseSessionStorage()) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      cache.key,
      JSON.stringify({
        timestamp,
        data,
      } satisfies DashboardSessionCacheEnvelope<T>)
    );
  } catch {
    // Ignore storage quota and serialization errors.
  }
};

export const fetchDashboardSessionCache = async <T,>(
  cache: DashboardSessionCache<T>,
  loader: () => Promise<T>,
  options: { force?: boolean } = {}
): Promise<T> => {
  if (!options.force) {
    const cached = getDashboardSessionCache(cache);
    if (cached !== null) {
      const isStale = Date.now() >= cache.expiresAt;
      if (isStale && !cache.request) {
        // Return stale data immediately; refresh silently in background
        cache.request = (async () => {
          const data = await loader();
          setDashboardSessionCache(cache, data);
          return data;
        })().finally(() => {
          cache.request = null;
        });
      }
      return cached;
    }
    if (cache.request) {
      return cache.request;
    }
  }

  cache.request = (async () => {
    const data = await loader();
    setDashboardSessionCache(cache, data);
    return data;
  })();

  try {
    return await cache.request;
  } finally {
    cache.request = null;
  }
};