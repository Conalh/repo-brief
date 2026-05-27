import type { Route } from '../../types.js';

const METHODS = '(get|post|put|patch|delete|head|options|all)';

// Python: @app.get("/x") / @router.post("/x") (FastAPI, APIRouter, etc.)
const PY_DECORATOR = new RegExp(
  `@\\s*\\w+\\.${METHODS}\\s*\\(\\s*['"]([^'"]+)['"]`,
  'gi',
);
// Python Flask: @app.route("/x", methods=["GET", "POST"])
const FLASK_ROUTE = /@\s*\w+\.route\s*\(\s*['"]([^'"]+)['"]([^)]*)\)/gi;

// JS: app.get('/x', ...) / router.post('/x', ...) (Express, Fastify, Koa router)
const JS_CALL = new RegExp(`\\b\\w+\\.${METHODS}\\s*\\(\\s*['"]([^'"]+)['"]`, 'gi');

/** Extract FastAPI/Flask routes from Python source. */
export function extractPyRoutes(path: string, content: string): Route[] {
  const routes: Route[] = [];
  for (const m of content.matchAll(PY_DECORATOR)) {
    routes.push({
      method: m[1]!.toUpperCase(),
      path: m[2]!,
      handlerPath: path,
      framework: 'FastAPI',
    });
  }
  for (const m of content.matchAll(FLASK_ROUTE)) {
    const methods = [...m[2]!.matchAll(/['"]([A-Z]+)['"]/g)].map((x) => x[1]!);
    for (const method of methods.length > 0 ? methods : ['GET']) {
      routes.push({ method, path: m[1]!, handlerPath: path, framework: 'Flask' });
    }
  }
  return routes;
}

/** Extract Express/Fastify/Koa-router style routes from JS/TS source. */
export function extractJsRoutes(path: string, content: string): Route[] {
  const routes: Route[] = [];
  for (const m of content.matchAll(JS_CALL)) {
    const method = m[1]!.toUpperCase();
    const url = m[2]!;
    // Skip obvious false positives: paths must look like routes.
    if (!url.startsWith('/')) continue;
    routes.push({
      method: method === 'ALL' ? undefined : method,
      path: url,
      handlerPath: path,
      framework: 'Express',
    });
  }
  return routes;
}
