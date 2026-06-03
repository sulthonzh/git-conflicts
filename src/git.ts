import simpleGit, { SimpleGit } from 'simple-git';
import { resolve } from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

export class GitOperations {
  private git: SimpleGit;
  private workingDir: string;

  constructor(cwd?: string) {
    this.workingDir = cwd ? resolve(cwd) : process.cwd();
    this.git = simpleGit(this.workingDir);
  }

  /**
   * Get list of files with merge conflicts
   */
  async getConflictedFiles(): Promise<string[]> {
    try {
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
   * Attempts to read MERGE_HEAD and MERGE_MSG for better context
   */
  async getMergeInfo(): Promise<{ current: string; merging?: string; mergeMessage?: string; operation?: string }> {
    const current = await this.getCurrentBranch();
    let merging: string | undefined;
    let mergeMessage: string | undefined;
    let operation: string | undefined;

    const gitDir = (await this.git.revparse(['--git-dir'])).trim();

    // Detect rebase state
    const rebaseMergeDir = resolve(this.workingDir, gitDir, 'rebase-merge');
    const rebaseApplyDir = resolve(this.workingDir, gitDir, 'rebase-apply');
    if (existsSync(rebaseMergeDir)) {
      operation = 'rebase';
      try {
        const headName = await readFile(resolve(rebaseMergeDir, 'head-name'), 'utf-8');
        const match = headName.trim().match(/^refs\/heads\/(.+)$/);
        if (match) {
          // head-name contains the branch being rebased onto
          merging = match[1];
        }
      } catch { /* ignore */ }
      try {
        const msg = await readFile(resolve(rebaseMergeDir, 'message'), 'utf-8');
        mergeMessage = msg.split('\n')[0].trim();
      } catch { /* ignore */ }
    } else if (existsSync(rebaseApplyDir)) {
      operation = 'rebase';
    }

    // Detect cherry-pick/revert state
    if (!operation) {
      const cherryPickHead = resolve(this.workingDir, gitDir, 'CHERRY_PICK_HEAD');
      const revertHead = resolve(this.workingDir, gitDir, 'REVERT_HEAD');
      if (existsSync(cherryPickHead)) {
        operation = 'cherry-pick';
      } else if (existsSync(revertHead)) {
        operation = 'revert';
      }
    }

    // Default to merge
    if (!operation) {
      operation = 'merge';
    }

    // Try to read MERGE_MSG for merge context
    try {
      const mergeMsgPath = resolve(this.workingDir, gitDir, 'MERGE_MSG');
      if (existsSync(mergeMsgPath)) {
        const msg = await readFile(mergeMsgPath, 'utf-8');
        const match = msg.match(/Merge branch ['"]([^'"]+)['"]/);
        if (match) {
          merging = match[1];
        }
        mergeMessage = msg.split('\n')[0].trim();
      }
    } catch {
      // MERGE_MSG might not exist during rebase or cherry-pick
    }

    // Try to read MERGE_HEAD for the commit being merged
    if (!merging) {
      try {
        const mergeHeadPath = resolve(this.workingDir, gitDir, 'MERGE_HEAD');
        if (existsSync(mergeHeadPath)) {
          const sha = (await readFile(mergeHeadPath, 'utf-8')).trim();
          try {
            const name = await this.git.raw(['name-rev', '--name-only', sha]);
            merging = name.trim() || sha.substring(0, 7);
          } catch {
            merging = sha.substring(0, 7);
          }
        }
      } catch {
        // ignore
      }
    }

    return { current, merging, mergeMessage, operation };
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
   * Count conflict markers in content
   */
  countConflicts(content: string): number {
    const matches = content.match(/<<<<<<<.*$/gm);
    return matches ? matches.length : 0;
  }
  /**
   * Abort current merge
   */
  async abortMerge(): Promise<void> {
    const gitDir = (await this.git.revparse(['--git-dir'])).trim();

    // Detect what operation is in progress
    if (existsSync(resolve(this.workingDir, gitDir, 'rebase-merge')) ||
        existsSync(resolve(this.workingDir, gitDir, 'rebase-apply'))) {
      await this.git.raw(['rebase', '--abort']);
    } else if (existsSync(resolve(this.workingDir, gitDir, 'CHERRY_PICK_HEAD'))) {
      await this.git.raw(['cherry-pick', '--abort']);
    } else if (existsSync(resolve(this.workingDir, gitDir, 'REVERT_HEAD'))) {
      await this.git.raw(['revert', '--abort']);
    } else {
      await this.git.merge(['--abort']);
    }
  }

  /**
   * Stage a file (git add)
   */
  async stageFile(filePath: string): Promise<void> {
    await this.git.add(filePath);
  }

  /**
   * Check if merge is in progress
   */
  async isMergeInProgress(): Promise<boolean> {
    try {
      // Check for conflict files via diff
      const diffOutput = await this.git.diff(['--name-only', '--diff-filter=U']);
      const files = diffOutput.split('\n').filter((f: string) => f.trim().length > 0);
      if (files.length > 0) return true;

      // Also check for ongoing operations that haven't produced conflicts yet
      const gitDir = (await this.git.revparse(['--git-dir'])).trim();
      return (
        existsSync(resolve(this.workingDir, gitDir, 'MERGE_HEAD')) ||
        existsSync(resolve(this.workingDir, gitDir, 'rebase-merge')) ||
        existsSync(resolve(this.workingDir, gitDir, 'rebase-apply')) ||
        existsSync(resolve(this.workingDir, gitDir, 'CHERRY_PICK_HEAD')) ||
        existsSync(resolve(this.workingDir, gitDir, 'REVERT_HEAD'))
      );
    } catch {
      return false;
    }
  }

  /**
   * Get conflict status as structured data (for --json)
   */
  async getConflictStatus(): Promise<{
    hasConflicts: boolean;
    files: string[];
    branch: string;
    merging?: string;
    mergeMessage?: string;
    operation?: string;
  }> {
    // Get conflicts and branch in parallel to avoid sequential git calls
    const [files, info] = await Promise.all([
      this.getConflictedFiles(),
      this.getMergeInfo(),
    ]);
    return {
      hasConflicts: files.length > 0,
      files,
      branch: info.current,
      merging: info.merging,
      mergeMessage: info.mergeMessage,
      operation: info.operation,
    };
  }
}