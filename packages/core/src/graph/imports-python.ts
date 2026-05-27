import { dirOf, normalizePosix } from './resolve.js';

/** A raw Python import: a dotted module plus the relative-dot level (0 = absolute). */
export interface RawPyImport {
  module: string;
  level: number;
}

const IMPORT_RE = /^\s*import\s+([\w.]+)/;
const FROM_RE = /^\s*from\s+(\.*)([\w.]*)\s+import\s+/;

/** Extract imports from Python source, line by line. */
export function extractPyImports(content: string): RawPyImport[] {
  const out: RawPyImport[] = [];
  for (const line of content.split(/\r?\n/)) {
    const from = FROM_RE.exec(line);
    if (from) {
      out.push({ module: from[2]!, level: from[1]!.length });
      continue;
    }
    const imp = IMPORT_RE.exec(line);
    if (imp) {
      // `import a.b.c` and `import a as b` — take the first dotted name.
      out.push({ module: imp[1]!, level: 0 });
    }
  }
  return out;
}

const PY_SOURCE_ROOTS = ['', 'src/'];

/** Try module-path candidates (module.py and module/__init__.py) against files. */
function matchModule(modPath: string, files: ReadonlySet<string>): string | null {
  for (const root of PY_SOURCE_ROOTS) {
    const base = normalizePosix(root + modPath);
    if (files.has(`${base}.py`)) return `${base}.py`;
    if (files.has(`${base}/__init__.py`)) return `${base}/__init__.py`;
  }
  return null;
}

/**
 * Resolve a Python import from `importer` to an in-repo .py file, or null when
 * it is a standard-library/third-party module. Relative imports (level > 0)
 * resolve against the importer's package directory.
 */
export function resolvePyImport(
  importer: string,
  imp: RawPyImport,
  files: ReadonlySet<string>,
): { path: string; confidence: 'high' } | null {
  let modPath: string;
  if (imp.level > 0) {
    // Each leading dot climbs one package level from the importer's directory.
    let dir = dirOf(importer);
    for (let i = 1; i < imp.level; i++) dir = dirOf(dir);
    const sub = imp.module ? imp.module.replace(/\./g, '/') : '';
    modPath = normalizePosix(dir ? (sub ? `${dir}/${sub}` : dir) : sub);
  } else {
    modPath = imp.module.replace(/\./g, '/');
  }
  if (!modPath) return null;

  const match = matchModule(modPath, files);
  return match ? { path: match, confidence: 'high' } : null;
}
