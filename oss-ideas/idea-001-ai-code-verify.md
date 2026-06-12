# Idea: `trustshell` — AI Code Output Verifier CLI

**Date:** 2026-06-12
**Status:** Researched, not built

## The Problem

84% of devs use AI coding tools daily (SO Survey 2025/2026). But **46% distrust the output** and only 3% "highly trust" it. Developers are stuck manually reviewing AI-generated code — checking imports, edge cases, security issues, type correctness. There's no quick "sanity check" tool between "AI wrote this" and "I'm shipping it."

## The Idea

A CLI tool that runs a battery of automated checks on AI-generated code before you commit it:

- **Type check** — runs `tsc --noEmit` or equivalent, catches type hallucinations
- **Import validation** — verifies all imports resolve (AI loves inventing packages)
- **Security scan** — flags obvious vulnerabilities (eval, innerHTML, SQL injection patterns)
- **Test generation** — generates basic smoke tests for the new code and runs them
- **Diff awareness** — operates on `git diff` (staged or against branch), not whole codebase
- **LLM-as-judge** — optional: send diff to a local/smaller model for a second opinion on logic

## Why Now

- AI coding agents exploded: Cursor (18% adoption, first year), Claude Code (10%), Windsurf (5%)
- Trust is at all-time low — this isn't a nice-to-have, it's a safety net
- MCP protocol standardizing tool integration means this could plug into any agent workflow
- `pompelmi` (from dev.to npm list) just appeared doing file upload scanning with zero cloud deps — shows appetite for local-first verification tools

## Competition

- **Existing linters (ESLint, Ruff, etc.):** Not AI-aware, don't understand diff context
- **GitHub Copilot Autofix:** Security-focused only, not general verification
- **Codium/Qodo:** Test generation but not a quick "trust check" pipeline
- **Gap:** No tool combines diff-aware + AI-specific failure modes + fast feedback loop

## Technical Feasibility

- **Buildable in a weekend?** Yes — MVP is a Node.js CLI that pipes `git diff` through a series of checkers
- **Core stack:** TypeScript, Node.js, git diff parsing, existing linter integrations
- **Extensible:** Plugin system for custom checks (MCP-compatible?)
- **Monetization:** Core OSS, premium cloud features (team policies, historical trust scores)

## Market Signals

- SO Survey: 51% of professional devs use AI daily — massive TAM
- npm packages like `pompelmi` (file scanning, zero deps) gaining traction = devs want local verification
- "Technical debt" named #1 developer frustration — AI hallucinated code is the new tech debt

## Risks

- Linters already exist — need clear positioning as "AI-aware trust layer"
- AI models improving fast — hallucination rates dropping. Counter: new failure modes emerging
- Might be too niche — need to validate with actual devs

## Next Steps

1. Build CLI MVP: `npx trustshell` → runs checks on staged diff
2. Ship as MCP server so it integrates with Cursor/Claude Code workflows
3. Validate with a few dev communities
