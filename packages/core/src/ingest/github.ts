import { classifyFileKind, extensionOf } from '../classify/file-kind.js';
import type { FileNode, RepositoryInput, RepoSnapshot } from '../types.js';

/** Error raised for GitHub ingestion problems, with an actionable message. */
export class GitHubIngestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GitHubIngestError';
  }
}

interface GitHubTreeEntry {
  path: string;
  type: 'blob' | 'tree' | 'commit';
  size?: number;
}

interface GitHubTreeResponse {
  sha: string;
  tree: GitHubTreeEntry[];
  truncated: boolean;
}

interface GitHubRepoResponse {
  default_branch: string;
}

export interface GitHubIngestOptions {
  /** Token for authenticated requests (raises rate limit 60/hr -> 5000/hr). */
  token?: string;
  /** Injectable fetch for testing; defaults to global fetch. */
  fetchImpl?: typeof fetch;
}

function authHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'repobrief',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

/**
 * Ingest a public GitHub repository into a normalized snapshot using the Git
 * trees API (recursive). Resolves the default branch when none was given.
 */
export async function ingestGitHub(
  input: RepositoryInput,
  options: GitHubIngestOptions = {},
): Promise<RepoSnapshot> {
  if (input.sourceType !== 'github_url' || !input.owner) {
    throw new GitHubIngestError('Expected a GitHub repository input.');
  }
  const doFetch = options.fetchImpl ?? fetch;
  const { owner, repo } = input;
  const headers = authHeaders(options.token);

  let branch = input.branch;
  if (!branch) {
    const repoRes = await doFetch(
      `https://api.github.com/repos/${owner}/${repo}`,
      { headers },
    );
    if (!repoRes.ok) {
      throw mapHttpError(repoRes.status, owner!, repo);
    }
    const repoBody = (await repoRes.json()) as GitHubRepoResponse;
    branch = repoBody.default_branch;
  }

  const treeRes = await doFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(
      branch,
    )}?recursive=1`,
    { headers },
  );
  if (!treeRes.ok) {
    throw mapHttpError(treeRes.status, owner!, repo);
  }
  const tree = (await treeRes.json()) as GitHubTreeResponse;

  const files: FileNode[] = tree.tree
    .filter((entry) => entry.type === 'blob')
    .map((entry) => ({
      path: entry.path,
      extension: extensionOf(entry.path),
      sizeBytes: entry.size,
      kind: classifyFileKind(entry.path),
    }));

  return {
    input: { ...input, branch },
    headSha: tree.sha,
    files,
    truncated: tree.truncated,
  };
}

function mapHttpError(status: number, owner: string, repo: string): GitHubIngestError {
  switch (status) {
    case 404:
      return new GitHubIngestError(
        `Repository ${owner}/${repo} was not found. It may be private or misspelled. Private repos are not supported in V1.`,
        404,
      );
    case 401:
    case 403:
      return new GitHubIngestError(
        'GitHub rejected the request (auth or rate limit). Set GITHUB_TOKEN to raise the rate limit to 5000/hour.',
        status,
      );
    default:
      return new GitHubIngestError(`GitHub request failed (HTTP ${status}).`, status);
  }
}
