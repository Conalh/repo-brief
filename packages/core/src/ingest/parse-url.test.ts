import { describe, expect, it } from 'vitest';
import { parseGitHubUrl, RepoUrlParseError } from './parse-url.js';

describe('parseGitHubUrl', () => {
  it.each([
    'https://github.com/vercel/next.js',
    'https://github.com/vercel/next.js.git',
    'github.com/vercel/next.js',
    'vercel/next.js',
    'git@github.com:vercel/next.js.git',
  ])('parses %s', (raw) => {
    const result = parseGitHubUrl(raw);
    expect(result.owner).toBe('vercel');
    expect(result.repo).toBe('next.js');
    expect(result.url).toBe('https://github.com/vercel/next.js');
  });

  it('extracts a single-segment branch from a /tree/ url', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo/tree/canary');
    expect(result.branch).toBe('canary');
  });

  it('rejects an ambiguous /tree/ url with a sub-path (slashes could be a branch)', () => {
    // "feature/foo" could be branch "feature" + path "foo", or branch
    // "feature/foo" — refuse to guess and point at the explicit syntax.
    expect(() => parseGitHubUrl('https://github.com/owner/repo/tree/feature/foo')).toThrow(
      RepoUrlParseError,
    );
  });

  it.each([
    ['owner/repo#feature/foo', 'feature/foo'],
    ['https://github.com/owner/repo#release/1.2', 'release/1.2'],
    ['https://github.com/owner/repo?ref=feature/foo', 'feature/foo'],
    ['https://github.com/owner/repo?branch=feature/foo', 'feature/foo'],
    // An explicit ref wins over (and resolves) an ambiguous /tree/ path.
    ['https://github.com/owner/repo/tree/feature/foo#feature/foo', 'feature/foo'],
  ])('takes a slashed branch verbatim from %s', (raw, expected) => {
    const result = parseGitHubUrl(raw);
    expect(result.owner).toBe('owner');
    expect(result.repo).toBe('repo');
    expect(result.branch).toBe(expected);
  });

  it('decodes a percent-encoded ref', () => {
    expect(parseGitHubUrl('owner/repo#feature%2Ffoo').branch).toBe('feature/foo');
  });

  it('leaves branch undefined when no ref is given', () => {
    expect(parseGitHubUrl('owner/repo').branch).toBeUndefined();
    expect(parseGitHubUrl('https://github.com/owner/repo').branch).toBeUndefined();
  });

  it('rejects non-github hosts', () => {
    expect(() => parseGitHubUrl('https://gitlab.com/owner/repo')).toThrow(
      RepoUrlParseError,
    );
  });

  it('rejects incomplete references', () => {
    expect(() => parseGitHubUrl('owner')).toThrow(RepoUrlParseError);
    expect(() => parseGitHubUrl('')).toThrow(RepoUrlParseError);
  });
});
