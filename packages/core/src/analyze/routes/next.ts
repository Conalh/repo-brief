import type { FileNode, Route } from '../../types.js';

/**
 * Convert a Next.js route-segment directory path into a URL path:
 *   - `[id]`      -> `:id`     (dynamic segment)
 *   - `[...slug]` -> `:slug*`  (catch-all)
 *   - `(group)`   -> removed   (route group, no URL impact)
 */
function toUrlPath(segments: string[]): string {
  const parts = segments
    .filter((s) => !(s.startsWith('(') && s.endsWith(')')))
    .map((s) => {
      const dyn = /^\[\.\.\.(.+)\]$/.exec(s);
      if (dyn) return `:${dyn[1]}*`;
      const param = /^\[(.+)\]$/.exec(s);
      if (param) return `:${param[1]}`;
      return s;
    });
  return '/' + parts.join('/');
}

const PAGE_FILE = /^(page|index)\.(tsx|jsx|ts|js)$/;
const ROUTE_FILE = /^route\.(ts|js)$/;

/**
 * Derive routes from Next.js file conventions (App Router + Pages Router) using
 * only file paths — no content reads. App `route.ts` files are API routes;
 * `page`/`index` files are page routes; `pages/api/**` are API routes.
 */
export function routesFromNextFiles(files: FileNode[]): Route[] {
  const routes: Route[] = [];

  for (const file of files) {
    const parts = file.path.split('/');
    const base = parts[parts.length - 1]!;

    // App Router: a segment dir contains "app" somewhere in the path.
    const appIdx = parts.indexOf('app');
    if (appIdx !== -1 && appIdx < parts.length - 1) {
      const segments = parts.slice(appIdx + 1, -1);
      if (ROUTE_FILE.test(base)) {
        routes.push({ path: toUrlPath(segments), handlerPath: file.path, framework: 'Next.js' });
        continue;
      }
      if (PAGE_FILE.test(base) && base.startsWith('page')) {
        routes.push({ path: toUrlPath(segments), handlerPath: file.path, framework: 'Next.js' });
        continue;
      }
    }

    // Pages Router.
    const pagesIdx = parts.indexOf('pages');
    if (pagesIdx !== -1 && /\.(tsx|jsx|ts|js)$/.test(base)) {
      const segments = parts.slice(pagesIdx + 1);
      const stem = segments[segments.length - 1]!.replace(/\.(tsx|jsx|ts|js)$/, '');
      if (stem.startsWith('_')) continue; // _app, _document, _error
      const urlSegments = [...segments.slice(0, -1), stem === 'index' ? '' : stem].filter(
        (s) => s !== '',
      );
      routes.push({ path: toUrlPath(urlSegments), handlerPath: file.path, framework: 'Next.js' });
    }
  }

  return routes;
}
