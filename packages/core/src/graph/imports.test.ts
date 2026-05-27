import { describe, expect, it } from 'vitest';
import {
  buildAliasResolver,
  buildWorkspaceResolver,
  extractJsImports,
  resolveJsImport,
} from './imports-js.js';
import { extractPyImports, resolvePyImport } from './imports-python.js';

describe('extractJsImports', () => {
  it('captures static, type-only, dynamic and require forms', () => {
    const src = [
      "import a from './a';",
      "import type { T } from './types';",
      "export { x } from './x';",
      "const y = require('./y');",
      "const z = await import('./z');",
      "import './side-effect';",
    ].join('\n');
    const imports = extractJsImports(src);
    const bySpec = Object.fromEntries(imports.map((i) => [i.spec, i.kind]));
    expect(bySpec['./a']).toBe('static');
    expect(bySpec['./types']).toBe('type_only');
    expect(bySpec['./z']).toBe('dynamic');
    expect(bySpec['./side-effect']).toBe('static');
  });
});

describe('resolveJsImport', () => {
  const files = new Set([
    'src/app.ts',
    'src/util/index.ts',
    'src/components/Button.tsx',
  ]);

  it('resolves a relative import', () => {
    const r = resolveJsImport('src/app.ts', './util', files, () => null);
    expect(r).toEqual({ path: 'src/util/index.ts', confidence: 'medium' });
  });

  it('resolves a .js specifier to its .ts source', () => {
    const r = resolveJsImport('src/app.ts', './components/Button.js', files, () => null);
    expect(r?.path).toBe('src/components/Button.tsx');
    expect(r?.confidence).toBe('high');
  });

  it('resolves a tsconfig path alias', () => {
    const alias = buildAliasResolver(
      JSON.stringify({ compilerOptions: { paths: { '@/*': ['src/*'] } } }),
    );
    const r = resolveJsImport('src/app.ts', '@/components/Button', files, alias);
    expect(r?.path).toBe('src/components/Button.tsx');
  });

  it('drops bare (node_modules) specifiers', () => {
    expect(resolveJsImport('src/app.ts', 'react', files, () => null)).toBeNull();
  });
});

describe('python imports', () => {
  const files = new Set([
    'pkg/__init__.py',
    'pkg/core.py',
    'pkg/sub/helpers.py',
    'src/app/main.py',
  ]);

  it('resolves an absolute package import', () => {
    const [imp] = extractPyImports('from pkg.core import thing');
    expect(resolvePyImport('pkg/app.py', imp!, files)?.path).toBe('pkg/core.py');
  });

  it('resolves a relative import', () => {
    const [imp] = extractPyImports('from .helpers import x');
    expect(resolvePyImport('pkg/sub/main.py', imp!, files)?.path).toBe(
      'pkg/sub/helpers.py',
    );
  });

  it('resolves under a src/ root', () => {
    const [imp] = extractPyImports('import app.main');
    expect(resolvePyImport('tests/t.py', imp!, files)?.path).toBe('src/app/main.py');
  });

  it('drops stdlib/third-party imports', () => {
    const [imp] = extractPyImports('import os');
    expect(resolvePyImport('pkg/core.py', imp!, files)).toBeNull();
  });

  it('resolves under a lib/ root', () => {
    const libFiles = new Set(['lib/mymod/__init__.py', 'lib/mymod/core.py']);
    const [imp] = extractPyImports('import mymod.core');
    expect(resolvePyImport('app.py', imp!, libFiles)?.path).toBe('lib/mymod/core.py');
  });
});

describe('buildWorkspaceResolver', () => {
  const files = new Set([
    'packages/core/src/index.ts',
    'packages/core/src/util.ts',
    'packages/web/src/app.ts',
    'packages/ui/index.ts',
  ]);
  const packages = [
    { name: '@acme/core', dir: 'packages/core' },
    { name: '@acme/ui', dir: 'packages/ui' },
  ];

  it('resolves a workspace package bare import to its src entry', () => {
    const resolve = buildWorkspaceResolver(packages, files);
    const r = resolveJsImport('packages/web/src/app.ts', '@acme/core', files, resolve);
    expect(r?.path).toBe('packages/core/src/index.ts');
  });

  it('resolves a subpath import into the package', () => {
    const resolve = buildWorkspaceResolver(packages, files);
    const r = resolveJsImport('packages/web/src/app.ts', '@acme/core/util', files, resolve);
    expect(r?.path).toBe('packages/core/src/util.ts');
  });

  it('falls back to a top-level index when there is no src/', () => {
    const resolve = buildWorkspaceResolver(packages, files);
    const r = resolveJsImport('packages/web/src/app.ts', '@acme/ui', files, resolve);
    expect(r?.path).toBe('packages/ui/index.ts');
  });

  it('returns no edge for an unknown bare specifier', () => {
    const resolve = buildWorkspaceResolver(packages, files);
    expect(resolveJsImport('packages/web/src/app.ts', 'react', files, resolve)).toBeNull();
  });
});
