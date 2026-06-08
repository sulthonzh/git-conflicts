# envguard 🔒

[![npm version](https://img.shields.io/npm/v/envguard.svg)](https://www.npmjs.com/package/envguard) [![license](https://img.shields.io/github/license/sulthonzh/envguard)](https://github.com/sulthonzh/envguard/blob/main/LICENSE) [![tests](https://img.shields.io/badge/tests-75%20passing-brightgreen)](https://github.com/sulthonzh/envguard)

Validate `.env` files, detect secrets, keep env configs in sync.

A zero-dependency CLI tool that catches missing variables, leaked secrets, and type mismatches before they hit production.

## Install

```bash
npm install -g envguard
# or
npx envguard check
```

## Commands

### `envguard check [env-file] [example-file]`

Validate `.env` against `.env.example`. Reports missing keys, extra keys, and empty required values.

```bash
envguard check                    # .env vs .env.example
envguard check .env.local .env    # custom files
```

Exit code 1 if issues found, 0 if clean.

`--strict` — treat extra keys and all empty values as errors (not just `@required`):

```bash
envguard check --strict
```

### `envguard fix [env-file] [example-file]`

Sync `.env` with `.env.example` — adds missing keys, optionally removes extras.

```bash
envguard fix                         # add missing keys
envguard fix --prune                 # also remove keys not in .env.example
envguard fix --sort                  # alphabetically sort keys
envguard fix --dry-run               # preview changes without writing
envguard fix -o .env.fixed           # write to a different file
```

### `envguard diff [env-file] [example-file]`

Side-by-side key comparison between env files.

```
✓ DATABASE_URL
✗ REDIS_URL          ← missing
+ STRIPE_KEY          ← extra
! PORT               ← type mismatch
```

### `envguard secrets [env-file]`

Scan for leaked secrets and credentials. Detects:

- AWS Access Key IDs (`AKIA...`)
- AWS Secret Access Keys
- GitHub Tokens (`ghp_`, `ghs_`)
- Generic API Keys (20+ chars)
- Generic Tokens (32+ chars)
- Private Keys (`-----BEGIN ... PRIVATE KEY-----`)
- JWTs (`eyJ...`)

```bash
envguard secrets .env
```

Exit code 1 if secrets found, 0 if clean.

### `envguard lint [env-file]`

Lint your `.env` for structural quality issues. Catches problems that cause silent bugs:

- **Duplicate keys** — last value wins silently
- **Invalid key names** — keys must match `[A-Za-z_][A-Za-z0-9_]*`
- **Spaces around `=`** — `KEY = val` works in some shells but not all
- **Trailing whitespace** — invisible bugs in values
- **Unquoted values with spaces** — `KEY=hello world` drops everything after the space
- **Very long lines** — usually means a secret is inline instead of referenced

```bash
envguard lint .env              # errors only → exit 1 on errors
envguard lint .env --strict     # errors + warnings → exit 1 on any issue
envguard lint .env --json       # JSON output
```

### `envguard init [env-file]`

Generate `.env.example` from an existing `.env` file. Strips all values, keeps keys and comments.

```bash
envguard init          # reads .env, creates .env.example
```

### `envguard validate [env-file] [example-file]`

Full validation: check + type-aware validation using annotations in `.env.example`.

```env
# .env.example
DATABASE_URL=           # @required @type url
PORT=3000               # @type number
DEBUG=false             # @type boolean
```

Supported types: `string`, `number`, `boolean`, `url`, `email`, `json`

## .env.example Annotations

Annotate your `.env.example` to enable type validation:

| Annotation | Effect |
|---|---|
| `# @required` | Value must be present and non-empty |
| `# @type <type>` | Validate value matches type |
| `# @default <val>` | Document default value |

## Features

- **Zero runtime dependencies** — only `commander` for CLI parsing
- **Dual CJS/ESM** — works everywhere
- **CI-friendly** — exit codes for pipeline gates
- **JSON output** — `--json` flag for all commands
- **Secret redaction** — values shown masked, never leaked in output

## Use in CI

```yaml
# GitHub Actions
- name: Check env vars
  run: npx envguard check

- name: Scan for secrets
  run: npx envguard secrets
```

## Development

```bash
git clone https://github.com/sulthonzh/envguard.git
cd envguard
npm install
npm test          # 75 tests
npm run build     # dual CJS/ESM
```

## License

MIT © Sulthon
