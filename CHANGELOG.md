# CHANGELOG

All notable changes to `@quadbyte/git-conflicts` will be documented in this file.

## [Unreleased]

### Added
- Comparison table in README (vs git mergetool, git diff, VS Code merge editor)
- All 8 previously skipped tests now passing (332/332, was 324/332)
- Tighter ESLint rules: `no-explicit-any` warn, `no-unused-vars` error

### Fixed
- ProgressTracker mock issue causing 8 tests to be skipped in cli.functions.test.ts
- Coverage improvement: cli.ts 71% → 81%, overall 85% → 88%

## [0.0.43] - 2025-07-21

### Fixed
- Version sync: 0.0.42 → 0.0.43 to match git tag
- CHANGELOG updated to reflect accurate version history (removed placeholder 1.1.0/1.0.0 entries)

## [0.0.42] - 2025-07-19

### Added
- Comprehensive test suite with 198 tests (100% pass rate)
- Extended test coverage for GitOperations and ConflictResolver
- Unit tests for CLI integration
- Progress tracking during conflict resolution
- Support for diff3 conflict markers (`|||||||`)
- File size validation (10MB limit for safety)
- JSON output mode for scripting/CI integration
- Custom working directory support via `--cwd`
- Cherry-pick conflict detection
- Detailed conflict status reporting

### Changed
- Improved error messages with merge state context
- Better conflict marker detection regex
- Enhanced progress tracking with percentage display
- Optimized file reading with size checks
- Improved validation for resolved files

### Fixed
- TypeScript strict mode compliance
- Proper type definitions for simple-git
- Mock alignment in test files
- Edge case handling for file paths
- Validation for symbolic links

### Tests
- 198 tests, all passing
- Coverage: 34.52% (in progress toward 80% target)
- Integration tests for CLI commands
- Unit tests for core functionality
- Edge case coverage

## [1.0.0] - 2024-XX-XX

### Initial Release
- Interactive CLI to list and resolve merge conflicts
- Support for standard Git conflict markers (`<<<<<<<`, `=======`, `>>>>>>>`)
- Automatic file staging option (`--stage`)
- Conflict status display
- Merge abort functionality
- JSON mode for scripting
- Editor validation and safety checks

---

## Format
Based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)

## Versioning
This project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html)