/**
 * Additional branch coverage tests for git.ts
 * Focusing on edge cases and error paths
 */

import { GitOperations } from './git';
import simpleGit from 'simple-git';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

jest.mock('simple-git');
jest.mock('fs/promises');
jest.mock('fs');

describe('GitOperations - Branch Coverage', () => {
  let gitOps: GitOperations;
  let mockGit: any;

  beforeEach(() => {
    mockGit = {
      status: jest.fn(),
      branch: jest.fn(),
      merge: jest.fn(),
      diff: jest.fn(),
      revparse: jest.fn(),
      nameRev: jest.fn(),
      raw: jest.fn(),
      add: jest.fn(),
    };
    (simpleGit as jest.Mock).mockReturnValue(mockGit);
    gitOps = new GitOperations();
    jest.clearAllMocks();
    (existsSync as jest.Mock).mockReturnValue(false);
    (readFile as jest.Mock).mockResolvedValue('');
  });

  describe('getMergeInfo - error handling', () => {
    beforeEach(() => {
      mockGit.status.mockResolvedValue({ current: 'main' });
    });

    it('should handle revparse error', async () => {
      mockGit.revparse.mockRejectedValue(new Error('Not a git repo'));

      await expect(gitOps.getMergeInfo()).rejects.toThrow('Failed to resolve git directory');
    });

    it('should handle unknown error in getMergeInfo', async () => {
      mockGit.revparse.mockRejectedValue('string error');

      await expect(gitOps.getMergeInfo()).rejects.toThrow('Failed to resolve git directory');
    });

    it('should handle MERGE_MSG read error gracefully', async () => {
      mockGit.revparse.mockResolvedValue('.git');
      (existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('MERGE_MSG');
      });
      (readFile as jest.Mock).mockRejectedValue(new Error('Read error'));

      const result = await gitOps.getMergeInfo();

      expect(result).toEqual({
        current: 'main',
        merging: undefined,
        mergeMessage: undefined,
      });
    });

    it('should handle MERGE_HEAD read error gracefully', async () => {
      mockGit.revparse.mockResolvedValue('.git');
      (existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('MERGE_HEAD');
      });
      (readFile as jest.Mock).mockRejectedValue(new Error('Read error'));
      mockGit.nameRev.mockResolvedValue('');

      const result = await gitOps.getMergeInfo();

      expect(result.merging).toBeUndefined();
    });

    it('should handle nameRev error with SHA fallback', async () => {
      mockGit.revparse.mockResolvedValue('.git');
      (existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('MERGE_HEAD');
      });
      (readFile as jest.Mock).mockResolvedValue('abc123def456789\n');
      mockGit.nameRev.mockRejectedValue(new Error('nameRev error'));

      const result = await gitOps.getMergeInfo();

      expect(result.merging).toBe('abc123d');
    });

    it('should handle empty SHA in MERGE_HEAD', async () => {
      mockGit.revparse.mockResolvedValue('.git');
      (existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('MERGE_HEAD');
      });
      (readFile as jest.Mock).mockResolvedValue('   \n');

      const result = await gitOps.getMergeInfo();

      expect(result.merging).toBeUndefined();
    });

    it('should handle SHA shorter than 7 chars', async () => {
      mockGit.revparse.mockResolvedValue('.git');
      (existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('MERGE_HEAD');
      });
      (readFile as jest.Mock).mockResolvedValue('ab\n');
      mockGit.nameRev.mockRejectedValue(new Error('error'));

      const result = await gitOps.getMergeInfo();

      expect(result.merging).toBe('ab');
    });

    it('should handle rebase head-name read error', async () => {
      mockGit.revparse.mockResolvedValue('.git');
      (existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('rebase-merge');
      });
      (readFile as jest.Mock).mockRejectedValue(new Error('Read error'));

      const result = await gitOps.getMergeInfo();

      expect(result.merging).toBeUndefined();
    });

    it('should handle empty head-name in rebase', async () => {
      mockGit.revparse.mockResolvedValue('.git');
      (existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('rebase-merge');
      });
      (readFile as jest.Mock).mockResolvedValue('   \n');

      const result = await gitOps.getMergeInfo();

      expect(result.merging).toBeUndefined();
    });

    it('should handle head-name without refs/heads prefix', async () => {
      mockGit.revparse.mockResolvedValue('.git');
      (existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('rebase-merge');
      });
      (readFile as jest.Mock).mockResolvedValue('feature-branch\n');

      const result = await gitOps.getMergeInfo();

      expect(result.merging).toBe('feature-branch');
    });
  });

  describe('abortMerge - error handling', () => {
    it('should handle not in merge state error', async () => {
      jest.spyOn(gitOps as any, 'getMergeState').mockResolvedValue('none');

      await expect(gitOps.abortMerge()).rejects.toThrow('Not in a merge state');
    });

    it('should handle other merge errors', async () => {
      jest.spyOn(gitOps as any, 'getMergeState').mockResolvedValue('merge');
      mockGit.merge.mockRejectedValue(new Error('Some other error'));

      await expect(gitOps.abortMerge()).rejects.toThrow('Some other error');
    });

    it('should handle non-error throw', async () => {
      jest.spyOn(gitOps as any, 'getMergeState').mockResolvedValue('merge');
      mockGit.merge.mockRejectedValue('string error');

      await expect(gitOps.abortMerge()).rejects.toBe('string error');
    });
  });

  describe('getMergeState - complex scenarios', () => {
    beforeEach(() => {
      mockGit.revparse.mockResolvedValue('.git');
    });

    it('should handle missing working_dir in status file', async () => {
      mockGit.status.mockResolvedValue({
        files: [{ index: 'U', path: 'file.ts' }]
      });

      const result = await (gitOps as any).getMergeState();

      expect(result).toBe('none');
    });

    it('should handle undefined working_dir in status file', async () => {
      mockGit.status.mockResolvedValue({
        files: [{ index: 'U', working_dir: undefined, path: 'file.ts' }]
      });

      const result = await (gitOps as any).getMergeState();

      expect(result).toBe('none');
    });

    it('should handle multiple files with different conflict codes', async () => {
      mockGit.status.mockResolvedValue({
        files: [
          { index: 'U', working_dir: 'U', path: 'file1.ts' },
          { index: 'A', working_dir: 'A', path: 'file2.ts' },
          { index: 'D', working_dir: 'D', path: 'file3.ts' }
        ]
      });

      const result = await (gitOps as any).getMergeState();

      expect(result).toBe('merge');
    });

    it('should prioritize rebase over merge when both exist', async () => {
      // When rebase-merge dir AND MERGE_HEAD both exist, rebase takes priority.
      // Rebase internally uses merge mechanics, so MERGE_HEAD existing doesn't
      // mean it's a standalone merge. The rebase-merge dir is the authoritative signal.
      mockGit.status.mockResolvedValue({
        files: [{ index: 'U', working_dir: 'U', path: 'file.ts' }]
      });
      (existsSync as jest.Mock).mockImplementation(() => true);

      const result = await (gitOps as any).getMergeState();

      expect(result).toBe('rebase');
    });

    it('should check rebase-merge only when no conflict files', async () => {
      mockGit.status.mockResolvedValue({ files: [] });
      (existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('rebase-merge');
      });

      const result = await (gitOps as any).getMergeState();

      expect(result).toBe('rebase');
    });

    it('should check CHERRY_PICK_HEAD only when no conflict files or rebase', async () => {
      mockGit.status.mockResolvedValue({ files: [] });
      (existsSync as jest.Mock).mockImplementation((path: string) => {
        return path.includes('CHERRY_PICK_HEAD');
      });

      const result = await (gitOps as any).getMergeState();

      expect(result).toBe('cherry-pick');
    });

    it('should handle error in existsSync call', async () => {
      mockGit.status.mockResolvedValue({ files: [] });
      (existsSync as jest.Mock).mockImplementation(() => {
        throw new Error('existsSync error');
      });

      const result = await (gitOps as any).getMergeState();

      // existsSync throws are caught by try-catch in getMergeState
      expect(result).toBe('unknown');
    });
  });

  describe('getConflictStatus - error handling', () => {
    it('should handle error in getMergeInfo', async () => {
      mockGit.diff.mockResolvedValue('file.ts');
      mockGit.status.mockResolvedValue({ current: 'main' });
      jest.spyOn(gitOps, 'getMergeInfo').mockRejectedValue(new Error('Merge info error'));

      await expect(gitOps.getConflictStatus()).rejects.toThrow('Failed to get conflict status');
    });

    it('should handle error in getMergeState', async () => {
      mockGit.diff.mockResolvedValue('file.ts');
      mockGit.status.mockResolvedValue({ current: 'main' });
      jest.spyOn(gitOps as any, 'getMergeState').mockRejectedValue(new Error('Merge state error'));

      await expect(gitOps.getConflictStatus()).rejects.toThrow('Failed to get conflict status');
    });

    it('should handle unknown error type', async () => {
      // getConflictedFiles wraps all errors
      mockGit.diff.mockRejectedValue('string error');

      // The error gets wrapped as 'Failed to get conflict status: Unknown error while getting conflicted files'
      await expect(gitOps.getConflictStatus()).rejects.toThrow('Failed to get conflict status');
    });
  });

  describe('getFileConflictStatus - comprehensive scenarios', () => {
    it('should handle isConflicted false but file read succeeds', async () => {
      mockGit.diff.mockResolvedValue('');
      mockGit.status.mockResolvedValue({
        files: [
          { path: 'file.ts', index: 'M', working_dir: ' ' }
        ]
      });
      (readFile as jest.Mock).mockResolvedValue('content');

      const result = await gitOps.getFileConflictStatus('file.ts');

      expect(result).toEqual({
        isConflicted: false,
        isStaged: true,
        isModified: false,
        conflictCount: 0,
      });
    });

    it('should handle isModified true', async () => {
      mockGit.diff.mockResolvedValue('');
      mockGit.status.mockResolvedValue({
        files: [
          { path: 'file.ts', index: ' ', working_dir: 'M' }
        ]
      });

      const result = await gitOps.getFileConflictStatus('file.ts');

      expect(result.isModified).toBe(true);
    });

    it('should handle both staged and modified', async () => {
      mockGit.diff.mockResolvedValue('');
      mockGit.status.mockResolvedValue({
        files: [
          { path: 'file.ts', index: 'M', working_dir: 'M' }
        ]
      });

      const result = await gitOps.getFileConflictStatus('file.ts');

      expect(result.isStaged).toBe(true);
      expect(result.isModified).toBe(true);
    });

    it('should handle getStatus error in getFileConflictStatus', async () => {
      mockGit.diff.mockResolvedValue('file.ts');
      mockGit.status.mockRejectedValue(new Error('Status error'));

      const result = await gitOps.getFileConflictStatus('file.ts');

      expect(result).toEqual({
        isConflicted: true,
        isStaged: false,
        isModified: false,
        conflictCount: 0,
      });
    });

    it('should handle isFileStaged error in getFileConflictStatus', async () => {
      mockGit.diff.mockResolvedValue('file.ts');
      mockGit.status.mockResolvedValue({
        files: [
          { path: 'file.ts', index: 'M', working_dir: ' ' }
        ]
      });
      jest.spyOn(gitOps, 'isFileStaged').mockRejectedValue(new Error('Staged error'));

      const result = await gitOps.getFileConflictStatus('file.ts');

      expect(result.isStaged).toBe(false);
    });

    it('should handle isFileModified error in getFileConflictStatus', async () => {
      mockGit.diff.mockResolvedValue('file.ts');
      mockGit.status.mockResolvedValue({
        files: [
          { path: 'file.ts', index: ' ', working_dir: 'M' }
        ]
      });
      jest.spyOn(gitOps, 'isFileModified').mockRejectedValue(new Error('Modified error'));

      const result = await gitOps.getFileConflictStatus('file.ts');

      expect(result.isModified).toBe(false);
    });
  });

  describe('stageFile - error handling', () => {
    it('should handle git add error', async () => {
      mockGit.add.mockRejectedValue(new Error('Add error'));

      await expect(gitOps.stageFile('file.ts')).rejects.toThrow('Add error');
    });

    it('should handle non-error throw', async () => {
      mockGit.add.mockRejectedValue('string error');

      // stageFile doesn't wrap errors - re-throws directly
      await expect(gitOps.stageFile('file.ts')).rejects.toBe('string error');
    });
  });

  describe('isFileConflicted - comprehensive', () => {
    it('should handle absolute path matching relative path', async () => {
      mockGit.diff.mockResolvedValue('src/file.ts');

      const result = await gitOps.isFileConflicted('src/file.ts');

      expect(result).toBe(true);
    });

    it('should handle path normalization edge cases', async () => {
      mockGit.diff.mockResolvedValue('file.ts');

      const result1 = await gitOps.isFileConflicted('./file.ts');
      const result2 = await gitOps.isFileConflicted('file.ts');

      expect(result1).toBe(result2);
    });

    it('should match absolute path inside workingDir (regression: isAbsolute check)', async () => {
      // Regression: toRelativePath had `isAbsolute(filePath)` check that
      // returned the original absolute path even when it was inside
      // workingDir, causing isFileConflicted/isFileStaged/isFileModified
      // to fail matching against git's relative path output.
      const cwd = process.cwd();
      mockGit.diff.mockResolvedValue('src/file.ts');

      const result = await gitOps.isFileConflicted(cwd + '/src/file.ts');

      expect(result).toBe(true);
    });
  });
});