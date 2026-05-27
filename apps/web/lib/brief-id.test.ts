import { describe, expect, it } from 'vitest';
import { briefId } from './brief-id';

describe('briefId', () => {
  it('combines owner/repo/sha into a url-safe slug', () => {
    expect(briefId('sindresorhus', 'slugify', 'abcdef1234567890', 'balanced')).toBe(
      'sindresorhus-slugify-abcdef123456',
    );
  });

  it('omits a suffix for balanced but adds one for other modes', () => {
    expect(briefId('a', 'b', 'sha123456789', 'balanced')).toBe('a-b-sha123456789');
    expect(briefId('a', 'b', 'sha123456789', 'fast')).toBe('a-b-sha123456789-fast');
    expect(briefId('a', 'b', 'sha123456789', 'deep')).toBe('a-b-sha123456789-deep');
  });

  it('sanitizes non-alphanumeric characters', () => {
    expect(briefId('My.Org', 'Cool_Repo!', undefined, 'balanced')).toBe(
      'my-org-cool-repo-',
    );
  });

  it('is deterministic for the same inputs (cache key stability)', () => {
    const a = briefId('o', 'r', 'deadbeefcafe', 'deep');
    const b = briefId('o', 'r', 'deadbeefcafe', 'deep');
    expect(a).toBe(b);
  });
});
