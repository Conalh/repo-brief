import { describe, expect, it } from 'vitest';
import { classifyFileKind, extensionOf } from './file-kind.js';

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
    ['Dockerfile', 'config'],
    ['mystery', 'unknown'],
  ] as const)('classifies %s as %s', (path, kind) => {
    expect(classifyFileKind(path)).toBe(kind);
  });
});
