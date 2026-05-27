# RepoBrief

Turn any public GitHub repo into an architecture map, key-file guide, risk
summary, hotspot list, and a "where to start" onboarding path. RepoBrief
compresses the first confusing hour in an unfamiliar codebase into a trustworthy
briefing. It is an **orientation layer, not a code review**.

See [`PLAN.md`](./PLAN.md) for the full product spec and [`ROADMAP.md`](./ROADMAP.md)
for the milestone sequence taking it from plan to shipped product.

## Status

Early development. Through **Milestone 3**: the CLI ingests a GitHub URL or local
path and prints a brief with the detected tech stack (languages + frameworks),
run/build/test commands, entrypoints, and a **subsystem architecture map** with a
Mermaid graph — backed by npm/Python/Rust/GitHub Actions manifest parsing and a
JS/TS + Python import graph.

## Monorepo layout

| Package | Purpose |
| --- | --- |
| `packages/core` | Shared TypeScript analysis engine (ingest, classify, report). |
| `apps/cli` | `repobrief` command-line tool. |
| `apps/web` | Next.js web surface (scaffolded in Milestone 4). |

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
```

Set `GITHUB_TOKEN` (see [`.env.example`](./.env.example)) to raise the GitHub
API rate limit from 60 to 5000 requests/hour.

## License

MIT (to be added).
