'use client';

import { usePathname } from 'next/navigation';

const TABS = [
  { slug: '', label: 'Overview' },
  { slug: 'architecture', label: 'Architecture' },
  { slug: 'hotspots', label: 'Hotspots' },
  { slug: 'start', label: 'Where to start' },
];

/** Tab navigation across the brief sub-pages, with the active tab highlighted. */
export function BriefNav({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/briefs/${id}`;

  return (
    <nav className="flex flex-wrap gap-1 border-b border-neutral-200 dark:border-neutral-800">
      {TABS.map((tab) => {
        const href = tab.slug ? `${base}/${tab.slug}` : base;
        const active = pathname === href;
        return (
          <a
            key={tab.slug}
            href={href}
            className={
              'border-b-2 px-3 py-2 text-sm ' +
              (active
                ? 'border-blue-600 font-medium text-blue-600'
                : 'border-transparent text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100')
            }
          >
            {tab.label}
          </a>
        );
      })}
    </nav>
  );
}
