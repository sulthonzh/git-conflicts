import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import { resolve } from 'path';
import { GitOperations } from './git';

export class ConflictResolver {
  private gitOps: GitOperations;

  constructor() {
    this.gitOps = new GitOperations();
  }

  /**
   * Open file in user's preferred editor
   */
  async openInEditor(filePath: string): Promise<void> {
    const editor = process.env.EDITOR || process.env.VISUAL || this.getDefaultEditor();
    const fullPath = resolve(filePath);

    console.log(`💡 Opening ${filePath} in ${editor}...`);

    return new Promise((resolvePromise, reject) => {
      const editorProcess = spawn(editor, [fullPath], {
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
      // macOS/Linux/Unix
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
   * Resolve a single conflict file
   * Returns true if resolved, false if skipped or failed
   */
  async resolveFile(filePath: string): Promise<{ success: boolean; message: string }> {
    try {
      // Open in editor
      await this.openInEditor(filePath);

      // Validate resolution
      const validation = await this.validateResolution(filePath);

      if (!validation.valid) {
        return {
          success: false,
          message: `⚠️  ${filePath}: ${validation.reason}`,
        };
      }

      return {
        success: true,
        message: `✅ Resolved ${filePath}`,
      };
    } catch (error) {
      return {
        success: false,
        message: `❌ Failed to resolve ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}