'use strict';

// Core analyzer — parses TS/JS imports, builds a module graph,
// detects circular dependencies, and computes coupling metrics.

const fs = require('fs');
const path = require('path');

// ── Extensions we scan ─────────────────────────────────────────────
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.d.ts']);

// ── Import matching patterns ──────────────────────────────────────
// Static imports:  import { x } from './path'
// Dynamic imports: import('./path')
// Require:         require('./path')
// Export from:     export ... from './path'
const IMPORT_PATTERNS = [
  // import ... from '...'
  /\bimport\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
  // export ... from '...'
  /\bexport\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g,
  // import('...')
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  // require('...')
  /\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

/**
 * Check if a module specifier is a relative path.
 */
function isRelative(specifier) {
  return specifier.startsWith('./') || specifier.startsWith('../');
}

/**
 * Resolve a relative import to an absolute file path.
 * Tries common extensions and /index fallback.
 */
function resolveModule(fromFile, specifier) {
  const baseDir = path.dirname(fromFile);
  const resolved = path.resolve(baseDir, specifier);

  // Exact file
  if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
    return resolved;
  }

  // TS allows importing './foo.js' when file is './foo.ts'
  // Strip the extension and try all extensions
  const ext = path.extname(specifier);
  const base = ext ? resolved.slice(0, -ext.length) : resolved;

  // Try extensions
  for (const scanExt of SCAN_EXTENSIONS) {
    const withExt = base + scanExt;
    if (fs.existsSync(withExt) && fs.statSync(withExt).isFile()) {
      return withExt;
    }
  }

  // Try index files
  for (const scanExt of SCAN_EXTENSIONS) {
    const indexFile = path.join(resolved, 'index' + scanExt);
    if (fs.existsSync(indexFile) && fs.statSync(indexFile).isFile()) {
      return indexFile;
    }
  }

  return null;
}

/**
 * Extract all import specifiers from source code.
 */
function extractImports(source) {
  const specifiers = new Set();

  for (const pattern of IMPORT_PATTERNS) {
    // Reset lastIndex for reused regex
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(source)) !== null) {
      specifiers.add(match[1]);
    }
  }

  return specifiers;
}

/**
 * Walk a directory recursively, returning all scannable source files.
 */
function walkDir(dir, ignore = ['node_modules', '.git', 'dist', 'build', 'out', 'coverage']) {
  const results = [];

  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!ignore.includes(entry.name)) {
        results.push(...walkDir(fullPath, ignore));
      }
    } else if (entry.isFile()) {
      const ext = path.extname(entry.name);
      if (SCAN_EXTENSIONS.has(ext)) {
        results.push(fullPath);
      }
    }
  }

  return results;
}

/**
 * Build a module dependency graph from a root directory.
 * Returns:
 *   nodes:  Map<absolutePath, { path, relativePath, imports: string[], resolvedImports: string[] }>
 *   edges:  Array<{ from, to }>
 *   unresolved: Array<{ from, specifier }>
 */
function buildGraph(rootDir, options = {}) {
  const ignore = options.ignore || ['node_modules', '.git', 'dist', 'build', 'out', 'coverage'];
  const absRoot = path.resolve(rootDir);
  const files = walkDir(absRoot, ignore);

  const nodes = new Map();
  const edges = [];
  const unresolved = [];

  // Create nodes
  for (const file of files) {
    const relativePath = path.relative(absRoot, file);
    nodes.set(file, {
      path: file,
      relativePath,
      imports: [],
      resolvedImports: [],
    });
  }

  // Parse imports and build edges
  for (const file of files) {
    const node = nodes.get(file);
    let source;
    try {
      source = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }

    const specifiers = extractImports(source);

    for (const specifier of specifiers) {
      node.imports.push(specifier);

      if (isRelative(specifier)) {
        const resolved = resolveModule(file, specifier);
        if (resolved && nodes.has(resolved)) {
          node.resolvedImports.push(resolved);
          edges.push({ from: file, to: resolved });
        } else if (!resolved) {
          unresolved.push({ from: file, specifier });
        }
      }
      // Bare imports (npm packages) are tracked but not edges
    }
  }

  return { nodes, edges, unresolved, rootDir: absRoot };
}

