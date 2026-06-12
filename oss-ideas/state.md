# OSS Ideas Researcher — State

**Last updated:** 2026-06-13 03:23 WIB
**Session:** Research Cycle 11 completed

## Research Completed
- ✅ GitHub trending scan (June 2026)
- ✅ npm trends review
- ✅ Stack Overflow 2025/2026 survey analysis
- ✅ MCP ecosystem deep dive
- ✅ AI agent context window pain points analysis
- ✅ MCP server gap identification
- ✅ AI security landscape analysis (June 2026)
- ✅ OWASP Agentic Applications Top 10 research
- ✅ Microsoft RAMPART & Clarity analysis
- ✅ First malicious MCP server incident analysis
- ✅ RAG & Vector security assessment
- ✅ AI governance & compliance landscape scan
- ✅ AI agent development pain points deep dive (75+ frustrations analysis)
- ✅ AI governance trends for 2026 (Trustible analysis)
- ✅ AI evaluation infrastructure gap identification
- ✅ AI agent evaluation platform opportunity validation
- ✅ Local-first ecosystem deep dive (June 2026 trending)
- ✅ CRDT migration gap identification & validation
- ✅ AI agent skills ecosystem analysis (June 2026 — Cycle 7)
- ✅ Skill security competition landscape deep dive (June 2026 — Cycle 8)
- ✅ OWASP AST10 (Agentic Skills Top 10) analysis
- ✅ Snyk ToxicSkills & agent-scan competitive analysis
- ✅ MCP CVE/zero-day landscape update (June 2026)
- ✅ **Skill security competitive landscape re-assessment (June 2026 — Cycle 9)** ⚠️ MAJOR SHIFT
- ✅ **GitHub trending Week 1 June 2026 scan**
- ✅ **METR 2026 AI coding slowdown analysis**

## ⚠️ CRITICAL UPDATE — Cycle 9

### Skill Security Space: Gap CLOSED
The instruction-layer semantic analysis gap identified in Cycle 8 has been **filled by major players** in weeks:
- **NVIDIA SkillSpector** — 64 vulnerability patterns, 16 categories, two-stage analysis (static + LLM semantic), AST analysis, YARA, OSV.dev CVE lookups, 0-100 scoring. Full production tool.
- **Cisco AI Defense Skill Scanner** — 10 analyzers, pattern + LLM-as-judge + behavioral dataflow, SARIF output, PyPI package. Full production tool.
- **Enkrypt AI Skill Sentinel** — OSS scanner for Cursor/Claude Code skills, launched Feb 2026.
- **SkillShield.dev** — Security-scored directory, 10,500+ skills scanned, 0-100 trust scores, CLI scanner.

**Verdict:** This space is now a big-player game (NVIDIA + Cisco + Snyk + OWASP). Weekend builder opportunity is GONE. Ideas #015 and #016 should be **deprioritized**.

### New Signals — June 2026 GitHub Trending
- **odysseus** (36.1K⭐) — Self-hosted AI workspace, massive demand for local AI dev environments
- **memory-os** (678⭐) — 7-layer memory OS for Hermes Agent. Validates agent memory management demand.
- **Duel-Agents** (693⭐) — Adversarial AI agent testing CLI/SDK
- **pi-dynamic-workflows** (752⭐) — Dynamic workflow orchestration
- **gemini-web2api** (1.3K⭐) — Gemini web → OpenAI API converter. Proxy/wrapper layer demand.

### New Macro Data Point
- **METR 2026 Study:** AI coding tools make developers **19% SLOWER** on real tasks (vs vendor claims of 55% faster). 74-point gap between reality and marketing.
- **Senior dev shortage thesis:** AI tools causing junior pipeline collapse, creating long-term skills gap.

