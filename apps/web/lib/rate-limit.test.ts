import { describe, expect, it } from 'vitest';
import { clientIp, createRateLimiter } from './rate-limit';

describe('createRateLimiter — per-key window', () => {
  it('allows up to the limit then rejects within the window', () => {
    let t = 1_000;
    const rl = createRateLimiter({ limit: 2, windowMs: 1_000, maxConcurrent: 5, now: () => t });

    expect(rl.take('a').ok).toBe(true);
    expect(rl.take('a').ok).toBe(true);
    const blocked = rl.take('a');
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it('resets after the window elapses', () => {
    let t = 0;
    const rl = createRateLimiter({ limit: 1, windowMs: 1_000, maxConcurrent: 5, now: () => t });

    expect(rl.take('a').ok).toBe(true);
    expect(rl.take('a').ok).toBe(false);
    t += 1_000; // window boundary
    expect(rl.take('a').ok).toBe(true);
  });

  it('tracks keys independently', () => {
    const t = 0;
    const rl = createRateLimiter({ limit: 1, windowMs: 1_000, maxConcurrent: 5, now: () => t });

    expect(rl.take('a').ok).toBe(true);
    expect(rl.take('b').ok).toBe(true);
    expect(rl.take('a').ok).toBe(false);
  });
});

describe('createRateLimiter — concurrency cap', () => {
  it('caps concurrent acquisitions and frees them on release', () => {
    const rl = createRateLimiter({ limit: 100, windowMs: 1_000, maxConcurrent: 2 });

    expect(rl.acquire()).toBe(true);
    expect(rl.acquire()).toBe(true);
    expect(rl.acquire()).toBe(false);
    expect(rl.active()).toBe(2);

    rl.release();
    expect(rl.acquire()).toBe(true);
  });

  it('never lets active go negative', () => {
    const rl = createRateLimiter({ limit: 100, windowMs: 1_000, maxConcurrent: 1 });
    rl.release();
    rl.release();
    expect(rl.active()).toBe(0);
    expect(rl.acquire()).toBe(true);
  });
});

describe('clientIp', () => {
  it('takes the first x-forwarded-for entry', () => {
    const h = new Headers({ 'x-forwarded-for': '203.0.113.1, 70.41.3.18' });
    expect(clientIp(h)).toBe('203.0.113.1');
  });

  it('falls back to x-real-ip then "unknown"', () => {
    expect(clientIp(new Headers({ 'x-real-ip': '198.51.100.7' }))).toBe('198.51.100.7');
    expect(clientIp(new Headers())).toBe('unknown');
  });
});
