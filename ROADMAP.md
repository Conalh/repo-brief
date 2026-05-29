# RepoBrief Roadmap & Build Log

This is the record of how RepoBrief went from [`PLAN.md`](./PLAN.md) — *what* to
build — to working software, in the order it was actually built. **Milestones 0–6
are complete** (V1 is feature-complete; see the [README status](./README.md#status)).
The forward-looking work lives in [Beyond V1](#beyond-v1--hardening) at the end.

The guiding principle was: **get one repo URL to one rendered brief as fast as
possible**, then deepen each layer — not build all of one phase before seeing
anything work.

---

## Milestone 0 — Foundation & Decisions ✅

A repo you can `git init`, install, and run, with the big choices locked.

- [x] `git init`.
- [x] Monorepo tool: **pnpm workspaces + Turborepo**.
- [x] Datastore for V1: **SQLite first** (local `node:sqlite`), libSQL/Turso for hosting.
- [x] Scaffold the package layout (`packages/core`, `apps/web`, `apps/cli`, `apps/mcp`).
- [x] TypeScript config, Prettier, Vitest, and root `pnpm test` / `pnpm build`.
- [x] `.env.example` documenting `GITHUB_TOKEN` and the DB path.
- [x] A real README so the repo never looks empty.

---

## Milestone 1 — The Walking Skeleton ✅ ⭐ most important

End-to-end thinnest slice — prove the whole pipeline before deepening any stage.

- [x] GitHub URL parser (`owner/repo`, `#ref`, `?ref=`).
- [x] GitHub ingestion (tarball fast path + tree/contents fallback) and local tree walk.
- [x] Normalize into `FileNode`s (path, ext, size).
- [x] Assemble a `BriefReport` (identity + file count).
- [x] CLI prints that brief.
- [x] Fixture repos checked in for offline, deterministic tests.

---

## Milestone 2 — Real Classification & Tech Detection ✅

The brief becomes *accurate* about what the repo is and how to run it.

- [x] File-kind classifier (source/test/docs/config/workflow/asset/generated).
- [x] Manifest parsers: npm → Python → Rust → GitHub Actions.
- [x] Framework detection rules.
- [x] Entrypoint detection: dev/build/test commands + app/api/cli entry files.
- [x] Per-manifest unit tests + fixture repos spanning languages.

---

## Milestone 3 — Graph, Subsystems, Hotspots, Reading Path ✅

The analysis that makes RepoBrief more than `ls`.

- [x] TS/JS import edges (relative + path aliases + workspaces) → tests.
- [x] Python and Go import edges → tests.
- [x] Convention-first subsystem grouping, refined by the import graph.
- [x] Mermaid graph output.
- [x] Hotspot scoring (line count, fan-in/out, test gap, broad-name heuristic) → tests.
- [x] Reading-path generator with a reason per file and a skip list.
- [x] Confidence labels throughout.

---

## Milestone 4 — Web Experience ✅

A non-CLI user can paste a URL and understand a repo in the browser.

- [x] API routes backed by the core engine + datastore.
- [x] Pages: input → overview → architecture → hotspots → reading path.
- [x] Export: Markdown / `REPO_BRIEF.md` candidate.
- [x] Pre-baked demo briefs so the site is useful with zero clicks.
- [x] Async run handling — `POST /api/briefs` enqueues a job; clients poll status.

---

## Milestone 5 — Hardening & Real-World Robustness ✅

Survive the messy repos that aren't the fixtures.

- [x] Graceful handling: invalid URL, private-without-auth, truncated tree
      (marked "partial"), binaries, huge files.
- [x] Size caps + the fast/balanced/deep mode split.
- [x] Cache results by repo SHA.
- [x] Validated the latency targets (small <30s, medium <90s; CLI and web agree).

---

## Milestone 6 — Ship & Showcase ✅

Deployed, installable, and reads as a finished portfolio piece.

- [x] Web app deploys to a single-instance host (local SQLite) or serverless (Turso).
- [x] CLI published to npm as `@repobrief/cli`.
- [x] README with screenshots, architecture diagram, sample brief, and badges.
- [x] CI: GitHub Action running typecheck + build + test on PRs.
- [x] RepoBrief run on itself, committed as [`REPO_BRIEF.md`](./REPO_BRIEF.md).

---

## Beyond V1 — hardening

Post-V1 robustness for running on a public URL, tracked as a sequence of PRs:

- [x] **Correctness hardening** — slashed-branch parsing, best-effort churn that
      degrades instead of failing, stable `pathPrefix` subsystem-graph identity.
- [ ] **Public-deployment hardening** — seed endpoint default-closed in
      production, per-IP rate limiting + concurrency cap on `/api/briefs`, lower
      hosted ingest caps, and refusing to decode binary content as text.
- [ ] **Async analysis** — persisted job table, `202 + jobId`, status polling,
      and an in-process job runner (swappable for a durable queue).
- [ ] **Presentation** — this build log, honest Node runtime requirements, and a
      trimmed lint/tooling story.

### Further out

- Durable queue + worker for multi-replica / serverless background execution.
- A configured linter (ESLint/Biome) wired into CI once a style baseline is set.
- Private-repo OAuth, semantic understanding, and runtime execution remain out of
  scope for V1 (see PLAN's exclusions).
