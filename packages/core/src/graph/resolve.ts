/**
 * Path resolution helpers shared by the import-graph extractors. These resolve
 * an import specifier to a concrete repo-relative file path that exists in the
 * snapshot, or null when the target is external or unresolvable.
 */

/** Normalize a POSIX path, collapsing "." and ".." segments. No leading slash. */
export function normalizePosix(path: string): string {
  const out: string[] = [];
  for (const segment of path.split('/')) {
    if (segment === '' || segment === '.') continue;
    if (segment === '..') {
      if (out.length > 0 && out[out.length - 1] !== '..') out.pop();
      else out.push('..');
    } else {
      out.push(segment);
    }
  }
  return out.join('/');
}

/** Directory portion of a repo-relative path ("" for a root-level file). */
export function dirOf(path: string): string {
  const i = path.lastIndexOf('/');
  return i === -1 ? '' : path.slice(0, i);
}

/** Join a directory and a relative specifier into a normalized path. */
export function joinPosix(dir: string, rel: string): string {
  return normalizePosix(dir ? `${dir}/${rel}` : rel);
}

const JS_EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs'];

/**
 * Given a base path with no (or a ".js") extension, find the actual source file
 * in `files` by trying extension and index-file candidates. Returns the matched
 * path plus whether it resolved exactly or via an index file (lower confidence).
 */
export function resolveJsTarget(
  base: string,
  files: ReadonlySet<string>,
): { path: string; viaIndex: boolean } | null {
  // A specifier may already carry an extension; strip a trailing ".js"/".jsx"
  // since TS projects import ".js" that maps to a ".ts" source.
  const stripped = base.replace(/\.(js|jsx|mjs|cjs)$/, '');

  if (files.has(base)) return { path: base, viaIndex: false };

  for (const ext of JS_EXTENSIONS) {
    const candidate = `${stripped}.${ext}`;
    if (files.has(candidate)) return { path: candidate, viaIndex: false };
  }
  for (const ext of JS_EXTENSIONS) {
    const candidate = `${stripped}/index.${ext}`;
    if (files.has(candidate)) return { path: candidate, viaIndex: true };
  }
  return null;
}