## Ideas Logged
| # | Idea | Date | Status |
|---|------|------|--------|
| 001 | `trustshell` — AI Code Output Verifier CLI | 2026-06-12 | Researched, validated, high potential |
| 002 | `code-verify-mcp` — AI Code Verification MCP Server | 2026-06-12 | Identified gap |
| 003 | `context-optimizer-mcp` — Context Window Management Server | 2026-06-12 | Identified gap |
| 004 | `ai-test-generator-mcp` — AI-Powered Test Generation Server | 2026-06-12 | Identified gap |
| 005 | `security-tester-agent` — AI Agent Security Testing Framework | 2026-06-12 | New gap identified, high potential |
| 006 | `mcp-server-security` — MCP Server Security Verifier | 2026-06-12 | New gap identified, medium-high potential |
| 007 | `ai-governance-toolkit` — AI Governance & Compliance Toolkit | 2026-06-12 | New gap identified, medium potential |
| 008 | `rag-security-scanner` — RAG & Vector Security Scanner | 2026-06-12 | New gap identified, medium potential |
| 009 | `ai-agent-eval` — AI Agent Evaluation Framework | 2026-06-12 | New gap identified, high potential |
| 010 | `eval-ai-agent` — AI Agent Performance Evaluation Platform | 2026-06-12 | New gap identified, high potential |
| 011 | `ai-agent-orchestrator` — AI Agent Orchestration Platform | 2026-06-12 | New gap identified, high potential |
| 012 | `ai-agent-observability` — AI Agent Observability Platform | 2026-06-12 | New gap identified, high potential |
| 013 | `ai-cost-optimizer` — AI Cost Optimization Platform | 2026-06-12 | New gap identified, high potential |
| 014 | `crdt-migrate` — Database-to-CRDT Migration CLI | 2026-06-12 | Researched, validated, high potential |
| 015 | `skill-vet` — Agent Skill Security & Quality Auditor | 2026-06-12 | ❌ GAP CLOSED — NVIDIA/Cisco dominate |
| 016 | `skill-vet-semantic` — Instruction-Layer Skill Analyzer | 2026-06-13 | ❌ GAP CLOSED — NVIDIA/Cisco dominate |
| 017 | `ai-code-drift` — AI Code Quality Regression Detector | 2026-06-13 | **NEW** — Cycle 9, high potential |
| 018 | `agent-memory-layer` — Universal Agent Memory Abstraction | 2026-06-13 | ❌ GAP CLOSED — Mem0/TeleMem/Letta/Zep/Cognee/Graphiti dominate |

## New Ideas — Cycle 9

### 🆕 #017: `ai-code-drift` — AI Code Quality Regression Detector
**Problem:** METR 2026 proves AI coding tools make devs 19% slower on real tasks. AI-generated code introduces subtle quality regressions — copy-paste patterns, unnecessary abstractions, hallucinated utilities, growing technical debt. Nobody detects this automatically.
**What:** CLI/CI tool that measures code quality drift from AI-generated changes. Compares pre-AI vs post-AI code metrics: complexity, duplication, dead code, dependency bloat, pattern consistency. Alerts when AI contributions degrade quality.
**Validation:**
- METR study is headline news — massive awareness of the problem
- Technical debt is #1 developer frustration (from SO survey data)
- 84% of devs use AI tools, 51% daily — enormous addressable market
- "Senior dev shortage" narrative compounds this — fewer experienced devs to catch issues
**Competition:** DEEP RESEARCH DONE (Cycle 10):
- **SonarQube/CodeClimate:** Static code quality, NOT AI-specific drift. No before/after AI contribution comparison.
- **ML drift tools (Arize, Evidently, WhyLabs, Fiddler):** Track ML model output drift, NOT source code quality. Different problem entirely.
- **Nobody does code quality drift detection for AI-generated code.** ✅ GAP CONFIRMED.
- **Key dependency SOLVED:** `agentblame` provides AI code attribution data (`git ai blame`). `ai-code-drift` can consume this data to measure quality drift specifically on AI-generated lines. Natural product pairing.
**Build time:** ~1 week MVP (git diff analysis + quality metrics + drift scoring)
**Monetization:** OSS core + CI/CD integration (GitHub Action) paid tier
**Risk:** SonarQube or similar could add AI-specific rules quickly.

