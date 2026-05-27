import { describe, expect, it } from 'vitest';
import { detectFrameworks } from './framework.js';
import { detectLanguages } from './language.js';
import type { FileNode, Manifest } from '../types.js';

function npm(deps: string[]): Manifest {
  return { path: 'package.json', manager: 'npm', scripts: {}, dependencies: deps };
}

describe('detectFrameworks', () => {
  it('marks Next.js high when dep and config file both present', () => {
    const fw = detectFrameworks([{ path: 'next.config.js' }], [npm(['next'])]);
    const next = fw.find((f) => f.name === 'Next.js');
    expect(next?.confidence).toBe('high');
  });

  it('marks a dependency-only signal as medium', () => {
    const fw = detectFrameworks([{ path: 'main.py' }], [npm(['express'])]);
    expect(fw.find((f) => f.name === 'Express')?.confidence).toBe('medium');
  });

  it('detects .NET from project files alone', () => {
    const fw = detectFrameworks([{ path: 'App/App.csproj' }], []);
    expect(fw.some((f) => f.name === '.NET')).toBe(true);
  });
});

describe('detectLanguages', () => {
  it('ranks languages by source file count', () => {
    const files: FileNode[] = [
      { path: 'a.ts', extension: 'ts', kind: 'source' },
      { path: 'b.ts', extension: 'ts', kind: 'source' },
      { path: 'c.py', extension: 'py', kind: 'source' },
      { path: 'README.md', extension: 'md', kind: 'docs' },
    ];
    const { primaryLanguage, languages } = detectLanguages(files);
    expect(primaryLanguage).toBe('TypeScript');
    expect(languages).toEqual(['TypeScript', 'Python']);
  });
});
