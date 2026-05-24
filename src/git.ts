import simpleGit, { SimpleGit } from 'simple-git';
import { resolve } from 'path';

interface StatusFile {
  index: string;
  path: string;
}

export class GitOperations {
  private git: SimpleGit;

  constructor(cwd?: string) {
    const workingDir = cwd ? resolve(cwd) : process.cwd();
    this.git = simpleGit(workingDir);
  }

  /**
   * Get list of files with merge conflicts
   */
  async getConflictedFiles(): Promise<string[]> {
    try {
      // Check if we are in a git repository
      await this.git.status();

      // Get files with unmerged status (U)
      // Using git diff --name-only --diff-filter=U as specified in requirements
      const diffOutput = await this.git.diff(['--name-only', '--diff-filter=U']);
      const files = diffOutput
        .split('\n')
        .map((f: string) => f.trim())
        .filter((f: string) => f.length > 0);

      return files;
    } catch (error) {
      if (error instanceof Error) {
        if (error.message.includes('not a git repository')) {
          throw new Error('Not a git repository');
        }
      }
      throw error;
    }
  }

  /**
   * Get current branch information
   */
  async getCurrentBranch(): Promise<string> {
    const status = await this.git.status();
    return status.current || 'HEAD';
  }

  /**
   * Get merge conflict info (branches involved)
   */
  async getMergeInfo(): Promise<{ current: string; merging?: string }> {
    const current = await this.getCurrentBranch();
    await this.git.status();

    // simple-git doesn't directly expose the merging branch name in status easily
    // We'll return current for now. In a real scenario, we might parse .git/MERGE_HEAD
    return { current };
  }

  /**
   * Check if a file is currently in conflicted state
   */
  async isFileConflicted(filePath: string): Promise<boolean> {
    const conflictedFiles = await this.getConflictedFiles();
    return conflictedFiles.includes(filePath);
  }

  /**
   * Check if file content still has conflict markers
   */
  hasConflictMarkers(content: string): boolean {
    return content.includes('<<<<<<<');
  }

  /**
   * Abort current merge
   */
  async abortMerge(): Promise<void> {
    await this.git.merge(['--abort']);
  }

  /**
   * Check if merge is in progress
   */
  async isMergeInProgress(): Promise<boolean> {
    try {
      const status = await this.git.status();
      return status.files.some((f: StatusFile) => f.index === 'U');
    } catch {
      return false;
    }
  }
}