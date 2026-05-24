# git-conflicts

Interactive CLI to list and resolve merge conflicts one file at a time with progress tracking.

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

### Abort current merge

```bash
git-conflicts --abort
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