### 🆕 #018: `agent-memory-layer` — Universal Agent Memory Abstraction
**Problem:** memory-os (678⭐ in a week) proves demand for agent memory. But it's Hermes-specific. Every agent framework (Claude Code, Codex, Cursor, OpenClaw, Hermes) manages memory differently. No universal layer.
**What:** A universal memory abstraction that works across AI agents. Normalizes memory format (facts, conversations, preferences), provides CRUD API, supports multiple backends (file, SQLite, Qdrant). Like Prisma for agent memory.
**Validation:**
- memory-os hit 678⭐ in days — raw demand signal
- Every agent framework reinvents memory management
- Context window optimization is a top pain point (from Cycle 6 data)
- Skills ecosystem (91K+ skills) needs persistent memory to be useful
**Competition:** memory-os (Hermes-specific), various agent-specific implementations. No universal layer exists.
**Build time:** ~2 weeks MVP (file + SQLite backends, standard API)
**Monetization:** OSS core + cloud sync/persistence paid tier
**Risk:** Major agent platforms could standardize memory internally.

## Top 3 Ideas to Build (Prioritized — UPDATED)

### 🥇 `crdt-migrate` — Database-to-CRDT Migration CLI
**Why #1 now:** Skill security gap closed. CRDT migration is the ONLY idea with ZERO competition and a validated growing market (local-first mainstream shift). First mover advantage is still open.
**What:** CLI that analyzes existing SQLite/Postgres schemas and generates CRDT-compatible versions.
**Build time:** ~1 week MVP (SQLite first)
**Competition:** NONE. PowerSync/ElectricSQL require manual migration.
**Moat:** Migration is hard — first tool to automate it owns the funnel.

### 🥈 `ai-code-drift` — AI Code Quality Regression Detector
**Why #2:** Fresh, validated problem (METR study), strong narrative, no direct competition yet. Timing is perfect — awareness is peaking.
**What:** CLI/CI that detects quality regressions from AI-generated code.
**Build time:** ~1 week MVP
**Risk:** SonarQube could add this feature. Speed to market matters.

### ~~🥉 `agent-memory-layer`~~ — ❌ GAP CLOSED (Cycle 11)
Mem0 already dominates: 21 framework integrations, 20 vector stores, LoCoMo 92.5 benchmark, managed + self-hosted + local MCP. TeleMem is a drop-in replacement. Letta, Zep, Cognee, Graphiti, Hindsight, LangMem all compete. Space has 8+ frameworks. Weekend builder opportunity is GONE.

**Replacement #3 needed — investigate next cycle.**

## Next Cycle Priorities
- [x] Deep dive `ai-code-drift` competition — SonarQube/CodeClimate do static quality, NOT AI drift. ML drift tools (Arize, Evidently, WhyLabs) track model performance, NOT code quality. **GAP CONFIRMED.**
- [x] Research git blame + AI attribution — **SOLVED by agentblame (mesa-dot-dev)** + git-ai. Tracks AI-generated lines via Git Notes. Works with Cursor/Claude Code/OpenCode. Browser extension for GitHub PRs. Squash-safe.
- [x] Check if any "AI code quality" tools launched recently — None found for code quality drift.
- [x] Validate CRDT-migrate further — sqlite-sync exists but adds CRDT replication, NOT migration. Gap still open.
- [x] Research `agent-memory-layer` — ❌ GAP CLOSED. Mem0 dominates (21 frameworks, 20 vector stores, LoCoMo 92.5). TeleMem, Letta, Zep, Cognee, Graphiti, Hindsight, LangMem all compete. 8+ frameworks in the space.
- [x] Look at `memory-os` architecture — EMNLP 2025 Oral paper, hierarchical 3-tier (short/mid/long-term). But this is research, not a market gap.

