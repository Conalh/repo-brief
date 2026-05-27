import { loadBrief } from '@/lib/load-brief';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function StartPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { report } = await loadBrief(id);
  const { steps, skip } = report.readingPath;

  if (steps.length === 0) {
    return <p className="text-sm text-neutral-500">No reading path available.</p>;
  }

  return (
    <div className="space-y-6">
      <ol className="space-y-3">
        {steps.map((step, i) => (
          <li key={step.path} className="flex gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-medium text-white">
              {i + 1}
            </span>
            <div>
              <code className="break-all font-medium">{step.path}</code>
              <p className="text-sm text-neutral-500">{step.reason}</p>
            </div>
          </li>
        ))}
      </ol>

      {skip.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Safe to skip ({skip.length})
          </h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {skip.map((path) => (
              <li
                key={path}
                className="rounded bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 dark:bg-neutral-900"
              >
                {path}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
