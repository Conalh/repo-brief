import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname } from 'node:path';
import type { DatabaseSync as DatabaseSyncCtor } from 'node:sqlite';
import {
  CREATE_TABLE_SQL,
  rowToBrief,
  type BriefRow,
  type Store,
  type StoredBrief,
} from './types';

// node:sqlite is a recent (experimental) Node builtin that bundlers don't yet
// recognize. Load it via createRequire so it resolves natively at runtime
// instead of being transformed by Vite/Next. The type-only import is erased.
const nodeRequire = createRequire(import.meta.url);

/** Local, zero-config SQLite store backed by Node's built-in `node:sqlite`. */
export function createSqliteStore(path: string): Store {
  const { DatabaseSync } = nodeRequire('node:sqlite') as {
    DatabaseSync: typeof DatabaseSyncCtor;
  };
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(CREATE_TABLE_SQL);

  return {
    async getBrief(id) {
      const row = db.prepare('SELECT * FROM briefs WHERE id = ?').get(id) as unknown;
      return row ? rowToBrief(row as BriefRow) : null;
    },
    async listDemoBriefs() {
      const rows = db
        .prepare('SELECT * FROM briefs WHERE is_demo = 1 ORDER BY repo')
        .all() as unknown as BriefRow[];
      return rows.map(rowToBrief);
    },
    async putBrief(brief: StoredBrief) {
      db.prepare(
        `INSERT OR REPLACE INTO briefs
           (id, owner, repo, source, head_sha, report_json, is_demo, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        brief.id,
        brief.owner ?? null,
        brief.repo,
        brief.source,
        brief.headSha ?? null,
        JSON.stringify(brief.report),
        brief.isDemo ? 1 : 0,
        brief.createdAt,
      );
    },
  };
}
