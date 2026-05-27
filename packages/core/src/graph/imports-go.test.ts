import { describe, expect, it } from 'vitest';
import {
  buildGoPackageIndex,
  extractGoImports,
  parseGoModulePath,
  resolveGoImport,
} from './imports-go.js';

describe('extractGoImports', () => {
  it('captures single and grouped imports, with aliases and blank/dot forms', () => {
    const src = [
      'package main',
      '',
      'import "fmt"',
      '',
      'import (',
      '\t"strings"',
      '\talias "github.com/acme/app/pkg/util"',
      '\t_ "github.com/acme/app/internal/side"',
      '\t. "github.com/acme/app/pkg/dsl"',
      ')',
      '',
      'import single "github.com/acme/app/pkg/solo"',
    ].join('\n');
    expect(extractGoImports(src)).toEqual([
      'fmt',
      'strings',
      'github.com/acme/app/pkg/util',
      'github.com/acme/app/internal/side',
      'github.com/acme/app/pkg/dsl',
      'github.com/acme/app/pkg/solo',
    ]);
  });

  it('dedupes repeated specifiers', () => {
    expect(extractGoImports('import "fmt"\nimport "fmt"')).toEqual(['fmt']);
  });
});

describe('parseGoModulePath', () => {
  it('reads the module directive', () => {
    expect(parseGoModulePath('module github.com/acme/app\n\ngo 1.22\n')).toBe(
      'github.com/acme/app',
    );
  });

  it('returns null when absent', () => {
    expect(parseGoModulePath('go 1.22\n')).toBeNull();
    expect(parseGoModulePath(null)).toBeNull();
  });
});

describe('resolveGoImport', () => {
  const index = buildGoPackageIndex([
    'main.go',
    'pkg/util/util.go',
    'pkg/util/helpers.go',
    'internal/store/store.go',
  ]);
  const mod = 'github.com/acme/app';

  it('resolves an in-module import to the package directory representative file', () => {
    // pkg/util has helpers.go and util.go; sorted, helpers.go is representative.
    const r = resolveGoImport(`${mod}/pkg/util`, mod, index);
    expect(r).toEqual({ path: 'pkg/util/helpers.go', confidence: 'medium' });
  });

  it('resolves the root package', () => {
    expect(resolveGoImport(mod, mod, index)?.path).toBe('main.go');
  });

  it('drops standard-library and third-party imports', () => {
    expect(resolveGoImport('fmt', mod, index)).toBeNull();
    expect(resolveGoImport('github.com/other/lib/x', mod, index)).toBeNull();
  });

  it('returns null without a module path', () => {
    expect(resolveGoImport(`${mod}/pkg/util`, null, index)).toBeNull();
  });

  it('returns null for an in-module path with no source files', () => {
    expect(resolveGoImport(`${mod}/pkg/empty`, mod, index)).toBeNull();
  });
});
