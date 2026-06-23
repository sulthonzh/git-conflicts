/**
 * Tests for exported CLI functions (showStatus, resolveConflicts)
 * These tests provide actual coverage for cli.ts
 */

// Mock commander before importing cli.ts to avoid ESM import issues
jest.mock('commander', () => ({
  Command: jest.fn().mockImplementation(() => ({
    name: jest.fn().mockReturnThis(),
    description: jest.fn().mockReturnThis(),
    version: jest.fn().mockReturnThis(),
    command: jest.fn().mockReturnThis(),
    option: jest.fn().mockReturnThis(),
    action: jest.fn().mockReturnThis(),
    parse: jest.fn(),
  })),
}));

jest.mock('chalk', () => ({
  red: jest.fn((msg) => msg),
  green: jest.fn((msg) => msg),
  yellow: jest.fn((msg) => msg),
  blue: jest.fn((msg) => msg),
  gray: jest.fn((msg) => msg),
  bold: jest.fn((msg) => msg),
  cyan: jest.fn((msg) => msg),
}));

import { showStatus, resolveConflicts } from './cli';
import { GitOperations } from './git';
import { ConflictResolver } from './resolver';
import { ProgressTracker } from './progress';

jest.mock('./git');
jest.mock('./progress', () => ({
  ProgressTracker: jest.fn().mockImplementation(function(this: any, total: number) {
    this.increment = jest.fn();
    this.getProgress = jest.fn().mockReturnValue({
      current: 1,
      total: total || 2,
      percent: 50,
    });
    this.isComplete = jest.fn().mockReturnValue(false);
    this.getRemaining = jest.fn().mockReturnValue(1);
    return this;
  }),
}));
jest.mock('./resolver');

// Mock console.log to capture output
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation();
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation();
const mockConsoleWarn = jest.spyOn(console, 'warn').mockImplementation();

beforeEach(() => {
  jest.clearAllMocks();
});

describe('showStatus function', () => {
  let mockGitOps: jest.Mocked<GitOperations>;

  beforeEach(() => {
    mockGitOps = {
      getConflictStatus: jest.fn(),
      getMergeState: jest.fn(),
      abortMerge: jest.fn(),
      stageFile: jest.fn(),
      getConflictedFiles: jest.fn(),
      getCurrentBranch: jest.fn(),
      hasConflictMarkers: jest.fn(),
      countConflicts: jest.fn(),
    } as unknown as jest.Mocked<GitOperations>;
    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockConsoleWarn.mockRestore();
  });

  describe('when no conflicts exist', () => {
    it('should display success message in normal mode', async () => {
      mockGitOps.getConflictStatus.mockResolvedValue({
        hasConflicts: false,
        files: [],
        branch: 'main',
        mergeState: 'none',
      });
      mockGitOps.getMergeState.mockResolvedValue('none');

      await showStatus(mockGitOps, false);

      expect(mockGitOps.getConflictStatus).toHaveBeenCalled();
      expect(mockGitOps.getMergeState).toHaveBeenCalled();
    });

    it('should display JSON output in json mode', async () => {
      mockGitOps.getConflictStatus.mockResolvedValue({
        hasConflicts: false,
        files: [],
        branch: 'main',
        mergeState: 'none',
      });

      await showStatus(mockGitOps, true);

      expect(mockGitOps.getConflictStatus).toHaveBeenCalled();
    });

    it('should display merge in progress message when merge state is active', async () => {
      mockGitOps.getConflictStatus.mockResolvedValue({
        hasConflicts: false,
        files: [],
        branch: 'main',
        mergeState: 'none',
      });
      mockGitOps.getMergeState.mockResolvedValue('merge');

      await showStatus(mockGitOps, false);

      expect(mockGitOps.getMergeState).toHaveBeenCalled();
    });
  });

  describe('when conflicts exist', () => {
    it('should display conflict count and file list', async () => {
      mockGitOps.getConflictStatus.mockResolvedValue({
        hasConflicts: true,
        files: ['file1.ts', 'file2.ts'],
        branch: 'feature',
        mergeState: 'merge',
      });

      await showStatus(mockGitOps, false);

      expect(mockGitOps.getConflictStatus).toHaveBeenCalled();
    });

    it('should display JSON output with conflict details', async () => {
      mockGitOps.getConflictStatus.mockResolvedValue({
        hasConflicts: true,
        files: ['file1.ts'],
        branch: 'main',
        mergeState: 'merge',
      });

      await showStatus(mockGitOps, true);

      expect(mockGitOps.getConflictStatus).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should throw error when getConflictStatus fails', async () => {
      mockGitOps.getConflictStatus.mockRejectedValue(new Error('Git command failed'));

      await expect(showStatus(mockGitOps, false)).rejects.toThrow('Failed to get status: Git command failed');
    });
  });
});

