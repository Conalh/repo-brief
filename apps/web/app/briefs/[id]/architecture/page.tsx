import { MermaidGraph } from '@/components/mermaid-graph';
import { loadBrief } from '@/lib/load-brief';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ArchitecturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { report } = await loadBrief(id);
  // Tolerate briefs persisted by an older analyzer that predates these fields.
  const subsystems = report.subsystems ?? [];
  const cycles = report.cycles ?? [];
  const routes = report.routes ?? [];

  return (
    <div className="space-y-8">
      {report.architectureMermaid && (
        <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
          <MermaidGraph chart={report.architectureMermaid} />
        </section>
      )}

      {subsystems.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Subsystems
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2">
            {subsystems.map((s) => (
              <li
                key={s.pathPrefix}
                className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
              >
                <div className="flex items-baseline justify-between">
                  <code className="font-medium">{s.name}</code>
                  <span className="text-xs text-neutral-500">{s.fileCount} files</span>
                </div>
                {s.dependsOn.length > 0 && (
                  <p className="mt-1 text-sm text-neutral-500">→ {s.dependsOn.join(', ')}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {cycles.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-amber-600">
            Circular dependencies ({cycles.length})
          </h2>
          <ul className="space-y-1 text-sm">
            {cycles.slice(0, 10).map((cycle) => (
              <li key={cycle.join('|')} className="font-mono text-xs">
                {cycle.join(' → ')} → …
              </li>
            ))}
          </ul>
        </section>
      )}

      {routes.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500">
            Routes ({routes.length})
          </h2>
          <ul className="divide-y divide-neutral-200 text-sm dark:divide-neutral-800">
            {routes.slice(0, 60).map((r) => (
              <li key={`${r.method}-${r.path}-${r.handlerPath}`} className="flex gap-3 py-1.5">
                {r.method && (
                  <span className="w-14 shrink-0 font-mono text-xs text-blue-600">
                    {r.method}
                  </span>
                )}
                <code className="shrink-0 font-medium">{r.path}</code>
                <span className="truncate text-neutral-500">{r.handlerPath}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {subsystems.length === 0 && routes.length === 0 && (
        <p className="text-sm text-neutral-500">No architecture data detected.</p>
      )}
    </div>
  );
}
