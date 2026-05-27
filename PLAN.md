# RepoBrief Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a GitHub repository briefing tool that turns any public repo URL into an architecture map, key file guide, risk summary, hotspot list, and "where to start" onboarding path.

**Architecture:** A Next.js app and CLI share a TypeScript analysis engine. The engine ingests repository trees and selected files through GitHub APIs or local clone fallback, classifies files by responsibility, builds a lightweight dependency/import graph, extracts docs and scripts, and produces a structured brief with evidence links. Hosted runs store snapshots and reports in Postgres; local CLI runs can write JSON and Markdown to disk.

**Tech Stack:** TypeScript, Next.js, Tailwind, TanStack Query, Node.js CLI, tree-sitter or language-specific lightweight parsers, GitHub REST API, Postgres or SQLite, Vitest, Playwright.

---

## Product Thesis

Every developer has had the same first hour in a repo: open README, scan files, guess the architecture, find package scripts, search for routes, and hope the tests run.

RepoBrief should compress that first hour into a trustworthy briefing:

- What is this repo?
- What are the main subsystems?
- Which files matter first?
- How does data move?
- How do I run it?
- Where are tests?
- What looks risky?
- What should I read in order?

The product is not a code review. It is an orientation layer.

## Target Users

Primary users:

- Developers evaluating open-source repos.
- Job candidates studying company projects.
- Maintainers onboarding contributors.
- Agents preparing to work in an unfamiliar codebase.

Secondary users:

- Technical writers.
- Engineering managers.
- Students reading real-world repos.
- Open-source curators.

## Portfolio Value

This is a strong GitHub project because it shows:

- GitHub API use.
- Repository structure analysis.
- Language/framework detection.
- Import and route graph extraction.
- UX for dense technical information.
- CLI and web surfaces.
- Evidence-first reporting.

It also acts as a meta-tool for making the rest of the GitHub portfolio more legible.

## Core Product Loop

1. User pastes a GitHub URL.
2. RepoBrief fetches metadata, tree, README, manifests, configs, routes, tests, and docs.
3. Analyzer classifies architecture, file roles, entrypoints, scripts, test commands, and hotspots.
4. Report renders an architecture map and guided reading path.
5. User exports Markdown or shares the brief link.

## V1 Scope

Included:

- Public GitHub repo ingestion.
- Local repo ingestion through CLI.
- File tree and language summary.
- README and docs summary.
- Manifest/script detection.
- Entrypoint detection.
- Route/API detection for common frameworks.
- Import graph for TypeScript/JavaScript and Python.
- Hotspot detection by size, imports, churn, and centrality.
- "Read these files first" path.
- Markdown export.
- Demo briefs.

Excluded from V1:

- Private repo OAuth.
- Full semantic code understanding.
- Runtime execution.
- Security scanning.
- Pull request comments.
- Organization-wide search.
- Deep binary/notebook parsing.

## Product Surfaces

### Home

Purpose: One input, instant value.

Fields:

- GitHub URL.
- Branch.
- Depth mode: fast, balanced, deep.

Fast mode:

- metadata.
- tree.
- README.
- manifests.
- top files.

Balanced mode:

- fast mode plus import graph and tests.

Deep mode:

- balanced mode plus docs cross-reference and churn if commit history is available.

### Brief Overview

Purpose: Summarize the repo in one screen.

Sections:

- One-sentence identity.
- Main technologies.
- How to run.
- Main entrypoints.
- Main subsystems.
- Top risks.
- Suggested reading path.

### Architecture Map

Purpose: Show how the repo is organized.

Views:

- Folder responsibility map.
- Subsystem graph.
- Entrypoint-to-module graph.
- API route map where detected.

### Hotspots

Purpose: Identify files that deserve attention.

Signals:

- high line count.
- high import fan-in.
- high import fan-out.
- recent churn.
- mixed responsibility.
- test gap.

### Where To Start

Purpose: Make onboarding actionable.

Sections:

- Read first.
- Run first.
- Test first.
- Modify first if doing a small contribution.
- Avoid first because risky.

### Export

Purpose: Produce a repo-ready briefing artifact.

Formats:

- Markdown.
- JSON.
- GitHub issue body.
- `REPO_BRIEF.md` candidate.

## Data Model

### RepositoryInput

- id
- source_type: github_url, local_path
- owner
- repo
- url
- branch
- local_path
- created_at

### BriefRun

- id
- repository_input_id
- status: queued, running, completed, failed
- mode: fast, balanced, deep
- started_at
- completed_at
- analyzer_version
- error_message

### RepoMetadata

