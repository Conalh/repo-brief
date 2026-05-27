import { describe, expect, it } from 'vitest';
import { routesFromNextFiles } from './next.js';
import { extractJsRoutes, extractPyRoutes } from './handlers.js';
import type { FileNode } from '../../types.js';

function f(path: string): FileNode {
  return { path, extension: path.split('.').pop()!, kind: 'source' };
}

describe('routesFromNextFiles', () => {
  it('derives app-router page and route paths, with dynamic segments', () => {
    const routes = routesFromNextFiles([
      f('app/page.tsx'),
      f('app/blog/[slug]/page.tsx'),
      f('app/api/users/route.ts'),
      f('app/(marketing)/about/page.tsx'),
    ]);
    const paths = routes.map((r) => r.path).sort();
    expect(paths).toContain('/');
    expect(paths).toContain('/blog/:slug');
    expect(paths).toContain('/api/users');
    expect(paths).toContain('/about'); // route group stripped
  });

  it('derives pages-router routes and skips special files', () => {
    const routes = routesFromNextFiles([
      f('pages/index.tsx'),
      f('pages/about.tsx'),
      f('pages/api/health.ts'),
      f('pages/_app.tsx'),
    ]);
    const paths = routes.map((r) => r.path).sort();
    expect(paths).toEqual(['/', '/about', '/api/health']);
  });
});

describe('extractPyRoutes', () => {
  it('reads FastAPI decorators and Flask routes', () => {
    const fastapi = extractPyRoutes('main.py', '@router.get("/health")\n@app.post("/items")');
    expect(fastapi).toEqual([
      { method: 'GET', path: '/health', handlerPath: 'main.py', framework: 'FastAPI' },
      { method: 'POST', path: '/items', handlerPath: 'main.py', framework: 'FastAPI' },
    ]);

    const flask = extractPyRoutes('app.py', "@app.route('/login', methods=['GET', 'POST'])");
    expect(flask.map((r) => r.method)).toEqual(['GET', 'POST']);
  });
});

describe('extractJsRoutes', () => {
  it('reads Express-style route calls and ignores non-paths', () => {
    const routes = extractJsRoutes(
      'server.ts',
      "app.get('/users', h);\nrouter.post('/users/:id', h);\nthing.get('not-a-path', x);",
    );
    expect(routes).toEqual([
      { method: 'GET', path: '/users', handlerPath: 'server.ts', framework: 'Express' },
      { method: 'POST', path: '/users/:id', handlerPath: 'server.ts', framework: 'Express' },
    ]);
  });
});
