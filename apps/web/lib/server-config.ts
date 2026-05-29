import { type IngestLimits } from '@repobrief/core';

/** A read-only view of environment variables (what `process.env` provides). */
type Env = Record<string, string | undefined>;

/** Read a positive integer env var, falling back when unset or invalid. */
function intEnv(env: Env, name: string, fallback: number): number {
  const raw = env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/**
 * Lower, env-overridable ingest ceilings for the hosted (public) surface. The
 * hosted app accepts arbitrary public repo URLs, so its caps are much tighter
 * than the core defaults used by the trusted CLI. Each is overridable via env.
 */
export function hostedIngestLimits(env: Env = process.env): IngestLimits {
  return {
    maxArchiveBytes: intEnv(env, 'INGEST_MAX_ARCHIVE_BYTES', 60_000_000),
    maxFileCount: intEnv(env, 'INGEST_MAX_FILE_COUNT', 25_000),
    maxTotalTextBytes: intEnv(env, 'INGEST_MAX_TOTAL_TEXT_BYTES', 80_000_000),
  };
}

export type SeedAuth = { ok: true } | { ok: false; status: 401 | 404; error: string };

/**
 * Authorize a request to the demo-seed endpoint. Default-closed in production:
 *   - SEED_TOKEN set        -> require a matching token (401 otherwise).
 *   - unset + production     -> disabled, reported as 404 (don't advertise it).
 *   - unset + non-production -> open, for local development/seeding.
 */
export function assessSeedAuth(env: Env, token: string | null): SeedAuth {
  const required = env.SEED_TOKEN;
  if (required) {
    return token === required ? { ok: true } : { ok: false, status: 401, error: 'Unauthorized.' };
  }
  if (env.NODE_ENV === 'production') {
    return { ok: false, status: 404, error: 'Not found.' };
  }
  return { ok: true };
}
