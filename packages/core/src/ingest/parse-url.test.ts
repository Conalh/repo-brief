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

  it('extracts a branch from a /tree/ url', () => {
    const result = parseGitHubUrl('https://github.com/owner/repo/tree/canary/app');
    expect(result.branch).toBe('canary');
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
