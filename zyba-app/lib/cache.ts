const DEFAULT_TTL_MS = 5 * 60 * 1000;

type CachePayload<T> = {
  expiresAt: number;
  data: T;
};

export function getCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachePayload<T>;

    if (!parsed.expiresAt || Date.now() > parsed.expiresAt) {
      sessionStorage.removeItem(key);
      return null;
    }

    return parsed.data;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

export function setCache<T>(key: string, data: T, ttlMs = DEFAULT_TTL_MS) {
  if (typeof window === "undefined") return;

  const payload: CachePayload<T> = {
    expiresAt: Date.now() + ttlMs,
    data,
  };

  sessionStorage.setItem(key, JSON.stringify(payload));
}

export function clearCache(key: string) {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(key);
}