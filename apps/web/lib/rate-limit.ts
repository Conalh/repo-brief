/**
 * Lightweight, in-process request throttling for the analysis endpoint.
 *
 * The hosted brief endpoint runs an expensive synchronous analysis, so it is the
 * main DoS surface. This guards it two ways: a per-IP fixed-window rate limit and
 * a global concurrency cap on in-flight analyses.
 *
 * State is in-memory and therefore per-instance: it resets on redeploy and is not
 * shared across serverless replicas. That's a deliberate baseline for a small
 * deployment — a multi-replica setup should back this with a shared store
 * (Redis/Turso). It still meaningfully bounds a single instance.
 */

export interface RateLimitDecision {
  ok: boolean;
  /** Seconds the caller should wait before retrying (0 when allowed). */
  retryAfterSec: number;
}

export interface RateLimiterOptions {
  /** Max requests per key within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
  /** Max concurrent in-flight analyses across all callers. */
  maxConcurrent: number;
  /** Clock injection point for tests; defaults to Date.now. */
  now?: () => number;
}

interface Window {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  /** Account for one request from `key`; returns whether it is allowed. */
  take(key: string): RateLimitDecision;
  /** Try to reserve a concurrency slot; false when the cap is reached. */
  acquire(): boolean;
  /** Release a previously acquired concurrency slot. */
  release(): void;
  /** Current number of reserved concurrency slots (for tests/diagnostics). */
  active(): number;
}

/** Build a rate limiter with its own isolated state. */
export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const now = opts.now ?? (() => Date.now());
  const windows = new Map<string, Window>();
  let active = 0;

  return {
    take(key) {
      const t = now();
      // Opportunistically drop expired windows so the map can't grow unbounded.
      if (windows.size > 10_000) {
        for (const [k, w] of windows) {
          if (t >= w.resetAt) windows.delete(k);
        }
      }
      const existing = windows.get(key);
      if (!existing || t >= existing.resetAt) {
        windows.set(key, { count: 1, resetAt: t + opts.windowMs });
        return { ok: true, retryAfterSec: 0 };
      }
      if (existing.count >= opts.limit) {
        return { ok: false, retryAfterSec: Math.max(1, Math.ceil((existing.resetAt - t) / 1000)) };
      }
      existing.count++;
      return { ok: true, retryAfterSec: 0 };
    },
    acquire() {
      if (active >= opts.maxConcurrent) return false;
      active++;
      return true;
    },
    release() {
      if (active > 0) active--;
    },
    active() {
      return active;
    },
  };
}

/** Best-effort client IP from standard forwarding headers. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim();
    if (first) return first;
  }
  return headers.get('x-real-ip')?.trim() || 'unknown';
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Process-wide limiter for POST /api/briefs. Defaults: 10 requests/min per IP and
 * at most 2 concurrent analyses; all three are env-overridable.
 */
export const briefsRateLimiter = createRateLimiter({
  limit: intEnv('BRIEFS_RATE_LIMIT', 10),
  windowMs: intEnv('BRIEFS_RATE_WINDOW_MS', 60_000),
  maxConcurrent: intEnv('BRIEFS_MAX_CONCURRENT', 2),
});