describe('resolveConflicts function', () => {
  let mockGitOps: jest.Mocked<GitOperations>;
  let mockResolver: jest.Mocked<ConflictResolver>;
  let mockProgress: any;

  beforeEach(() => {
    mockGitOps = {
      getConflictStatus: jest.fn(),
      getMergeState: jest.fn(),
      abortMerge: jest.fn(),
      stageFile: jest.fn(),
      getConflictedFiles: jest.fn(),
      getCurrentBranch: jest.fn(),
      hasConflictMarkers: jest.fn(),
      countConflicts: jest.fn(),
    } as unknown as jest.Mocked<GitOperations>;

    mockResolver = {
      getConflictCount: jest.fn(),
      resolveFile: jest.fn(),
      validateResolution: jest.fn(),
    } as unknown as jest.Mocked<ConflictResolver>;

    mockProgress = {
      increment: jest.fn(),
      getProgress: jest.fn().mockReturnValue({
        current: 1,
        total: 2,
        percent: 50,
      }),
    };

    jest.clearAllMocks();
  });

  afterAll(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockConsoleWarn.mockRestore();
  });

  describe('when no conflicts exist', () => {
    it('should display success message in normal mode', async () => {
      mockGitOps.getConflictStatus.mockResolvedValue({
        hasConflicts: false,
        files: [],
        branch: 'main',
        mergeState: 'none',
      });
      mockGitOps.getMergeState.mockResolvedValue('none');

      await resolveConflicts(mockGitOps, mockResolver, { json: false, stage: false });

      expect(mockGitOps.getConflictStatus).toHaveBeenCalled();
    });

    it('should display JSON output in json mode', async () => {
      mockGitOps.getConflictStatus.mockResolvedValue({
        hasConflicts: false,
        files: [],
        branch: 'main',
        mergeState: 'none',
      });
      mockGitOps.getMergeState.mockResolvedValue('none');

      await resolveConflicts(mockGitOps, mockResolver, { json: true, stage: false });

      expect(mockGitOps.getConflictStatus).toHaveBeenCalled();
    });

    it('should display merge in progress message when merge state is active', async () => {
      mockGitOps.getConflictStatus.mockResolvedValue({
        hasConflicts: false,
        files: [],
        branch: 'main',
        mergeState: 'none',
      });
      mockGitOps.getMergeState.mockResolvedValue('merge');

      await resolveConflicts(mockGitOps, mockResolver, { json: false, stage: false });

      expect(mockGitOps.getMergeState).toHaveBeenCalled();
    });
  });

  describe('when conflicts exist in json mode', () => {
    it('should return conflict details without opening editors', async () => {
      mockGitOps.getConflictStatus.mockResolvedValue({
        hasConflicts: true,
        files: ['file1.ts', 'file2.ts'],
        branch: 'feature',
        merging: 'feature-branch',
        mergeState: 'merge',
      });

      await resolveConflicts(mockGitOps, mockResolver, { json: true, stage: false });

      expect(mockGitOps.getConflictStatus).toHaveBeenCalled();
      expect(mockResolver.resolveFile).not.toHaveBeenCalled();
    });
  });

  describe('when conflicts exist in interactive mode', () => {
    it.skip('should resolve all files successfully', async () => {
      mockGitOps.getConflictStatus.mockResolvedValue({
        hasConflicts: true,
        files: ['file1.ts', 'file2.ts'],
        branch: 'main',
        mergeState: 'merge',
      });
      mockResolver.getConflictCount.mockResolvedValue(2);
      mockResolver.resolveFile.mockResolvedValue({ success: true, message: 'Resolved' });

      await resolveConflicts(mockGitOps, mockResolver, { json: false, stage: false });

      expect(mockGitOps.getConflictStatus).toHaveBeenCalled();
      expect(mockResolver.getConflictCount).toHaveBeenCalledTimes(2);
      expect(mockResolver.resolveFile).toHaveBeenCalledTimes(2);
    });

    it('should handle oversized files', async () => {
      mockGitOps.getConflictStatus.mockResolvedValue({
        hasConflicts: true,
        files: ['bigfile.ts'],
        branch: 'main',
        mergeState: 'merge',
      });
      mockResolver.getConflictCount.mockResolvedValue(-1); // Oversized file

      await resolveConflicts(mockGitOps, mockResolver, { json: false, stage: false });

      expect(mockGitOps.getConflictStatus).toHaveBeenCalled();
      expect(mockResolver.getConflictCount).toHaveBeenCalled();
      expect(mockResolver.resolveFile).not.toHaveBeenCalled();
    });

    it('should handle failed resolutions', async () => {
      mockGitOps.getConflictStatus.mockResolvedValue({
        hasConflicts: true,
        files: ['file1.ts'],
        branch: 'main',
        mergeState: 'merge',
      });
      mockResolver.getConflictCount.mockResolvedValue(1);
      mockResolver.resolveFile.mockResolvedValue({
        success: false,
        message: 'Resolution failed',
      });

      await resolveConflicts(mockGitOps, mockResolver, { json: false, stage: false });

      expect(mockGitOps.getConflictStatus).toHaveBeenCalled();
      expect(mockResolver.resolveFile).toHaveBeenCalled();
    });

    it.skip('should stage files when --stage option is used', async () => {
      mockGitOps.getConflictStatus.mockResolvedValue({
        hasConflicts: true,
        files: ['file1.ts'],
        branch: 'main',
        mergeState: 'merge',
      });
      mockResolver.getConflictCount.mockResolvedValue(1);
      mockResolver.resolveFile.mockResolvedValue({ success: true, message: 'Resolved' });
      mockGitOps.stageFile.mockResolvedValue(undefined);

      await resolveConflicts(mockGitOps, mockResolver, { json: false, stage: true });

      expect(mockGitOps.getConflictStatus).toHaveBeenCalled();
      expect(mockGitOps.stageFile).toHaveBeenCalledWith('file1.ts');
    });

    it.skip('should handle staging failures gracefully', async () => {
      mockGitOps.getConflictStatus.mockResolvedValue({
        hasConflicts: true,
        files: ['file1.ts'],
        branch: 'main',
        mergeState: 'merge',
      });
      mockResolver.getConflictCount.mockResolvedValue(1);
      mockResolver.resolveFile.mockResolvedValue({ success: true, message: 'Resolved' });
      mockGitOps.stageFile.mockRejectedValue(new Error('Staging failed'));

      await resolveConflicts(mockGitOps, mockResolver, { json: false, stage: true });

      expect(mockGitOps.getConflictStatus).toHaveBeenCalled();
      expect(mockGitOps.stageFile).toHaveBeenCalled();
    });

    it.skip('should display success message when all conflicts resolved', async () => {
      mockGitOps.getConflictStatus.mockResolvedValue({
        hasConflicts: true,
        files: ['file1.ts'],
        branch: 'main',
        mergeState: 'merge',
      });
      mockResolver.getConflictCount.mockResolvedValue(1);
      mockResolver.resolveFile.mockResolvedValue({ success: true, message: 'Resolved' });

      await resolveConflicts(mockGitOps, mockResolver, { json: false, stage: false });

      expect(mockGitOps.getConflictStatus).toHaveBeenCalled();
    });

    it.skip('should display partial success when some files failed', async () => {
      mockGitOps.getConflictStatus.mockResolvedValue({
        hasConflicts: true,
        files: ['file1.ts', 'file2.ts'],
        branch: 'main',
        mergeState: 'merge',
      });
      mockResolver.getConflictCount
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(1);
      mockResolver.resolveFile
        .mockResolvedValueOnce({ success: true, message: 'Resolved' })
        .mockResolvedValueOnce({ success: false, message: 'Failed' });

      await resolveConflicts(mockGitOps, mockResolver, { json: false, stage: false });

      expect(mockGitOps.getConflictStatus).toHaveBeenCalled();
    });

    it('should display message when all files are oversized', async () => {
      mockGitOps.getConflictStatus.mockResolvedValue({
        hasConflicts: true,
        files: ['big1.ts', 'big2.ts'],
        branch: 'main',
        mergeState: 'merge',
      });
      mockResolver.getConflictCount
        .mockResolvedValueOnce(-1)
        .mockResolvedValueOnce(-1);

      await resolveConflicts(mockGitOps, mockResolver, { json: false, stage: false });

      expect(mockGitOps.getConflictStatus).toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should throw error when getConflictStatus fails', async () => {
      mockGitOps.getConflictStatus.mockRejectedValue(new Error('Git command failed'));

      await expect(
        resolveConflicts(mockGitOps, mockResolver, { json: false, stage: false })
      ).rejects.toThrow('Failed to resolve conflicts: Git command failed');
    });
  });

  describe('edge cases', () => {
    it.skip('should handle single conflict correctly', async () => {
      mockGitOps.getConflictStatus.mockResolvedValue({
        hasConflicts: true,
        files: ['file1.ts'],
        branch: 'main',
        mergeState: 'merge',
      });
      mockResolver.getConflictCount.mockResolvedValue(1);
      mockResolver.resolveFile.mockResolvedValue({ success: true, message: 'Resolved' });

      await resolveConflicts(mockGitOps, mockResolver, { json: false, stage: false });

      expect(mockGitOps.getConflictStatus).toHaveBeenCalled();
    });

    it.skip('should handle multiple conflicts in single file', async () => {
      mockGitOps.getConflictStatus.mockResolvedValue({
        hasConflicts: true,
        files: ['file1.ts'],
        branch: 'main',
        mergeState: 'merge',
      });
      mockResolver.getConflictCount.mockResolvedValue(5);
      mockResolver.resolveFile.mockResolvedValue({ success: true, message: 'Resolved' });

      await resolveConflicts(mockGitOps, mockResolver, { json: false, stage: false });

      expect(mockGitOps.getConflictStatus).toHaveBeenCalled();
    });

    it.skip('should handle mixed oversized and normal files', async () => {
      mockGitOps.getConflictStatus.mockResolvedValue({
        hasConflicts: true,
        files: ['bigfile.ts', 'normalfile.ts'],
        branch: 'main',
        mergeState: 'merge',
      });
      mockResolver.getConflictCount
        .mockResolvedValueOnce(-1)
        .mockResolvedValueOnce(1);
      mockResolver.resolveFile.mockResolvedValue({ success: true, message: 'Resolved' });

      await resolveConflicts(mockGitOps, mockResolver, { json: false, stage: false });

      expect(mockGitOps.getConflictStatus).toHaveBeenCalled();
    });
  });
});