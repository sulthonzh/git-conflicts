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
});

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;

  beforeEach(() => {
    resolver = new ConflictResolver();
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