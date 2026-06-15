'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const {
  isRelative,
  resolveModule,
  extractImports,
  walkDir,
  buildGraph,
  detectCycles,
  couplingMetrics,
  hotspots,
  orphans,
  summarize,
} = require('./index');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
  } catch (err) {
    failed++;
    console.error(`✗ ${name}: ${err.message}`);
  }
}

function testAsync(name, fn) {
  return fn()
    .then(() => passed++)
    .catch((err) => {
      failed++;
      console.error(`✗ ${name}: ${err.message}`);
    });
}

// Helper: create a temp project structure
function createTempProject(structure) {
  const tmpdir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsbound-'));
  for (const [relPath, content] of Object.entries(structure)) {
    const fullPath = path.join(tmpdir, relPath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content);
  }
  return tmpdir;
}

// ── isRelative ─────────────────────────────────────────────────────

test('isRelative: ./ paths', () => {
  assert.strictEqual(isRelative('./foo'), true);
  assert.strictEqual(isRelative('../bar'), true);
  assert.strictEqual(isRelative('./../baz'), true);
});

test('isRelative: bare imports', () => {
  assert.strictEqual(isRelative('react'), false);
  assert.strictEqual(isRelative('lodash/get'), false);
  assert.strictEqual(isRelative('@scope/pkg'), false);
});

test('isRelative: absolute paths', () => {
  assert.strictEqual(isRelative('/abs/path'), false);
  assert.strictEqual(isRelative('~/home'), false);
});

// ── extractImports ─────────────────────────────────────────────────

test('extractImports: default import', () => {
  const src = `import foo from './foo';`;
  const imports = extractImports(src);
  assert.ok(imports.has('./foo'));
});

test('extractImports: named imports', () => {
  const src = `import { a, b } from './utils';`;
  const imports = extractImports(src);
  assert.ok(imports.has('./utils'));
});

test('extractImports: namespace import', () => {
  const src = `import * as path from './path';`;
  const imports = extractImports(src);
  assert.ok(imports.has('./path'));
});

test('extractImports: side-effect import', () => {
  const src = `import './polyfill';`;
  const imports = extractImports(src);
  assert.ok(imports.has('./polyfill'));
});

test('extractImports: dynamic import', () => {
  const src = `const mod = await import('./dynamic');`;
  const imports = extractImports(src);
  assert.ok(imports.has('./dynamic'));
});

test('extractImports: require call', () => {
  const src = `const x = require('./helper');`;
  const imports = extractImports(src);
  assert.ok(imports.has('./helper'));
});

test('extractImports: export from', () => {
  const src = `export { foo } from './re-export';`;
  const imports = extractImports(src);
  assert.ok(imports.has('./re-export'));
});

test('extractImports: export star from', () => {
  const src = `export * from './all';`;
  const imports = extractImports(src);
  assert.ok(imports.has('./all'));
});

test('extractImports: multiple imports', () => {
  const src = `
    import { a } from './a';
    import b from '../b';
    const c = require('./c');
    export { d } from './d';
  `;
  const imports = extractImports(src);
  assert.ok(imports.has('./a'));
  assert.ok(imports.has('../b'));
  assert.ok(imports.has('./c'));
  assert.ok(imports.has('./d'));
});

test('extractImports: ignores bare specifiers', () => {
  const src = `import React from 'react';\nimport { _ } from 'lodash';`;
  const imports = extractImports(src);
  assert.ok(imports.has('react'));
  assert.ok(imports.has('lodash'));
});

test('extractImports: handles double quotes', () => {
  const src = `import foo from "./double";`;
  const imports = extractImports(src);
  assert.ok(imports.has('./double'));
});

test('extractImports: empty source', () => {
  const imports = extractImports('');
  assert.strictEqual(imports.size, 0);
});

// ── walkDir ────────────────────────────────────────────────────────

