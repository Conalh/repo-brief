import { RepoInput } from '@/components/repo-input';
import { listDemoBriefs } from '@/lib/store';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const demos = await listDemoBriefs();

  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          Understand any repo in a minute.
        </h1>
        <p className="max-w-2xl text-neutral-600 dark:text-neutral-400">
          Paste a public GitHub URL. RepoBrief maps the architecture, finds the
          files that matter, flags what looks risky, and tells you what to read
          first — an orientation layer, not a code review.
        </p>
        <RepoInput />
      </section>

      {demos.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Demo briefs
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {demos.map((d) => (
              <li key={d.id}>
                <a
                  href={`/briefs/${d.id}`}
                  className="block rounded-lg border border-neutral-200 p-4 hover:border-blue-400 dark:border-neutral-800"
                >
                  <div className="font-medium">
                    {d.owner ? `${d.owner}/${d.repo}` : d.repo}
                  </div>
                  <div className="mt-1 line-clamp-2 text-sm text-neutral-500">
                    {d.report.identity}
                  </div>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
