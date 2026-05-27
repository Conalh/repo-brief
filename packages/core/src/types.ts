/**
 * Core domain types shared by every analysis stage and both surfaces (web + CLI).
 * These mirror the data model in PLAN.md but only include the fields the
 * walking-skeleton (Milestone 1) actually produces. Later milestones extend them.
 */

export type SourceType = 'github_url' | 'local_path';

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
  kind: FileKind;
}

/** The raw ingested snapshot before deep analysis. */
export interface RepoSnapshot {
  input: RepositoryInput;
  /** Resolved commit SHA when the source provides one. */
  headSha?: string;
  files: FileNode[];
  /** True when the source tree was truncated by the provider (GitHub trees API). */
  truncated: boolean;
}

/** The minimal Milestone-1 brief. Later milestones add subsystems, hotspots, etc. */
export interface BriefReport {
  identity: string;
  fileCount: number;
  /** File counts grouped by kind, for a quick at-a-glance summary. */
  kindBreakdown: Record<FileKind, number>;
  /** True if the underlying snapshot was partial. */
  partial: boolean;
  generatedAt: string;
}
