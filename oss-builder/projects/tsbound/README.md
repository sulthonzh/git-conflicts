# tsbound

Analyze TypeScript/JavaScript import boundaries, circular dependencies, and module coupling — with zero dependencies.

## Why

Circular dependencies are the silent killer of TypeScript projects. They cause weird initialization bugs, make refactoring painful, and turn your clean architecture into spaghetti. `tsbound` finds them, shows you the worst coupling hotspots, and helps you understand your module boundaries.

It's not a bundler. It's not a linter. It's a **static analysis tool** that reads your import statements, builds a dependency graph, and tells you:

- **Where your cycles are** — exact file chains
- **Which modules are coupling hotspots** — too many dependencies in/out
- **Which modules are orphans** — unused code candidates
- **How stable each module is** — using the instability metric (Ce / Ca + Ce)

## Install

```bash
npm install -g tsbound
# or
npx tsbound src/
```

## Usage

```bash
# Analyze a directory
tsbound src/

# Only show circular dependencies
tsbound src/ --cycles

# JSON output for CI pipelines
tsbound src/ --json

# Fail CI if cycles found
tsbound src/ --ci

# Ignore specific directories
tsbound . --ignore node_modules,dist,vendor
```

## Example Output

```
📦 tsbound — Module Boundary Analysis
──────────────────────────────────────────────────

Summary
  Modules:        42
  Edges:          87
  Circular deps:  2
  Orphan modules: 3
  Avg instability: 54%

Circular Dependencies (2)

  1. src/auth/session.ts → src/auth/token.ts → src/auth/session.ts
  2. src/utils/format.ts → src/utils/helper.ts → src/utils/index.ts → src/utils/format.ts

Coupling Hotspots (top 10)

  ██████████████████████████░░░░ 15  src/index.ts
         Ca=0 Ce=15 I=1.00
  ██████████████░░░░░░░░░░░░░░░░ 9   src/db/connection.ts
         Ca=8 Ce=1 I=0.11
  ...
```

## Metrics Explained

| Metric | Meaning |
|--------|---------|
| **Ca** (Afferent) | Modules that depend on this one (fan-in) |
| **Ce** (Efferent) | Modules this one depends on (fan-out) |
| **I** (Instability) | `Ce / (Ca + Ce)` — 0 = stable (depended on), 1 = unstable (depends on others) |

High instability isn't bad per se, but modules with both high Ca and Ce are coupling hotspots — they're hard to change and hard to remove.

## What It Detects

- `import { x } from './path'` — static imports
- `import('./path')` — dynamic imports
- `require('./path')` — CommonJS
- `export { x } from './path'` — re-exports
- `export * from './path'` — star re-exports

Only **relative imports** (`./`, `../`) are tracked as edges. Bare imports (`react`, `lodash`) are noted but don't create edges.

## CI Integration

```yaml
# GitHub Actions
- name: Check for circular dependencies
  run: npx tsbound src/ --ci
```

The `--ci` flag exits with code 1 if any circular dependencies are found.

## TypeScript `.js` Imports

`tsbound` handles the TS convention of importing `./foo.js` when the file is `./foo.ts`. It resolves extension variants automatically.

## License

MIT
