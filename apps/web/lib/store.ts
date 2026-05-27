import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
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

interface Row {
  id: string;
  owner: string | null;
  repo: string;
  source: string;
  head_sha: string | null;
  report_json: string;
  is_demo: number;
  created_at: string;
}

let db: DatabaseSync | null = null;

/** Lazily open (and migrate) the SQLite database. Singleton per process. */
function getDb(): DatabaseSync {
  if (db) return db;
  const path = process.env.REPOBRIEF_DB_PATH ?? '.data/repobrief.sqlite';
  mkdirSync(dirname(path), { recursive: true });
  db = new DatabaseSync(path);
  db.exec(`
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
  `);
  return db;
}

function rowToBrief(row: Row): StoredBrief {
  return {
    id: row.id,
    owner: row.owner ?? undefined,
    repo: row.repo,
    source: row.source,
    headSha: row.head_sha ?? undefined,
    report: JSON.parse(row.report_json) as BriefReport,
    isDemo: row.is_demo === 1,
    createdAt: row.created_at,
  };
}

export function getBrief(id: string): StoredBrief | null {
  const row = getDb().prepare('SELECT * FROM briefs WHERE id = ?').get(id) as
    | unknown
    | undefined;
  return row ? rowToBrief(row as Row) : null;
}

export function listDemoBriefs(): StoredBrief[] {
  const rows = getDb()
    .prepare('SELECT * FROM briefs WHERE is_demo = 1 ORDER BY repo')
    .all() as unknown as Row[];
  return rows.map(rowToBrief);
}

/** Insert or replace a brief (idempotent on id, so re-runs refresh the cache). */
export function putBrief(brief: StoredBrief): void {
  getDb()
    .prepare(
      `INSERT OR REPLACE INTO briefs
         (id, owner, repo, source, head_sha, report_json, is_demo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      brief.id,
      brief.owner ?? null,
      brief.repo,
      brief.source,
      brief.headSha ?? null,
      JSON.stringify(brief.report),
      brief.isDemo ? 1 : 0,
      brief.createdAt,
    );
}
