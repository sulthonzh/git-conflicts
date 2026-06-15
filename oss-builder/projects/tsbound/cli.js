#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const {
  buildGraph,
  detectCycles,
  couplingMetrics,
  hotspots,
  orphans,
  summarize,
} = require('./index');

function usage() {
  console.log(`
tsbound — TypeScript import boundary & coupling analyzer

Usage:
  tsbound <directory> [options]

Options:
  --json              Output as JSON
  --cycles            Show only circular dependencies
  --hotspots          Show only coupling hotspots
  --orphans           Show only orphan modules
  --ci                Exit non-zero if cycles found
  --ignore <dirs>     Comma-separated dirs to ignore (default: node_modules,.git,dist,build)
  --help, -h          Show this help

Examples:
  tsbound src/
  tsbound src/ --json
  tsbound . --cycles --ci
`);
}

function parseArgs(argv) {
  const args = {
    dir: null,
    json: false,
    cycles: false,
    hotspots: false,
    orphans: false,
    ci: false,
    ignore: ['node_modules', '.git', 'dist', 'build', 'out', 'coverage'],
    help: false,
  };

  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--json': args.json = true; break;
      case '--cycles': args.cycles = true; break;
      case '--hotspots': args.hotspots = true; break;
      case '--orphans': args.orphans = true; break;
      case '--ci': args.ci = true; break;
      case '--help':
      case '-h': args.help = true; break;
      case '--ignore':
        args.ignore = (argv[++i] || '').split(',').map((s) => s.trim());
        break;
      default:
        if (!arg.startsWith('--')) positional.push(arg);
        break;
    }
  }
  args.dir = positional[0] || '.';
  return args;
}

function formatBar(value, max, width = 30) {
  const filled = max > 0 ? Math.round((value / max) * width) : 0;
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

function printHuman(graph, cycles, metrics, summary, filter) {
  // Header
  console.log(`\n📦 tsbound — Module Boundary Analysis`);
  console.log(`${'─'.repeat(50)}\n`);

  if (!filter || filter === 'summary') {
    console.log('Summary');
    console.log(`  Modules:        ${summary.totalModules}`);
    console.log(`  Edges:          ${summary.totalEdges}`);
    console.log(`  Circular deps:  ${summary.totalCycles}`);
    console.log(`  Orphan modules: ${summary.orphanCount}`);
    console.log(`  Avg instability: ${(summary.avgInstability * 100).toFixed(0)}%`);
    if (summary.unresolvedImports > 0) {
      console.log(`  Unresolved:     ${summary.unresolvedImports}`);
    }
    console.log();
  }

  if (!filter || filter === 'cycles') {
    if (cycles.length > 0) {
      console.log(`Circular Dependencies (${cycles.length})\n`);
      for (let i = 0; i < cycles.length; i++) {
        const cycle = cycles[i];
        console.log(`  ${i + 1}. ${cycle.join(' → ')} → ${cycle[0]}`);
      }
      console.log();
    } else if (!filter) {
      console.log('Circular Dependencies: None ✅\n');
    }
  }

  if (!filter || filter === 'hotspots') {
    const spots = hotspots(metrics, 10);
    if (spots.length > 0 && spots[0].totalCoupling > 0) {
      const maxCoupling = spots[0].totalCoupling;
      console.log('Coupling Hotspots (top 10)\n');
      for (const spot of spots) {
        if (spot.totalCoupling === 0) break;
        const bar = formatBar(spot.totalCoupling, maxCoupling);
        console.log(
          `  ${bar} ${spot.totalCoupling}  ${spot.path}`
        );
        console.log(
          `         Ca=${spot.afferent} Ce=${spot.efferent} I=${spot.instability.toFixed(2)}`
        );
      }
      console.log();
    }
  }

  if (!filter || filter === 'orphans') {
    const orphanList = orphans(metrics);
    if (orphanList.length > 0) {
      console.log(`Orphan Modules (${orphanList.length})\n`);
      for (const o of orphanList.slice(0, 20)) {
        console.log(`  ${o.path}`);
      }
      if (orphanList.length > 20) {
        console.log(`  ... and ${orphanList.length - 20} more`);
      }
      console.log();
    }
  }

  // Verdict
  if (summary.totalCycles > 0) {
    console.log(`⚠️  ${summary.totalCycles} circular dependency(s) found.`);
  } else {
    console.log('✅ No circular dependencies detected.');
  }
}

function printJSON(graph, cycles, metrics, summary) {
  const spots = hotspots(metrics, 10);
  const orphanList = orphans(metrics);

  const output = {
    summary,
    cycles: cycles.map((c) => [...c, c[0]]),
    hotspots: spots.filter((s) => s.totalCoupling > 0),
    orphans: orphanList,
    unresolvedImports: graph.unresolved,
  };
  console.log(JSON.stringify(output, null, 2));
}

function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    usage();
    process.exit(0);
  }

  const targetDir = path.resolve(args.dir);
  if (!fs.existsSync(targetDir) || !fs.statSync(targetDir).isDirectory()) {
    console.error(`Error: "${args.dir}" is not a valid directory.`);
    process.exit(1);
  }

  // Build graph
  const graph = buildGraph(targetDir, { ignore: args.ignore });
  const cycles = detectCycles(graph.nodes, graph.edges, graph.rootDir);
  const metrics = couplingMetrics(graph.nodes, graph.edges);
  const summary = summarize(graph, cycles, metrics);

  // Determine filter
  let filter = null;
  if (args.cycles) filter = 'cycles';
  else if (args.hotspots) filter = 'hotspots';
  else if (args.orphans) filter = 'orphans';

  if (args.json) {
    printJSON(graph, cycles, metrics, summary);
  } else {
    printHuman(graph, cycles, metrics, summary, filter);
  }

  if (args.ci && summary.totalCycles > 0) {
    process.exit(1);
  }
}

main();
