import { parseTarGzip } from 'nanotar';
import { classifyFileKind, extensionOf } from '../classify/file-kind.js';
import type {
  ChurnProvider,
  FileContentReader,
  FileNode,
  RepositoryInput,
  RepoSnapshot,
} from '../types.js';

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
  /** Force the tree+contents API path instead of the tarball (mainly for tests). */
  preferTree?: boolean;
}

/** Skip storing text for files larger than this (bounds memory for big blobs). */
const MAX_TEXT_BYTES = 2_000_000;

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
 * Commit-history churn via the GitHub commits API (recent commits + per-commit
 * file lists, bounded concurrency). Shared by both ingestion paths. Returns an
 * empty map on any failure so churn is best-effort.
 */
function buildChurnProvider(
  owner: string,
  repo: string,
  ref: string,
  headers: Record<string, string>,
  doFetch: typeof fetch,
): ChurnProvider {
  return {
    async recentChanges(commitLimit) {
      const counts = new Map<string, number>();
      const perPage = Math.min(commitLimit, 100);
      const listRes = await doFetch(
        `https://api.github.com/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(
          ref,
        )}&per_page=${perPage}`,
        { headers },
      );
      if (!listRes.ok) return counts;
      const list = (await listRes.json()) as { sha: string }[];

      let cursor = 0;
      const worker = async (): Promise<void> => {
        while (cursor < list.length) {
          const sha = list[cursor++]!.sha;
          const res = await doFetch(
            `https://api.github.com/repos/${owner}/${repo}/commits/${sha}`,
            { headers },
          );
          if (!res.ok) continue;
          const detail = (await res.json()) as { files?: { filename: string }[] };
          for (const file of detail.files ?? []) {
            counts.set(file.filename, (counts.get(file.filename) ?? 0) + 1);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(8, list.length) }, worker));
      return counts;
    },
  };
}

/**
 * Ingest a public GitHub repo into a normalized snapshot. Prefers a single
 * tarball download (the whole repo in one request, contents served from memory
 * with zero per-file API calls), falling back to the Git trees + contents API
 * if the tarball can't be used. Auth/not-found errors are not masked by the
 * fallback. Churn always uses the commits API (history isn't in the tarball).
 */
export async function ingestGitHub(
  input: RepositoryInput,
  options: GitHubIngestOptions = {},
): Promise<RepoSnapshot> {
  if (input.sourceType !== 'github_url' || !input.owner) {
    throw new GitHubIngestError('Expected a GitHub repository input.');
  }
  if (options.preferTree) return ingestViaTree(input, options);

  try {
    return await ingestViaTarball(input, options);
  } catch (err) {
    // Don't retry past a definitive auth/not-found answer.
    if (err instanceof GitHubIngestError && [401, 403, 404].includes(err.status ?? 0)) {
      throw err;
    }
    return ingestViaTree(input, options);
  }
}

/**
 * Tarball path: one archive download, contents extracted and served from
 * memory. Downloads from codeload.github.com, which serves git archives and is
 * NOT bound by the API rate limit — so an anonymous balanced run makes zero
 * api.github.com calls. The commit SHA isn't in a `HEAD`/branch archive, so it
 * is resolved best-effort via one API call, but only when a token is present
 * (to avoid spending the tiny anonymous quota).
 */
