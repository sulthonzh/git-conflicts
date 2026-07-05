/**
 * Additional comprehensive tests for GitOperations
 * Focusing on uncovered lines in git.ts
 */

import { GitOperations } from './git';
import simpleGit from 'simple-git';
import fs from 'fs';
import fsPromises from 'fs/promises';

jest.mock('simple-git');
jest.mock('fs');
jest.mock('fs/promises');

describe('GitOperations - Extended Coverage', () => {
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
      checkout: jest.fn(),
      checkoutFiles: jest.fn(),
      log: jest.fn(),
      stash: jest.fn(),
      add: jest.fn(),
    };
    (simpleGit as jest.Mock).mockReturnValue(mockGit);
    gitOps = new GitOperations();
    jest.clearAllMocks();
  });

  describe('getConflictedFiles - edge cases', () => {
    it('should handle empty diff output', async () => {
      mockGit.diff.mockResolvedValue('');

      const files = await gitOps.getConflictedFiles();

      expect(files).toEqual([]);
    });

    it('should handle whitespace-only diff output', async () => {
      mockGit.diff.mockResolvedValue('   \n   \n   ');

      const files = await gitOps.getConflictedFiles();

      expect(files).toEqual([]);
    });

    it('should handle files with spaces in names', async () => {
      mockGit.diff.mockResolvedValue('file with spaces.ts\nanother file.ts');

      const files = await gitOps.getConflictedFiles();

      expect(files).toEqual(['file with spaces.ts', 'another file.ts']);
    });

    it('should handle files with special characters', async () => {
      mockGit.diff.mockResolvedValue('file-test.ts\nfile_test.ts');

      const files = await gitOps.getConflictedFiles();

      expect(files).toEqual(['file-test.ts', 'file_test.ts']);
    });

    it('should handle trailing newlines', async () => {
      mockGit.diff.mockResolvedValue('file1.ts\nfile2.ts\n');

      const files = await gitOps.getConflictedFiles();

      expect(files).toEqual(['file1.ts', 'file2.ts']);
    });

    it('should handle carriage returns', async () => {
      mockGit.diff.mockResolvedValue('file1.ts\r\nfile2.ts\r\n');

      const files = await gitOps.getConflictedFiles();

      expect(files).toEqual(['file1.ts', 'file2.ts']);
    });
  });

  describe('getCurrentBranch - edge cases', () => {
    it('should handle empty branch name', async () => {
      mockGit.status.mockResolvedValue({ current: '' });

      const branch = await gitOps.getCurrentBranch();

      expect(branch).toBe('HEAD');
    });

    it('should handle undefined branch name', async () => {
      mockGit.status.mockResolvedValue({ current: undefined });

      const branch = await gitOps.getCurrentBranch();

      expect(branch).toBe('HEAD');
    });

    it('should handle detached HEAD state', async () => {
      mockGit.status.mockResolvedValue({ current: 'HEAD' });

      const branch = await gitOps.getCurrentBranch();

      expect(branch).toBe('HEAD');
    });

    it('should handle branch names with slashes', async () => {
      mockGit.status.mockResolvedValue({ current: 'feature/new-branch' });

      const branch = await gitOps.getCurrentBranch();

      expect(branch).toBe('feature/new-branch');
    });

    it('should handle branch names with special characters', async () => {
      mockGit.status.mockResolvedValue({ current: 'feature/123-test' });

      const branch = await gitOps.getCurrentBranch();

      expect(branch).toBe('feature/123-test');
    });
  });

  describe('isMergeInProgress - detailed states', () => {
    it('should return true for merge state', async () => {
      const mockGetMergeState = jest.spyOn(gitOps as any, 'getMergeState')
        .mockResolvedValue('merge');

      const result = await gitOps.isMergeInProgress();

      expect(result).toBe(true);
      mockGetMergeState.mockRestore();
    });

    it('should return true for rebase state', async () => {
      const mockGetMergeState = jest.spyOn(gitOps as any, 'getMergeState')
        .mockResolvedValue('rebase');

      const result = await gitOps.isMergeInProgress();

      expect(result).toBe(true);
      mockGetMergeState.mockRestore();
    });

    it('should return true for cherry-pick state', async () => {
      const mockGetMergeState = jest.spyOn(gitOps as any, 'getMergeState')
        .mockResolvedValue('cherry-pick');

      const result = await gitOps.isMergeInProgress();

      expect(result).toBe(true);
      mockGetMergeState.mockRestore();
    });

    it('should return false for none state', async () => {
      const mockGetMergeState = jest.spyOn(gitOps as any, 'getMergeState')
        .mockResolvedValue('none');

      const result = await gitOps.isMergeInProgress();

      expect(result).toBe(false);
      mockGetMergeState.mockRestore();
    });

    it('should return false for unknown state', async () => {
      const mockGetMergeState = jest.spyOn(gitOps as any, 'getMergeState')
        .mockResolvedValue('unknown');

      const result = await gitOps.isMergeInProgress();

      expect(result).toBe(false);
      mockGetMergeState.mockRestore();
    });

    it('should return false on getMergeState error', async () => {
      const mockGetMergeState = jest.spyOn(gitOps as any, 'getMergeState')
        .mockRejectedValue(new Error('Git error'));

      const result = await gitOps.isMergeInProgress();

      expect(result).toBe(false);
      mockGetMergeState.mockRestore();
    });
  });

  describe('hasConflictMarkers - comprehensive patterns', () => {
    it('should detect <<<<<<< at start of line', () => {
      const content = '<<<<<<< HEAD\nconst a = 1;';
      expect(gitOps.hasConflictMarkers(content)).toBe(true);
    });

    it('should not detect <<<<<<< with leading whitespace', () => {
      // Regex only matches at line start (^)
      const content = '  <<<<<<< HEAD\nconst a = 1;';
      expect(gitOps.hasConflictMarkers(content)).toBe(false);
    });

    it('should detect ======= at start of line', () => {
      const content = '=======\nconst b = 2;';
      expect(gitOps.hasConflictMarkers(content)).toBe(true);
    });

    it('should not detect ======= with leading whitespace', () => {
      const content = '  =======\nconst b = 2;';
      expect(gitOps.hasConflictMarkers(content)).toBe(false);
    });

    it('should detect >>>>>>> at start of line', () => {
      const content = '>>>>>>> branch\nconst c = 3;';
      expect(gitOps.hasConflictMarkers(content)).toBe(true);
    });

    it('should not detect >>>>>>> with leading whitespace', () => {
      const content = '  >>>>>>> branch\nconst c = 3;';
      expect(gitOps.hasConflictMarkers(content)).toBe(false);
    });

    it('should detect ||||||| (diff3) at start of line', () => {
      const content = '|||||||\nbase version';
      expect(gitOps.hasConflictMarkers(content)).toBe(true);
    });

    it('should not detect ||||||| with leading whitespace', () => {
      const content = '  |||||||\nbase version';
      expect(gitOps.hasConflictMarkers(content)).toBe(false);
    });

    it('should not match markers in strings', () => {
      const content = 'const marker = "<<<<<<< HEAD";';
      expect(gitOps.hasConflictMarkers(content)).toBe(false);
    });

    it('should not match markers in comments', () => {
      const content = '// This is a comment <<<<<<< HEAD';
      expect(gitOps.hasConflictMarkers(content)).toBe(false);
    });

    it('should not match markers in template literals', () => {
      const content = 'const str = `<<<<<<< HEAD`;';
      expect(gitOps.hasConflictMarkers(content)).toBe(false);
    });

    it('should detect multiple markers', () => {
      const content = `<<<<<<< HEAD
a
=======
b
>>>>>>> branch`;
      expect(gitOps.hasConflictMarkers(content)).toBe(true);
    });

    it('should return false for clean content with similar patterns', () => {
      const content = 'const a = b <<<< c >>> d;';
      expect(gitOps.hasConflictMarkers(content)).toBe(false);
    });
  });

  describe('countConflicts - comprehensive scenarios', () => {
    it('should count single conflict', () => {
      const content = `<<<<<<< HEAD
const a = 1;
=======
const b = 2;
>>>>>>> branch`;
      expect(gitOps.countConflicts(content)).toBe(1);
    });

    it('should count multiple conflicts', () => {
      const content = `<<<<<<< HEAD
const a = 1;
=======
const b = 2;
>>>>>>> branch1

<<<<<<< HEAD
const c = 3;
=======
const d = 4;
>>>>>>> branch2`;
      expect(gitOps.countConflicts(content)).toBe(2);
    });

    it('should count 10 conflicts', () => {
      let content = '';
      for (let i = 0; i < 10; i++) {
        content += `<<<<<<< HEAD\na${i}\n=======\nb${i}\n>>>>>>> branch${i}\n\n`;
      }
      expect(gitOps.countConflicts(content)).toBe(10);
    });

    it('should return 0 for clean content', () => {
      const content = 'const a = 1;\nconst b = 2;';
      expect(gitOps.countConflicts(content)).toBe(0);
    });

    it('should handle empty content', () => {
      expect(gitOps.countConflicts('')).toBe(0);
    });

    it('should handle content with only markers', () => {
      const content = '<<<<<<<\n=======\n>>>>>>>';
      expect(gitOps.countConflicts(content)).toBe(1);
    });

    it('should handle incomplete conflicts', () => {
      const content = '<<<<<<< HEAD\nconst a = 1;\n======='; // Missing >>>>>>>
      // countConflicts counts <<<<<<< markers, not complete conflicts
      expect(gitOps.countConflicts(content)).toBe(1);
    });
  });

  describe('abortMerge - edge cases', () => {
    it('should call git merge --abort for merge state', async () => {
      jest.spyOn(gitOps as any, 'getMergeState').mockResolvedValue('merge');
      mockGit.merge.mockResolvedValue(undefined);

      await gitOps.abortMerge();

      expect(mockGit.merge).toHaveBeenCalledWith(['--abort']);
    });

    it('should call git rebase --abort for rebase state', async () => {
      jest.spyOn(gitOps as any, 'getMergeState').mockResolvedValue('rebase');
      mockGit.raw.mockResolvedValue(undefined);

      await gitOps.abortMerge();

      expect(mockGit.raw).toHaveBeenCalledWith(['rebase', '--abort']);
    });

    it('should handle abort already in progress', async () => {
      jest.spyOn(gitOps as any, 'getMergeState').mockResolvedValue('merge');
      mockGit.merge.mockResolvedValue(undefined);

      await gitOps.abortMerge();

      expect(mockGit.merge).toHaveBeenCalledWith(['--abort']);
    });
  });

  describe('getMergeState - detailed states', () => {
    it('should return unknown on error', async () => {
      mockGit.revparse.mockRejectedValue(new Error('Error'));

      const state = await (gitOps as any).getMergeState();

      expect(state).toBe('unknown');
    });
  });



  describe('stageFile - edge cases', () => {
    it('should call git add with single file', async () => {
      mockGit.add.mockResolvedValue(undefined);

      await gitOps.stageFile('file.ts');

      expect(mockGit.add).toHaveBeenCalledWith('file.ts');
    });

    it('should call git add with file containing spaces', async () => {
      mockGit.add.mockResolvedValue(undefined);

      await gitOps.stageFile('file with spaces.ts');

      expect(mockGit.add).toHaveBeenCalledWith('file with spaces.ts');
    });

    it('should call git add with file containing special characters', async () => {
      mockGit.add.mockResolvedValue(undefined);

      await gitOps.stageFile('file-test_123.ts');

      expect(mockGit.add).toHaveBeenCalledWith('file-test_123.ts');
    });
  });

  describe('getConflictStatus - comprehensive', () => {
    it('should handle error', async () => {
      mockGit.diff.mockRejectedValue(new Error('Git error'));

      await expect(gitOps.getConflictStatus()).rejects.toThrow('Failed to get conflict status');
    });
  });

  describe('isFileConflicted - comprehensive', () => {
    it('should return true for conflicted file', async () => {
      mockGit.diff.mockResolvedValue('file.ts');

      const isConflicted = await gitOps.isFileConflicted('file.ts');

      expect(isConflicted).toBe(true);
    });

    it('should return false for clean file', async () => {
      mockGit.diff.mockResolvedValue('');

      const isConflicted = await gitOps.isFileConflicted('file.ts');

      expect(isConflicted).toBe(false);
    });

    it('should handle filename matching', async () => {
      mockGit.diff.mockResolvedValue('file.ts');

      const isConflicted = await gitOps.isFileConflicted('file.ts');

      expect(isConflicted).toBe(true);
    });

    it('should handle filename not matching', async () => {
      mockGit.diff.mockResolvedValue('other-file.ts');

      const isConflicted = await gitOps.isFileConflicted('file.ts');

      expect(isConflicted).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle git diff errors', async () => {
      mockGit.diff.mockRejectedValue(new Error('Git diff failed'));

      await expect(gitOps.getConflictedFiles()).rejects.toThrow('Failed to get conflicted files');
    });

    it('should handle git status errors', async () => {
      mockGit.status.mockRejectedValue(new Error('Git status failed'));

      await expect(gitOps.getCurrentBranch()).rejects.toThrow();
    });

    it('should handle git merge errors', async () => {
      jest.spyOn(gitOps as any, 'getMergeState').mockResolvedValue('merge');
      mockGit.merge.mockRejectedValue(new Error('Git merge failed'));

      await expect(gitOps.abortMerge()).rejects.toThrow();
    });

    it('should handle git add errors', async () => {
      mockGit.add.mockRejectedValue(new Error('Git add failed'));

      await expect(gitOps.stageFile('file.ts')).rejects.toThrow();
    });
  });
});