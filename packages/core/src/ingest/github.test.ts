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

describe('ingestGitHub — churn provider is best-effort', () => {
  // Build a snapshot via the tree path (2 calls), then drive churn separately.
  async function snapshotWithChurnFetch(...churnCalls: unknown[]) {
    const fetchImpl = vi.fn();
    fetchImpl
      .mockResolvedValueOnce(jsonResponse({ default_branch: 'main' }))
      .mockResolvedValueOnce(
        jsonResponse({
          sha: 'abc',
          truncated: false,
          tree: [{ path: 'a.ts', type: 'blob', size: 1 }],
        }),
      );
    for (const call of churnCalls) {
      if (call instanceof Error) fetchImpl.mockRejectedValueOnce(call);
      else fetchImpl.mockResolvedValueOnce(call as Response);
    }
    const snapshot = await ingestGitHub(input, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
      preferTree: true,
    });
    return snapshot;
  }

  it('returns an empty map when the commits list request is not ok', async () => {
    const snapshot = await snapshotWithChurnFetch(jsonResponse(null, false, 500));
    const counts = await snapshot.churn!.recentChanges(10);
    expect(counts.size).toBe(0);
  });

  it('does not throw when listing commits rejects (network error)', async () => {
    const snapshot = await snapshotWithChurnFetch(new Error('network down'));
    await expect(snapshot.churn!.recentChanges(10)).resolves.toBeInstanceOf(Map);
  });

  it('skips a commit whose detail fetch rejects, without aborting', async () => {
    const snapshot = await snapshotWithChurnFetch(
      jsonResponse([{ sha: 's1' }]), // list ok
      new Error('boom'), // per-commit detail rejects
    );
    const counts = await snapshot.churn!.recentChanges(10);
    expect(counts.size).toBe(0);
  });

  it('still counts commits whose detail succeeds', async () => {
    const snapshot = await snapshotWithChurnFetch(
      jsonResponse([{ sha: 's1' }]),
      jsonResponse({ files: [{ filename: 'a.ts' }, { filename: 'b.ts' }] }),
    );
    const counts = await snapshot.churn!.recentChanges(10);
    expect(counts.get('a.ts')).toBe(1);
    expect(counts.get('b.ts')).toBe(1);
  });
});

describe('ingestGitHub — hosted limits and binary handling', () => {
  it('lists every file but only retains text content for textual files', async () => {
    const gz = await createTarGzip([
      { name: 'octo-demo-deadbeef/src/index.ts', data: 'export const x = 1;' },
      // Innocent name, but the bytes contain a NUL -> sniffed as binary.
      { name: 'octo-demo-deadbeef/blob.dat', data: new Uint8Array([1, 0, 2, 3]) },
      // Known binary asset kind by extension.
      { name: 'octo-demo-deadbeef/logo.png', data: new Uint8Array([137, 80, 78, 71]) },
    ]);
    const fetchImpl = vi.fn().mockResolvedValueOnce(tarballResponse(gz));

    const snapshot = await ingestGitHub(input, {
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    // All three appear in the tree...
    expect(snapshot.files.map((f) => f.path).sort()).toEqual([
      'blob.dat',
      'logo.png',
      'src/index.ts',
    ]);
    // ...but only the source file's content is decoded and stored.
    expect(await snapshot.reader.read('src/index.ts')).toBe('export const x = 1;');
    expect(await snapshot.reader.read('blob.dat')).toBeNull();
    expect(await snapshot.reader.read('logo.png')).toBeNull();
  });

  it('enforces a lowered maxFileCount from options', async () => {
    const gz = await createTarGzip([
      { name: 'octo-demo-deadbeef/a.ts', data: 'a' },
      { name: 'octo-demo-deadbeef/b.ts', data: 'b' },
      { name: 'octo-demo-deadbeef/c.ts', data: 'c' },
    ]);
    const fetchImpl = vi.fn().mockResolvedValueOnce(tarballResponse(gz));

    await expect(
      ingestGitHub(input, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        limits: { maxFileCount: 2 },
      }),
    ).rejects.toThrow(/too many files/);
  });

  it('enforces a lowered maxTotalTextBytes from options', async () => {
    const gz = await createTarGzip([
      { name: 'octo-demo-deadbeef/a.ts', data: 'hello world' },
      { name: 'octo-demo-deadbeef/b.ts', data: 'another body' },
    ]);
    const fetchImpl = vi.fn().mockResolvedValueOnce(tarballResponse(gz));

    await expect(
      ingestGitHub(input, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        limits: { maxTotalTextBytes: 5 },
      }),
    ).rejects.toThrow(/too much text/);
  });

  it('rejects an archive whose declared size exceeds a lowered cap', async () => {
    const oversized = {
      ok: true,
      status: 200,
      headers: { get: (k: string) => (k === 'content-length' ? '1000' : null) },
      arrayBuffer: async () => new Uint8Array().buffer,
    } as unknown as Response;
    const fetchImpl = vi.fn().mockResolvedValueOnce(oversized);

    await expect(
      ingestGitHub(input, {
        fetchImpl: fetchImpl as unknown as typeof fetch,
        limits: { maxArchiveBytes: 500 },
      }),
    ).rejects.toThrow(/too large/);
    // 413 is fatal — no fallback to the tree path.
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