## Key Data Points Collected
- 84% devs use AI tools, 51% daily (SO Survey)
- 46% distrust AI output, only 3% highly trust
- METR 2026: AI tools make devs 19% SLOWER (74-point gap vs vendor claims)
- Cursor at 18% IDE adoption (first year), Claude Code at 10%
- Technical debt = #1 developer frustration
- MCP ecosystem: 10,000+ servers, 97M monthly downloads, 400% YoY growth
- AI agents burn 5x more tokens than chatbots
- Local-first transitioning from niche to mainstream architecture pattern
- Snyk: 36% of skills have security flaws, 1,467 vulnerable skills
- NVIDIA SkillSpector: 64 vulnerability patterns, two-stage analysis (static + LLM)
- Cisco Skill Scanner: 10 analyzers, pattern + LLM-as-judge + behavioral dataflow
- memory-os: 678⭐ in days — agent memory demand validated
- odysseus: 36.1K⭐ — self-hosted AI workspace demand massive

### 🆕 Cycle 10 Findings (June 2026)
- **`ai-code-drift` competition: CONFIRMED GAP.** All "AI drift" tools (Arize, Evidently, WhyLabs, Fiddler) track ML model output drift. SonarQube/CodeClimate do static quality. Nobody detects CODE QUALITY drift from AI contributions.
- **AI code attribution: SOLVED.** `agentblame` (mesa-dot-dev) + `git-ai` provide `git ai blame` — tracks which lines are AI-generated, survives rebase/squash. Browser extension for GitHub PRs.
- **`ai-code-drift` + `agentblame` = natural pairing.** Agentblame provides the "which lines are AI" data. `ai-code-drift` consumes it to measure quality drift on those specific lines.
- **CRDT-migrate: Still open.** sqlite-sync adds CRDT replication to SQLite but doesn't migrate existing schemas. No automated migration tool exists.

### 🆕 Cycle 11 Findings (June 2026)
- **`agent-memory-layer` (#018): GAP CLOSED.** Mem0 is the dominant player — 21 frameworks, 20 vector stores, 3 hosting models, LoCoMo 92.5, LongMemEval 94.4 benchmarks. TeleMem offers drop-in replacement (`import telemem as mem0`). Letta, Zep, Cognee, Graphiti, Hindsight, LangMem, MemoryScope, txtai all compete. At least 8+ OSS frameworks. Not a gap.
- **MemoryOS (BAI-LAB):** EMNLP 2025 Oral paper, academic research with 3-tier hierarchy (short/mid/long-term memory). Not a competitive product but validates the architecture space.
- **Agent memory benchmarks now standardized:** LoCoMo, LongMemEval, BEAM are the standard benchmarks. This means the space is mature enough for comparison — another sign it's not an underserved gap.
- **GitHub trending Week 1 June 2026:** No major new gaps identified. odysseus (36.1K⭐) continues to dominate. Duel-Agents (693⭐) validates adversarial agent testing but that's already covered by idea #005.

## Top 3 Priority — NEEDS REFRESH
- 🥇 `crdt-migrate` — STILL OPEN, zero competition
- 🥈 `ai-code-drift` — STILL OPEN, fresh validated problem
- 🥉 **OPEN SLOT** — need to identify new idea in Cycle 12

## Next Cycle Priorities
- [ ] Find replacement #3 idea — look at underserved gaps in AI dev tooling
- [ ] Explore: AI code review automation, prompt testing frameworks, agent debugging tools
- [ ] Check if any new trending repos signal emerging gaps

## Historical Context (Condensed
- Cycles 1-6: Mapped AI agent ecosystem, identified security, evaluation, cost optimization gaps
- Cycle 7: Agent skills ecosystem explosion (91K+ skills, 8 marketplaces, zero security tooling)
- Cycle 8: Skill security competition emerging (Snyk, OWASP AST10, SkillProbe academic)
- Cycle 9: Skill security gap CLOSED by NVIDIA + Cisco. Pivoted to new gaps.
- Cycle 10: `ai-code-drift` gap confirmed, agentblame validates attribution layer, CRDT gap still open.
- Cycle 11: `agent-memory-layer` gap CLOSED — 8+ competing frameworks. Need new #3 idea.
