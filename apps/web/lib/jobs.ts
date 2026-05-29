import { randomUUID } from 'node:crypto';
import type { BriefMode } from '@repobrief/core';
import { runGitHubBrief } from './analyze-service';
import { briefsRateLimiter } from './rate-limit';
import { createJob, updateJob, type StoredJob } from './store';

/**
 * In-process async job runner for repo analyses.
 *
 * POST /api/briefs creates a persisted job (queued) and enqueues it here; clients
 * poll the job status endpoint. Work runs in this Node process with bounded
 * concurrency — a good fit for the recommended single-instance deployment.
 *
 * Caveat: state (the queue) is in-memory, and serverless platforms may freeze or
 * kill the process after the HTTP response, so background work isn't guaranteed
 * there. A multi-replica or serverless deployment should move this to a durable
 * queue + worker. The persisted `jobs` table already models everything such a
 * worker would need; only the executor below would change.
 */

/** Thrown when the queue is saturated, so callers can return 429 promptly. */
export class JobQueueFullError extends Error {
  constructor() {
    super('Analysis queue is full.');
    this.name = 'JobQueueFullError';
  }
}

interface QueueItem {
  id: string;
  url: string;
  mode: BriefMode;
}

export interface JobRunnerDeps {
  /** Runs the actual analysis; returns the resulting brief's id. */
  run: (url: string, mode: BriefMode) => Promise<{ id: string }>;
  createJob: (job: StoredJob) => Promise<void>;
  updateJob: (id: string, patch: { status: StoredJob['status']; briefId?: string; error?: string; updatedAt: string }) => Promise<void>;
  /** Reserve a concurrency slot; false when at capacity. */
  acquire: () => boolean;
  /** Release a previously reserved slot. */
  release: () => void;
  /** Max jobs waiting in the queue before enqueue is rejected. */
  maxQueue: number;
  newId: () => string;
  now: () => string;
}

export interface JobRunner {
  /** Persist and enqueue a job; returns it in `queued` state. */
  enqueue(url: string, mode: BriefMode): Promise<StoredJob>;
  /** Resolves when the queue is drained and no jobs are in flight (for tests). */
  onIdle(): Promise<void>;
}

function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Analysis failed.';
}

/** Build a job runner over injectable dependencies (testable in isolation). */
export function createJobRunner(deps: JobRunnerDeps): JobRunner {
  const queue: QueueItem[] = [];
  let active = 0;
  let idleWaiters: Array<() => void> = [];

  function settleIdle(): void {
    if (active === 0 && queue.length === 0) {
      const waiters = idleWaiters;
      idleWaiters = [];
      waiters.forEach((w) => w());
    }
  }

  async function process(item: QueueItem): Promise<void> {
    await deps.updateJob(item.id, { status: 'running', updatedAt: deps.now() });
    try {
      const brief = await deps.run(item.url, item.mode);
      await deps.updateJob(item.id, {
        status: 'succeeded',
        briefId: brief.id,
        updatedAt: deps.now(),
      });
    } catch (err) {
      await deps.updateJob(item.id, {
        status: 'failed',
        error: errorMessage(err),
        updatedAt: deps.now(),
      });
    }
  }

  function drain(): void {
    while (queue.length > 0) {
      if (!deps.acquire()) break; // at the concurrency cap; resume on release
      const item = queue.shift()!;
      active++;
      void process(item).finally(() => {
        active--;
        deps.release();
        drain();
        settleIdle();
      });
    }
    settleIdle();
  }

  return {
    async enqueue(url, mode) {
      if (queue.length >= deps.maxQueue) throw new JobQueueFullError();
      const now = deps.now();
      const job: StoredJob = {
        id: deps.newId(),
        url,
        mode,
        status: 'queued',
        createdAt: now,
        updatedAt: now,
      };
      await deps.createJob(job);
      queue.push({ id: job.id, url, mode });
      drain();
      return job;
    },
    onIdle() {
      if (active === 0 && queue.length === 0) return Promise.resolve();
      return new Promise((resolve) => idleWaiters.push(resolve));
    },
  };
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Process-wide runner wired to the real store, analyzer, and concurrency cap. */
export const briefJobs: JobRunner = createJobRunner({
  run: runGitHubBrief,
  createJob,
  updateJob,
  acquire: () => briefsRateLimiter.acquire(),
  release: () => briefsRateLimiter.release(),
  maxQueue: intEnv('BRIEFS_MAX_QUEUE', 100),
  newId: () => randomUUID(),
  now: () => new Date().toISOString(),
});

/** Convenience wrapper used by the route. */
export function enqueueBrief(url: string, mode: BriefMode): Promise<StoredJob> {
  return briefJobs.enqueue(url, mode);
}
