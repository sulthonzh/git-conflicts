import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { GitOperations } from './git';

export class ConflictResolver {
  private gitOps: GitOperations;

  constructor(gitOps?: GitOperations) {
    this.gitOps = gitOps ?? new GitOperations();
  }

  /**
   * Parse editor command string into command and args array.
   * Handles editors with flags like "code --wait" or "vim -c 'set diff'"
   */
  private parseEditorCommand(editorString: string): { command: string; args: string[] } {
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
      return { command: editorString, args: [] };
    }

    return { command: parts[0], args: parts.slice(1) };
  }

  /**
   * Open file in user's preferred editor
   */
  async openInEditor(filePath: string): Promise<void> {
    const editorString = process.env.EDITOR || process.env.VISUAL || this.getDefaultEditor();
    const fullPath = resolve(filePath);
    const { command, args } = this.parseEditorCommand(editorString);

    console.log(`  Opening in ${editorString}...`);

    return new Promise((resolvePromise, reject) => {
      const editorProcess = spawn(command, [...args, fullPath], {
        stdio: 'inherit',
      });

      editorProcess.on('close', (code) => {
        if (code === 0) {
          resolvePromise();
        } else {
          reject(new Error(`Editor exited with code ${code}`));
        }
      });

      editorProcess.on('error', (err) => {
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
      const content = await readFile(resolve(filePath), 'utf-8');

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
      const content = await readFile(resolve(filePath), 'utf-8');
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
