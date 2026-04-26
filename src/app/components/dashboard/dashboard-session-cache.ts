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
    if (!timestamp || now >= timestamp + cache.ttlMs) {
      window.sessionStorage.removeItem(cache.key);
      cache.data = null;
      cache.expiresAt = 0;
      return null;
    }

    cache.data = parsed.data;
    cache.expiresAt = timestamp + cache.ttlMs;
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