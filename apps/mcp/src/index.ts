#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import {
  analyzeSnapshot,
  ingestGitHub,
  ingestLocal,
  parseGitHubUrl,
  renderBriefMarkdown,
  type BriefMode,
  type RepoSnapshot,
} from '@repobrief/core';

const MODES: BriefMode[] = ['fast', 'balanced', 'deep'];

/** Ingest a target: a local path if it exists on disk, else a GitHub reference. */
async function ingest(target: string): Promise<RepoSnapshot> {
  if (target === '.' || target.startsWith('./') || existsSync(target)) {
    return ingestLocal(target);
  }
  return ingestGitHub(parseGitHubUrl(target), { token: process.env.GITHUB_TOKEN });
}

function normalizeMode(mode: unknown): BriefMode {
  return typeof mode === 'string' && MODES.includes(mode as BriefMode)
    ? (mode as BriefMode)
    : 'balanced';
}

const targetSchema = {
  type: 'object',
  properties: {
    target: {
      type: 'string',
      description: 'A GitHub URL, "owner/repo", or a local directory path.',
    },
    mode: {
      type: 'string',
      enum: MODES,
      description: 'Analysis depth (default: balanced).',
    },
  },
  required: ['target'],
} as const;

const server = new Server(
  { name: 'repobrief', version: '0.1.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'inspect_repo',
      description:
        'Orient in a repository: returns a Markdown brief with tech stack, run/build/test ' +
        'commands, entrypoints, a subsystem map, routes, circular dependencies, hotspots, ' +
        'and a "where to start" reading path. Use this before working in an unfamiliar repo.',
      inputSchema: targetSchema,
    },
    {
      name: 'repo_graph',
      description:
        'Return just the Mermaid architecture graph (subsystem dependencies) for a repository.',
      inputSchema: targetSchema,
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = request.params.arguments ?? {};
  const target = args.target;
  if (typeof target !== 'string' || target.trim() === '') {
    return {
      isError: true,
      content: [{ type: 'text', text: 'A "target" (URL or path) is required.' }],
    };
  }

  try {
    const brief = await analyzeSnapshot(await ingest(target), {
      mode: normalizeMode(args.mode),
    });
    const text =
      request.params.name === 'repo_graph'
        ? brief.architectureMermaid || 'No subsystems detected to graph.'
        : renderBriefMarkdown(brief);
    return { content: [{ type: 'text', text }] };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { isError: true, content: [{ type: 'text', text: `Error: ${message}` }] };
  }
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Stay alive on stdio until the client disconnects.
}

main().catch((err) => {
  process.stderr.write(`repobrief-mcp failed to start: ${String(err)}\n`);
  process.exit(1);
});
