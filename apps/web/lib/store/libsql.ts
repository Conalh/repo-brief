import {
  CREATE_TABLE_SQL,
  rowToBrief,
  type BriefRow,
  type Store,
  type StoredBrief,
} from './types';

/**
 * Remote libSQL (Turso) store for serverless deploys. The client is imported
 * dynamically so local development never loads it. Table creation runs once,
 * lazily, on first use.
 */
export function createLibsqlStore(url: string, authToken?: string): Store {
  // Imported lazily to keep it out of the local-dev (SQLite) code path.
  const clientPromise = import('@libsql/client').then(({ createClient }) =>
    createClient({ url, authToken }),
  );

  let ready: Promise<void> | null = null;
  async function client() {
    const c = await clientPromise;
    ready ??= c.execute(CREATE_TABLE_SQL).then(() => undefined);
    await ready;
    return c;
  }

  return {
    async getBrief(id) {
      const c = await client();
      const rs = await c.execute({
        sql: 'SELECT * FROM briefs WHERE id = ?',
        args: [id],
      });
      const row = rs.rows[0];
      return row ? rowToBrief(row as unknown as BriefRow) : null;
    },
    async listDemoBriefs() {
      const c = await client();
      const rs = await c.execute('SELECT * FROM briefs WHERE is_demo = 1 ORDER BY repo');
      return rs.rows.map((row) => rowToBrief(row as unknown as BriefRow));
    },
    async putBrief(brief: StoredBrief) {
      const c = await client();
      await c.execute({
        sql: `INSERT OR REPLACE INTO briefs
                (id, owner, repo, source, head_sha, report_json, is_demo, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          brief.id,
          brief.owner ?? null,
          brief.repo,
          brief.source,
          brief.headSha ?? null,
          JSON.stringify(brief.report),
          brief.isDemo ? 1 : 0,
          brief.createdAt,
        ],
      });
    },
  };
}