test('walkDir: finds source files', () => {
  const tmp = createTempProject({
    'src/index.ts': 'export {};',
    'src/utils/helper.js': 'export {};',
    'src/components/App.tsx': 'export {};',
    'README.md': '# readme',
  });
  const files = walkDir(path.join(tmp, 'src'));
  assert.strictEqual(files.length, 3);
  fs.rmSync(tmp, { recursive: true });
});

test('walkDir: ignores node_modules', () => {
  const tmp = createTempProject({
    'index.ts': 'export {};',
    'node_modules/pkg/index.ts': 'export {};',
  });
  const files = walkDir(tmp);
  assert.strictEqual(files.length, 1);
  fs.rmSync(tmp, { recursive: true });
});

test('walkDir: respects custom ignore', () => {
  const tmp = createTempProject({
    'a.ts': '',
    'vendor/b.ts': '',
    'src/c.ts': '',
  });
  const files = walkDir(tmp, ['vendor']);
  assert.strictEqual(files.length, 2);
  fs.rmSync(tmp, { recursive: true });
});

// ── buildGraph ─────────────────────────────────────────────────────

test('buildGraph: basic graph', () => {
  const tmp = createTempProject({
    'index.ts': `import { foo } from './foo';\nimport bar from './bar';`,
    'foo.ts': `export const foo = 1;`,
    'bar.ts': `export const bar = 2;`,
  });
  const { nodes, edges } = buildGraph(tmp);
  assert.strictEqual(nodes.size, 3);
  // 2 edges: index -> foo, index -> bar
  assert.strictEqual(edges.length, 2);
  fs.rmSync(tmp, { recursive: true });
});

test('buildGraph: tracks unresolved imports', () => {
  const tmp = createTempProject({
    'index.ts': `import { x } from './missing';`,
  });
  const { unresolved } = buildGraph(tmp);
  assert.strictEqual(unresolved.length, 1);
  assert.strictEqual(unresolved[0].specifier, './missing');
  fs.rmSync(tmp, { recursive: true });
});

test('buildGraph: resolves extension variants', () => {
  const tmp = createTempProject({
    'index.ts': `import { a } from './a';\nimport { b } from './b.js';`,
    'a.ts': 'export const a = 1;',
    'b.ts': 'export const b = 2;',
  });
  const { edges } = buildGraph(tmp);
  assert.strictEqual(edges.length, 2);
  fs.rmSync(tmp, { recursive: true });
});

test('buildGraph: resolves index files', () => {
  const tmp = createTempProject({
    'index.ts': `import { x } from './lib';`,
    'lib/index.ts': 'export const x = 1;',
  });
  const { edges } = buildGraph(tmp);
  assert.strictEqual(edges.length, 1);
  fs.rmSync(tmp, { recursive: true });
});

test('buildGraph: ignores bare imports for edges', () => {
  const tmp = createTempProject({
    'index.ts': `import React from 'react';`,
  });
  const { edges } = buildGraph(tmp);
  assert.strictEqual(edges.length, 0);
  fs.rmSync(tmp, { recursive: true });
});

test('buildGraph: node has import list', () => {
  const tmp = createTempProject({
    'index.ts': `import { a } from './a';\nimport { b } from './b';`,
    'a.ts': '',
    'b.ts': '',
  });
  const { nodes } = buildGraph(tmp);
  const indexPath = path.join(tmp, 'index.ts');
  const node = nodes.get(indexPath);
  assert.ok(node.imports.includes('./a'));
  assert.ok(node.imports.includes('./b'));
  fs.rmSync(tmp, { recursive: true });
});

// ── detectCycles ───────────────────────────────────────────────────

test('detectCycles: no cycles in DAG', () => {
  const tmp = createTempProject({
    'a.ts': `import { b } from './b';`,
    'b.ts': `import { c } from './c';`,
    'c.ts': `export const c = 1;`,
  });
  const graph = buildGraph(tmp);
  const cycles = detectCycles(graph.nodes, graph.edges, graph.rootDir);
  assert.strictEqual(cycles.length, 0);
  fs.rmSync(tmp, { recursive: true });
});

