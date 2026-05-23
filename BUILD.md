# BUILD.md — EnvGuard CLI

## Overview
A zero-dependency CLI tool to validate `.env` files, detect secrets, and keep env configs in sync.

## Package
- **Name:** `envguard`
- **Description:** 🔒 Validate .env files, detect secrets, keep env configs in sync
- **License:** MIT

## Architecture

```
src/
├── index.ts          # Main entry (bin)
├── commands/
│   ├── check.ts      # Validate .env against .env.example
│   ├── diff.ts       # Show differences between env files
│   ├── secrets.ts    # Scan for leaked secrets
│   ├── init.ts       # Generate .env.example from .env
│   └── validate.ts   # Type-aware validation
├── lib/
│   ├── parser.ts     # .env file parser
│   ├── scanner.ts    # Secret pattern detection
│   ├── types.ts      # Type validation rules
│   └── output.ts     # Formatting + JSON output
├── templates/
│   └── patterns.ts   # Secret regex patterns
tests/
├── parser.test.ts
├── check.test.ts
├── diff.test.ts
├── secrets.test.ts
├── init.test.ts
├── validate.test.ts
└── fixtures/
    ├── .env
    ├── .env.example
    ├── .env.missing
    └── .env.secrets
```

## Commands

### `envguard check [env-file] [example-file]`
- Default: `.env` vs `.env.example`
- Report: missing keys, extra keys, empty values that shouldn't be
- Exit 1 if issues found, 0 if clean

### `envguard diff [env-file] [example-file]`
- Side-by-side key comparison
- Show: ✓ present, ✗ missing, + extra, ! type mismatch

### `envguard secrets [env-file]`
- Scan for patterns: AWS keys, GitHub tokens, private keys, generic API keys
- Report matches with line numbers
- Exit 1 if secrets found

### `envguard init [env-file]`
- Read .env, generate .env.example with empty values
- Strip all values, keep keys + comments
- Add `# @required` for non-empty values

### `envguard validate [env-file] [example-file]`
- Full validation: check + type validation
- Type hints from .env.example comments: `# @type number`, `# @type url`, `# @type boolean`
- Report all violations

## .env.example Format
```env
# Database config
DATABASE_URL=           # @required @type url
DB_PORT=5432            # @type number
DB_NAME=myapp           # @required

# Optional
DEBUG=false             # @type boolean
LOG_LEVEL=info
```

## Secret Patterns (minimum viable set)
- AWS Access Key: `AKIA[0-9A-Z]{16}`
- AWS Secret Key: 40-char base64 after known key names
- GitHub Token: `gh[ps]_[A-Za-z0-9_]{36,}`
- Generic API Key: alphanumeric 20+ chars after `api_key`, `apikey`, `secret` key names
- Private Key: `-----BEGIN (RSA |EC |DSA )?PRIVATE KEY-----`
- JWT: `eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+`
- Generic Token: 32+ hex/alpha string after `token`, `bearer` key names

## Dependencies
**Runtime: ZERO** (only dev deps)
- `commander` — CLI framework (but if we want zero deps, use process.argv directly... actually commander is fine for DX)
- Actually: keep it truly zero. Parse args manually. Small enough.

Wait, Commander.js is acceptable. It's small and standard. Let's use it.

**Dev:**
- `typescript` — compilation
- `vitest` — testing
- `@types/node` — types
- `tsup` — build (dual CJS/ESM)
- `prettier` — formatting

## Security
- Input validation on ALL file paths (no path traversal)
- No eval() or dynamic code execution
- All regex patterns are static (no ReDoS)
- File reads limited to .env-like files
- No network requests
- No secrets in output by default (show key name + redacted value)

## Testing
- Unit tests for parser, scanner, each command
- Integration tests with fixture .env files
- Edge cases: empty files, missing files, malformed entries, BOM, comments, quoted values
- Target: 30+ tests

## Build
- `tsup` for dual CJS/ESM output
- Bin entry: `"bin": { "envguard": "./dist/index.js" }`
- Files: `["dist"]`
- Engines: `"node": ">=18"`
