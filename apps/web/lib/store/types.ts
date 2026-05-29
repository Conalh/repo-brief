import type { BriefMode, BriefReport } from '@repobrief/core';

/** A persisted brief plus the identifying metadata used for caching/links. */
export interface StoredBrief {
  id: string;
  owner?: string;
  repo: string;
  source: string;
  headSha?: string;
  report: BriefReport;
  isDemo: boolean;
  createdAt: string;
}

/** Lifecycle of an async analysis job. */
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed';

/** A persisted analysis job — the unit POST /api/briefs creates and clients poll. */
export interface StoredJob {
  id: string;
  /** The requested repository reference. */
  url: string;
  mode: BriefMode;
  status: JobStatus;
  /** Set when the job succeeds: the id of the resulting brief. */
  briefId?: string;
  /** Set when the job fails: a human-readable message. */
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/** The mutable fields of a job, updated as it progresses. */
export interface JobUpdate {
  status: JobStatus;
  briefId?: string;
  error?: string;
  updatedAt: string;
}

/**
 * Persistence for completed briefs and async jobs. Implemented by a local SQLite
 * backend and a remote libSQL (Turso) backend; the factory in `../store.ts`
 * picks one by env. All methods are async so both backends share one interface.
 */
export interface Store {
  getBrief(id: string): Promise<StoredBrief | null>;
  listDemoBriefs(): Promise<StoredBrief[]>;
  /** Insert or replace a brief (idempotent on id, so re-runs refresh the cache). */
  putBrief(brief: StoredBrief): Promise<void>;
  createJob(job: StoredJob): Promise<void>;
  getJob(id: string): Promise<StoredJob | null>;
  updateJob(id: string, patch: JobUpdate): Promise<void>;
}

/** Column shape shared by both backends' `briefs` table. */
export interface BriefRow {
  id: string;
  owner: string | null;
  repo: string;
  source: string;
  head_sha: string | null;
  report_json: string;
  is_demo: number;
  created_at: string;
}

export function rowToBrief(row: BriefRow): StoredBrief {
  return {
    id: row.id,
    owner: row.owner ?? undefined,
    repo: row.repo,
    source: row.source,
    headSha: row.head_sha ?? undefined,
    report: JSON.parse(row.report_json) as BriefReport,
    isDemo: Number(row.is_demo) === 1,
    createdAt: row.created_at,
  };
}

export const CREATE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS briefs (
    id          TEXT PRIMARY KEY,
    owner       TEXT,
    repo        TEXT NOT NULL,
    source      TEXT NOT NULL,
    head_sha    TEXT,
    report_json TEXT NOT NULL,
    is_demo     INTEGER NOT NULL DEFAULT 0,
    created_at  TEXT NOT NULL
  );
`;

/** Column shape shared by both backends' `jobs` table. */
export interface JobRow {
  id: string;
  url: string;
  mode: string;
  status: string;
  brief_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

export function rowToJob(row: JobRow): StoredJob {
  return {
    id: row.id,
    url: row.url,
    mode: row.mode as BriefMode,
    status: row.status as JobStatus,
    briefId: row.brief_id ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const CREATE_JOBS_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS jobs (
    id          TEXT PRIMARY KEY,
    url         TEXT NOT NULL,
    mode        TEXT NOT NULL,
    status      TEXT NOT NULL,
    brief_id    TEXT,
    error       TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
  );
`;