async function ingestViaTarball(
  input: RepositoryInput,
  options: GitHubIngestOptions,
): Promise<RepoSnapshot> {
  const doFetch = options.fetchImpl ?? fetch;
  const { owner, repo } = input;
  const headers = authHeaders(options.token);
  const ref = input.branch ?? 'HEAD';

  const res = await doFetch(
    `https://codeload.github.com/${owner}/${repo}/tar.gz/${encodeURIComponent(ref)}`,
    { headers },
  );
  if (!res.ok) throw mapHttpError(res.status, owner!, repo);

  const bytes = new Uint8Array(await res.arrayBuffer());
  const entries = await parseTarGzip(bytes);
  const decoder = new TextDecoder('utf-8', { fatal: false });

  const files: FileNode[] = [];
  const contents = new Map<string, string>();
  let headSha: string | undefined;

  for (const entry of entries) {
    const name = entry.name;
    if (name.endsWith('/')) continue; // directory
    const slash = name.indexOf('/');
    if (slash === -1) continue; // top-level file (shouldn't happen)

    if (headSha === undefined) {
      // Top dir is "<owner>-<repo>-<sha>"; pull the trailing commit SHA.
      const sha = /-([0-9a-f]{7,40})$/.exec(name.slice(0, slash));
      if (sha) headSha = sha[1];
    }

    const rel = name.slice(slash + 1);
    if (!rel) continue;
    const data = entry.data ?? new Uint8Array();
    files.push({
      path: rel,
      extension: extensionOf(rel),
      sizeBytes: data.length,
      kind: classifyFileKind(rel),
    });
    if (data.length > 0 && data.length <= MAX_TEXT_BYTES) {
      contents.set(rel, decoder.decode(data));
    }
  }

  if (files.length === 0) {
    throw new GitHubIngestError('Tarball contained no files.');
  }

  // A HEAD/branch archive doesn't encode the SHA; resolve it best-effort, but
  // only with a token so we never spend the small anonymous quota on it.
  if (!headSha && options.token) {
    headSha = await resolveSha(owner!, repo, ref, headers, doFetch);
  }

  const reader: FileContentReader = {
    async read(path) {
      return contents.has(path) ? contents.get(path)! : null;
    },
  };
  const churn = buildChurnProvider(owner!, repo, headSha ?? ref, headers, doFetch);

  return {
    input: { ...input },
    headSha,
    files,
    truncated: false,
    reader,
    churn,
  };
}

/** Best-effort commit SHA for a ref via the API. Returns undefined on failure. */
async function resolveSha(
  owner: string,
  repo: string,
  ref: string,
  headers: Record<string, string>,
  doFetch: typeof fetch,
): Promise<string | undefined> {
  try {
    const res = await doFetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`,
      { headers },
    );
    if (!res.ok) return undefined;
    return ((await res.json()) as { sha?: string }).sha;
  } catch {
    return undefined;
  }
}

/** Fallback path: Git trees API + per-file contents API reads. */
async function ingestViaTree(
  input: RepositoryInput,
  options: GitHubIngestOptions,
): Promise<RepoSnapshot> {
  const doFetch = options.fetchImpl ?? fetch;
  const { owner, repo } = input;
  const headers = authHeaders(options.token);

  let branch = input.branch;
  if (!branch) {
    const repoRes = await doFetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers,
    });
    if (!repoRes.ok) throw mapHttpError(repoRes.status, owner!, repo);
    branch = ((await repoRes.json()) as GitHubRepoResponse).default_branch;
  }

  const treeRes = await doFetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(
      branch,
    )}?recursive=1`,
    { headers },
  );
  if (!treeRes.ok) throw mapHttpError(treeRes.status, owner!, repo);
  const tree = (await treeRes.json()) as GitHubTreeResponse;

  const files: FileNode[] = tree.tree
    .filter((entry) => entry.type === 'blob')
    .map((entry) => ({
      path: entry.path,
      extension: extensionOf(entry.path),
      sizeBytes: entry.size,
      kind: classifyFileKind(entry.path),
    }));

  const reader: FileContentReader = {
    async read(path) {
      const res = await doFetch(
        `https://api.github.com/repos/${owner}/${repo}/contents/${path
          .split('/')
          .map(encodeURIComponent)
          .join('/')}?ref=${encodeURIComponent(branch)}`,
        { headers: { ...headers, Accept: 'application/vnd.github.raw+json' } },
      );
      if (!res.ok) return null;
      return res.text();
    },
  };
  const churn = buildChurnProvider(owner!, repo, branch, headers, doFetch);

  return {
    input: { ...input, branch },
    headSha: tree.sha,
    files,
    truncated: tree.truncated,
    reader,
    churn,
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