test('detectCycles: simple 2-node cycle', () => {
  const tmp = createTempProject({
    'a.ts': `import { b } from './b';`,
    'b.ts': `import { a } from './a';`,
  });
  const graph = buildGraph(tmp);
  const cycles = detectCycles(graph.nodes, graph.edges, graph.rootDir);
  assert.strictEqual(cycles.length, 1);
  assert.strictEqual(cycles[0].length, 2);
  fs.rmSync(tmp, { recursive: true });
});

test('detectCycles: self-referencing', () => {
  const tmp = createTempProject({
    'a.ts': `import { a } from './a';`,
  });
  const graph = buildGraph(tmp);
  const cycles = detectCycles(graph.nodes, graph.edges, graph.rootDir);
  assert.strictEqual(cycles.length, 1);
  fs.rmSync(tmp, { recursive: true });
});

test('detectCycles: 3-node cycle', () => {
  const tmp = createTempProject({
    'a.ts': `import { b } from './b';`,
    'b.ts': `import { c } from './c';`,
    'c.ts': `import { a } from './a';`,
  });
  const graph = buildGraph(tmp);
  const cycles = detectCycles(graph.nodes, graph.edges, graph.rootDir);
  assert.strictEqual(cycles.length, 1);
  assert.strictEqual(cycles[0].length, 3);
  fs.rmSync(tmp, { recursive: true });
});

test('detectCycles: deduplicates', () => {
  const tmp = createTempProject({
    'a.ts': `import { b } from './b';`,
    'b.ts': `import { a } from './a';`,
  });
  const graph = buildGraph(tmp);
  const cycles = detectCycles(graph.nodes, graph.edges, graph.rootDir);
  // Should only report once even though DFS may encounter from both nodes
  assert.strictEqual(cycles.length, 1);
  fs.rmSync(tmp, { recursive: true });
});

test('detectCycles: nested cycle in larger graph', () => {
  const tmp = createTempProject({
    'entry.ts': `import { a } from './a';\nimport { d } from './d';`,
    'a.ts': `import { b } from './b';`,
    'b.ts': `import { a } from './a';\nimport { c } from './c';`,
    'c.ts': `export const c = 1;`,
    'd.ts': `export const d = 1;`,
  });
  const graph = buildGraph(tmp);
  const cycles = detectCycles(graph.nodes, graph.edges, graph.rootDir);
  assert.strictEqual(cycles.length, 1);
  // Cycle should involve a and b
  assert.ok(cycles[0].includes('a.ts'));
  assert.ok(cycles[0].includes('b.ts'));
  fs.rmSync(tmp, { recursive: true });
});

// ── couplingMetrics ────────────────────────────────────────────────

test('couplingMetrics: computes afferent and efferent', () => {
  const tmp = createTempProject({
    'a.ts': `import { b } from './b';\nimport { c } from './c';`,
    'b.ts': `import { c } from './c';`,
    'c.ts': `export const c = 1;`,
  });
  const graph = buildGraph(tmp);
  const metrics = couplingMetrics(graph.nodes, graph.edges);
  const cMetrics = metrics.get(path.join(tmp, 'c.ts'));
  assert.strictEqual(cMetrics.afferent, 2);
  assert.strictEqual(cMetrics.efferent, 0);
  const aMetrics = metrics.get(path.join(tmp, 'a.ts'));
  assert.strictEqual(aMetrics.afferent, 0);
  assert.strictEqual(aMetrics.efferent, 2);
  fs.rmSync(tmp, { recursive: true });
});

test('couplingMetrics: instability calculation', () => {
  const tmp = createTempProject({
    'a.ts': `import { b } from './b';`,
    'b.ts': `export const b = 1;`,
  });
  const graph = buildGraph(tmp);
  const metrics = couplingMetrics(graph.nodes, graph.edges);
  const aM = metrics.get(path.join(tmp, 'a.ts'));
  const bM = metrics.get(path.join(tmp, 'b.ts'));
  // a: Ce=1, Ca=0 → I=1.0 (unstable)
  assert.strictEqual(aM.instability, 1);
  // b: Ce=0, Ca=1 → I=0.0 (stable)
  assert.strictEqual(bM.instability, 0);
  fs.rmSync(tmp, { recursive: true });
});

