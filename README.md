# git-conflicts

Merge conflicts suck. `git diff --name-only --diff-filter=U` gives you a list — then you're on your own. git-conflicts gives you a guided workflow: one file at a time, editor opens automatically, conflict markers validated before moving on, progress tracked the whole way.

## vs Other Tools

| Tool | What it does | What it lacks |
|---|---|---|
| **git-conflicts** | Guided file-by-file resolution, editor integration, marker validation, progress tracking, JSON mode for CI | — |
| `git mergetool` | Opens a diff tool per file | No progress tracking, requires GUI diff tool, complex config |
| `git diff --diff-filter=U` | Lists conflicted files | No workflow — you manually open each file |
| `git checkout --conflict=diff3` | Re-generates conflict markers | Doesn't help resolve them |
| VS Code merge editor | Visual 3-way merge | IDE-bound, no CLI/CI integration |

## Problem

When `git merge` fails, developers face pain points:
1. `git diff --name-only --diff-filter=U` shows conflict files but no workflow
2. Manual opening each file in `$EDITOR` is tedious
3. No progress tracking during conflict resolution
4. Easy to miss resolving all conflicts before committing

## Features

- ✅ List conflicted files with progress counter
- ✅ Open each file in your preferred `$EDITOR`
- ✅ Validate conflict markers are resolved before continuing
- ✅ Cross-platform (macOS, Linux, Windows)
- ✅ Continue/abort functionality
- ✅ Zero configuration required

## Installation

```bash
npm install -g git-conflicts
```

## Usage

### Show conflict status

```bash
git-conflicts --status
```

Output:
```
🔥 Found 3 merge conflict(s)
📁 /path/to/repo (main)

1. src/components/LoginForm.tsx
2. src/utils/auth.ts
3. tests/auth.test.ts
```

### Resolve all conflicts interactively

```bash
git-conflicts
```

Output:
```
🔥 Found 3 merge conflict(s)
📁 /path/to/repo (main)

📄 Resolving: src/components/LoginForm.tsx
💡 Opening src/components/LoginForm.tsx in vim...
✅ Resolved src/components/LoginForm.tsx (1/3)

📄 Resolving: src/utils/auth.ts
💡 Opening src/utils/auth.ts in vim...
✅ Resolved src/utils/auth.ts (2/3)

📄 Resolving: tests/auth.test.ts
💡 Opening tests/auth.test.ts in vim...
✅ Resolved tests/auth.test.ts (3/3)

--- Summary ---
✅ Resolved: 3

🎉 All conflicts resolved!
Run "git commit" to complete the merge.
```

### Resolve with auto-staging

```bash
git-conflicts --stage
```

This automatically runs `git add` on each file after resolution, so you can run `git commit` directly when done.

### Abort current merge

```bash
git-conflicts --abort
```

### JSON output for CI/CD

```bash
git-conflicts --status --json
```

Output:
```json
{
  "hasConflicts": true,
  "files": ["src/app.ts", "src/utils.ts"],
  "branch": "main",
  "merging": "feature/login",
  "mergeState": "merge"
}
```

## Real-World Examples

### Example 1: Quick conflict resolution in a feature branch

You're working on a feature branch and `git merge main` resulted in conflicts:

```bash
$ git merge main
Auto-merging src/components/Button.tsx
CONFLICT (content): Merge conflict in src/components/Button.tsx
Auto-merging src/utils/helpers.ts
CONFLICT (content): Merge conflict in src/utils/helpers.ts
Automatic merge failed; fix conflicts and then commit the result.

$ git-conflicts
🔥 Found 2 merge conflict(s)
📁 /home/user/my-project (feature/login)
🔀 Merging: main

📄 src/components/Button.tsx (1 conflict)
[Your editor opens - you resolve conflicts and save]
✅ Resolved src/components/Button.tsx (1/2)

📄 src/utils/helpers.ts (1 conflict)
[Your editor opens - you resolve conflicts and save]
✅ Resolved src/utils/helpers.ts (2/2)

--- Summary ---
✅ Resolved: 2/2

🎉 All conflicts resolved!
Run "git add ." then "git commit" to complete the merge.

$ git add .
$ git commit
[feature/login 8f2a3b9] Merge branch 'main' into feature/login
```

### Example 2: Team workflow with cherry-pick conflicts

Your team uses cherry-pick to backport fixes. When cherry-picking causes conflicts:

```bash
$ git cherry-pick abc123f
error: could not apply abc123f... Fix critical bug
hint: after resolving the conflicts, mark the corrected paths
hint: with 'git add <paths>' or 'git rm <paths>'

$ git-conflicts --stage
🔥 Found 1 merge conflict(s)
📁 /home/user/production-branch (v2.1.x)
📋 Status: Cherry-pick in progress

📄 src/api/routes.ts (2 conflicts)
[Editor opens - you keep production-specific changes]
✅ Resolved & staged src/api/routes.ts (1/1)

--- Summary ---
✅ Resolved: 1/1

🎉 All conflicts resolved!
All resolved files staged. Run "git commit" to complete the merge.

$ git commit
[v2.1.x 7c8d9e0] Fix critical bug
```

### Example 3: CI/CD pipeline with conflict detection

In a CI/CD pipeline, you want to fail if there would be merge conflicts:

```yaml
# .github/workflows/conflict-check.yml
name: Check Merge Conflicts

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  check-conflicts:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install -g git-conflicts
      - name: Test merge with main
        run: |
          git merge origin/main --no-commit --no-ff
          conflicts=$(git-conflicts --status --json)
          if echo "$conflicts" | grep -q '"hasConflicts":true'; then
            echo "::error::Merge would cause conflicts in these files:"
            echo "$conflicts" | jq -r '.files[]' | sed 's/^/  - /'
            exit 1
          fi
          git merge --abort
```

When conflicts are detected, the GitHub Action fails with clear output:
```
::error::Merge would cause conflicts in these files:
  - src/lib/core.ts
  - src/types/index.ts
Error: Process completed with exit code 1
```

## Configuration

`git-conflicts` respects your environment variables:

- `EDITOR`: Your preferred text editor (e.g., `vim`, `code`, `nano`)
- `VISUAL`: Fallback editor if `EDITOR` is not set

If neither is set, it defaults to:
- `vim` on Unix/macOS
- `notepad` on Windows

## How it works

1. Detects merge conflicts using `git diff --name-only --diff-filter=U`
2. Opens each conflicted file in your configured editor
3. Validates that conflict markers (`<<<<<<<`) are removed
4. Tracks progress and shows summary
5. Prompts you to run `git commit` when done

## Requirements

- Node.js 18+
- Git

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Test
npm test

# Lint
npm run lint

# Format
npm run format
```

## License

MIT

## Author

Sulthon

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.