- id
- brief_run_id
- name
- description
- default_branch
- head_sha
- stars
- forks
- topics_json
- license
- homepage_url
- pushed_at

### FileNode

- id
- brief_run_id
- path
- extension
- language
- size_bytes
- line_count
- kind: source, test, docs, config, workflow, asset, generated, unknown
- responsibility
- hash

### Manifest

- id
- brief_run_id
- path
- manager: npm, python, rust, go, dotnet, docker, github_actions
- scripts_json
- dependencies_json
- runtime_json

### ImportEdge

- id
- brief_run_id
- from_path
- to_path
- import_kind: static, dynamic, type_only, unknown
- confidence

### Entrypoint

- id
- brief_run_id
- path
- kind: app, api, cli, test, build, worker, config
- command
- evidence

### Subsystem

- id
- brief_run_id
- name
- summary
- paths_json
- depends_on_json
- confidence

### Hotspot

- id
- brief_run_id
- path
- score
- reasons_json
- recommendation

### BriefReport

- id
- brief_run_id
- identity
- architecture_summary
- run_instructions_json
- risk_summary_json
- reading_path_json
- markdown
- created_at

## Analysis Engine

### Detector: Language and Framework

Inputs:

- file extensions.
- package manifests.
- config files.
- imports.

Outputs:

- primary language.
- secondary languages.
- frameworks.
- runtime.
- confidence.

Examples:

- `next.config.*` plus `app/` or `pages/` indicates Next.js.
- `pyproject.toml` plus `fastapi` dependency indicates FastAPI.
- `Cargo.toml` indicates Rust package.
- `.csproj` or `.sln` indicates .NET.

### Detector: Entrypoints

Inputs:

- package scripts.
- Dockerfile.
- Procfile.
- workflow commands.
- framework conventions.

Outputs:

- dev command.
- build command.
- test command.
- app entry file.
- API entry file.
- CLI entry file.

### Detector: Subsystems

Inputs:

- folders.
- file kinds.
- import edges.
- route conventions.
- docs headings.

Outputs:

- subsystem names.
- responsible paths.
- inbound and outbound dependencies.

Rules:

- Prefer convention-based grouping first.
- Use import graph to refine.
- Keep names boring and accurate.

### Detector: Hotspots

Inputs:

- line count.
- import centrality.
- churn when available.
- responsibility classification.
- tests nearby.

Scoring:

- +2 for high line count.
- +2 for high fan-in.
- +1 for high fan-out.
- +2 for high churn.
- +2 if source file has no nearby tests.
- +1 if filename suggests broad responsibility such as `utils`, `helpers`, `manager`, or `controller`.

### Detector: Reading Path

Inputs:

- README.
- entrypoints.
- subsystem graph.
- tests.
- docs.

Output:

- ordered list of files to read.
- reason for each file.
- skip list for generated or low-signal files.

## API Surface

### Brief Runs

- `POST /api/briefs`
- `GET /api/briefs/{brief_id}`
- `GET /api/briefs/{brief_id}/status`
- `GET /api/briefs/{brief_id}/metadata`
- `GET /api/briefs/{brief_id}/architecture`
- `GET /api/briefs/{brief_id}/hotspots`
- `GET /api/briefs/{brief_id}/reading-path`
- `GET /api/briefs/{brief_id}/export.md`

### Demo

- `GET /api/demo/briefs`
- `POST /api/demo/reset`

## CLI Surface

Commands:

```bash
repobrief inspect https://github.com/owner/repo
repobrief inspect . --mode deep
repobrief export --format markdown
repobrief graph --format mermaid
```

Example output:

```text
RepoBrief: owner/repo
Identity: Next.js + FastAPI app for repository analysis.
Start here: README.md -> web/app/page.tsx -> src/api.py -> tests/
Risk: 2 hotspots, 1 missing test surface, 1 stale setup command.
Report: .repobrief/report.md
```

## Frontend Component Map

- `app/page.tsx`: repo URL input.
- `app/briefs/[id]/page.tsx`: overview.
- `app/briefs/[id]/architecture/page.tsx`: architecture map.
- `app/briefs/[id]/hotspots/page.tsx`: hotspot list.
- `app/briefs/[id]/start/page.tsx`: reading path.
- `components/repo-input.tsx`: input form.
- `components/identity-card.tsx`: repo identity.
- `components/tech-stack-card.tsx`: language/framework summary.
- `components/architecture-graph.tsx`: subsystem graph.
- `components/hotspot-table.tsx`: hotspot ranking.
- `components/reading-path.tsx`: ordered onboarding path.
- `components/export-panel.tsx`: Markdown and JSON export.

