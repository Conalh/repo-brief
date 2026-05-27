import { execFile } from 'node:child_process';
import { readdir, readFile, stat } from 'node:fs/promises';
import { basename, join, relative, resolve, sep } from 'node:path';
import { promisify } from 'node:util';
import { classifyFileKind, extensionOf } from '../classify/file-kind.js';
import type {
  ChurnProvider,
  FileContentReader,
  FileNode,
  RepositoryInput,
  RepoSnapshot,
} from '../types.js';

const execFileAsync = promisify(execFile);

/**
 * Churn from local git history: counts how many of the last `commitLimit`
 * commits touched each file. Returns an empty map if the directory is not a git
 * repo or git is unavailable.
 */
function localChurnProvider(root: string): ChurnProvider {
  return {
    async recentChanges(commitLimit) {
      const counts = new Map<string, number>();
      try {
        const { stdout } = await execFileAsync(
          'git',
          ['-C', root, 'log', `-n${commitLimit}`, '--name-only', '--pretty=format:'],
          { maxBuffer: 32 * 1024 * 1024 },
        );
        for (const line of stdout.split(/\r?\n/)) {
          const path = line.trim();
          if (path) counts.set(path, (counts.get(path) ?? 0) + 1);
        }
      } catch {
        // Not a git repo, or git not installed — churn simply unavailable.
      }
      return counts;
    },
  };
}

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

  const reader: FileContentReader = {
    async read(path) {
      try {
        return await readFile(join(root, path), 'utf8');
      } catch {
        return null;
      }
    },
  };

  return { input, files, truncated, reader, churn: localChurnProvider(root) };
}
