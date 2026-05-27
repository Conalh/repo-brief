import type { BriefReport } from '@repobrief/core';

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

/**
 * Persistence for completed briefs. Implemented by a local SQLite backend and a
 * remote libSQL (Turso) backend; the factory in `../store.ts` picks one by env.
 * All methods are async so both backends share one interface.
 */
export interface Store {
  getBrief(id: string): Promise<StoredBrief | null>;
  listDemoBriefs(): Promise<StoredBrief[]>;
  /** Insert or replace a brief (idempotent on id, so re-runs refresh the cache). */
  putBrief(brief: StoredBrief): Promise<void>;
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
