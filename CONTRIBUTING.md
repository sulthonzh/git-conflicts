# Contributing to envguard

Thanks for your interest! Here's how to get started.

## Setup

```bash
git clone https://github.com/sulthonzh/envguard.git
cd envguard
npm install
```

## Development

```bash
npm run build    # Build with tsup
npm test         # Run tests with Vitest
```

## Making Changes

1. Create a branch: `git checkout -b feat/your-feature`
2. Make your changes with micro commits
3. Ensure `npm run build && npm test` pass
4. Open a Pull Request

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(scope): add new feature
fix(scope): fix a bug
docs: update documentation
test: add tests
chore: maintenance
```

## Reporting Issues

- Include Node.js version (`node -v`)
- Include envguard version
- Provide minimal reproduction steps
- Don't include real secrets in bug reports!

## License

By contributing, you agree your changes are licensed under MIT.
