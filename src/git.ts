import simpleGit, { SimpleGit } from 'simple-git';
import { resolve } from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

interface StatusFile {
  index: string;
  path: string;
}

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
      await this.git.status();

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
  async getMergeInfo(): Promise<{ current: string; merging?: string; mergeMessage?: string }> {
    const current = await this.getCurrentBranch();
    let merging: string | undefined;
    let mergeMessage: string | undefined;

    // Try to read .git/MERGE_MSG for merge context
    try {
      const gitDir = await this.git.revparse(['--git-dir']);
      // gitDir can be relative (e.g. ".git") — resolve relative to workingDir
      const absoluteGitDir = resolve(this.workingDir, gitDir.trim());
      const mergeMsgPath = resolve(absoluteGitDir, 'MERGE_MSG');
      if (existsSync(mergeMsgPath)) {
        const msg = await readFile(mergeMsgPath, 'utf-8');
        // Extract branch name from "Merge branch 'xyz'"
        const match = msg.match(/Merge branch ['"]([^'"]+)['"]/);
        if (match) {
          merging = match[1];
        }
        mergeMessage = msg.split('\n')[0].trim();
      }
    } catch {
      // MERGE_MSG might not exist during rebase or cherry-pick
    }

    // Try to read .git/MERGE_HEAD for the commit being merged
    if (!merging) {
      try {
        const gitDir = await this.git.revparse(['--git-dir']);
        const absoluteGitDir = resolve(this.workingDir, gitDir.trim());
        const mergeHeadPath = resolve(absoluteGitDir, 'MERGE_HEAD');
        if (existsSync(mergeHeadPath)) {
          const sha = (await readFile(mergeHeadPath, 'utf-8')).trim();
          // Get short ref name for the SHA
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

    return { current, merging, mergeMessage };
  }

  /**
   * Check if a file is currently in conflicted state
   */
  async isFileConflicted(filePath: string): Promise<boolean> {
    const conflictedFiles = await this.getConflictedFiles();
    return conflictedFiles.includes(filePath);
  }

  /**
   * Check if file content still has conflict markers.
   * Checks for all marker types including diff3 style (|||||||).
   * A partially-edited file might have orphan ======= or >>>>>>> markers
   * without a matching <<<<<<<, so we check all of them.
   */
  hasConflictMarkers(content: string): boolean {
    // Check line-by-line at line start to avoid false positives from strings
    const lines = content.split('\n');
    return lines.some(line =>
      /^<{7}\s/.test(line) ||
      /^={7}$/.test(line) ||
      /^>{7}\s/.test(line) ||
      /^\|{7}\s/.test(line)
    );
  }

  /**
   * Count conflict markers in content.
   * Counts <<<<<<< markers (each one starts a conflict block).
   */
  countConflicts(content: string): number {
    const lines = content.split('\n');
    return lines.filter(line => /^<{7}\s/.test(line)).length;
  }
  /**
   * Abort current merge
   */
  async abortMerge(): Promise<void> {
    await this.git.merge(['--abort']);
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
      const status = await this.git.status();
      return status.files.some((f: StatusFile) => f.index === 'U');
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
  }> {
    const files = await this.getConflictedFiles();
    const info = await this.getMergeInfo();
    return {
      hasConflicts: files.length > 0,
      files,
      branch: info.current,
      merging: info.merging,
      mergeMessage: info.mergeMessage,
    };
  }
}