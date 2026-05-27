'use client';

import { useEffect, useId, useRef, useState } from 'react';

/**
 * Renders Mermaid source to SVG on the client. Mermaid is imported dynamically
 * so it stays out of the server bundle. Falls back to showing the source in a
 * code block if rendering fails.
 */
export function MermaidGraph({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  // Mermaid needs a DOM-id-safe identifier.
  const id = 'm' + useId().replace(/[^a-zA-Z0-9]/g, '');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const mermaid = (await import('mermaid')).default;
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' });
        const { svg } = await mermaid.render(id, chart);
        if (!cancelled && ref.current) ref.current.innerHTML = svg;
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [chart, id]);

  if (failed) {
    return (
      <pre className="overflow-x-auto rounded bg-neutral-100 p-3 text-xs dark:bg-neutral-900">
        <code>{chart}</code>
      </pre>
    );
  }

  return <div ref={ref} className="overflow-x-auto" aria-label="Architecture diagram" />;
}
