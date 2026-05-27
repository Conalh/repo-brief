import { notFound } from 'next/navigation';
import { getBrief, type StoredBrief } from './store';

/** Load a stored brief or trigger the Next 404 page. */
export async function loadBrief(id: string): Promise<StoredBrief> {
  const brief = await getBrief(id);
  if (!brief) notFound();
  return brief;
}

/** Display title for a brief (owner/repo, or just repo for local sources). */
export function briefTitle(brief: StoredBrief): string {
  return brief.owner ? `${brief.owner}/${brief.repo}` : brief.repo;
}
