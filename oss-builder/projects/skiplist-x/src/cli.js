#!/usr/bin/env node
'use strict';

const { SkipList } = require('./index.js');
const { readFileSync } from 'fs';

const USAGE = `skiplist-x — probabilistic skip list CLI

Usage:
  skiplist-x insert <key> [value]     Insert or update a key
  skiplist-x search <key>             Look up a value by key
  skiplist-x delete <key>             Remove a key
  skiplist-x min                      Show minimum key
  skiplist-x max                      Show maximum key
  skiplist-x range <low> [high]       Entries in [low, high)
  skiplist-x index <n>                Entry at 0-based index
  skiplist-x list                     Dump all entries (ascending)
  skiplist-x stats                    Size, current level, distribution
  skiplist-x valid                    Check structural integrity
  skiplist-x demo                     Insert sample data and list

Options:
  --json        Emit JSON
  --compare=<fn>  js eval comparator (advanced) — default numeric

Data file:
  Reads entries from stdin when piped (JSON array of [key,value] or newline-delimited keys).
`;

function parseArgs(argv) {
  const args = { json: false, command: null, params: [] };
  for (const a of argv) {
    if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') args.help = true;
    else if (!args.command) args.command = a;
    else args.params.push(a);
  }
  return args;
}

function readStdin() {
  return new Promise((resolve) => {
    if (process.stdin.isTTY) return resolve(null);
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (c) => (data += c));
    process.stdin.on('end', () => resolve(data.trim() || null));
  });
}

function output(args, value) {
  if (args.json) {
    console.log(JSON.stringify(value, null, 2));
  } else {
    if (Array.isArray(value)) {
      for (const [k, v] of value) console.log(`${k}\t${v}`);
    } else if (typeof value === 'object' && value !== null) {
      for (const [k, v] of Object.entries(value)) console.log(`${k}: ${v}`);
    } else {
      console.log(value ?? '(not found)');
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.command) {
    console.log(USAGE);
    process.exit(0);
  }

  // Try to load existing data from stdin (bulk insert before command)
  const stdin = await readStdin();
  const sl = new SkipList();

  if (stdin) {
    try {
      const parsed = JSON.parse(stdin);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (Array.isArray(item)) sl.insert(item[0], item[1]);
          else sl.insert(item);
        }
      }
    } catch {
      // newline-delimited keys
      for (const line of stdin.split('\n')) {
        if (line.trim()) sl.insert(line.trim());
      }
    }
  }

  const [cmd, ...rest] = [args.command, ...args.params];

  switch (cmd) {
    case 'insert':
    case 'set': {
      const key = Number(rest[0]);
      const value = rest[1] !== undefined ? rest[1] : true;
      sl.insert(key, value);
      output(args, { inserted: [key, value], size: sl.size });
      break;
    }
    case 'search':
    case 'get': {
      const val = sl.search(Number(rest[0]));
      output(args, val ?? '(not found)');
      break;
    }
    case 'delete':
    case 'remove': {
      const ok = sl.delete(Number(rest[0]));
      output(args, { deleted: ok, size: sl.size });
      break;
    }
    case 'min': {
      output(args, sl.minKey() ?? '(empty)');
      break;
    }
    case 'max': {
      output(args, sl.maxKey() ?? '(empty)');
      break;
    }
    case 'range': {
      const low = Number(rest[0]);
      const high = rest[1] !== undefined ? Number(rest[1]) : undefined;
      output(args, sl.range(low, high));
      break;
    }
    case 'index': {
      const entry = sl.atIndex(Number(rest[0]));
      output(args, entry ? `${entry[0]}\t${entry[1]}` : '(out of bounds)');
      break;
    }
    case 'list': {
      output(args, sl.toArray());
      break;
    }
    case 'stats': {
      const heights = sl.debugHeights();
      const dist = {};
      for (const h of heights) dist[`L${h.level}`] = (dist[`L${h.level}`] || 0) + 1;
      output(args, {
        size: sl.size,
        currentLevel: sl.currentLevel,
        levelDistribution: dist,
        valid: sl.isValid(),
      });
      break;
    }
    case 'valid': {
      output(args, sl.isValid() ? 'valid ✅' : 'INVALID ❌');
      break;
    }
    case 'demo': {
      const demo = new SkipList();
      const sample = [42, 7, 99, 23, 15, 88, 3, 56, 71, 34];
      for (const n of sample) demo.insert(n, `val-${n}`);
      output(args, {
        size: demo.size,
        currentLevel: demo.currentLevel,
        entries: demo.toArray(),
        heights: demo.debugHeights(),
        valid: demo.isValid(),
      });
      break;
    }
    default:
      console.error(`Unknown command: ${cmd}`);
      console.log(USAGE);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
