import { parse as parseToml } from 'smol-toml';
import type { Manifest } from '../../types.js';

interface CargoToml {
  package?: { name?: string; edition?: string; 'rust-version'?: string };
  dependencies?: Record<string, unknown>;
  'dev-dependencies'?: Record<string, unknown>;
}

/** Parse a Cargo.toml into a Manifest. Returns null on invalid TOML. */
export function parseCargoToml(path: string, content: string): Manifest | null {
  let doc: CargoToml;
  try {
    doc = parseToml(content) as CargoToml;
  } catch {
    return null;
  }

  const dependencies = [
    ...Object.keys(doc.dependencies ?? {}),
    ...Object.keys(doc['dev-dependencies'] ?? {}),
  ];

  const rustVersion = doc.package?.['rust-version'];

  return {
    path,
    manager: 'rust',
    // Cargo has fixed lifecycle commands rather than named scripts.
    scripts: { build: 'cargo build', test: 'cargo test', run: 'cargo run' },
    dependencies,
    runtime: rustVersion ? `rust ${rustVersion}` : undefined,
  };
}
