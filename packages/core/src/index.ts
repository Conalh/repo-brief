/** Public surface of the RepoBrief analysis engine. */
export * from './types.js';
export { parseGitHubUrl, RepoUrlParseError } from './ingest/parse-url.js';
export { ingestGitHub, GitHubIngestError } from './ingest/github.js';
export type { GitHubIngestOptions } from './ingest/github.js';
export { ingestLocal } from './ingest/local.js';
export type { LocalIngestOptions } from './ingest/local.js';
export { classifyFileKind, extensionOf } from './classify/file-kind.js';
export { detectLanguages } from './classify/language.js';
export { detectFrameworks, detectTechStack } from './classify/framework.js';
export {
  collectManifests,
  parseNpmManifest,
  parsePyproject,
  parseRequirementsTxt,
  parseCargoToml,
  parseGithubWorkflow,
} from './analyze/manifests/index.js';
export { detectCommands, detectEntrypoints } from './analyze/entrypoints.js';
export { analyzeSnapshot } from './analyze/pipeline.js';
export { assembleBrief, renderBriefMarkdown } from './report/brief.js';
export type { BriefAnalysis } from './report/brief.js';
