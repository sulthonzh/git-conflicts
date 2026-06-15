#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const { generateMarkdown } = require('./index');

function usage() {
  console.error(`Usage: jsonschema-tomd <schema.json> [options]

Options:
  -o, --output <file>   Write markdown to file (default: stdout)
  -t, --title <title>   Override document title
  --max-depth <n>       Max nesting depth (default: 10)
  -h, --help            Show this help

Examples:
  jsonschema-tomd schema.json
  jsonschema-tomd schema.json -o README.md
  jsonschema-tomd schema.json --title "API Config" -o docs/api.md
`);
}

function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args.includes('-h') || args.includes('--help')) {
    usage();
    process.exit(args.length === 0 ? 1 : 0);
  }

  let inputFile = null;
  let outputFile = null;
  let title = null;
  let maxDepth = 10;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '-o' || a === '--output') {
      outputFile = args[++i];
    } else if (a === '-t' || a === '--title') {
      title = args[++i];
    } else if (a === '--max-depth') {
      maxDepth = parseInt(args[++i], 10);
    } else if (!a.startsWith('-')) {
      inputFile = a;
    } else {
      console.error(`Unknown option: ${a}`);
      usage();
      process.exit(1);
    }
  }

  if (!inputFile) {
    console.error('Error: input schema file required');
    usage();
    process.exit(1);
  }

  let raw;
  try {
    raw = fs.readFileSync(path.resolve(inputFile), 'utf8');
  } catch (err) {
    console.error(`Error reading file: ${err.message}`);
    process.exit(1);
  }

  let schema;
  try {
    schema = JSON.parse(raw);
  } catch (err) {
    console.error(`Invalid JSON: ${err.message}`);
    process.exit(1);
  }

  const md = generateMarkdown(schema, { title, maxDepth });

  if (outputFile) {
    fs.writeFileSync(path.resolve(outputFile), md, 'utf8');
    console.log(`✅ Written to ${outputFile}`);
  } else {
    console.log(md);
  }
}

main(process.argv);
