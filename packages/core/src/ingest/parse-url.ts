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

/** Best-effort percent-decode; returns the input unchanged if it's malformed. */
function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Parse a GitHub repository URL or "owner/repo" shorthand into a RepositoryInput.
 *
 * Accepted forms:
 *   - https://github.com/owner/repo
 *   - https://github.com/owner/repo.git
 *   - https://github.com/owner/repo/tree/<branch>          (single-segment branch)
 *   - github.com/owner/repo
 *   - owner/repo
 *   - git@github.com:owner/repo.git
 *
 * Specifying a ref:
 *   - owner/repo#feature/foo                               (fragment; slashes kept)
 *   - https://github.com/owner/repo?ref=feature/foo        (?ref= or ?branch=)
 *
 * A `/tree/<branch>/<path...>` URL is ambiguous — a branch name may itself
 * contain slashes, so "feature/foo" is indistinguishable from branch "feature"
 * plus path "foo" without asking GitHub which ref exists. Rather than silently
 * guessing (and getting slashed branches wrong), such URLs are rejected with a
 * pointer to the explicit `#ref` / `?ref=` syntax, which captures the whole ref
 * verbatim. A single trailing segment after `/tree/` is unambiguous and accepted.
 *
 * Throws RepoUrlParseError with specific guidance on anything else.
 */
export function parseGitHubUrl(raw: string): RepositoryInput {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new RepoUrlParseError('Empty repository reference.', raw);
  }

  // Peel an explicit ref off the end first. A `#fragment` or a `?ref=`/`?branch=`
  // query value is taken verbatim as the ref, so branch names with slashes
  // (e.g. "feature/foo") survive intact. This is the reliable way to pin a ref.
  let working = trimmed;
  let explicitRef: string | undefined;

  const hashIndex = working.indexOf('#');
  if (hashIndex !== -1) {
    explicitRef = safeDecode(working.slice(hashIndex + 1)).trim() || undefined;
    working = working.slice(0, hashIndex);
  }

  const queryIndex = working.indexOf('?');
  if (queryIndex !== -1) {
    const query = working.slice(queryIndex + 1);
    working = working.slice(0, queryIndex);
    if (!explicitRef) {
      const params = new URLSearchParams(query);
      explicitRef = (params.get('ref') ?? params.get('branch'))?.trim() || undefined;
    }
  }

  // Normalize the scp-like SSH form into a path we can split.
  // git@github.com:owner/repo.git -> owner/repo.git
  const sshMatch = /^git@github\.com:(.+)$/.exec(working);
  let pathPart: string;
  let branch = explicitRef;

  if (sshMatch) {
    pathPart = sshMatch[1]!;
  } else {
    // Strip a scheme if present, then a leading github.com host.
    const hadScheme = /^[a-z]+:\/\//i.test(working);
    let rest = working.replace(/^[a-z]+:\/\//i, '');
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

  // Pull a branch out of a /tree/<branch> URL when one wasn't given explicitly.
  if (!branch && tail[0] === 'tree') {
    const refSegments = tail.slice(1).map(safeDecode);
    if (refSegments.length === 1) {
      branch = refSegments[0];
    } else if (refSegments.length > 1) {
      // Ambiguous: can't tell a slashed branch from branch + sub-path here.
      throw new RepoUrlParseError(
        `Ambiguous ref in "/tree/${refSegments.join('/')}": a branch name may ` +
          `contain slashes, so the branch can't be determined from the path. ` +
          `Specify it explicitly, e.g. "${owner}/${repo}#${refSegments.join('/')}".`,
        raw,
      );
    }
  }

  return {
    sourceType: 'github_url',
    owner,
    repo: repo!,
    url: `https://github.com/${owner}/${repo}`,
    branch,
  };
}
