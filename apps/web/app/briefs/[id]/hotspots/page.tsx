import { loadBrief } from '@/lib/load-brief';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function HotspotsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { report } = await loadBrief(id);

  if (report.hotspots.length === 0) {
    return <p className="text-sm text-neutral-500">No hotspots flagged.</p>;
  }

  return (
    <ul className="space-y-3">
      {report.hotspots.map((h) => (
        <li
          key={h.path}
          className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800"
        >
          <div className="flex items-baseline justify-between gap-3">
            <code className="break-all font-medium">{h.path}</code>
            <span className="shrink-0 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              score {h.score}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-500">{h.reasons.join(' · ')}</p>
          <p className="mt-1 text-sm">{h.recommendation}</p>
        </li>
      ))}
    </ul>
  );
}
