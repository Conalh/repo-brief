'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

interface JobStatusResponse {
  status?: 'queued' | 'running' | 'succeeded' | 'failed';
  briefId?: string;
  error?: string;
}

const POLL_INTERVAL_MS = 1200;
const MAX_POLLS = 120; // ~2.5 minutes at the interval above

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Repo URL input. POSTs to /api/briefs (which enqueues an async job), then polls
 * the job status until the brief is ready and routes to it.
 */
export function RepoInput() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState<JobStatusResponse['status'] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pollUntilDone(jobId: string): Promise<void> {
    for (let i = 0; i < MAX_POLLS; i++) {
      await sleep(POLL_INTERVAL_MS);
      const res = await fetch(`/api/briefs/jobs/${jobId}`);
      const data = (await res.json()) as JobStatusResponse;
      if (!res.ok) {
        setError(data.error ?? 'Lost track of the analysis job.');
        return;
      }
      setStatus(data.status ?? null);
      if (data.status === 'succeeded' && data.briefId) {
        router.push(`/briefs/${data.briefId}`);
        return;
      }
      if (data.status === 'failed') {
        setError(data.error ?? 'Analysis failed.');
        return;
      }
    }
    setError('Analysis is taking longer than expected — please try again.');
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setStatus(null);
    try {
      const res = await fetch('/api/briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as { jobId?: string; error?: string };
      if (!res.ok || !data.jobId) {
        setError(data.error ?? 'Something went wrong.');
        return;
      }
      setStatus('queued');
      await pollUntilDone(data.jobId);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setPending(false);
    }
  }

  const statusLabel =
    status === 'running'
      ? 'Analyzing repository…'
      : status === 'queued'
        ? 'Queued — waiting for a slot…'
        : 'Analyzing…';

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          aria-label="GitHub repository URL"
          className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none dark:border-neutral-700 dark:bg-neutral-900"
        />
        <button
          type="submit"
          disabled={pending || url.trim() === ''}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {pending ? statusLabel : 'Brief it'}
        </button>
      </div>
      {pending && (
        <p className="text-sm text-neutral-500" role="status" aria-live="polite">
          {statusLabel} This can take up to a minute for larger repos.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
