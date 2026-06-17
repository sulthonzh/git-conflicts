import { spawn } from 'child_process';
import { readFile, stat, lstat } from 'fs/promises';
import { resolve } from 'path';
import { GitOperations } from './git';
import { existsSync } from 'fs';

// Common safe editors with their typical executable names
// Updated with modern editors and common IDEs
const SAFE_EDITORS = new Set([
  // VS Code family
  'code', 'code-insiders', 'code-oss', 'vscode', 
  // Vim/neovim
  'vim', 'nvim', 'vim-nix', 'neovim',
  // Traditional editors
  'nano', 'emacs', 'micro', 
  // Sublime Text
  'subl', 'sublime-text', 'sublime-merge',
  // JetBrains IDEs
  'webstorm', 'intellij', 'idea', 'rubymine', 'phpstorm',
  'pycharm', 'goland', 'clion', 'datagrip', 'rider', 'teamcity',
  // VS family
  'resharper', 'resharper-cmd', 
  // Eclipse family
  'eclipse', 'eclipse-java', 'eclipse-cpp', 
  // Windows editors
  'notepad', 'notepad++', 'notepad2', 'notepad3', 'editplus', 'ultraedit',
  // Linux editors
  'gedit', 'kate', 'mousepad', 'leafpad', 'pluma', 'geany',
  // macOS editors
  'textedit', 'xcode', 'macvim', 'mvim',
  // Terminal-based editors
  'joe', 'joe-editor', 'pico', 'jed'
]);

