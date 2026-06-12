# OSS Builder Tracker

## Shipped
- [x] **git-metrics** (2026-06-13) — Git repo contributor metrics, bus factor, code churn, file ownership, commit timeline. 49 tests, zero deps.
- [x] **license-audit** (2026-06-13) — Scan npm deps for license compliance. 6 categories, policy engine, CI mode, JSON output. 37 tests, zero deps.
- [x] **depgraph-viz** (2026-06-13) — Visualize npm dependency trees as ASCII or SVG. Lockfile-aware, duplicate detection, stats. 36 tests, zero deps.
- [x] **readme-doctor** (2026-06-12) — Diagnose and score README.md. 12 health checks, letter grades A-F, CI mode, zero deps, 25 tests.
- [x] **npmsiz** (2026-06-12) — Analyze npm package bloat before publish. Extension breakdown, bar charts, bloat detection. 30 tests, zero deps.
- [x] **configdiff** (2026-06-12) — Semantic diff for config files (JSON/YAML/TOML). Cross-format comparison, 50 tests, zero deps.
- [x] **cronexpr** (2026-06-12) — Parse and validate cron expressions. Next run times, human descriptions, CLI. 25 tests, zero deps.
- [x] **envcheck** (2026-06-12) — Validate .env files against a schema. 7 types, strict mode, CLI, zero deps. 47 tests.
- [x] **dockalyze** (2026-06-12) — Dockerfile best practices analyzer. 14 rules, zero deps.
- [x] **pkgcheck** (2026-06-12) — Validate package.json health. Fields, deps, licenses, scripts, engines, entry points. Zero deps.
- [x] **local-mock-api-factory** (2026-06-12) — Zero-dep mock API server from JSON. Route params, dynamic responses, delays, CORS.
- [x] **jsonl-agent-logger** (2026-06-12) — Structured JSONL logging for AI agents. Spans, counters, LLM/tool helpers, CLI, zero deps.
- [x] **ai-code-quality-analyzer** (2026-06-11) — Code quality CLI for humans and CI.
- [x] **k8s-policy-check** (2026-06-11) — OPA/Gatekeeper Rego policy linter.

## Ideas / Backlog
- [ ] `skillguard` — Validate AI skill definitions
- [ ] `tsdown` — Analyze TypeScript compilation time per file
- [x] **deadcode-hunter** (2026-06-13) — Find unused JS/TS exports. Named/default, export lists, CJS require, dynamic import, re-exports. 39 tests, zero deps.
