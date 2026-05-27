/** Public surface of the RepoBrief analysis engine. */
export * from './types.js';
export { parseGitHubUrl, RepoUrlParseError } from './ingest/parse-url.js';
export { ingestGitHub, GitHubIngestError } from './ingest/github.js';
export type { GitHubIngestOptions } from './ingest/github.js';
export { ingestLocal } from './ingest/local.js';
export type { LocalIngestOptions } from './ingest/local.js';
export { classifyFileKind, extensionOf } from './classify/file-kind.js';
export { assembleBrief, renderBriefMarkdown } from './report/brief.js';