## Package Map

- `packages/core/src/ingest/github.ts`: GitHub ingestion.
- `packages/core/src/ingest/local.ts`: local ingestion.
- `packages/core/src/classify/file-kind.ts`: file role classifier.
- `packages/core/src/classify/framework.ts`: framework detector.
- `packages/core/src/graph/imports-js.ts`: TypeScript/JavaScript imports.
- `packages/core/src/graph/imports-python.ts`: Python imports.
- `packages/core/src/analyze/entrypoints.ts`: run/build/test detection.
- `packages/core/src/analyze/subsystems.ts`: subsystem builder.
- `packages/core/src/analyze/hotspots.ts`: hotspot scoring.
- `packages/core/src/report/brief.ts`: report assembly.
- `apps/web`: Next.js app.
- `apps/cli`: Node CLI.

## Implementation Phases

### Phase 1: Normalized Repo Snapshot

- [ ] Create monorepo.
- [ ] Implement GitHub URL parser.
- [ ] Implement GitHub tree fetch.
- [ ] Implement local tree walk.
- [ ] Normalize file nodes.
- [ ] Classify file kinds.
- [ ] Add fixture repos.

Exit criteria:

- CLI can print a normalized file tree for a GitHub URL and local path.

### Phase 2: Technology and Entrypoint Detection

- [ ] Parse npm manifests.
- [ ] Parse Python manifests.
- [ ] Parse Rust manifests.
- [ ] Parse GitHub Actions workflows.
- [ ] Detect common frameworks.
- [ ] Detect dev/build/test commands.
- [ ] Test every supported manifest.

Exit criteria:

- Report identifies the tech stack and commands for fixture repos.

### Phase 3: Graph and Subsystems

- [ ] Extract TypeScript/JavaScript import edges.
- [ ] Extract Python import edges.
- [ ] Build subsystem grouping.
- [ ] Generate Mermaid graph output.
- [ ] Add tests for alias and relative imports.

Exit criteria:

- The architecture tab shows an accurate first-pass subsystem map.

### Phase 4: Hotspots and Reading Path

- [ ] Implement line count scoring.
- [ ] Implement fan-in and fan-out scoring.
- [ ] Implement test gap scoring.
- [ ] Build reading path generator.
- [ ] Add tests for hotspot ranking.

Exit criteria:

- Report recommends a credible onboarding path and ranks files worth attention.

### Phase 5: Web Experience

- [ ] Build input page.
- [ ] Build overview.
- [ ] Build architecture page.
- [ ] Build hotspots page.
- [ ] Build reading path page.
- [ ] Add export panel.
- [ ] Add demo briefs.

Exit criteria:

- A public visitor can run and understand a repo brief in the browser.

### Phase 6: Portfolio Finish

- [ ] Add README with screenshots.
- [ ] Add CLI install docs.
- [ ] Add sample briefs.
- [ ] Add architecture diagram.
- [ ] Add test and build badges.
- [ ] Add GitHub Action example.

Exit criteria:

- Repo is ready to pin and demonstrates the product within the README.

## Error Handling

- Invalid URL gives specific parse guidance.
- Private repo without auth gives a clean auth message.
- Truncated GitHub tree marks report as partial.
- Unsupported language still gets file tree, docs, and manifest analysis.
- Binary files are skipped.
- Large files are summarized by metadata only.

## Success Metrics

- Small repo brief completes under 30 seconds.
- Medium repo brief completes under 90 seconds.
- Report includes at least one entrypoint, one subsystem, and one reading path for fixture repos.
- Markdown export is useful as a GitHub issue or onboarding doc.
- CLI and web report match for the same snapshot.

## Risks

- Architecture maps can overstate understanding.
- Import parsing across languages can explode scope.
- Large monorepos may overwhelm V1.
- Users may expect code review instead of orientation.
- GitHub rate limits can affect hosted use.

Mitigations:

- Show confidence labels.
- Start with TypeScript/JavaScript and Python.
- Add size caps and deep mode.
- Use "orientation, not review" copy.
- Cache results by repo SHA.

## Reference Sources To Review During Build

- GitHub REST repositories API: https://docs.github.com/rest/repos/
- GitHub REST repository contents API: https://docs.github.com/en/rest/repos/contents
- GitHub REST Git trees API: https://docs.github.com/en/rest/git/trees
- GitHub REST commits API: https://docs.github.com/rest/commits
- GitHub code search syntax: https://docs.github.com/en/search-github/github-code-search/understanding-github-code-search-syntax
- GitHub REST API rate limits: https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
