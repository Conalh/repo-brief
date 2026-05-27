import { createTarGzip } from 'nanotar';
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
  return { ok, status, json: async () => body } as Response;
}

function tarballResponse(bytes: Uint8Array): Response {
  return {
    ok: true,
    status: 200,
    arrayBuffer: async () => bytes.buffer,
  } as Response;
}

describe('ingestGitHub — tarball path', () => {
  it('extracts files and SHA from a single tarball download', async () => {
    const gz = await createTarGzip([
      { name: 'octo-demo-deadbeefcafe/README.md', data: '# Demo' },
      { name: 'octo-demo-deadbeefcafe/src/index.ts', data: 'export const x = 1;' },
      { name: 'octo-demo-deadbeefcafe/src/', data: '' }, // directory entry
    ]);
    const fetchImpl = vi.fn().mockResolvedValueOnce(tarballResponse(gz));

    const snapshot = await ingestGitHub(input, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    expect(snapshot.headSha).toBe('deadbeefcafe');
    expect(snapshot.truncated).toBe(false);
    expect(snapshot.files.map((f) => f.path).sort()).toEqual([
      'README.md',
      'src/index.ts',
    ]);
    // Content is served from memory — no extra fetch.
    expect(await snapshot.reader.read('src/index.ts')).toBe('export const x = 1;');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]![0]).toContain('codeload.github.com');
    expect(fetchImpl.mock.calls[0]![0]).toContain('/tar.gz/');
  });

  it('falls back to the tree API when the tarball is unusable', async () => {
    const fetchImpl = vi
      .fn()
      // Tarball response that fails to parse as a gzip tar -> triggers fallback.
      .mockResolvedValueOnce(tarballResponse(new Uint8Array([1, 2, 3])))
      .mockResolvedValueOnce(jsonResponse({ default_branch: 'main' }))
      .mockResolvedValueOnce(
        jsonResponse({
          sha: 'abc123',
          truncated: false,
          tree: [{ path: 'README.md', type: 'blob', size: 6 }],
        }),
      );

    const snapshot = await ingestGitHub(input, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(snapshot.headSha).toBe('abc123');
    expect(snapshot.files).toHaveLength(1);
  });

  it('rejects an oversized archive without falling back to the tree path', async () => {
    const oversized = {
      ok: true,
      status: 200,
      headers: { get: (k: string) => (k === 'content-length' ? '999999999' : null) },
      arrayBuffer: async () => new Uint8Array().buffer,
    } as unknown as Response;
    const fetchImpl = vi.fn().mockResolvedValueOnce(oversized);

    await expect(
      ingestGitHub(input, { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toThrow(GitHubIngestError);
    // The 413 is fatal: no second (tree-path) request is made.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe('ingestGitHub — tree path (preferTree)', () => {
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
      preferTree: true,
    });

    expect(snapshot.input.branch).toBe('main');
    expect(snapshot.headSha).toBe('abc123');
    expect(snapshot.files).toHaveLength(2);
    expect(fetchImpl.mock.calls[1]![0]).toContain('/git/trees/main?recursive=1');
  });

  it('maps 404 to an actionable error (not masked by fallback)', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonResponse(null, false, 404));
    await expect(
      ingestGitHub(input, { fetchImpl: fetchImpl as unknown as typeof fetch }),
    ).rejects.toBeInstanceOf(GitHubIngestError);
  });
});
