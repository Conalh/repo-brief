import { describe, expect, it } from 'vitest';
import { parseNpmManifest } from './npm.js';
import { parsePyproject, parseRequirementsTxt } from './python.js';
import { parseCargoToml } from './rust.js';
import { parseGithubWorkflow } from './github-actions.js';

describe('parseNpmManifest', () => {
  it('extracts scripts, deps and node runtime', () => {
    const m = parseNpmManifest(
      'package.json',
      JSON.stringify({
        scripts: { dev: 'next dev', test: 'vitest' },
        dependencies: { next: '15' },
        devDependencies: { vitest: '2' },
        engines: { node: '>=20' },
      }),
    )!;
    expect(m.manager).toBe('npm');
    expect(m.scripts.dev).toBe('next dev');
    expect(m.dependencies).toEqual(expect.arrayContaining(['next', 'vitest']));
    expect(m.runtime).toBe('node >=20');
  });

  it('returns null on invalid JSON', () => {
    expect(parseNpmManifest('package.json', '{ not json')).toBeNull();
  });
});

describe('parsePyproject', () => {
  it('reads PEP 621 dependencies and python version', () => {
    const m = parsePyproject(
      'pyproject.toml',
      [
        '[project]',
        'requires-python = ">=3.11"',
        'dependencies = ["fastapi>=0.110", "uvicorn[standard]"]',
      ].join('\n'),
    )!;
    expect(m.dependencies).toContain('fastapi');
    expect(m.dependencies).toContain('uvicorn');
    expect(m.runtime).toBe('python >=3.11');
  });

  it('reads poetry dependencies and drops python pin', () => {
    const m = parsePyproject(
      'pyproject.toml',
      ['[tool.poetry.dependencies]', 'python = "^3.11"', 'flask = "^3"'].join('\n'),
    )!;
    expect(m.dependencies).toEqual(['flask']);
  });
});

describe('parseRequirementsTxt', () => {
  it('parses names and skips flags/comments', () => {
    const m = parseRequirementsTxt(
      'requirements.txt',
      ['# deps', 'Django==5.0', '-r other.txt', 'requests>=2  # http'].join('\n'),
    );
    expect(m.dependencies).toEqual(['django', 'requests']);
  });
});

describe('parseCargoToml', () => {
  it('parses deps and fixed cargo commands', () => {
    const m = parseCargoToml(
      'Cargo.toml',
      ['[package]', 'name = "x"', '[dependencies]', 'axum = "0.7"'].join('\n'),
    )!;
    expect(m.dependencies).toContain('axum');
    expect(m.scripts.test).toBe('cargo test');
  });
});

describe('parseGithubWorkflow', () => {
  it('maps jobs to runners', () => {
    const m = parseGithubWorkflow(
      '.github/workflows/ci.yml',
      ['name: CI', 'jobs:', '  build:', '    runs-on: ubuntu-latest'].join('\n'),
    )!;
    expect(m.manager).toBe('github_actions');
    expect(m.scripts.build).toBe('ubuntu-latest');
  });

  it('returns null for non-workflow yaml', () => {
    expect(parseGithubWorkflow('x.yml', 'foo: bar')).toBeNull();
  });
});
