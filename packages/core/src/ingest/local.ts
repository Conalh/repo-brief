import { readdir, stat } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { classifyFileKind, extensionOf } from '../classify/file-kind.js';
import type { FileNode, RepositoryInput, RepoSnapshot } from '../types.js';

/** Directory names never worth walking into for a V1 snapshot. */
const SKIP_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'out',
  'coverage',
  '.turbo',
]);

export interface LocalIngestOptions {
  /** Safety cap on number of files; protects against huge monorepos in V1. */
  maxFiles?: number;
}

/** Convert a possibly-Windows path into a repo-relative POSIX path. */
function toPosix(path: string): string {
  return path.split(sep).join('/');
}

/**
 * Ingest a local directory into a normalized snapshot by walking the tree,
 * skipping VCS/dependency/build directories. Marks the snapshot truncated if
 * the file cap is hit.
 */
export async function ingestLocal(
  dirPath: string,
  options: LocalIngestOptions = {},
): Promise<RepoSnapshot> {
  const root = resolve(dirPath);
  const maxFiles = options.maxFiles ?? 20000;
  const files: FileNode[] = [];
  let truncated = false;

  async function walk(current: string): Promise<void> {
    if (truncated) return;
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (truncated) return;
      const abs = join(current, entry.name);
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        await walk(abs);
      } else if (entry.isFile()) {
        if (files.length >= maxFiles) {
          truncated = true;
          return;
        }
        const rel = toPosix(relative(root, abs));
        let sizeBytes: number | undefined;
        try {
          sizeBytes = (await stat(abs)).size;
        } catch {
          sizeBytes = undefined;
        }
        files.push({
          path: rel,
          extension: extensionOf(rel),
          sizeBytes,
          kind: classifyFileKind(rel),
        });
      }
    }
  }

  await walk(root);

  const input: RepositoryInput = {
    sourceType: 'local_path',
    repo: basename(root),
    localPath: root,
  };

  return { input, files, truncated };
}
