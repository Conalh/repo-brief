import { loadBrief } from '@/lib/load-brief';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-neutral-500">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default async function OverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { report } = loadBrief(id);
  const { techStack, commands, entrypoints } = report;

  return (
    <div className="space-y-4">
      <p className="text-lg">{report.identity}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card title="Tech stack">
          <p className="text-sm">
            {techStack.languages.join(', ') || 'No source languages detected.'}
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {techStack.frameworks.map((f) => (
              <li key={f.name}>
                <span className="font-medium">{f.name}</span>{' '}
                <span className="text-neutral-500">({f.confidence})</span>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="How to run">
          {commands.dev || commands.build || commands.test ? (
            <ul className="space-y-1 font-mono text-sm">
              {commands.dev && <li>dev: {commands.dev}</li>}
              {commands.build && <li>build: {commands.build}</li>}
              {commands.test && <li>test: {commands.test}</li>}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">No commands detected.</p>
          )}
        </Card>

        <Card title="Entrypoints">
          {entrypoints.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {entrypoints.map((e) => (
                <li key={e.path}>
                  <span className="text-neutral-500">{e.kind}:</span>{' '}
                  <code>{e.path}</code>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-neutral-500">None detected.</p>
          )}
        </Card>

        <Card title="At a glance">
          <ul className="space-y-1 text-sm">
            <li>{report.fileCount} files</li>
            <li>{report.subsystems.length} subsystems</li>
            <li>{report.hotspots.length} hotspots flagged</li>
            <li>{report.readingPath.steps.length}-step reading path</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
