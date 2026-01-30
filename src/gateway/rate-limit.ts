/**
 * Simple sliding-window rate limiter keyed by IP address.
 * No external dependencies — uses an in-memory Map with periodic cleanup.
 */

export type RateLimiterOptions = {
  /** Window size in milliseconds. */
  windowMs: number;
  /** Maximum number of requests allowed per window. */
  maxRequests: number;
  /** How often to purge expired entries (ms). Default: windowMs * 2. */
  cleanupIntervalMs?: number;
};

type WindowEntry = {
  count: number;
  windowStart: number;
};

export type RateLimiter = {
  /** Returns true if the request should be allowed, false if rate-limited. */
  allow(key: string): boolean;
  /** Stop the cleanup timer. Call on shutdown. */
  cleanup(): void;
  /** Number of tracked keys (for testing). */
  size(): number;
};

export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const { windowMs, maxRequests } = opts;
  const entries = new Map<string, WindowEntry>();

  const cleanupIntervalMs = opts.cleanupIntervalMs ?? windowMs * 2;
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of entries) {
      if (now - entry.windowStart >= windowMs) {
        entries.delete(key);
      }
    }
  }, cleanupIntervalMs);

  // Don't prevent process exit
  if (timer.unref) {
    timer.unref();
  }

  return {
    allow(key: string): boolean {
      const now = Date.now();
      const entry = entries.get(key);

      if (!entry || now - entry.windowStart >= windowMs) {
        entries.set(key, { count: 1, windowStart: now });
        return true;
      }

      entry.count += 1;
      return entry.count <= maxRequests;
    },

    cleanup() {
      clearInterval(timer);
      entries.clear();
    },

    size() {
      return entries.size;
    },
  };
}
