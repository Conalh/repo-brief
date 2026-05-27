import { describe, expect, it } from 'vitest';
import { classifyFileKind, extensionOf, isExamplePath } from './file-kind.js';

describe('isExamplePath', () => {
  it('flags example/sample/template project directories', () => {
    expect(isExamplePath('examples/next-app/package.json')).toBe(true);
    expect(isExamplePath('packages/core/example/demo.ts')).toBe(true);
    expect(isExamplePath('samples/x/main.py')).toBe(true);
    expect(isExamplePath('templates/starter/package.json')).toBe(true);
  });
  it('does not flag ordinary source paths', () => {
    expect(isExamplePath('src/index.ts')).toBe(false);
    expect(isExamplePath('packages/core/src/exampleHelper.ts')).toBe(false);
  });
});

describe('extensionOf', () => {
  it('returns lowercased extension', () => {
    expect(extensionOf('src/Index.TS')).toBe('ts');
  });
  it('returns empty for dotfiles', () => {
    expect(extensionOf('.gitignore')).toBe('');
  });
  it('returns empty when no extension', () => {
    expect(extensionOf('Makefile')).toBe('');
  });
});

describe('classifyFileKind', () => {
  it.each([
    ['src/index.ts', 'source'],
    ['src/util.test.ts', 'test'],
    ['tests/foo.py', 'test'],
    ['README.md', 'docs'],
    ['package.json', 'config'],
    ['.github/workflows/ci.yml', 'workflow'],
    ['logo.png', 'asset'],
    ['node_modules/left-pad/index.js', 'generated'],
    ['pnpm-lock.yaml', 'generated'],
    ['vendor/foo/bar.go', 'generated'],
    ['third_party/lib.c', 'generated'],
    ['packages/core/fixtures/mini/index.ts', 'test'],
    ['src/__mocks__/fs.ts', 'test'],
    ['Dockerfile', 'config'],
    ['mystery', 'unknown'],
  ] as const)('classifies %s as %s', (path, kind) => {
    expect(classifyFileKind(path)).toBe(kind);
  });
});
