import { loadBrief } from '@/lib/load-brief';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function ArchitecturePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { report } = loadBrief(id);

  if (report.subsystems.length === 0) {
    return <p className="text-sm text-neutral-500">No subsystems detected.</p>;
  }

  return (
    <div className="space-y-6">
      <ul className="grid gap-3 sm:grid-cols-2">
        {report.subsystems.map((s) => (
          <li
            key={s.pathPrefix}
            className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
          >
            <div className="flex items-baseline justify-between">
              <code className="font-medium">{s.name}</code>
              <span className="text-xs text-neutral-500">{s.fileCount} files</span>
            </div>
            {s.dependsOn.length > 0 && (
              <p className="mt-1 text-sm text-neutral-500">
                → {s.dependsOn.join(', ')}
              </p>
            )}
          </li>
        ))}
      </ul>

      {report.architectureMermaid && (
        <details className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <summary className="cursor-pointer text-sm font-medium">
            Mermaid graph source
          </summary>
          <pre className="mt-2 overflow-x-auto rounded bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
            <code>{report.architectureMermaid}</code>
          </pre>
        </details>
      )}
    </div>
  );
}