/**
 * Detect circular dependencies using DFS.
 * Returns array of cycles, each cycle is an array of relative paths.
 */
function detectCycles(nodes, edges, rootDir) {
  // Build adjacency list
  const adj = new Map();
  for (const [key] of nodes) {
    adj.set(key, []);
  }
  for (const edge of edges) {
    adj.get(edge.from)?.push(edge.to);
  }

  const cycles = [];
  const visited = new Set();
  const recStack = new Set();
  const pathArr = [];

  function dfs(node) {
    visited.add(node);
    recStack.add(node);
    pathArr.push(node);

    const neighbors = adj.get(node) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        dfs(neighbor);
      } else if (recStack.has(neighbor)) {
        // Found a cycle — extract it
        const cycleStart = pathArr.indexOf(neighbor);
        const cycle = pathArr.slice(cycleStart).map((p) =>
          path.relative(rootDir, p)
        );
        cycles.push(cycle);
      }
    }

    pathArr.pop();
    recStack.delete(node);
  }

  for (const [key] of nodes) {
    if (!visited.has(key)) {
      dfs(key);
    }
  }

  // Deduplicate cycles (same cycle can be found from different starting points)
  const seen = new Set();
  const unique = [];
  for (const cycle of cycles) {
    // Normalize: rotate so smallest element is first
    const minIdx = cycle.indexOf(Math.min(...cycle));
    const normalized = [...cycle.slice(minIdx), ...cycle.slice(0, minIdx)].join('→');
    if (!seen.has(normalized)) {
      seen.add(normalized);
      unique.push(cycle);
    }
  }

  return unique;
}

/**
 * Compute coupling metrics for each module.
 *
 * Afferent coupling (Ca): how many modules depend on this one
 * Efferent coupling (Ce): how many modules this one depends on
 * Instability (I): Ce / (Ca + Ce) — 0 = stable, 1 = unstable
 */
function couplingMetrics(nodes, edges) {
  const metrics = new Map();

  for (const [key, node] of nodes) {
    metrics.set(key, {
      path: node.relativePath,
      afferent: 0,   // incoming
      efferent: 0,   // outgoing
      instability: 0,
    });
  }

  for (const edge of edges) {
    if (metrics.has(edge.from)) metrics.get(edge.from).efferent++;
    if (metrics.has(edge.to)) metrics.get(edge.to).afferent++;
  }

  for (const [, m] of metrics) {
    const total = m.afferent + m.efferent;
    m.instability = total === 0 ? 0 : m.efferent / total;
  }

  return metrics;
}

/**
 * Find the most tightly coupled modules (highest fan-in + fan-out).
 */
function hotspots(metrics, limit = 10) {
  return [...metrics.values()]
    .map((m) => ({
      ...m,
      totalCoupling: m.afferent + m.efferent,
    }))
    .sort((a, b) => b.totalCoupling - a.totalCoupling)
    .slice(0, limit);
}

/**
 * Detect orphan modules (no incoming or outgoing internal dependencies).
 */
function orphans(metrics) {
  return [...metrics.values()].filter(
    (m) => m.afferent === 0 && m.efferent === 0
  );
}

/**
 * Compute summary stats.
 */
function summarize(graph, cycles, metrics) {
  const totalModules = graph.nodes.size;
  const totalEdges = graph.edges.length;
  const totalCycles = cycles.length;
  const orphanCount = orphans(metrics).length;

  // Modules involved in cycles
  const cycleModules = new Set();
  for (const cycle of cycles) {
    for (const mod of cycle) {
      cycleModules.add(mod);
    }
  }

  // Average instability
  let avgInstability = 0;
  if (totalModules > 0) {
    let sum = 0;
    for (const [, m] of metrics) sum += m.instability;
    avgInstability = sum / totalModules;
  }

  return {
    totalModules,
    totalEdges,
    totalCycles,
    orphanCount,
    cycleModuleCount: cycleModules.size,
    avgInstability: Math.round(avgInstability * 100) / 100,
    unresolvedImports: graph.unresolved.length,
  };
}

module.exports = {
  SCAN_EXTENSIONS,
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
};
