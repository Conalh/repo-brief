#!/usr/bin/env node
import { existsSync } from 'node:fs';
import {
  analyzeSnapshot,
  ingestGitHub,
  ingestLocal,
  parseGitHubUrl,
  renderBriefMarkdown,
  type RepoSnapshot,
} from '@repobrief/core';

/**
 * Milestone-1 CLI: `repobrief inspect <url|path>`.
 * Prints a shallow brief (identity + file breakdown) for a GitHub repo or a
 * local directory. Deeper analysis and more subcommands arrive in later milestones.
 */
async function inspect(target: string): Promise<number> {
  let snapshot: RepoSnapshot;

  // A local path wins if it exists on disk; otherwise treat as a GitHub ref.
  if (target === '.' || target.startsWith('./') || existsSync(target)) {
    snapshot = await ingestLocal(target);
  } else {
    const input = parseGitHubUrl(target);
    snapshot = await ingestGitHub(input, { token: process.env.GITHUB_TOKEN });
  }

  const brief = await analyzeSnapshot(snapshot);
  process.stdout.write(renderBriefMarkdown(brief) + '\n');
  return 0;
}

function usage(): void {
  process.stdout.write(
    [
      'RepoBrief — orientation for unfamiliar repositories.',
      '',
      'Usage:',
      '  repobrief inspect <github-url | owner/repo | local-path>',
      '',
      'Examples:',
      '  repobrief inspect https://github.com/vercel/next.js',
      '  repobrief inspect .',
      '',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const [command, target] = process.argv.slice(2);

  if (!command || command === '--help' || command === '-h') {
    usage();
    process.exitCode = command ? 0 : 1;
    return;
  }

  if (command !== 'inspect') {
    process.stderr.write(`Unknown command: ${command}\n`);
    usage();
    process.exitCode = 1;
    return;
  }

  if (!target) {
    process.stderr.write('inspect requires a target (URL or path).\n');
    process.exitCode = 1;
    return;
  }

  try {
    // Set the code but let the event loop drain naturally so in-flight
    // network sockets close cleanly (avoids a libuv assertion on Windows).
    process.exitCode = await inspect(target);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`Error: ${message}\n`);
    process.exitCode = 1;
  }
}

void main();
