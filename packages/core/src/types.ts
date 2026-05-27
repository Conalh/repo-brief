/**
 * Core domain types shared by every analysis stage and both surfaces (web + CLI).
 * These mirror the data model in PLAN.md but only include the fields the
 * walking-skeleton (Milestone 1) actually produces. Later milestones extend them.
 */

export type SourceType = 'github_url' | 'local_path';

/**
 * Analysis depth:
 *  - fast: metadata, tree, manifests, entrypoints (no import graph).
 *  - balanced: fast + import graph, subsystems, hotspots, reading path.
 *  - deep: balanced with higher file caps (churn is a future addition).
 */
export type BriefMode = 'fast' | 'balanced' | 'deep';

/** A parsed, normalized repository reference. */
export interface RepositoryInput {
  sourceType: SourceType;
  /** Owner login for GitHub sources; undefined for local paths. */
  owner?: string;
  /** Repo name for GitHub sources; the directory name for local paths. */
  repo: string;
  /** Original URL for GitHub sources. */
  url?: string;
  /** Branch/ref, when specified or resolved. */
  branch?: string;
  /** Absolute filesystem path for local sources. */
  localPath?: string;
}

export type FileKind =
  | 'source'
  | 'test'
  | 'docs'
  | 'config'
  | 'workflow'
  | 'asset'
  | 'generated'
  | 'unknown';

/** A single normalized file in the repository snapshot. */
export interface FileNode {
  /** Repo-relative POSIX path, e.g. "src/index.ts". */
  path: string;
  /** Lowercased extension without the dot, e.g. "ts". Empty string if none. */
  extension: string;
  /** Size in bytes when known. */
  sizeBytes?: number;
  /** Line count, filled when the file's content is read (graph pass). */
  lineCount?: number;
  kind: FileKind;
}

/**
 * Lazily reads the text content of a single repo-relative file path.
 * Returns null when the file is missing or cannot be read as text.
 * Each ingest source provides an implementation (GitHub raw API / local fs).
 */
export interface FileContentReader {
  read(path: string): Promise<string | null>;
}

/**
 * Provides recent change frequency (churn) per file from commit history.
 * Used only in deep mode. Implementations return an empty map when history is
 * unavailable (e.g. a non-git local dir, or a rate-limited API).
 */
export interface ChurnProvider {
  /** Map of repo-relative path -> number of recent commits that touched it. */
  recentChanges(commitLimit: number): Promise<Map<string, number>>;
}

/** The raw ingested snapshot before deep analysis. */
export interface RepoSnapshot {
  input: RepositoryInput;
  /** Resolved commit SHA when the source provides one. */
  headSha?: string;
  files: FileNode[];
  /** True when the source tree was truncated by the provider (GitHub trees API). */
  truncated: boolean;
  /** Reads file contents on demand; used by manifest/framework detectors. */
  reader: FileContentReader;
  /** Recent-change frequency source for deep mode; absent when unavailable. */
  churn?: ChurnProvider;
}

export type PackageManager = 'npm' | 'python' | 'rust' | 'github_actions';

/** A parsed dependency/build manifest. */
export interface Manifest {
  path: string;
  manager: PackageManager;
  /** Named runnable scripts, e.g. npm scripts or workflow jobs. */
  scripts: Record<string, string>;
  /** Dependency names (not versions) declared by the manifest. */
  dependencies: string[];
  /** Runtime hint when declared, e.g. "node >=20", "python 3.12". */
  runtime?: string;
}

export type Confidence = 'high' | 'medium' | 'low';

/** A detected framework with the evidence that supports it. */
export interface Framework {
  name: string;
  confidence: Confidence;
  evidence: string[];
}

/** Aggregate technology summary for a repository. */
export interface TechStack {
  /** Most prevalent source language by file count, if any. */
  primaryLanguage?: string;
  /** All detected languages, most prevalent first. */
  languages: string[];
  frameworks: Framework[];
  packageManagers: PackageManager[];
}

/** Resolved run/build/test commands, when detectable. */
export interface Commands {
  dev?: string;
  build?: string;
  test?: string;
}

export type ImportKind = 'static' | 'dynamic' | 'type_only';

/** A resolved edge between two in-repo files (importer -> imported). */
export interface ImportEdge {
  from: string;
  to: string;
  kind: ImportKind;
  /** How sure we are the edge resolved correctly. */
  confidence: Confidence;
}

/** A cohesive group of files (e.g. a top-level folder) and its dependencies. */
export interface Subsystem {
  name: string;
  /** Repo-relative path prefix that owns this subsystem, e.g. "src/ingest". */
  pathPrefix: string;
  fileCount: number;
  /** Names of other subsystems this one imports from. */
  dependsOn: string[];
  confidence: Confidence;
}

/** A file flagged as worth attention, with the signals that flagged it. */
export interface Hotspot {
  path: string;
  score: number;
  reasons: string[];
  recommendation: string;
}

/** One step in the onboarding reading path. */
export interface ReadingStep {
  path: string;
  reason: string;
}

/** An ordered "read these first" path plus files safe to skip. */
export interface ReadingPath {
  steps: ReadingStep[];
  skip: string[];
}

export type EntrypointKind = 'app' | 'api' | 'cli' | 'test' | 'build';

/** A notable entry file with the reason it was flagged. */
export interface Entrypoint {
  kind: EntrypointKind;
  path: string;
  evidence: string;
}

/** The brief. Grows by milestone; later add subsystems, hotspots, reading path. */
export interface BriefReport {
  identity: string;
  /** Depth the brief was produced at. */
  mode: BriefMode;
  fileCount: number;
  /** File counts grouped by kind, for a quick at-a-glance summary. */
  kindBreakdown: Record<FileKind, number>;
  /** Detected technologies (Milestone 2). */
  techStack: TechStack;
  /** Resolved run/build/test commands (Milestone 2). */
  commands: Commands;
  /** Notable entry files (Milestone 2). */
  entrypoints: Entrypoint[];
  /** Parsed manifests backing the tech/command detection (Milestone 2). */
  manifests: Manifest[];
  /** Subsystem map derived from folders + import graph (Milestone 3). */
  subsystems: Subsystem[];
  /** Mermaid source for the subsystem dependency graph (Milestone 3). */
  architectureMermaid: string;
  /** Circular import groups (each a set of files that import each other). */
  cycles: string[][];
  /** Files worth attention, highest score first (Milestone 4). */
  hotspots: Hotspot[];
  /** Ordered onboarding reading path (Milestone 4). */
  readingPath: ReadingPath;
  /** True if the underlying snapshot was partial. */
  partial: boolean;
  generatedAt: string;
}
