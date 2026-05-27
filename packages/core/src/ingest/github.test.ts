import { describe, expect, it, vi } from 'vitest';
import { ingestGitHub, GitHubIngestError } from './github.js';
import type { RepositoryInput } from '../types.js';

const input: RepositoryInput = {
  sourceType: 'github_url',
  owner: 'octo',
  repo: 'demo',
  url: 'https://github.com/octo/demo',
};

function jsonResponse(body: unknown, ok = true, status = 200): Response {
  return {
    ok,
    status,
    json: async () => body,
  } as Response;
}

describe('ingestGitHub', () => {
  it('resolves the default branch then fetches the recursive tree', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ default_branch: 'main' }))
      .mockResolvedValueOnce(
        jsonResponse({
          sha: 'abc123',
          truncated: false,
          tree: [
            { path: 'README.md', type: 'blob', size: 10 },
            { path: 'src/index.ts', type: 'blob', size: 42 },
            { path: 'src', type: 'tree' },
          ],
        }),
      );

    const snapshot = await ingestGitHub(input, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(snapshot.input.branch).toBe('main');
    expect(snapshot.headSha).toBe('abc123');
    expect(snapshot.files).toHaveLength(2); // tree entry filtered out
    expect(snapshot.files.map((f) => f.path)).toContain('src/index.ts');
    // Second call should hit the trees endpoint for the resolved branch.
    expect(fetchImpl.mock.calls[1]![0]).toContain('/git/trees/main?recursive=1');
  });

  it('maps 404 to an actionable error', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(null, false, 404));
    await expect(
      ingestGitHub(input, { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toBeInstanceOf(GitHubIngestError);
  });
});
