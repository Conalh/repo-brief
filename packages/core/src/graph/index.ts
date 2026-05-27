import type { FileNode, ImportEdge, RepoSnapshot } from '../types.js';
import {
  buildAliasResolver,
  extractJsImports,
  resolveJsImport,
  type AliasResolver,
} from './imports-js.js';
import { extractPyImports, resolvePyImport } from './imports-python.js';

export * from './imports-js.js';
export * from './imports-python.js';
export * from './resolve.js';

const JS_EXTENSIONS = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs']);

export interface ImportGraphOptions {
  /** Cap on source files read (bounds GitHub API calls). Default 1500. */
  maxFiles?: number;
  /** Concurrent reads. Default 12. */
  concurrency?: number;
}

/**
 * Build the in-repo import graph for a snapshot. Reads JS/TS and Python source
 * files (up to `maxFiles`), extracts import specifiers, and resolves them to
 * other files in the snapshot. External (node_modules / stdlib) imports are
 * dropped — only edges between repo files are kept.
 */
export async function buildImportGraph(
  snapshot: RepoSnapshot,
  options: ImportGraphOptions = {},
): Promise<ImportEdge[]> {
  const maxFiles = options.maxFiles ?? 1500;
  const concurrency = options.concurrency ?? 12;
  const fileSet = new Set(snapshot.files.map((f) => f.path));

  const aliasContent = await snapshot.reader.read('tsconfig.json');
  const alias = buildAliasResolver(aliasContent);

  const sources = snapshot.files
    .filter((f) => f.kind === 'source' && isGraphable(f))
    .slice(0, maxFiles);

  const edges: ImportEdge[] = [];
  const seen = new Set<string>();

  await mapPool(sources, concurrency, async (file) => {
    const content = await snapshot.reader.read(file.path);
    if (content === null) return;
    for (const edge of edgesFor(file, content, fileSet, alias)) {
      const key = `${edge.from}|${edge.to}|${edge.kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(edge);
    }
  });

  return edges;
}

function isGraphable(file: FileNode): boolean {
  return JS_EXTENSIONS.has(file.extension) || file.extension === 'py';
}

function edgesFor(
  file: FileNode,
  content: string,
  files: ReadonlySet<string>,
  alias: AliasResolver,
): ImportEdge[] {
  const edges: ImportEdge[] = [];
  if (file.extension === 'py') {
    for (const imp of extractPyImports(content)) {
      const resolved = resolvePyImport(file.path, imp, files);
      if (resolved && resolved.path !== file.path) {
        edges.push({ from: file.path, to: resolved.path, kind: 'static', confidence: 'high' });
      }
    }
  } else {
    for (const imp of extractJsImports(content)) {
      const resolved = resolveJsImport(file.path, imp.spec, files, alias);
      if (resolved && resolved.path !== file.path) {
        edges.push({
          from: file.path,
          to: resolved.path,
          kind: imp.kind,
          confidence: resolved.confidence,
        });
      }
    }
  }
  return edges;
}

/** Run `fn` over items with bounded concurrency. */
async function mapPool<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++]!;
      await fn(item);
    }
  });
  await Promise.all(workers);
}
