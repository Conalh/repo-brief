# Deploying the RepoBrief web app

The web app (`apps/web`) is a standard Next.js App Router app. It runs anywhere
Next.js does, but its persistence layer needs one decision up front.

## Persistence: two backends, chosen by env

The web store auto-selects its backend (`apps/web/lib/store.ts`):

- **Local SQLite** (default) via Node's built-in `node:sqlite`, at
  `REPOBRIEF_DB_PATH`. Zero-config; great for dev and **single-instance hosts**
  with a persistent disk (a VPS, a mounted volume, Fly.io, Render, Railway).
- **Remote libSQL / Turso** when `TURSO_DATABASE_URL` is set. This is what makes
  **serverless** (Vercel, Netlify) work — those have an ephemeral filesystem, so a
  local SQLite file would not persist between invocations.

Both implement the same `Store` interface (`getBrief` / `putBrief` /
`listDemoBriefs`); switching is purely a matter of which env vars are present.

### Setting up Turso

```bash
turso db create repobrief
turso db show repobrief --url           # -> TURSO_DATABASE_URL
turso db tokens create repobrief        # -> TURSO_AUTH_TOKEN
```

Set both as environment variables on your host. The schema is created
automatically on first use.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `GITHUB_TOKEN` | Raises the GitHub API rate limit (60 → 5000/hr). Strongly recommended for a public deployment. |
| `REPOBRIEF_DB_PATH` | Path to the local SQLite file (used when `TURSO_DATABASE_URL` is unset). |
| `TURSO_DATABASE_URL` | libSQL/Turso URL. When set, the app uses it instead of local SQLite. |
| `TURSO_AUTH_TOKEN` | Auth token for the Turso database. |
| `SEED_TOKEN` | Optional. If set, `POST /api/demo/seed` requires a matching `x-seed-token` header. |

## Async analysis jobs

`POST /api/briefs` is asynchronous: it validates the URL, enqueues a job, and
returns `202 { jobId }`. The work runs in a background job runner (bounded
concurrency `BRIEFS_MAX_CONCURRENT`, queue cap `BRIEFS_MAX_QUEUE`), and clients
poll `GET /api/briefs/jobs/:jobId` until `status` is `succeeded` (with `briefId`)
or `failed` (with `error`). Job state is persisted in the `jobs` table of the
configured store.

The runner is **in-process**: the queue lives in memory and the analysis runs in
the same Node process. This fits the single-instance deploy below. Two caveats:

- **Serverless** (Vercel/Netlify) may freeze or kill the process after the HTTP
  response, so background work can be cut short — and an in-memory queue isn't
  shared across replicas. For serverless or multi-replica setups, move execution
  to a durable queue + worker. The persisted `jobs` table already models what
  such a worker needs; only the executor (`apps/web/lib/jobs.ts`) would change.
- A process restart abandons in-memory queued/in-flight jobs (their rows remain
  in their last state); re-submit to retry.

## Single-instance deploy (recommended for now)

```bash
pnpm install --frozen-lockfile
pnpm --filter @repobrief/core build      # engine must be built first
pnpm --filter @repobrief/web build
REPOBRIEF_DB_PATH=/data/repobrief.sqlite pnpm --filter @repobrief/web start
```

Seed demo briefs once after first boot by hitting the seed endpoint:

```bash
curl -X POST https://your-host/api/demo/seed   # add -H "x-seed-token: ..." if SEED_TOKEN is set
```

## Vercel

`vercel.json` points the build at the web app. For Vercel, **set
`TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`** so the app uses Turso instead of the
ephemeral filesystem — otherwise briefs won't persist between requests. Then seed
the demos with the curl above against your deployed URL.
