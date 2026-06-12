# Idea 014: `crdt-migrate` — Database-to-CRDT Migration CLI

**Date:** 2026-06-12
**Status:** Researched, validated, high potential

## The Problem

Local-first is booming in 2026 (CRDTs, SQLite sync engines, offline-first apps). But adopting CRDT-based sync requires strict schema patterns:
- Primary keys must be TEXT UUIDs (not auto-increment INTEGERs)
- All NOT NULL columns need DEFAULT values
- Foreign keys must cascade to new UUID-based references
- No auto-incrementing primary keys (causes multi-device conflicts)

**Converting an existing database to meet these requirements is pure pain.** You're manually rewriting schema, updating all foreign key chains, preserving data integrity. There is literally no tool for this — zero search results.

## The Idea

A CLI tool that takes your existing SQLite (or Postgres) database and **automatically migrates it to be CRDT-compatible**.

```
npx crdt-migrate ./myapp.db
# → Analyzes schema
# → Converts INT primary keys to UUIDs
# → Updates all foreign key references
# → Adds DEFAULT values where missing
# → Preserves all existing data
# → Outputs migration SQL + new CRDT-ready database
```

Think `prisma migrate` but for the local-first world.

## Why Now

- **Local-first is exploding**: CRDT frameworks, SQLite sync (sqlite-sync, PowerSync, ElectricSQL) all gaining massive traction
- **NOMAD project** (30K stars on GitHub June 2026) — offline survival AI
- **llama.cpp** (115K stars) — local-first AI inference
- **SQLite-sync** just launched CRDT extension requiring these exact schema patterns
- Multiple "local-first software in 2026" reports confirm this is mainstream, not niche

## Market Size & Demand

- Every team adopting local-first architecture hits this wall
- sqlite-sync alone has growing adoption (backed by SQLite Cloud)
- PowerSync, ElectricSQL, Zero framework all require similar schema discipline
- Point-Free just released a CloudKit-specific migration tool (Swift only) — proves the need exists but it's platform-locked

## Competition

- **None.** Zero general-purpose tools found.
- Point-Free's migration tool is Swift/CloudKit-specific, not a general solution
- Each CRDT framework has its own docs saying "design your schema this way" but no tooling to get you there

## Buildability

**Weekend project for MVP, ~1 week for solid release.**
1. Schema introspection (read existing tables, columns, types, constraints)
2. Primary key conversion (INT → UUID, generate values)
3. Foreign key chain update (cascade UUID changes through all referencing tables)
4. DEFAULT value injection
5. Migration SQL generation
6. Dry-run + verification mode

**Tech:** TypeScript/Node.js (broadest reach) or Rust (trendy, fast). Either works.

## Monetization

- **Open source CLI** (free, builds community)
- **Paid tier:** Visual migration preview (web UI), rollback support, Postgres support, team collaboration
- **Enterprise:** Automated migration CI/CD integration, custom CRDT conflict resolution rules
- **SaaS add-on:** "CRDT Doctor" — continuous monitoring that your schema stays CRDT-compatible

## Confidence

**High.** This solves a real, documented friction point in a rapidly growing market. Zero competition. Low build effort. Clear monetization path. The timing is right — local-first is transitioning from early adopters to mainstream, and migration tooling is the exact thing that unlocks adoption.

## Risks

- CRDT frameworks may add built-in migration (but haven't yet, and the space is fragmented)
- Schema complexity edge cases (but can handle incrementally)
