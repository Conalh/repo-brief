import { isExamplePath } from '../classify/file-kind.js';
import { MAX_SOURCE_TEXT_BYTES } from '../constants.js';
import type { FileNode, ImportEdge, RepoSnapshot } from '../types.js';
import {
  buildAliasResolver,
  buildWorkspaceResolver,
  extractJsImports,
  resolveJsImport,
  type AliasResolver,
  type WorkspacePackage,
} from './imports-js.js';
import { extractPyImports, resolvePyImport } from './imports-python.js';
import {
  buildGoPackageIndex,
  extractGoImports,
  parseGoModulePath,
  resolveGoImport,
} from './imports-go.js';
import { dirOf } from './resolve.js';

/** Resolution context for Go imports: the repo module path and its packages. */
interface GoContext {
  modulePath: string;
  packageIndex: Map<string, string[]>;
}

export * from './imports-js.js';
export * from './imports-python.js';
export * from './imports-go.js';
export * from './resolve.js';

const JS_EXTENSIONS = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs']);

export interface ImportGraphOptions {
  /** Cap on source files read (bounds GitHub API calls). Default 1500. */
  maxFiles?: number;
  /** Concurrent reads. Default 12. */
  concurrency?: number;
  /** Skip reading files larger than this many bytes. Defaults to the ingest cap. */
  maxFileBytes?: number;
  /** Optional visitor invoked with each source file's content (reuses the read). */
  onSource?: (file: FileNode, content: string) => void;
}

export interface ImportGraphResult {
  edges: ImportEdge[];
  /** Line counts for every source file that was read, by path. */
  lineCounts: Map<string, number>;
}

/**
 * Build the in-repo import graph for a snapshot. Reads JS/TS and Python source
 * files (up to `maxFiles`), extracts import specifiers, and resolves them to
 * other files in the snapshot. External (node_modules / stdlib) imports are
 * dropped — only edges between repo files are kept. Line counts are captured
 * from the same read so hotspot scoring needs no second pass.
 */
