'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

/** Repo URL input. POSTs to /api/briefs then routes to the brief on success. */
export function RepoInput() {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const res = await fetch('/api/briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) {
        setError(data.error ?? 'Something went wrong.');
        return;
      }
      router.push(`/briefs/${data.id}`);
    } catch {
      setError('Network error — please try again.');
    } finally {
      setPending(false);
    }
  }

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
          {pending ? 'Analyzing…' : 'Brief it'}
        </button>
      </div>
      {pending && (
        <p className="text-sm text-neutral-500">
          Fetching and analyzing — this can take up to a minute for larger repos.
        </p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
