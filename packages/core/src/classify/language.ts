import type { FileNode } from '../types.js';

/** Maps a source extension to a human language name. */
const EXTENSION_LANGUAGE: Record<string, string> = {
  ts: 'TypeScript',
  tsx: 'TypeScript',
  js: 'JavaScript',
  jsx: 'JavaScript',
  mjs: 'JavaScript',
  cjs: 'JavaScript',
  py: 'Python',
  rs: 'Rust',
  go: 'Go',
  java: 'Java',
  rb: 'Ruby',
  php: 'PHP',
  c: 'C',
  h: 'C',
  cpp: 'C++',
  cc: 'C++',
  cs: 'C#',
  swift: 'Swift',
  kt: 'Kotlin',
  scala: 'Scala',
};

export interface LanguageSummary {
  primaryLanguage?: string;
  /** Languages ordered by source-file count, descending. */
  languages: string[];
}

/**
 * Summarize repository languages by counting source files per language.
 * Only files classified as `source` contribute, so configs and docs don't
 * skew the result.
 */
export function detectLanguages(files: FileNode[]): LanguageSummary {
  const counts = new Map<string, number>();
  for (const file of files) {
    if (file.kind !== 'source') continue;
    const language = EXTENSION_LANGUAGE[file.extension];
    if (!language) continue;
    counts.set(language, (counts.get(language) ?? 0) + 1);
  }

  const languages = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([language]) => language);

  return { primaryLanguage: languages[0], languages };
}
