# RepoBrief Roadmap: From Plan to Real Thing

This roadmap turns [`PLAN.md`](./PLAN.md) into a shippable product. `PLAN.md` describes
*what* to build; this describes the *order of goals* that takes you from an empty
directory to something a stranger can use and you can pin to your GitHub profile.

The guiding principle: **get one repo URL to one rendered brief as fast as possible**,
then deepen each layer. Don't build all of Phase 1 before seeing anything work.

---

## Milestone 0 — Foundation & Decisions (½ day)

**Goal:** A repo you can `git init`, install, and run, with the big choices locked.

- [ ] `git init` (the working dir is not yet a git repo).
- [ ] Decide the monorepo tool: **pnpm workspaces + Turborepo** (recommended for this scope).
- [ ] Decide datastore for V1: **SQLite first** (zero-setup, matches CLI), Postgres later for hosting.
- [ ] Scaffold the package layout from PLAN's Package Map (`packages/core`, `apps/web`, `apps/cli`).
- [ ] Add TypeScript config, ESLint/Prettier, Vitest, and a root `pnpm test` / `pnpm build`.
- [ ] Add a `.env.example` documenting `GITHUB_TOKEN` (rate limits) and DB path.
- [ ] Commit a real README stub so the repo never looks empty.

**Exit:** `pnpm install && pnpm test` passes on an empty test in a clean clone.

---

## Milestone 1 — The Walking Skeleton (1–2 days) ⭐ most important

**Goal:** End-to-end thinnest possible slice. Prove the whole pipeline before deepening any stage.

- [ ] GitHub URL parser (`owner/repo/branch`).
- [ ] GitHub tree fetch for one repo + local tree walk.
- [ ] Normalize into `FileNode`s (path, ext, size) — skip rich classification for now.
- [ ] Assemble a trivial `BriefReport`: identity = repo name + description, plus file count.
- [ ] CLI `repobrief inspect <url>` prints that brief.
- [ ] One fixture repo checked in for offline, deterministic tests.

**Exit:** `repobrief inspect https://github.com/owner/repo` prints a real (shallow) brief.
This de-risks ingestion, auth, and rate limits — the parts most likely to surprise you.

---

## Milestone 2 — Real Classification & Tech Detection (covers PLAN Phases 1–2)

**Goal:** The brief becomes *accurate* about what the repo is and how to run it.

- [ ] File-kind classifier (source/test/docs/config/workflow/asset/generated).
- [ ] Manifest parsers: npm → Python → Rust → GitHub Actions (in that priority order).
- [ ] Framework detection rules (Next.js, FastAPI, Rust, .NET signatures from PLAN).
- [ ] Entrypoint detection: dev/build/test commands + app/api/cli entry files.
- [ ] Per-manifest unit tests + 2–3 more fixture repos spanning languages.

**Exit:** For each fixture repo, the brief names the stack and the run/build/test commands.

---

## Milestone 3 — Graph, Subsystems, Hotspots, Reading Path (covers PLAN Phases 3–4)

**Goal:** The analysis that makes RepoBrief more than `ls`.

- [ ] TS/JS import edges (handle relative + path aliases) → tests.
- [ ] Python import edges → tests.
- [ ] Convention-first subsystem grouping, refined by the import graph.
- [ ] Mermaid graph output (`repobrief graph --format mermaid`).
- [ ] Hotspot scoring (line count, fan-in/out, test gap, broad-name heuristic) → tests.
- [ ] Reading-path generator with a reason per file and a skip list.
- [ ] **Confidence labels everywhere** — directly mitigates the "overstated understanding" risk.

**Exit:** A fixture repo produces a credible subsystem map, ranked hotspots, and an ordered reading path.

---

## Milestone 4 — Web Experience (covers PLAN Phase 5)

**Goal:** A non-CLI user can paste a URL and understand a repo in the browser.

- [ ] API routes from PLAN's API Surface, backed by the core engine + datastore.
- [ ] Async run handling: `POST /api/briefs` → poll `status` (covers the 30–90s run times).
- [ ] Pages: input → overview → architecture → hotspots → reading path.
- [ ] Export panel: Markdown / JSON / `REPO_BRIEF.md` candidate.
- [ ] Pre-baked demo briefs so the site is useful with zero clicks and survives rate limits.

**Exit:** A public visitor runs and reads a brief end-to-end in the browser.

---

## Milestone 5 — Hardening & Real-World Robustness

**Goal:** Survive the messy repos that aren't your fixtures. (PLAN's Error Handling section.)

- [ ] Graceful handling: invalid URL, private-without-auth, truncated tree (mark "partial"), binaries, huge files.
- [ ] Size caps + the fast/balanced/deep mode split so large monorepos don't blow up.
- [ ] Cache results by repo SHA (rate-limit + speed mitigation).
- [ ] Validate the success metrics: small <30s, medium <90s, CLI and web agree on the same snapshot.
- [ ] Run it against 5–10 random real public repos and fix what breaks.

**Exit:** Throwing arbitrary public repos at it produces a useful brief or a clean, specific error.

---

## Milestone 6 — Ship & Showcase (covers PLAN Phase 6)

**Goal:** It's deployed, installable, and reads as a finished portfolio piece.

- [ ] Deploy the web app (Vercel) with a Postgres instance (Neon/Supabase) for hosted runs.
- [ ] Publish the CLI (npm) or document `npx repobrief` usage.
- [ ] README with screenshots, an architecture diagram, sample briefs, and test/build badges.
- [ ] CI: GitHub Action running `pnpm test` + `pnpm build` on PRs; ship the example Action from PLAN.
- [ ] Run RepoBrief on itself and commit the output as `REPO_BRIEF.md` (the meta-demo).
- [ ] Pin the repo.

**Exit:** A stranger lands on the README or live site and "gets it" in under a minute.

---

## Sequencing notes

- **Milestone 1 is the highest-leverage step.** Most projects die because ingestion/auth
  surprises arrive late; this surfaces them on day one.
- Milestones 2 and 3 are where PLAN's per-phase checkboxes live — work them in PLAN order
  but always keep the CLI brief runnable after each task.
- The web app (M4) deliberately comes *after* the engine works via CLI, so the UI is a thin
  layer over proven logic rather than where you debug analysis.
- Stay inside PLAN's V1 exclusions (no private OAuth, no semantic understanding, no runtime
  execution) until M6 is done. Scope creep here is the main schedule risk.

## Suggested first action

Start Milestone 0: `git init`, scaffold the pnpm/Turborepo workspace, and stand up the
empty `packages/core` + `apps/cli` so Milestone 1 has somewhere to live.
