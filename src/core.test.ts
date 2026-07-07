import { GitOperations } from './git';
import { ProgressTracker } from './progress';
import { ConflictResolver } from './resolver';
import fs, { Stats } from 'fs';
import fsPromises from 'fs/promises';

jest.mock('simple-git');
jest.mock('child_process');
jest.mock('fs/promises');
jest.mock('fs');

// Mock existsSync
const mockExistsSync = jest.fn();
fs.existsSync = mockExistsSync;

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
    expect(tracker.getProgress().percent).toBe(75);
    tracker.increment();
    expect(tracker.getProgress().percent).toBe(100);
  });

  it('should report complete status', () => {
    const tracker = new ProgressTracker(1);
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
    expect(tracker.getRemaining()).toBe(2);
  });
});

describe('GitOperations', () => {
  let gitOps: GitOperations;

  beforeEach(() => {
    gitOps = new GitOperations();
  });

  it('should detect conflict markers in content', () => {
    const conflictedContent = `<<<<<<< HEAD
const a = 1;
=======
const b = 2;
>>>>>>> feature-branch`;
    expect(gitOps.hasConflictMarkers(conflictedContent)).toBe(true);
  });

  it('should not detect conflict markers in clean content', () => {
    const cleanContent = `const a = 1;
// This is not a conflict marker <<<<<<<
const b = 2;`;
    expect(gitOps.hasConflictMarkers(cleanContent)).toBe(false);
  });

  it('should not false-positive on marker text inside strings', () => {
    const content = `const message = "Please resolve this<<<<<<< conflict";
const another = "This is not a conflict marker >>>>>>>";
const separator = "This is not ======= a separator";`;
    expect(gitOps.hasConflictMarkers(content)).toBe(false);
  });

  it('should detect diff3 conflict markers', () => {
    const diff3Content = `<<<<<<< HEAD
const a = 1;
|||||||
const base = 0;
=======
const b = 2;
>>>>>>> feature-branch`;
    expect(gitOps.hasConflictMarkers(diff3Content)).toBe(true);
  });

  it('should detect remaining ======= and >>>>>>> markers', () => {
    const content = `const a = 1;
=======
const b = 2;
>>>>>>> feature-branch`;
    expect(gitOps.hasConflictMarkers(content)).toBe(true);
  });

  it('should not false-positive on markdown setext headings without other markers', () => {
    const content = `My Heading
=======
Some paragraph text.`;
    expect(gitOps.hasConflictMarkers(content)).toBe(false);
  });

  it('should not false-positive on ASCII art box with equals signs', () => {
    const content = `// ===============================
// Important Section Header
// ===============================`;
    expect(gitOps.hasConflictMarkers(content)).toBe(false);
  });

  it('should detect ======= separator when other conflict markers present', () => {
    const content = `<<<<<<< HEAD
const a = 1;
=======
const b = 2;
>>>>>>> branch`;
    expect(gitOps.hasConflictMarkers(content)).toBe(true);
  });

  it('should detect stray ======= with other markers in file', () => {
    // Partially resolved: user removed <<<<<<< and >>>>>>> but left =======
    const content = `const resolved = true;
=======
const old = false;\n<<<<<<< HEAD\nmore`;
    expect(gitOps.hasConflictMarkers(content)).toBe(true);
  });

  it('should detect ======= separator with trailing whitespace', () => {
    const content = `<<<<<<< HEAD
const a = 1;
=======   \nconst b = 2;
>>>>>>> branch`;
    expect(gitOps.hasConflictMarkers(content)).toBe(true);
  });

  it('should not detect equals signs with text after them as conflict marker', () => {
    // =======text is not a valid conflict separator (git puts it on own line)
    const content = `Section
=======Important=======`;
    expect(gitOps.hasConflictMarkers(content)).toBe(false);
  });

  it('should count conflict markers correctly', () => {
    const content = `<<<<<<< HEAD
const a = 1;
=======
const b = 2;
>>>>>>> feature-branch
<<<<<<< HEAD
const c = 3;
=======
const d = 4;
>>>>>>> another-branch`;
    expect(gitOps.countConflicts(content)).toBe(2);
  });

  it('should count bare <<<<<<< lines without branch name', () => {
    const content = `<<<<<<<
const a = 1;
=======
const b = 2;
>>>>>>>`;
    expect(gitOps.hasConflictMarkers(content)).toBe(true);
    expect(gitOps.countConflicts(content)).toBe(1);
  });
});

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;
  let customGitOps: GitOperations;

  beforeEach(() => {
    customGitOps = new GitOperations();
    resolver = new ConflictResolver(customGitOps);
    // Reset all mocks
    mockExistsSync.mockClear();
    (fsPromises.readFile as jest.Mock).mockClear();
  });

  it('should accept a GitOperations instance', () => {
    const customResolver = new ConflictResolver(customGitOps);
    // Should not throw
    expect(customResolver).toBeInstanceOf(ConflictResolver);
  });

  it('should validate clean file content', async () => {
    const cleanContent = 'const x = 1;';
    (fsPromises.readFile as jest.Mock).mockResolvedValue(cleanContent);
    mockExistsSync.mockReturnValue(true);
    jest.spyOn(fsPromises, 'stat').mockResolvedValue({ size: 100 } as Stats);

    const result = await resolver.validateResolution('test.ts');
    expect(result.valid).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it('should fail validation for conflict markers', async () => {
    const conflictedContent = '<<<<<<< HEAD\ncode\n=======\ncode2\n>>>>>>>';
    (fsPromises.readFile as jest.Mock).mockResolvedValue(conflictedContent);
    mockExistsSync.mockReturnValue(true);
    jest.spyOn(fsPromises, 'stat').mockResolvedValue({ size: 100 } as Stats);

    const result = await resolver.validateResolution('test.ts');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Conflict markers');
  });

  it('should handle read errors during validation', async () => {
    mockExistsSync.mockReturnValue(true);
    (fsPromises.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

    const result = await resolver.validateResolution('nonexistent.ts');
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('Failed to read file');
  });

  it('should handle missing files', async () => {
    mockExistsSync.mockReturnValue(false);

    const result = await resolver.validateResolution('nonexistent.ts');
    expect(result.valid).toBe(false);
    expect(result.reason).toBe('File does not exist');
  });
});