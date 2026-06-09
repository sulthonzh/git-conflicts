import { GitOperations } from '../src/git';
import { ProgressTracker } from '../src/progress';
import { ConflictResolver } from '../src/resolver';
import * as fs from 'fs/promises';

jest.mock('simple-git');
jest.mock('child_process');
jest.mock('fs/promises');

describe('ProgressTracker', () => {
  it('should initialize with correct total', () => {
    const tracker = new ProgressTracker(5);
    expect(tracker.getProgress().total).toBe(5);
    expect(tracker.getProgress().current).toBe(0);
  });

  it('should increment correctly', () => {
    const tracker = new ProgressTracker(5);
    tracker.increment();
    expect(tracker.getProgress().current).toBe(1);
    tracker.increment();
    expect(tracker.getProgress().current).toBe(2);
  });

  it('should calculate percentage correctly', () => {
    const tracker = new ProgressTracker(4);
    expect(tracker.getProgress().percent).toBe(0);
    tracker.increment();
    expect(tracker.getProgress().percent).toBe(25);
    tracker.increment();
    expect(tracker.getProgress().percent).toBe(50);
    tracker.increment();
    tracker.increment();
    expect(tracker.getProgress().percent).toBe(100);
  });

  it('should report complete status', () => {
    const tracker = new ProgressTracker(2);
    expect(tracker.isComplete()).toBe(false);
    tracker.increment();
    expect(tracker.isComplete()).toBe(false);
    tracker.increment();
    expect(tracker.isComplete()).toBe(true);
  });

  it('should calculate remaining correctly', () => {
    const tracker = new ProgressTracker(5);
    expect(tracker.getRemaining()).toBe(5);
    tracker.increment();
    expect(tracker.getRemaining()).toBe(4);
    tracker.increment();
    tracker.increment();
    tracker.increment();
    tracker.increment();
    expect(tracker.getRemaining()).toBe(0);
  });
});

describe('GitOperations', () => {
  let gitOps: GitOperations;

  beforeEach(() => {
    // We can't really mock simple-git cleanly in Jest without more setup
    // So these tests will be basic structure tests
    gitOps = new GitOperations();
  });

  it('should detect conflict markers in content', () => {
    const contentWithMarkers = 'some code\n<<<<<<< HEAD\nmy code\n=======\ntheir code\n>>>>>>> feature\nend';
    expect(gitOps.hasConflictMarkers(contentWithMarkers)).toBe(true);
  });

  it('should not detect conflict markers in clean content', () => {
    const cleanContent = 'some code\nmy code\nend';
    expect(gitOps.hasConflictMarkers(cleanContent)).toBe(false);
  });

  it('should not false-positive on marker text inside strings', () => {
    // A string literal or comment containing <<<<<<< should not be flagged
    const contentWithString = 'const msg = "use <<<<<<< to mark conflicts";';
    expect(gitOps.hasConflictMarkers(contentWithString)).toBe(false);
  });

  it('should detect diff3 conflict markers (|||||||)', () => {
    const diff3Content = '||||||| merged common ancestors\nbase\n=======\nours\n>>>>>>> feature';
    expect(gitOps.hasConflictMarkers(diff3Content)).toBe(true);
  });

  it('should detect remaining ======= and >>>>>>> markers', () => {
    // User deleted <<<<<<< but left other markers
    const partialMarkers = 'some code\n=======\ntheir code\n>>>>>>> feature\nend';
    expect(gitOps.hasConflictMarkers(partialMarkers)).toBe(true);
  });

  it('should count conflict markers correctly', () => {
    const singleConflict = 'some code\n<<<<<<< HEAD\nmy code\n=======\ntheir code\n>>>>>>> feature\nend';
    expect(gitOps.countConflicts(singleConflict)).toBe(1);

    const multipleConflicts = 'a\n<<<<<<< HEAD\nx\n=======\ny\n>>>>>>> f1\nb\n<<<<<<< HEAD\nc\n=======\nd\n>>>>>>> f2';
    expect(gitOps.countConflicts(multipleConflicts)).toBe(2);

    const cleanContent = 'no conflicts here';
    expect(gitOps.countConflicts(cleanContent)).toBe(0);
  });

  it('should count bare <<<<<<< lines without branch name', () => {
    const bareMarker = 'some code\n<<<<<<<\nmy code\n=======\ntheir code\n>>>>>>> feature';
    expect(gitOps.countConflicts(bareMarker)).toBe(1);
  });
});

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;

  beforeEach(() => {
    resolver = new ConflictResolver();
  });

  it('should accept a GitOperations instance', () => {
    const customGitOps = new GitOperations('/some/path');
    const customResolver = new ConflictResolver(customGitOps);
    // Should not throw
    expect(customResolver).toBeInstanceOf(ConflictResolver);
  });

  it('should validate clean file content', async () => {
    const cleanContent = 'const x = 1;';
    (fs.readFile as jest.Mock).mockResolvedValue(cleanContent);

    const result = await resolver.validateResolution('test.ts');
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should fail validation for conflict markers', async () => {
    const conflictedContent = '<<<<<<< HEAD\ncode\n=======\ncode2\n>>>>>>>';
    (fs.readFile as jest.Mock).mockResolvedValue(conflictedContent);

    const result = await resolver.validateResolution('test.ts');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Conflict markers');
  });

  it('should handle read errors during validation', async () => {
    (fs.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

    const result = await resolver.validateResolution('nonexistent.ts');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Failed to read file');
  });
});