# Deploying the RepoBrief web app

The web app (`apps/web`) is a standard Next.js App Router app. It runs anywhere
Next.js does, but its persistence layer needs one decision up front.

## The persistence caveat (read this first)

The app stores completed briefs in **SQLite** via Node's built-in `node:sqlite`,
written to the path in `REPOBRIEF_DB_PATH` (default `.data/repobrief.sqlite`).

This is perfect for **local development and single-instance hosts** (a VPS, a
container with a mounted volume, Fly.io, Render, Railway). It does **not** work
on ephemeral serverless filesystems:

- **Vercel / Netlify functions** have a read-only filesystem except `/tmp`, and
  `/tmp` is not shared between invocations. A SQLite file there won't persist, so
  cached briefs and demo briefs would vanish between requests.

You have two paths:

1. **Single-instance host with a persistent disk** — deploy as-is, point
   `REPOBRIEF_DB_PATH` at the mounted volume. Simplest; matches today's code.
2. **Serverless (Vercel)** — swap the store for a hosted Postgres (Neon, Supabase)
   or a serverless SQLite (Turso/libSQL). Only `apps/web/lib/store.ts` needs to
   change; it already isolates all SQL behind `getBrief` / `putBrief` /
   `listDemoBriefs`, so this is a contained swap.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | Raises the GitHub API rate limit (60 → 5000/hr). Strongly recommended for a public deployment. |
| `REPOBRIEF_DB_PATH` | Path to the SQLite file. Point at a persistent volume in production. |

## Single-instance deploy (recommended for now)

```bash
pnpm install --frozen-lockfile
pnpm --filter @repobrief/core build      # engine must be built first
pnpm --filter @repobrief/web build
REPOBRIEF_DB_PATH=/data/repobrief.sqlite pnpm --filter @repobrief/web start
```

Seed demo briefs once after first boot:

```bash
cd apps/web
GITHUB_TOKEN=... REPOBRIEF_DB_PATH=/data/repobrief.sqlite \
  node --experimental-strip-types scripts/seed-demos.ts
```

## Vercel

`vercel.json` is provided and points the build at the web app. Before relying on
it in production, switch the store to a hosted database (see option 2 above) —
otherwise briefs will not persist across requests.
