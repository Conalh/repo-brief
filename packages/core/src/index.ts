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
export { buildSubsystems, subsystemKeyFor } from './analyze/subsystems.js';
export { detectHotspots } from './analyze/hotspots.js';
export { buildReadingPath } from './analyze/reading-path.js';
export type { ReadingPathInput } from './analyze/reading-path.js';
export {
  buildImportGraph,
  computeDegrees,
  extractJsImports,
  resolveJsImport,
  buildAliasResolver,
  extractPyImports,
  resolvePyImport,
} from './graph/index.js';
export type { ImportGraphOptions, ImportGraphResult, Degree } from './graph/index.js';
export { renderSubsystemMermaid } from './report/mermaid.js';
export { analyzeSnapshot } from './analyze/pipeline.js';
export type { AnalyzeOptions } from './analyze/pipeline.js';
export { assembleBrief, renderBriefMarkdown } from './report/brief.js';
export type { BriefAnalysis } from './report/brief.js';
