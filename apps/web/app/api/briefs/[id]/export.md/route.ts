import { renderBriefMarkdown } from '@repobrief/core';
import { getBrief } from '@/lib/store';

export const runtime = 'nodejs';

/** GET /api/briefs/:id/export.md -> the brief as downloadable Markdown. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  const brief = getBrief(id);
  if (!brief) {
    return new Response('Brief not found.', { status: 404 });
  }
  return new Response(renderBriefMarkdown(brief.report), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `inline; filename="${id}.md"`,
    },
  });
}
