// A small per-visitor limit on /api/chat, so one person (or bot) can't spend the whole Gemini free
// tier. In-memory, per server instance: good enough for a portfolio project, not a security wall.

export interface RateLimiter {
  /** True if this key may make another request now (and counts it). */
  allow(key: string): boolean;
}

export function createRateLimiter(opts: { limit: number; windowMs: number; now?: () => number; maxKeys?: number }): RateLimiter {
  const now = opts.now ?? Date.now;
  const maxKeys = opts.maxKeys ?? 5000;
  const hits = new Map<string, number[]>();
  return {
    allow(key) {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((x) => t - x < opts.windowMs);
      if (recent.length >= opts.limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(t);
      hits.delete(key);
      hits.set(key, recent);
      if (hits.size > maxKeys) hits.delete(hits.keys().next().value!); // forget the oldest visitor
      return true;
    },
  };
}
