import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import './globals.css';

export const metadata: Metadata = {
  title: 'RepoBrief',
  description:
    'Turn any public GitHub repo into an architecture map, hotspot list, and onboarding path.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-neutral-200 dark:border-neutral-800">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
            <a href="/" className="text-lg font-semibold tracking-tight">
              Repo<span className="text-blue-600">Brief</span>
            </a>
            <span className="text-sm text-neutral-500">orientation, not review</span>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
