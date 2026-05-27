import type { FileNode, Route } from '../../types.js';
import { extractJsRoutes, extractPyRoutes } from './handlers.js';
import { routesFromNextFiles } from './next.js';

export { routesFromNextFiles } from './next.js';
export { extractJsRoutes, extractPyRoutes } from './handlers.js';

const JS_EXT = new Set(['ts', 'tsx', 'js', 'jsx', 'mjs', 'cjs']);

/**
 * Collects content-based routes (FastAPI/Flask/Express) as source files are
 * read. Designed to be passed as the `onSource` visitor to buildImportGraph so
 * it reuses the single content-read pass rather than re-fetching files.
 */
export class RouteCollector {
  readonly routes: Route[] = [];

  visit = (file: FileNode, content: string): void => {
    if (file.extension === 'py') {
      this.routes.push(...extractPyRoutes(file.path, content));
    } else if (JS_EXT.has(file.extension)) {
      this.routes.push(...extractJsRoutes(file.path, content));
    }
  };
}

/** Merge file-based (Next.js) and content-based routes, de-duplicate, and sort. */
export function mergeRoutes(files: FileNode[], collected: Route[]): Route[] {
  const all = [...routesFromNextFiles(files), ...collected];
  const seen = new Set<string>();
  const unique: Route[] = [];
  for (const route of all) {
    const key = `${route.method ?? ''} ${route.path} ${route.handlerPath}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(route);
  }
  return unique.sort(
    (a, b) => a.path.localeCompare(b.path) || (a.method ?? '').localeCompare(b.method ?? ''),
  );
}
