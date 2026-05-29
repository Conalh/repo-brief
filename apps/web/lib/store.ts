import { createSqliteStore } from './store/sqlite';
import { createLibsqlStore } from './store/libsql';
import type { JobUpdate, Store, StoredBrief, StoredJob } from './store/types';

export type { StoredBrief, StoredJob, JobStatus, JobUpdate } from './store/types';

/**
 * Choose the persistence backend by environment:
 *   - TURSO_DATABASE_URL set  -> remote libSQL (Turso), for serverless deploys.
 *   - otherwise               -> local SQLite at REPOBRIEF_DB_PATH (zero-config).
 * Singleton per process.
 */
let store: Store | null = null;
function getStore(): Store {
  if (store) return store;
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  store = tursoUrl
    ? createLibsqlStore(tursoUrl, process.env.TURSO_AUTH_TOKEN)
    : createSqliteStore(process.env.REPOBRIEF_DB_PATH ?? '.data/repobrief.sqlite');
  return store;
}

export function getBrief(id: string): Promise<StoredBrief | null> {
  return getStore().getBrief(id);
}

export function listDemoBriefs(): Promise<StoredBrief[]> {
  return getStore().listDemoBriefs();
}

export function putBrief(brief: StoredBrief): Promise<void> {
  return getStore().putBrief(brief);
}

export function createJob(job: StoredJob): Promise<void> {
  return getStore().createJob(job);
}

export function getJob(id: string): Promise<StoredJob | null> {
  return getStore().getJob(id);
}

export function updateJob(id: string, patch: JobUpdate): Promise<void> {
  return getStore().updateJob(id, patch);
}
