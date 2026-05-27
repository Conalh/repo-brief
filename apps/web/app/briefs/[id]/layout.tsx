import type { ReactNode } from 'react';
import { BriefNav } from '@/components/brief-nav';
import { briefTitle, loadBrief } from '@/lib/load-brief';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export default async function BriefLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const brief = loadBrief(id);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{briefTitle(brief)}</h1>
          {brief.report.partial && (
            <span className="text-sm text-amber-600">
              ⚠ Partial brief — the source tree was truncated.
            </span>
          )}
        </div>
        <a
          href={`/api/briefs/${id}/export.md`}
          className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm hover:border-blue-400 dark:border-neutral-700"
        >
          Export Markdown
        </a>
      </div>
      <BriefNav id={id} />
      {children}
    </div>
  );
}
