import {
  CREATE_JOBS_TABLE_SQL,
  CREATE_TABLE_SQL,
  rowToBrief,
  rowToJob,
  type BriefRow,
  type JobRow,
  type JobUpdate,
  type Store,
  type StoredBrief,
  type StoredJob,
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
    ready ??= c
      .execute(CREATE_TABLE_SQL)
      .then(() => c.execute(CREATE_JOBS_TABLE_SQL))
      .then(() => undefined);
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
    async createJob(job: StoredJob) {
      const c = await client();
      await c.execute({
        sql: `INSERT INTO jobs (id, url, mode, status, brief_id, error, created_at, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          job.id,
          job.url,
          job.mode,
          job.status,
          job.briefId ?? null,
          job.error ?? null,
          job.createdAt,
          job.updatedAt,
        ],
      });
    },
    async getJob(id) {
      const c = await client();
      const rs = await c.execute({ sql: 'SELECT * FROM jobs WHERE id = ?', args: [id] });
      const row = rs.rows[0];
      return row ? rowToJob(row as unknown as JobRow) : null;
    },
    async updateJob(id: string, patch: JobUpdate) {
      const c = await client();
      await c.execute({
        sql: `UPDATE jobs SET status = ?, brief_id = ?, error = ?, updated_at = ? WHERE id = ?`,
        args: [patch.status, patch.briefId ?? null, patch.error ?? null, patch.updatedAt, id],
      });
    },
  };
}
