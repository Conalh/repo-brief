import { dirOf } from './resolve.js';

/**
 * Go import resolution is package- (directory-) level, not file-level: an import
 * names a package, and a package is every non-test .go file in a directory. To
 * fit the file-to-file edge model, an import resolves to a representative source
 * file in the target package directory (the lexicographically first), which is
 * enough for subsystem grouping and fan-in/out signals.
 */

const SINGLE_IMPORT_RE = /^\s*import\s+(?:[\w.]+\s+|_\s+|\.\s+)?"([^"]+)"/;
const BLOCK_OPEN_RE = /^\s*import\s*\(\s*$/;
const BLOCK_LINE_RE = /^\s*(?:[\w.]+\s+|_\s+|\.\s+)?"([^"]+)"/;

/** Extract imported package paths from Go source (single and grouped forms). */
export function extractGoImports(content: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  let inBlock = false;

  const add = (spec: string) => {
    if (!seen.has(spec)) {
      seen.add(spec);
      out.push(spec);
    }
  };

  for (const line of content.split(/\r?\n/)) {
    if (inBlock) {
      if (/^\s*\)/.test(line)) {
        inBlock = false;
        continue;
      }
      const m = BLOCK_LINE_RE.exec(line);
      if (m) add(m[1]!);
      continue;
    }
    if (BLOCK_OPEN_RE.test(line)) {
      inBlock = true;
      continue;
    }
    const single = SINGLE_IMPORT_RE.exec(line);
    if (single) add(single[1]!);
  }
  return out;
}

/** Read the module path from a go.mod file's `module` directive, or null. */
export function parseGoModulePath(goModContent: string | null): string | null {
  if (!goModContent) return null;
  for (const line of goModContent.split(/\r?\n/)) {
    const m = /^\s*module\s+(\S+)/.exec(line);
    if (m) return m[1]!;
  }
  return null;
}

/**
 * Map each directory containing source .go files to its files, sorted, so a
 * resolved package directory has a stable representative file.
 */
export function buildGoPackageIndex(goFiles: readonly string[]): Map<string, string[]> {
  const byDir = new Map<string, string[]>();
  for (const path of goFiles) {
    const dir = dirOf(path);
    const list = byDir.get(dir);
    if (list) list.push(path);
    else byDir.set(dir, [path]);
  }
  for (const list of byDir.values()) list.sort();
  return byDir;
}

/**
 * Resolve a Go import path to a representative in-repo file, or null when it is
 * a standard-library or third-party package. Only imports under the repo's own
 * module path map to local directories.
 */
export function resolveGoImport(
  importPath: string,
  modulePath: string | null,
  packageIndex: Map<string, string[]>,
): { path: string; confidence: 'medium' } | null {
  if (!modulePath) return null;

  let dir: string | null = null;
  if (importPath === modulePath) dir = '';
  else if (importPath.startsWith(`${modulePath}/`)) dir = importPath.slice(modulePath.length + 1);
  else return null; // external (stdlib or third-party)

  const files = packageIndex.get(dir);
  if (!files || files.length === 0) return null;
  return { path: files[0]!, confidence: 'medium' };
}