// Maximum file size for conflict resolution (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export class ConflictResolver {
  private gitOps: GitOperations;
  private editorTimeout: number;

  constructor(gitOps?: GitOperations, editorTimeout: number = 30000) {
    this.gitOps = gitOps ?? new GitOperations();
    this.editorTimeout = editorTimeout;
  }

  /**
   * Parse editor command string into command and args array.
   * Handles editors with flags like "code --wait" or "vim -c 'set diff'"
   * Security: Validates the editor command against a whitelist to prevent command injection
   */
  private parseEditorCommand(editorString: string): { command: string; args: string[] } {
    if (!editorString || typeof editorString !== 'string') {
      throw new Error('Invalid editor command');
    }

    // Security: Block shell metacharacters that enable command injection
    // Note: We allow + for editors like notepad++, and rely on the whitelist below
    // as the primary security boundary.
    if (/[;&|`$(){}[\]<>]/.test(editorString)) {
      throw new Error('Editor command contains potentially dangerous characters');
    }

    // Normalize whitespace and trim
    const normalized = editorString.trim().replace(/\s+/g, ' ');
    
    if (!normalized) {
      throw new Error('Empty editor command');
    }

    // Simple shell-like parsing: split on whitespace, respect basic quoting
    const parts: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (const ch of normalized) {
      if (inQuote) {
        if (ch === quoteChar) {
          inQuote = false;
        } else {
          current += ch;
        }
      } else if (ch === '"' || ch === "'") {
        inQuote = true;
        quoteChar = ch;
      } else if (ch === ' ') {
        if (current.length > 0) {
          parts.push(current);
          current = '';
        }
      } else {
        current += ch;
      }
    }
    if (current.length > 0) {
      parts.push(current);
    }

    if (parts.length === 0) {
      throw new Error('Empty editor command');
    }

    // Security: Validate editor executable against whitelist
    // Strip common executable extensions only (not arbitrary dot-separated suffixes)
    // Using split('.')[0] would allow bypasses like "code.evil" or "vim.malicious"
    const command = parts[0];
    const EXEC_EXTENSIONS = ['.exe', '.app', '.bat', '.cmd', '.com'];
    const baseName = EXEC_EXTENSIONS.some(ext => command.toLowerCase().endsWith(ext))
      ? command.slice(0, command.lastIndexOf('.'))
      : command;
    if (!SAFE_EDITORS.has(baseName)) {
      throw new Error(`Editor "${command}" is not in the safe list of editors`);
    }

    return { command, args: parts.slice(1) };
  }

  /**
   * Open file in user's preferred editor with timeout
   */
  async openInEditor(filePath: string): Promise<void> {
    const editorString = process.env.EDITOR ?? process.env.VISUAL ?? this.getDefaultEditor();
    const fullPath = resolve(filePath);
    const { command, args } = this.parseEditorCommand(editorString);

    console.log(`  Opening in ${editorString}...`);

    return new Promise((resolvePromise, reject) => {
      // Set up timeout to prevent hanging
      const timeout = setTimeout(() => {
        reject(new Error(`Editor timed out after ${this.editorTimeout}ms. The editor may still be running.`));
      }, this.editorTimeout);

      const editorProcess = spawn(command, [...args, fullPath], {
        stdio: 'inherit',
      });

      editorProcess.on('close', (code) => {
        clearTimeout(timeout);
        if (code === 0) {
          resolvePromise();
        } else {
          // Don't reject on non-zero exit codes - editor might exit with non-zero
          // for benign reasons (e.g., vim swap file warnings) while user saved changes
          console.log(`  Editor exited with code ${code}. Assuming changes were saved.`);
          resolvePromise();
        }
      });

      editorProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to open editor: ${err.message}. Please check if '${command}' is installed and accessible.`));
      });
    });
  }

  /**
   * Get default editor based on platform
   */
  private getDefaultEditor(): string {
    const platform = process.platform;

    if (platform === 'win32') {
      return 'notepad';
    } else {
      return 'vim';
    }
  }

  /**
   * Validate that conflict markers are resolved
   */
  async validateResolution(filePath: string): Promise<{ valid: boolean; reason?: string }> {
    try {
      const fullPath = resolve(filePath);

      if (!existsSync(fullPath)) {
        return {
          valid: false,
          reason: 'File does not exist',
        };
      }
      
      const stats = await stat(fullPath);
      if (stats.size > MAX_FILE_SIZE) {
        return {
          valid: false,
          reason: `File too large (${stats.size} bytes). Maximum allowed: ${MAX_FILE_SIZE} bytes`,
        };
      }
      
      // Additional security check: ensure file is not a symlink to prevent attacks
      try {
        const linkStat = await lstat(fullPath);
        if (linkStat.isSymbolicLink()) {
          return {
            valid: false,
            reason: 'Symbolic links are not allowed for conflict resolution',
          };
        }
      } catch {
        // If we can't check, assume it's safe
      }

      // Read file with explicit encoding to prevent encoding issues
      const content = await readFile(fullPath, { encoding: 'utf8' });

      if (content.length === 0) {
        return {
          valid: false,
          reason: 'File is empty after editing',
        };
      }

      if (this.gitOps.hasConflictMarkers(content)) {
        return {
          valid: false,
          reason: 'Conflict markers still present in file',
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: `Failed to read file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get the number of conflict markers in a file
   * Returns -1 for oversized files, -2 for unreadable files
   */
  async getConflictCount(filePath: string): Promise<number> {
    try {
      const fullPath = resolve(filePath);
      
      if (!existsSync(fullPath)) {
        return 0; // File doesn't exist, no conflicts
      }
      
      const stats = await stat(fullPath);
      if (stats.size > MAX_FILE_SIZE) {
        return -1; // Special value for oversized files
      }
      
      const content = await readFile(fullPath, 'utf-8');
      return this.gitOps.countConflicts(content);
    } catch {
      // File might be locked, permissions issue, or other read error
      return -2; // Special value for unreadable files
    }
  }

  /**
   * Resolve a single conflict file
   * Returns true if resolved, false if skipped or failed
   *
   * Note: After the editor closes (even with a non-zero exit code),
   * we still validate whether the file was actually resolved.
   * Editors like vim can exit with code 1 for benign reasons
   * (swap file warnings) while the user has saved their changes.
   */
  async resolveFile(filePath: string): Promise<{ success: boolean; message: string }> {
    try {
      await this.openInEditor(filePath);
    } catch (error) {
      // Distinguish between fatal editor errors (binary not found) and
      // non-zero exit codes (already handled inside openInEditor, which
      // resolves on close regardless of code). If we get here with ENOENT,
      // the editor binary doesn't exist — no point validating an unedited file.
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('Failed to open editor') || msg.includes('ENOENT')) {
        return {
          success: false,
          message: `${filePath}: ${msg}`,
        };
      }
      // Timeout or other non-fatal errors — user may have saved before abort.
      // Fall through to validate the file content below.
    }

    // Always validate resolution regardless of editor exit code
    const validation = await this.validateResolution(filePath);

    if (!validation.valid) {
      return {
        success: false,
        message: `${filePath}: ${validation.reason}`,
      };
    }

    return {
      success: true,
      message: `Resolved ${filePath}`,
    };
  }
}
