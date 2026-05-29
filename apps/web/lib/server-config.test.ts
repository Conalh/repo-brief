import { describe, expect, it } from 'vitest';
import { assessSeedAuth, hostedIngestLimits } from './server-config';

describe('assessSeedAuth', () => {
  it('requires a matching token when SEED_TOKEN is set', () => {
    const env = { SEED_TOKEN: 'secret' };
    expect(assessSeedAuth(env, 'secret')).toEqual({ ok: true });
    const bad = assessSeedAuth(env, 'nope');
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.status).toBe(401);
  });

  it('is disabled (404) in production when no token is configured', () => {
    const res = assessSeedAuth({ NODE_ENV: 'production' }, null);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.status).toBe(404);
  });

  it('is open outside production when no token is configured', () => {
    expect(assessSeedAuth({ NODE_ENV: 'development' }, null)).toEqual({ ok: true });
    expect(assessSeedAuth({}, null)).toEqual({ ok: true });
  });

  it('honors the token even in production', () => {
    const env = { NODE_ENV: 'production', SEED_TOKEN: 'secret' };
    expect(assessSeedAuth(env, 'secret')).toEqual({ ok: true });
    expect(assessSeedAuth(env, null).ok).toBe(false);
  });
});

describe('hostedIngestLimits', () => {
  it('returns lowered defaults when env is unset', () => {
    const limits = hostedIngestLimits({});
    expect(limits.maxArchiveBytes).toBe(60_000_000);
    expect(limits.maxFileCount).toBe(25_000);
    expect(limits.maxTotalTextBytes).toBe(80_000_000);
  });

  it('honors valid env overrides and ignores junk', () => {
    const limits = hostedIngestLimits({
      INGEST_MAX_ARCHIVE_BYTES: '1000',
      INGEST_MAX_FILE_COUNT: 'not-a-number',
      INGEST_MAX_TOTAL_TEXT_BYTES: '-5',
    });
    expect(limits.maxArchiveBytes).toBe(1000); // valid override
    expect(limits.maxFileCount).toBe(25_000); // junk -> fallback
    expect(limits.maxTotalTextBytes).toBe(80_000_000); // negative -> fallback
  });
});
