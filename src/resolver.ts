import { spawn } from 'child_process';
import { readFile, stat } from 'fs/promises';
import { resolve } from 'path';
import { GitOperations } from './git';
import { existsSync } from 'fs';

// Common safe editors with their typical executable names
const SAFE_EDITORS = new Set([
  'code', 'code-insiders', 'vscode', 'vim', 'nvim', 'nano', 'emacs', 
  'subl', 'atom', 'webstorm', 'intellij', 'idea', 'rubymine', 'phpstorm',
  'pycharm', 'goland', 'clion', 'eclipse', 'notepad', 'notepad++',
  'gedit', 'kate', 'mousepad', 'leafpad', 'gedit'
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

    // Security: Check for potentially dangerous characters
    if (/[;&|`$(){}\[\]]/.test(editorString)) {
      throw new Error('Editor command contains potentially dangerous characters');
    }

    // Simple shell-like parsing: split on whitespace, respect basic quoting
    const parts: string[] = [];
    let current = '';
    let inQuote = false;
    let quoteChar = '';

    for (const ch of editorString) {
      if (inQuote) {
        if (ch === quoteChar) {
          inQuote = false;
        } else {
          current += ch;
        }
      } else if (ch === '"' || ch === "'") {
        inQuote = true;
        quoteChar = ch;
      } else if (ch === ' ' || ch === '\t') {
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
    const command = parts[0];
    if (!SAFE_EDITORS.has(command.split('.')[0])) {
      throw new Error(`Editor "${command}" is not in the safe list of editors`);
    }

    return { command, args: parts.slice(1) };
  }

  /**
   * Open file in user's preferred editor with timeout
   */
  async openInEditor(filePath: string): Promise<void> {
    const editorString = process.env.EDITOR || process.env.VISUAL || this.getDefaultEditor();
    const fullPath = resolve(filePath);
    const { command, args } = this.parseEditorCommand(editorString);

    console.log(`  Opening in ${editorString}...`);

    return new Promise((resolvePromise, reject) => {
      // Set up timeout to prevent hanging
      const timeout = setTimeout(() => {
        reject(new Error(`Editor timed out after ${this.editorTimeout}ms`));
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
          resolvePromise();
        }
      });

      editorProcess.on('error', (err) => {
        clearTimeout(timeout);
        reject(new Error(`Failed to open editor: ${err.message}`));
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
      
      // Check if file exists
      if (!existsSync(fullPath)) {
        return {
          valid: false,
          reason: 'File does not exist',
        };
      }
      
      // Get file stats to check size
      const stats = await stat(fullPath);
      if (stats.size > MAX_FILE_SIZE) {
        return {
          valid: false,
          reason: `File too large (${stats.size} bytes). Maximum allowed: ${MAX_FILE_SIZE} bytes`,
        };
      }

      const content = await readFile(fullPath, 'utf-8');

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
   */
  async getConflictCount(filePath: string): Promise<number> {
    try {
      const fullPath = resolve(filePath);
      
      // Check file size before reading
      if (existsSync(fullPath)) {
        const stats = await import('fs').then(fs => fs.promises.stat(fullPath));
        if (stats.size > MAX_FILE_SIZE) {
          return -1; // Special value for oversized files
        }
      }
      
      const content = await readFile(fullPath, 'utf-8');
      return this.gitOps.countConflicts(content);
    } catch {
      return 0;
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
    } catch {
      // Editor exited with non-zero code — don't give up yet.
      // The user may have saved the file with conflicts resolved.
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