test('couplingMetrics: isolated module has 0 instability', () => {
  const tmp = createTempProject({
    'solo.ts': `export const x = 1;`,
  });
  const graph = buildGraph(tmp);
  const metrics = couplingMetrics(graph.nodes, graph.edges);
  const m = metrics.get(path.join(tmp, 'solo.ts'));
  assert.strictEqual(m.instability, 0);
  assert.strictEqual(m.afferent, 0);
  assert.strictEqual(m.efferent, 0);
  fs.rmSync(tmp, { recursive: true });
});

// ── hotspots ───────────────────────────────────────────────────────

test('hotspots: sorts by total coupling', () => {
  const tmp = createTempProject({
    'a.ts': `import { b } from './b';\nimport { c } from './c';\nimport { d } from './d';`,
    'b.ts': `import { c } from './c';`,
    'c.ts': `export const c = 1;`,
    'd.ts': `export const d = 1;`,
  });
  const graph = buildGraph(tmp);
  const metrics = couplingMetrics(graph.nodes, graph.edges);
  const spots = hotspots(metrics);
  // c.ts has Ca=2, Ce=0 = 2; a.ts has Ca=0, Ce=3 = 3
  assert.strictEqual(spots[0].path, 'a.ts');
  assert.strictEqual(spots[0].totalCoupling, 3);
  fs.rmSync(tmp, { recursive: true });
});

test('hotspots: respects limit', () => {
  const tmp = createTempProject({
    'a.ts': '',
    'b.ts': '',
    'c.ts': '',
  });
  const graph = buildGraph(tmp);
  const metrics = couplingMetrics(graph.nodes, graph.edges);
  const spots = hotspots(metrics, 2);
  assert.strictEqual(spots.length, 2);
  fs.rmSync(tmp, { recursive: true });
});

// ── orphans ────────────────────────────────────────────────────────

test('orphans: finds isolated modules', () => {
  const tmp = createTempProject({
    'a.ts': `import { b } from './b';`,
    'b.ts': `export const b = 1;`,
    'lonely.ts': `export const x = 1;`,
  });
  const graph = buildGraph(tmp);
  const metrics = couplingMetrics(graph.nodes, graph.edges);
  const orphanList = orphans(metrics);
  assert.strictEqual(orphanList.length, 1);
  assert.strictEqual(orphanList[0].path, 'lonely.ts');
  fs.rmSync(tmp, { recursive: true });
});

test('orphans: returns empty when all connected', () => {
  const tmp = createTempProject({
    'a.ts': `import { b } from './b';`,
    'b.ts': `export const b = 1;`,
  });
  const graph = buildGraph(tmp);
  const metrics = couplingMetrics(graph.nodes, graph.edges);
  const orphanList = orphans(metrics);
  assert.strictEqual(orphanList.length, 0);
  fs.rmSync(tmp, { recursive: true });
});

// ── summarize ──────────────────────────────────────────────────────

test('summarize: basic stats', () => {
  const tmp = createTempProject({
    'a.ts': `import { b } from './b';`,
    'b.ts': `import { a } from './a';`,
    'c.ts': `export const c = 1;`,
  });
  const graph = buildGraph(tmp);
  const cycles = detectCycles(graph.nodes, graph.edges, graph.rootDir);
  const metrics = couplingMetrics(graph.nodes, graph.edges);
  const summary = summarize(graph, cycles, metrics);
  assert.strictEqual(summary.totalModules, 3);
  assert.strictEqual(summary.totalCycles, 1);
  assert.strictEqual(summary.orphanCount, 1); // c.ts
  assert.ok(typeof summary.avgInstability === 'number');
  fs.rmSync(tmp, { recursive: true });
});

