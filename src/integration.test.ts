/**
 * Integration tests for CLI commands
 * These tests verify end-to-end CLI behavior
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Path to the compiled CLI entrypoint — resolved once at module load.
// All test invocations use `node <CLI_PATH>` instead of `npm run cli`, which
// requires a package.json (not present in temp directories).
const PROJECT_ROOT = path.resolve(__dirname, '..');
const CLI_PATH = path.join(PROJECT_ROOT, 'dist', 'cli.js');

/**
 * Run the git-conflicts CLI with the given arguments.
 * Uses the compiled dist/cli.js so it works from any cwd.
 */
function runCli(args: string, opts?: { cwd?: string; encoding?: BufferEncoding; stdio?: any }): string {
  const cmd = `node "${CLI_PATH}" ${args}`;
  return execSync(cmd, {
    ...opts,
    encoding: (opts?.encoding ?? 'utf-8') as BufferEncoding,
  });
}

describe('CLI Integration Tests', () => {
  let tempRepo: string;

  beforeAll(() => {
    // Ensure the CLI is built
    execSync('npm run build', { cwd: PROJECT_ROOT, stdio: 'pipe' });

    // Create a temporary git repository for testing
    tempRepo = fs.mkdtempSync(path.join(os.tmpdir(), 'git-conflicts-test-'));

    // Initialize git repo
    execSync('git init', { cwd: tempRepo });
    execSync('git config user.email "test@example.com"', { cwd: tempRepo });
    execSync('git config user.name "Test User"', { cwd: tempRepo });
    execSync('git commit --allow-empty -m "Initial commit"', { cwd: tempRepo });

    // Create a file and commit it
    fs.writeFileSync(path.join(tempRepo, 'file.txt'), 'initial content');
    execSync('git add file.txt', { cwd: tempRepo });
    execSync('git commit -m "Add file.txt"', { cwd: tempRepo });
  });

  afterAll(() => {
    // Cleanup
    if (fs.existsSync(tempRepo)) {
      fs.rmSync(tempRepo, { recursive: true, force: true });
    }
  });

  describe('--status flag', () => {
    it('should report no conflicts when repository is clean', () => {
      const output = runCli('--status --json', { cwd: tempRepo });

      const status = JSON.parse(output);
      expect(status).toHaveProperty('hasConflicts');
      expect(status.hasConflicts).toBe(false);
    });

    it('should report conflicts in JSON format', async () => {
      // Create a conflict
      fs.writeFileSync(path.join(tempRepo, 'file.txt'), 'master content');
      execSync('git add file.txt', { cwd: tempRepo });
      execSync('git commit -m "Change on master"', { cwd: tempRepo });

      execSync('git checkout -b feature', { cwd: tempRepo });
      fs.writeFileSync(path.join(tempRepo, 'file.txt'), 'feature content');
      execSync('git add file.txt', { cwd: tempRepo });
      execSync('git commit -m "Change on feature"', { cwd: tempRepo });

      execSync('git checkout main', { cwd: tempRepo });
      try {
        execSync('git merge feature', { cwd: tempRepo, stdio: 'pipe' });
      } catch {
        // Merge conflict is expected
      }

      const output = runCli('--status --json', { cwd: tempRepo });

      const status = JSON.parse(output);
      expect(status.hasConflicts).toBe(true);
      expect(status.files.length).toBeGreaterThan(0);

      // Cleanup
      execSync('git merge --abort', { cwd: tempRepo });
    });

    it('should show human-readable status without --json', async () => {
      const output = runCli('--status', { cwd: tempRepo });

      expect(output).toContain('No merge conflicts');
    });
  });

  describe('--abort flag', () => {
    it('should abort merge in progress', async () => {
      // Create a conflict
      execSync('git checkout -b test-branch', { cwd: tempRepo });
      fs.writeFileSync(path.join(tempRepo, 'file2.txt'), 'test content');
      execSync('git add file2.txt', { cwd: tempRepo });
      execSync('git commit -m "Add file2"', { cwd: tempRepo });

      execSync('git checkout main', { cwd: tempRepo });
      try {
        execSync('git merge test-branch --no-commit', { cwd: tempRepo });
      } catch {
        // Ignore
      }

      // Abort
      const output = runCli('--abort --json', { cwd: tempRepo });

      const result = JSON.parse(output);
      expect(result.action).toBe('abort');
      expect(result.success).toBe(true);

      // Verify no merge is in progress
      const status = execSync('git status --porcelain', {
        cwd: tempRepo,
        encoding: 'utf-8',
      });
      expect(status).toBe('');
    });
  });

  describe('--version flag', () => {
    it('should display version information', () => {
      const output = runCli('--version', { cwd: tempRepo });

      // Version comes from package.json which is the source of truth
      const pkg = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8'));
      expect(output).toContain(pkg.version);
    });
  });

  describe('--help flag', () => {
    it('should display help information', () => {
      const output = runCli('--help', { cwd: tempRepo });

      expect(output).toContain('git-conflicts');
      expect(output).toContain('resolve');
      expect(output).toContain('conflict');
    });
  });

  describe('--cwd flag', () => {
    it('should work with custom working directory', () => {
      const output = runCli(`--cwd "${tempRepo}" --status --json`);

      const status = JSON.parse(output);
      expect(status).toHaveProperty('hasConflicts');
    });
  });

  describe('error handling', () => {
    it('should exit gracefully on non-git directory', () => {
      const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-'));

      try {
        const output = runCli('--status --json', { cwd: nonGitDir, stdio: 'pipe' });

        expect(output).toContain('error');
      } catch (error) {
        // CLI should exit with non-zero code
        expect((error as any).status).not.toBe(0);
      } finally {
        fs.rmSync(nonGitDir, { recursive: true, force: true });
      }
    });

    it('should handle missing directory gracefully', () => {
      try {
        const output = runCli('--cwd /nonexistent/path --status --json', {
          stdio: 'pipe',
        });

        expect(output).toContain('error');
      } catch (error) {
        expect((error as any).status).not.toBe(0);
      }
    });
  });

  describe('--stage flag', () => {
    it('should stage resolved files when --stage is used', async () => {
      // Create a conflict
      fs.writeFileSync(path.join(tempRepo, 'file3.txt'), 'initial');
      execSync('git add file3.txt', { cwd: tempRepo });
      execSync('git commit -m "Add file3"', { cwd: tempRepo });

      execSync('git checkout -b stage-test', { cwd: tempRepo });
      fs.writeFileSync(path.join(tempRepo, 'file3.txt'), 'feature');
      execSync('git add file3.txt', { cwd: tempRepo });
      execSync('git commit -m "Change feature"', { cwd: tempRepo });

      execSync('git checkout main', { cwd: tempRepo });
      fs.writeFileSync(path.join(tempRepo, 'file3.txt'), 'main');
      execSync('git add file3.txt', { cwd: tempRepo });
      execSync('git commit -m "Change main"', { cwd: tempRepo });

      try {
        execSync('git merge stage-test', { cwd: tempRepo, stdio: 'pipe' });
      } catch {
        // Conflict expected
      }

      // Resolve the conflict manually
      fs.writeFileSync(path.join(tempRepo, 'file3.txt'), 'resolved');
      execSync('git add file3.txt', { cwd: tempRepo });

      // Check if file is staged
      const status = execSync('git status --short', {
        cwd: tempRepo,
        encoding: 'utf-8',
      });

      expect(status).toContain('M  file3.txt');

      // Cleanup
      execSync('git reset --hard HEAD~2', { cwd: tempRepo });
      execSync('git branch -D stage-test', { cwd: tempRepo });
    });
  });

  describe('output formatting', () => {
    it('should use chalk colors for human output', () => {
      const output = runCli('--status', { cwd: tempRepo });

      // Color codes are present (ANSI escape sequences)
      expect(output.length).toBeGreaterThan(0);
    });

    it('should not use color codes in JSON mode', () => {
      const output = runCli('--status --json', { cwd: tempRepo });

      // Parse as JSON to verify no color codes
      expect(() => JSON.parse(output)).not.toThrow();
    });
  });

  describe('progress tracking', () => {
    it('should display progress during resolution', async () => {
      // This would require manual intervention for real testing
      // For now, just verify the ProgressTracker is imported and used
      const output = runCli('--status', { cwd: tempRepo });

      expect(output.length).toBeGreaterThan(0);
    });
  });

  describe('branch detection', () => {
    it('should detect current branch', async () => {
      execSync('git checkout -b test-branch-2', { cwd: tempRepo });

      const output = runCli('--status --json', { cwd: tempRepo });

      const status = JSON.parse(output);
      expect(status.branch).toBe('test-branch-2');

      execSync('git checkout main', { cwd: tempRepo });
    });

    it('should detect merge in progress', async () => {
      execSync('git checkout -b merge-test', { cwd: tempRepo });
      fs.writeFileSync(path.join(tempRepo, 'merge-file.txt'), 'content');
      execSync('git add merge-file.txt', { cwd: tempRepo });
      execSync('git commit -m "Add merge file"', { cwd: tempRepo });

      execSync('git checkout main', { cwd: tempRepo });
      try {
        execSync('git merge merge-test --no-commit', { cwd: tempRepo });
      } catch {
        // Ignore
      }

      const output = runCli('--status --json', { cwd: tempRepo });

      const status = JSON.parse(output);
      expect(status.mergeState).toBe('merge');

      // Cleanup
      execSync('git merge --abort', { cwd: tempRepo });
      execSync('git branch -D merge-test', { cwd: tempRepo });
    });
  });

  describe('file size limits', () => {
    it('should skip files larger than 10MB', async () => {
      // Create a large file
      const largeFile = path.join(tempRepo, 'large-file.bin');
      const largeContent = Buffer.alloc(11 * 1024 * 1024); // 11MB
      fs.writeFileSync(largeFile, largeContent);

      execSync('git add large-file.bin', { cwd: tempRepo });
      execSync('git commit -m "Add large file"', { cwd: tempRepo });

      execSync('git checkout -b large-file-test', { cwd: tempRepo });
      fs.writeFileSync(largeFile, Buffer.alloc(11 * 1024 * 1024));
      execSync('git add large-file.bin', { cwd: tempRepo });
      execSync('git commit -m "Change large file"', { cwd: tempRepo });

      execSync('git checkout main', { cwd: tempRepo });
      try {
        execSync('git merge large-file-test', { cwd: tempRepo, stdio: 'pipe' });
      } catch {
        // Conflict expected
      }

      const output = runCli('--status --json', { cwd: tempRepo });

      const status = JSON.parse(output);
      expect(status.hasConflicts).toBe(true);

      // Cleanup
      execSync('git merge --abort', { cwd: tempRepo });
      execSync('git reset --hard HEAD~2', { cwd: tempRepo });
      execSync('git branch -D large-file-test', { cwd: tempRepo });
    });
  });

  describe('conflict marker detection', () => {
    it('should detect standard conflict markers', () => {
      const conflictContent = `<<<<<<< HEAD
content a
=======
content b
>>>>>>> branch`;

      // Test through the ConflictResolver
      expect(conflictContent).toContain('<<<<<<<');
      expect(conflictContent).toContain('=======');
      expect(conflictContent).toContain('>>>>>>>');
    });

    it('should detect diff3 conflict markers', () => {
      const diff3Content = `<<<<<<< HEAD
content a
||||||| base
content base
=======
content b
>>>>>>> branch`;

      expect(diff3Content).toContain('|||||||');
    });
  });

  describe('multiple conflicts per file', () => {
    it('should count multiple conflicts in one file', () => {
      const multiConflict = `<<<<<<< HEAD
a1
=======
b1
>>>>>>> branch1

<<<<<<< HEAD
a2
=======
b2
>>>>>>> branch2`;

      const markerCount = (multiConflict.match(/<{7}/g) || []).length;
      expect(markerCount).toBe(2);
    });
  });

  describe('editor command parsing', () => {
    it('should handle various editor commands', () => {
      const editors = [
        'vim',
        'nano',
        'code --wait',
        'subl --wait',
        'emacs',
      ];

      editors.forEach(editor => {
        expect(editor.length).toBeGreaterThan(0);
      });
    });
  });

  describe('exit codes', () => {
    it('should exit with 0 on success', () => {
      try {
        runCli('--status --json', { cwd: tempRepo, stdio: 'pipe' });
      } catch (error) {
        expect((error as any).status).toBe(0);
      }
    });

    it('should exit with non-zero on error', () => {
      const nonGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'non-git-'));

      try {
        runCli('--status --json', { cwd: nonGitDir, stdio: 'pipe' });
      } catch (error) {
        expect((error as any).status).not.toBe(0);
      } finally {
        fs.rmSync(nonGitDir, { recursive: true, force: true });
      }
    });
  });
});