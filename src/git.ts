import simpleGit, { SimpleGit } from 'simple-git';
import { resolve } from 'path';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';

interface StatusFile {
  index: string;
  path: string;
  working_dir?: string;
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
      const mergeMsgPath = resolve(this.workingDir, gitDir.trim(), 'MERGE_MSG');
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
        const mergeHeadPath = resolve(this.workingDir, gitDir.trim(), 'MERGE_HEAD');
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
   * Check if file content still has conflict markers
   * Checks for all conflict marker types at line start to avoid false positives
   * from strings/comments that happen to contain marker-like text.
   */
  hasConflictMarkers(content: string): boolean {
    // Check for any of the four conflict marker types at line start
    // <<<<<<< = ours, ======= = separator, >>>>>>> = theirs, ||||||| = base (diff3)
    return /^(<<<<<<<|=======|>>>>>>>|\|\|\|\|\|\|\|)/m.test(content);
  }

  /**
   * Count conflict markers in content
   */
  countConflicts(content: string): number {
    // Match <<<<<<< at line start with optional trailing text (including bare <<<<<<<)
    const matches = content.match(/^<<<<<<<.*$/gm);
    return matches ? matches.length : 0;
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
   * Checks for all unmerged status codes: UU, AA, DD, AU, UA, DU, UD
   */
  async isMergeInProgress(): Promise<boolean> {
    try {
      const status = await this.git.status();
      // Unmerged status codes: both modified (UU), both added (AA), both deleted (DD),
      // added by us (AU), added by them (UA), deleted by us (DU), deleted by them (UD)
      const unmergedCodes = new Set(['U', 'A', 'D']);
      return status.files.some(
        (f: StatusFile) =>
          unmergedCodes.has(f.index) && unmergedCodes.has(f.working_dir || '')
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