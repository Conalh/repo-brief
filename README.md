# RepoBrief

Turn any public GitHub repo into an architecture map, key-file guide, risk
summary, hotspot list, and a "where to start" onboarding path. RepoBrief
compresses the first confusing hour in an unfamiliar codebase into a trustworthy
briefing. It is an **orientation layer, not a code review**.

See [`PLAN.md`](./PLAN.md) for the full product spec and [`ROADMAP.md`](./ROADMAP.md)
for the milestone sequence taking it from plan to shipped product.

## Status

Early development. **Milestone 1 (walking skeleton)** is in progress: ingest a
GitHub URL or local path and print a shallow brief from the CLI.

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
```

Set `GITHUB_TOKEN` (see [`.env.example`](./.env.example)) to raise the GitHub
API rate limit from 60 to 5000 requests/hour.

## License

MIT (to be added).
