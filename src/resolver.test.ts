import { ConflictResolver } from './resolver';
import { GitOperations } from './git';
import fs from 'fs';
import fsPromises from 'fs/promises';

jest.mock('./git');
jest.mock('fs');
jest.mock('fs/promises');

describe('ConflictResolver', () => {
  let resolver: ConflictResolver;
  let mockGitOps: jest.Mocked<GitOperations>;

  beforeEach(() => {
    mockGitOps = {
      hasConflictMarkers: jest.fn(),
      countConflicts: jest.fn(),
    } as any;

    resolver = new ConflictResolver(mockGitOps);
    jest.clearAllMocks();
  });

  describe('getConflictCount', () => {
    it('should return 0 for clean file', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fsPromises.stat as jest.Mock).mockResolvedValue({ size: 100 } as any);
      (fsPromises.readFile as jest.Mock).mockResolvedValue('const a = 1;');
      mockGitOps.countConflicts.mockReturnValue(0);

      const count = await resolver.getConflictCount('file.ts');

      expect(count).toBe(0);
      expect(mockGitOps.countConflicts).toHaveBeenCalledWith('const a = 1;');
    });

    it('should return conflict count from gitOps', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fsPromises.stat as jest.Mock).mockResolvedValue({ size: 200 } as any);
      (fsPromises.readFile as jest.Mock).mockResolvedValue('content with conflict');
      mockGitOps.countConflicts.mockReturnValue(2);

      const count = await resolver.getConflictCount('file.ts');

      expect(count).toBe(2);
    });

    it('should return -1 for oversized files (>10MB)', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fsPromises.stat as jest.Mock).mockResolvedValue({ size: 11 * 1024 * 1024 } as any);

      const count = await resolver.getConflictCount('large-file.ts');

      expect(count).toBe(-1);
      expect(fsPromises.readFile).not.toHaveBeenCalled();
    });

    it('should return 0 for missing files', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      mockGitOps.countConflicts.mockReturnValue(0);

      const count = await resolver.getConflictCount('nonexistent.ts');

      expect(count).toBe(0);
    });

    it('should return 0 on read errors', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fsPromises.stat as jest.Mock).mockResolvedValue({ size: 100 } as any);
      (fsPromises.readFile as jest.Mock).mockRejectedValue(new Error('Permission denied'));
      mockGitOps.countConflicts.mockReturnValue(0);

      const count = await resolver.getConflictCount('file.ts');

      expect(count).toBe(0);
    });
  });

  describe('validateResolution', () => {
    it('should validate clean content successfully', async () => {
      const cleanContent = 'const a = 1;\nconst b = 2;';
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fsPromises.stat as jest.Mock).mockResolvedValue({ size: 100 } as any);
      (fsPromises.lstat as jest.Mock).mockResolvedValue({ isSymbolicLink: () => false } as any);
      (fsPromises.readFile as jest.Mock).mockResolvedValue(cleanContent);
      mockGitOps.hasConflictMarkers.mockReturnValue(false);

      const result = await resolver.validateResolution('file.ts');

      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('should fail validation for content with conflict markers', async () => {
      const conflictedContent = `<<<<<<< HEAD
const a = 1;
=======
const b = 2;
>>>>>>> branch`;
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fsPromises.stat as jest.Mock).mockResolvedValue({ size: 200 } as any);
      (fsPromises.lstat as jest.Mock).mockResolvedValue({ isSymbolicLink: () => false } as any);
      (fsPromises.readFile as jest.Mock).mockResolvedValue(conflictedContent);
      mockGitOps.hasConflictMarkers.mockReturnValue(true);

      const result = await resolver.validateResolution('file.ts');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Conflict markers still present');
    });

    it('should handle missing files', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      const result = await resolver.validateResolution('nonexistent.ts');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('File does not exist');
    });

    it('should handle read errors', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fsPromises.stat as jest.Mock).mockResolvedValue({ size: 100 } as any);
      (fsPromises.lstat as jest.Mock).mockResolvedValue({ isSymbolicLink: () => false } as any);
      (fsPromises.readFile as jest.Mock).mockRejectedValue(new Error('Read error'));

      const result = await resolver.validateResolution('file.ts');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Failed to read file');
    });

    it('should reject oversized files', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fsPromises.stat as jest.Mock).mockResolvedValue({ size: 11 * 1024 * 1024 } as any);

      const result = await resolver.validateResolution('large-file.ts');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('File too large');
    });

    it('should reject empty files', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fsPromises.stat as jest.Mock).mockResolvedValue({ size: 0 } as any);
      (fsPromises.lstat as jest.Mock).mockResolvedValue({ isSymbolicLink: () => false } as any);
      (fsPromises.readFile as jest.Mock).mockResolvedValue('');

      const result = await resolver.validateResolution('empty.ts');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('File is empty after editing');
    });

    it('should reject symbolic links', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fsPromises.stat as jest.Mock).mockResolvedValue({ size: 100 } as any);
      (fsPromises.lstat as jest.Mock).mockResolvedValue({ isSymbolicLink: () => true } as any);

      const result = await resolver.validateResolution('symlink.ts');

      expect(result.valid).toBe(false);
      expect(result.reason).toBe('Symbolic links are not allowed for conflict resolution');
    });

    it('should pass validation when lstat fails (assume safe)', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fsPromises.stat as jest.Mock).mockResolvedValue({ size: 100 } as any);
      (fsPromises.lstat as jest.Mock).mockRejectedValue(new Error('lstat error'));
      (fsPromises.readFile as jest.Mock).mockResolvedValue('const a = 1;');
      mockGitOps.hasConflictMarkers.mockReturnValue(false);

      const result = await resolver.validateResolution('file.ts');

      expect(result.valid).toBe(true);
    });
  });

  describe('resolveFile', () => {
    it('should successfully resolve file', async () => {
      const mockOpen = jest.spyOn(resolver as any, 'openInEditor')
        .mockResolvedValue(undefined);
      const mockValidate = jest.spyOn(resolver, 'validateResolution')
        .mockResolvedValue({ valid: true });

      const result = await resolver.resolveFile('file.ts');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Resolved file.ts');
      mockOpen.mockRestore();
      mockValidate.mockRestore();
    });

    it('should fail if editor fails to open', async () => {
      const mockOpen = jest.spyOn(resolver as any, 'openInEditor')
        .mockRejectedValue(new Error('Failed to open editor: ENOENT'));

      const result = await resolver.resolveFile('file.ts');

      expect(result.success).toBe(false);
      expect(result.message).toContain('file.ts');
      expect(result.message).toContain('Failed to open editor');
      mockOpen.mockRestore();
    });

    it('should fail if validation fails', async () => {
      const mockOpen = jest.spyOn(resolver as any, 'openInEditor')
        .mockResolvedValue(undefined);
      const mockValidate = jest.spyOn(resolver, 'validateResolution')
        .mockResolvedValue({ valid: false, reason: 'Conflict markers still present' });

      const result = await resolver.resolveFile('file.ts');

      expect(result.success).toBe(false);
      expect(result.message).toContain('file.ts');
      expect(result.message).toContain('Conflict markers still present');
      mockOpen.mockRestore();
      mockValidate.mockRestore();
    });

    it('should validate even if editor times out', async () => {
      const mockOpen = jest.spyOn(resolver as any, 'openInEditor')
        .mockRejectedValue(new Error('Editor timed out'));
      const mockValidate = jest.spyOn(resolver, 'validateResolution')
        .mockResolvedValue({ valid: true });

      const result = await resolver.resolveFile('file.ts');

      expect(result.success).toBe(true);
      expect(result.message).toBe('Resolved file.ts');
      mockOpen.mockRestore();
      mockValidate.mockRestore();
    });
  });

  describe('parseEditorCommand (private)', () => {
    it('should parse simple editor command', () => {
      const result = (resolver as any).parseEditorCommand('vim');

      expect(result).toEqual({ command: 'vim', args: [] });
    });

    it('should parse editor with flags', () => {
      const result = (resolver as any).parseEditorCommand('code --wait');

      expect(result).toEqual({ command: 'code', args: ['--wait'] });
    });

    it('should parse editor with multiple flags', () => {
      const result = (resolver as any).parseEditorCommand('vim -c "set diff" +/pattern');

      expect(result).toEqual({ command: 'vim', args: ['-c', 'set diff', '+/pattern'] });
    });

    it('should handle quoted arguments', () => {
      const result = (resolver as any).parseEditorCommand('vim -c "set diff"');

      expect(result).toEqual({ command: 'vim', args: ['-c', 'set diff'] });
    });

    it('should reject shell metacharacters', () => {
      expect(() => {
        (resolver as any).parseEditorCommand('vim; rm -rf /');
      }).toThrow('Editor command contains potentially dangerous characters');

      expect(() => {
        (resolver as any).parseEditorCommand('code && evil');
      }).toThrow('Editor command contains potentially dangerous characters');

      expect(() => {
        (resolver as any).parseEditorCommand('vim | cat');
      }).toThrow('Editor command contains potentially dangerous characters');
    });

    it('should reject null/undefined command', () => {
      expect(() => {
        (resolver as any).parseEditorCommand(null as any);
      }).toThrow('Invalid editor command');

      expect(() => {
        (resolver as any).parseEditorCommand(undefined as any);
      }).toThrow('Invalid editor command');
    });

    it('should reject empty command', () => {
      expect(() => {
        (resolver as any).parseEditorCommand('   ');
      }).toThrow('Empty editor command');
    });

    it('should reject unsafe editors', () => {
      expect(() => {
        (resolver as any).parseEditorCommand('evil-editor');
      }).toThrow('Editor "evil-editor" is not in the safe list');

      expect(() => {
        (resolver as any).parseEditorCommand('rm');
      }).toThrow('Editor "rm" is not in the safe list');
    });

    it('should accept safe editors from whitelist', () => {
      expect(() => {
        (resolver as any).parseEditorCommand('vim');
      }).not.toThrow();

      expect(() => {
        (resolver as any).parseEditorCommand('code');
      }).not.toThrow();

      expect(() => {
        (resolver as any).parseEditorCommand('nano');
      }).not.toThrow();
    });

    it('should strip executable extensions for validation', () => {
      const result = (resolver as any).parseEditorCommand('code.exe');

      expect(result.command).toBe('code.exe');
      expect(() => {
        (resolver as any).parseEditorCommand('code.exe');
      }).not.toThrow(); // Should validate 'code', not 'code.exe'
    });
  });

  describe('getDefaultEditor (private)', () => {
    it('should return notepad on Windows', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'win32' });

      const editor = (resolver as any).getDefaultEditor();

      expect(editor).toBe('notepad');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });

    it('should return vim on non-Windows', () => {
      const originalPlatform = process.platform;
      Object.defineProperty(process, 'platform', { value: 'darwin' });

      const editor = (resolver as any).getDefaultEditor();

      expect(editor).toBe('vim');

      Object.defineProperty(process, 'platform', { value: originalPlatform });
    });
  });

  describe('edge cases', () => {
    it('should handle file with special characters in path', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fsPromises.stat as jest.Mock).mockResolvedValue({ size: 100 } as any);
      (fsPromises.readFile as jest.Mock).mockResolvedValue('const a = 1;');
      mockGitOps.countConflicts.mockReturnValue(0);

      const count = await resolver.getConflictCount('file with spaces.ts');

      expect(count).toBe(0);
    });

    it('should handle file with unicode characters', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fsPromises.stat as jest.Mock).mockResolvedValue({ size: 100 } as any);
      (fsPromises.readFile as jest.Mock).mockResolvedValue('const ñ = 1;');
      mockGitOps.countConflicts.mockReturnValue(0);

      const count = await resolver.getConflictCount('file-ñ.ts');

      expect(count).toBe(0);
    });

    it('should handle file at exactly 10MB limit', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fsPromises.stat as jest.Mock).mockResolvedValue({ size: 10 * 1024 * 1024 } as any);
      (fsPromises.readFile as jest.Mock).mockResolvedValue('const a = 1;');
      mockGitOps.countConflicts.mockReturnValue(0);

      const count = await resolver.getConflictCount('exactly-10mb.ts');

      expect(count).toBe(0);
    });

    it('should handle file one byte over 10MB limit', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fsPromises.stat as jest.Mock).mockResolvedValue({ size: 10 * 1024 * 1024 + 1 } as any);

      const count = await resolver.getConflictCount('over-10mb.ts');

      expect(count).toBe(-1);
    });
  });
});