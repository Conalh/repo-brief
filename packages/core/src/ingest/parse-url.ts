import type { RepositoryInput } from '../types.js';

/** Thrown when a string cannot be parsed into a GitHub repository reference. */
export class RepoUrlParseError extends Error {
  constructor(
    message: string,
    readonly input: string,
  ) {
    super(message);
    this.name = 'RepoUrlParseError';
  }
}

/**
 * Parse a GitHub repository URL or "owner/repo" shorthand into a RepositoryInput.
 *
 * Accepted forms:
 *   - https://github.com/owner/repo
 *   - https://github.com/owner/repo.git
 *   - https://github.com/owner/repo/tree/branch/...
 *   - github.com/owner/repo
 *   - owner/repo
 *   - git@github.com:owner/repo.git
 *
 * Throws RepoUrlParseError with specific guidance on anything else.
 */
export function parseGitHubUrl(raw: string): RepositoryInput {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new RepoUrlParseError('Empty repository reference.', raw);
  }

  // Normalize the scp-like SSH form into a path we can split.
  // git@github.com:owner/repo.git -> owner/repo.git
  const sshMatch = /^git@github\.com:(.+)$/.exec(trimmed);
  let pathPart: string;
  let branch: string | undefined;

  if (sshMatch) {
    pathPart = sshMatch[1]!;
  } else {
    // Strip a scheme if present, then a leading github.com host.
    const hadScheme = /^[a-z]+:\/\//i.test(trimmed);
    let rest = trimmed.replace(/^[a-z]+:\/\//i, '');
    const wasGitHubHost = /^(www\.)?github\.com\//i.test(rest);
    rest = rest.replace(/^(www\.)?github\.com\//i, '');
    // If a host was present (scheme or a dotted first segment) but it wasn't
    // github.com, reject — only github.com is supported in V1.
    const firstSegment = rest.split('/')[0] ?? '';
    if ((hadScheme || firstSegment.includes('.')) && !wasGitHubHost) {
      throw new RepoUrlParseError('Only github.com URLs are supported in V1.', raw);
    }
    pathPart = rest;
  }

  pathPart = pathPart.replace(/\.git$/i, '').replace(/\/+$/, '');
  const segments = pathPart.split('/').filter(Boolean);

  if (segments.length < 2) {
    throw new RepoUrlParseError(
      'Expected "owner/repo" or a full github.com URL.',
      raw,
    );
  }

  const [owner, repo, ...tail] = segments;

  // Pull a branch out of a /tree/<branch> URL when present.
  if (tail[0] === 'tree' && tail[1]) {
    branch = tail[1];
  }

  return {
    sourceType: 'github_url',
    owner,
    repo: repo!,
    url: `https://github.com/${owner}/${repo}`,
    branch,
  };
}
