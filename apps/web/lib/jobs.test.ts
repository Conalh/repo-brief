import { describe, expect, it, vi } from 'vitest';
import { createJobRunner, JobQueueFullError, type JobRunnerDeps } from './jobs';

/** A simple counting semaphore to stand in for the concurrency cap. */
function semaphore(max: number) {
  let active = 0;
  return {
    acquire: () => (active < max ? (active++, true) : false),
    release: () => {
      if (active > 0) active--;
    },
  };
}

/** Flush pending microtasks (a macrotask turn) so fire-and-forget work settles. */
const flush = () => new Promise((r) => setTimeout(r, 0));

function deps(over: Partial<JobRunnerDeps> = {}): JobRunnerDeps {
  let seq = 0;
  const sem = semaphore(4);
  return {
    run: vi.fn(async () => ({ id: 'brief-x' })),
    createJob: vi.fn(async () => {}),
    updateJob: vi.fn(async () => {}),
    acquire: sem.acquire,
    release: sem.release,
    maxQueue: 100,
    newId: () => `job-${++seq}`,
    now: () => '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

describe('createJobRunner', () => {
  it('drives a job queued -> running -> succeeded with the brief id', async () => {
    const d = deps();
    const runner = createJobRunner(d);

    const job = await runner.enqueue('https://github.com/octo/demo', 'balanced');
    expect(job.status).toBe('queued');
    expect(d.createJob).toHaveBeenCalledOnce();

    await runner.onIdle();

    expect(d.run).toHaveBeenCalledWith('https://github.com/octo/demo', 'balanced');
    expect(d.updateJob).toHaveBeenNthCalledWith(
      1,
      job.id,
      expect.objectContaining({ status: 'running' }),
    );
    expect(d.updateJob).toHaveBeenLastCalledWith(
      job.id,
      expect.objectContaining({ status: 'succeeded', briefId: 'brief-x' }),
    );
  });

  it('records a failure with the error message', async () => {
    const d = deps({
      run: vi.fn(async () => {
        throw new Error('Repository not found.');
      }),
    });
    const runner = createJobRunner(d);
    const job = await runner.enqueue('https://github.com/octo/missing', 'fast');
    await runner.onIdle();

    expect(d.updateJob).toHaveBeenLastCalledWith(
      job.id,
      expect.objectContaining({ status: 'failed', error: 'Repository not found.' }),
    );
  });

  it('falls back to a generic message for non-Error throws', async () => {
    const d = deps({
      run: vi.fn(async () => {
        throw 'kaboom';
      }),
    });
    const runner = createJobRunner(d);
    const job = await runner.enqueue('u', 'balanced');
    await runner.onIdle();
    expect(d.updateJob).toHaveBeenLastCalledWith(
      job.id,
      expect.objectContaining({ status: 'failed', error: 'Analysis failed.' }),
    );
  });

  it('rejects enqueue when the queue is full', async () => {
    // Never acquire, so nothing drains and items pile up in the queue.
    const d = deps({ acquire: () => false, release: () => {}, maxQueue: 1 });
    const runner = createJobRunner(d);

    await runner.enqueue('a', 'balanced'); // queued (length 1)
    await expect(runner.enqueue('b', 'balanced')).rejects.toBeInstanceOf(JobQueueFullError);
  });

  it('honors the concurrency cap, draining queued work as slots free', async () => {
    const order: string[] = [];
    const gates: Array<() => void> = [];
    const sem = semaphore(1); // cap = 1
    const d = deps({
      acquire: sem.acquire,
      release: sem.release,
      run: vi.fn((url: string) => {
        order.push(`start:${url}`);
        return new Promise<{ id: string }>((resolve) => {
          gates.push(() => {
            order.push(`end:${url}`);
            resolve({ id: `brief-${url}` });
          });
        });
      }),
    });
    const runner = createJobRunner(d);

    await runner.enqueue('a', 'balanced');
    await runner.enqueue('b', 'balanced');
    await flush();

    // Under a cap of 1, only "a" has started; "b" waits in the queue.
    expect(order).toEqual(['start:a']);

    gates[0]!(); // finish a -> frees the slot -> b starts
    await flush();
    expect(order).toEqual(['start:a', 'end:a', 'start:b']);

    gates[1]!(); // finish b
    await runner.onIdle();
    expect(order).toEqual(['start:a', 'end:a', 'start:b', 'end:b']);
  });
});
