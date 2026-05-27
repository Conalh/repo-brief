# RepoBrief

Turn any public GitHub repo into an architecture map, key-file guide, risk
summary, hotspot list, and a "where to start" onboarding path. RepoBrief
compresses the first confusing hour in an unfamiliar codebase into a trustworthy
briefing. It is an **orientation layer, not a code review**.

See [`PLAN.md`](./PLAN.md) for the full product spec and [`ROADMAP.md`](./ROADMAP.md)
for the milestone sequence taking it from plan to shipped product.

## Status

Early development. The analysis engine is feature-complete for V1: the CLI
ingests a GitHub URL or local path and prints a brief with the detected tech
stack (languages + frameworks), run/build/test commands, entrypoints, a
**subsystem architecture map** (Mermaid graph), a ranked **hotspot list**, and a
**"where to start" reading path** — backed by npm/Python/Rust/GitHub Actions
manifest parsing and a JS/TS + Python import graph, with **fast/balanced/deep**
depth modes. The web app is live (see below). Remaining before launch: deploy
and portfolio polish (Milestone 6).

## Monorepo layout

| Package | Purpose |
| --- | --- |
| `packages/core` | Shared TypeScript analysis engine (ingest, classify, report). |
| `apps/cli` | `repobrief` command-line tool. |
| `apps/web` | Next.js web app: paste a URL, browse the brief, export Markdown. |

## Develop

```bash
pnpm install
pnpm test        # run all package test suites
pnpm build       # build all packages
```

## CLI usage (Milestone 1)

```bash
# From the repo root, against a public GitHub repo:
pnpm cli inspect https://github.com/owner/repo

# Or a local directory:
pnpm cli inspect .

# Just the Mermaid architecture graph:
pnpm cli graph .

# Depth modes: fast (no graph) | balanced (default) | deep
pnpm cli inspect . --mode deep
```

## Web app (Milestone 4)

```bash
pnpm --filter @repobrief/web dev      # http://localhost:3000
```

Paste a public GitHub URL on the home page; the brief is computed synchronously,
persisted to SQLite by repo + commit SHA (so re-runs are cached and links are
shareable), and rendered across Overview / Architecture / Hotspots / Where-to-start
tabs with a Markdown export. The hosted surface only accepts GitHub references —
it never reads the server filesystem from user input.

Seed the landing-page demo briefs (a `GITHUB_TOKEN` avoids rate limits):

```bash
cd apps/web && GITHUB_TOKEN=... node --experimental-strip-types scripts/seed-demos.ts
```

Set `GITHUB_TOKEN` (see [`.env.example`](./.env.example)) to raise the GitHub
API rate limit from 60 to 5000 requests/hour.

## License

MIT (to be added).