test('summarize: empty graph', () => {
  const tmp = createTempProject({});
  const graph = buildGraph(tmp);
  const cycles = detectCycles(graph.nodes, graph.edges, graph.rootDir);
  const metrics = couplingMetrics(graph.nodes, graph.edges);
  const summary = summarize(graph, cycles, metrics);
  assert.strictEqual(summary.totalModules, 0);
  assert.strictEqual(summary.totalCycles, 0);
  fs.rmSync(tmp, { recursive: true });
});

// ── resolveModule ──────────────────────────────────────────────────

test('resolveModule: resolves exact file', () => {
  const tmp = createTempProject({
    'foo.ts': 'export const x = 1;',
  });
  const resolved = resolveModule(path.join(tmp, 'index.ts'), './foo');
  assert.strictEqual(resolved, path.join(tmp, 'foo.ts'));
  fs.rmSync(tmp, { recursive: true });
});

test('resolveModule: resolves with extension', () => {
  const tmp = createTempProject({
    'bar.ts': 'export const x = 1;',
  });
  const resolved = resolveModule(path.join(tmp, 'index.ts'), './bar.ts');
  assert.strictEqual(resolved, path.join(tmp, 'bar.ts'));
  fs.rmSync(tmp, { recursive: true });
});

test('resolveModule: resolves index in folder', () => {
  const tmp = createTempProject({
    'lib/index.ts': 'export const x = 1;',
  });
  const resolved = resolveModule(path.join(tmp, 'main.ts'), './lib');
  assert.strictEqual(resolved, path.join(tmp, 'lib/index.ts'));
  fs.rmSync(tmp, { recursive: true });
});

test('resolveModule: returns null for missing', () => {
  const tmp = createTempProject({
    'index.ts': '',
  });
  const resolved = resolveModule(path.join(tmp, 'index.ts'), './nonexistent');
  assert.strictEqual(resolved, null);
  fs.rmSync(tmp, { recursive: true });
});

// ── Real-world scenarios ───────────────────────────────────────────

test('real world: typical project structure', () => {
  const tmp = createTempProject({
    'src/index.ts': `
      import { app } from './app';
      import { config } from './config';
    `,
    'src/app.ts': `
      import { router } from './routes';
      import { middleware } from './middleware';
    `,
    'src/routes.ts': `
      import { handler } from './handler';
    `,
    'src/handler.ts': `
      import { utils } from './utils';
    `,
    'src/middleware.ts': `export const middleware = () => {};`,
    'src/utils.ts': `export const utils = {};`,
    'src/config.ts': `export const config = {};`,
  });
  const graph = buildGraph(tmp);
  const cycles = detectCycles(graph.nodes, graph.edges, graph.rootDir);
  const metrics = couplingMetrics(graph.nodes, graph.edges);
  const summary = summarize(graph, cycles, metrics);

  assert.strictEqual(summary.totalModules, 7);
  assert.strictEqual(summary.totalCycles, 0);
  // config.ts is imported once, never imports → stable
  const configMetrics = metrics.get(path.join(tmp, 'src/config.ts'));
  assert.strictEqual(configMetrics.instability, 0);
  fs.rmSync(tmp, { recursive: true });
});

test('real world: diamond dependency', () => {
  const tmp = createTempProject({
    'a.ts': `import { b } from './b';\nimport { c } from './c';`,
    'b.ts': `import { d } from './d';`,
    'c.ts': `import { d } from './d';`,
    'd.ts': `export const d = 1;`,
  });
  const graph = buildGraph(tmp);
  const cycles = detectCycles(graph.nodes, graph.edges, graph.rootDir);
  const metrics = couplingMetrics(graph.nodes, graph.edges);
  const summary = summarize(graph, cycles, metrics);

  const dMetrics = metrics.get(path.join(tmp, 'd.ts'));
  assert.strictEqual(dMetrics.afferent, 2);
  assert.strictEqual(dMetrics.efferent, 0);
  fs.rmSync(tmp, { recursive: true });
});

// ── Run ────────────────────────────────────────────────────────────

async function run() {
  console.log('tsbound tests\n');

  // Handle any async tests if needed in future
  await Promise.resolve();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