export async function buildImportGraph(
  snapshot: RepoSnapshot,
  options: ImportGraphOptions = {},
): Promise<ImportGraphResult> {
  const maxFiles = options.maxFiles ?? 1500;
  const concurrency = options.concurrency ?? 12;
  const maxFileBytes = options.maxFileBytes ?? MAX_SOURCE_TEXT_BYTES;
  const fileSet = new Set(snapshot.files.map((f) => f.path));

  const aliasContent = await snapshot.reader.read('tsconfig.json');
  const tsAlias = buildAliasResolver(aliasContent);
  const workspaceResolver = buildWorkspaceResolver(
    await collectWorkspacePackages(snapshot),
    fileSet,
  );
  // tsconfig path aliases take precedence; workspace packages fill the rest.
  const alias: AliasResolver = (spec) => tsAlias(spec) ?? workspaceResolver(spec);

  // Go resolution is package-directory based, keyed off the module path.
  const goModulePath = parseGoModulePath(await snapshot.reader.read('go.mod'));
  const goPackageIndex = buildGoPackageIndex(
    snapshot.files.filter((f) => f.kind === 'source' && f.extension === 'go').map((f) => f.path),
  );
  const go: GoContext | null = goModulePath
    ? { modulePath: goModulePath, packageIndex: goPackageIndex }
    : null;

  const sources = snapshot.files
    .filter(
      (f) =>
        f.kind === 'source' &&
        isGraphable(f) &&
        (f.sizeBytes === undefined || f.sizeBytes <= maxFileBytes),
    )
    .slice(0, maxFiles);

  const edges: ImportEdge[] = [];
  const lineCounts = new Map<string, number>();
  const seen = new Set<string>();

  await mapPool(sources, concurrency, async (file) => {
    const content = await snapshot.reader.read(file.path);
    if (content === null) return;
    lineCounts.set(file.path, countLines(content));
    options.onSource?.(file, content);
    for (const edge of edgesFor(file, content, fileSet, alias, go)) {
      const key = `${edge.from}|${edge.to}|${edge.kind}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push(edge);
    }
  });

  return { edges, lineCounts };
}

export interface Degree {
  /** Number of distinct files that import this file. */
  fanIn: number;
  /** Number of distinct files this file imports. */
  fanOut: number;
}

/** Compute fan-in / fan-out for every file referenced by the edges. */
export function computeDegrees(edges: ImportEdge[]): Map<string, Degree> {
  const degrees = new Map<string, Degree>();
  const get = (path: string): Degree => {
    let d = degrees.get(path);
    if (!d) {
      d = { fanIn: 0, fanOut: 0 };
      degrees.set(path, d);
    }
    return d;
  };
  for (const edge of edges) {
    get(edge.from).fanOut++;
    get(edge.to).fanIn++;
  }
  return degrees;
}

/** Count lines in a text blob (number of newlines, +1 for trailing content). */
function countLines(content: string): number {
  if (content === '') return 0;
  let lines = 1;
  for (let i = 0; i < content.length; i++) {
    if (content.charCodeAt(i) === 10) lines++;
  }
  // A trailing newline shouldn't inflate the count.
  return content.endsWith('\n') ? lines - 1 : lines;
}

function isGraphable(file: FileNode): boolean {
  return JS_EXTENSIONS.has(file.extension) || file.extension === 'py' || file.extension === 'go';
}

/**
 * Discover in-repo workspace packages by reading every non-root package.json
 * (skipping vendored/generated trees, test fixtures, and example projects).
 * Scanning manifests directly covers pnpm, yarn, and npm workspaces without
 * parsing workspace globs.
 */
async function collectWorkspacePackages(snapshot: RepoSnapshot): Promise<WorkspacePackage[]> {
  const packages: WorkspacePackage[] = [];
  const candidates = snapshot.files.filter(
    (f) =>
      f.path.endsWith('/package.json') && // non-root only
      f.kind !== 'generated' &&
      f.kind !== 'test' &&
      !isExamplePath(f.path),
  );

  for (const file of candidates) {
    const content = await snapshot.reader.read(file.path);
    if (content === null) continue;
    let pkg: { name?: unknown; main?: unknown; module?: unknown };
    try {
      pkg = JSON.parse(content) as typeof pkg;
    } catch {
      continue;
    }
    if (!pkg || typeof pkg.name !== 'string' || pkg.name === '') continue;
    packages.push({
      name: pkg.name,
      dir: dirOf(file.path),
      entryBase: entryBaseOf(pkg.main) ?? entryBaseOf(pkg.module),
    });
  }
  return packages;
}

/** Strip a leading "./" and a JS/TS extension from a package entry field. */
function entryBaseOf(entry: unknown): string | undefined {
  if (typeof entry !== 'string' || entry === '') return undefined;
  return entry.replace(/^\.\//, '').replace(/\.(js|jsx|mjs|cjs|ts|tsx)$/, '');
}

function edgesFor(
  file: FileNode,
  content: string,
  files: ReadonlySet<string>,
  alias: AliasResolver,
  go: GoContext | null,
): ImportEdge[] {
  const edges: ImportEdge[] = [];
  if (file.extension === 'py') {
    for (const imp of extractPyImports(content)) {
      const resolved = resolvePyImport(file.path, imp, files);
      if (resolved && resolved.path !== file.path) {
        edges.push({ from: file.path, to: resolved.path, kind: 'static', confidence: 'high' });
      }
    }
  } else if (file.extension === 'go') {
    for (const spec of extractGoImports(content)) {
      const resolved = go && resolveGoImport(spec, go.modulePath, go.packageIndex);
      if (resolved && resolved.path !== file.path) {
        edges.push({
          from: file.path,
          to: resolved.path,
          kind: 'static',
          confidence: resolved.confidence,
        });
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
