import { notFound } from 'next/navigation';
import { getBrief, type StoredBrief } from './store';

/** Load a stored brief or trigger the Next 404 page. */
export function loadBrief(id: string): StoredBrief {
  const brief = getBrief(id);
  if (!brief) notFound();
  return brief;
}

/** Display title for a brief (owner/repo, or just repo for local sources). */
export function briefTitle(brief: StoredBrief): string {
  return brief.owner ? `${brief.owner}/${brief.repo}` : brief.repo;
}
