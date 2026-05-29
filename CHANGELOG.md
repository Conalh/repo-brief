# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

Post-V1 hardening for running on a public URL (see [ROADMAP](./ROADMAP.md#beyond-v1--hardening)):

### Fixed
- Parse `/tree/` URLs with slashed branch names correctly; added explicit
  `#ref` / `?ref=` / `?branch=` syntax. Deep-mode churn now degrades to a partial
  or empty signal instead of failing the analysis. Subsystem-graph identity keyed
  on stable `pathPrefix` so subsystems sharing a display name no longer collapse.

### Added (in progress)
- Public-deployment hardening: seed endpoint default-closed in production, per-IP
  rate limiting and a concurrency cap on `POST /api/briefs`, lower hosted ingest
  caps, and binary-content detection so non-text files aren't stored as UTF-8.
- Async analysis: a persisted `jobs` table, `202 + jobId` with status polling,
  and an in-process job runner (swappable for a durable queue later).

### Changed
- Runtime requirement clarified to **Node ≥ 22.5** (the web app's local store uses
  the built-in `node:sqlite`). Removed the placeholder `lint` task until a linter
  is configured.

## [1.0.0]

RepoBrief V1 — feature-complete. The first intended tagged release.

### Added
- **Analysis engine** (`@repobrief/core`): GitHub + local ingestion, language and
  framework detection, manifest/command parsing, a multi-language import graph
  (TS/JS, Python, Go), subsystem mapping, circular-dependency detection, a route
  map, hotspot scoring, and an ordered reading path — every claim backed by file
  evidence, with `fast` / `balanced` / `deep` modes.
- **CLI** (`@repobrief/cli`): `repobrief` command, published to npm.
- **Web app** (`apps/web`): paste a URL, browse the brief, export Markdown;
  backed by local SQLite or hosted libSQL/Turso.
- **MCP server** (`apps/mcp`): brief a repo from an AI agent.
- CI (typecheck + build + test) and [`REPO_BRIEF.md`](./REPO_BRIEF.md), RepoBrief
  analyzing its own source.

[Unreleased]: https://github.com/Conalh/repo-brief/compare/main...HEAD
