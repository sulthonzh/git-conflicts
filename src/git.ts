import simpleGit from 'simple-git';
import type { SimpleGit, StatusFile } from 'simple-git';
import { resolve, relative, isAbsolute } from 'path';
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
        if (error.message.includes('bad revision')) {
          throw new Error('Invalid git revision');
        }
        throw new Error(`Failed to get conflicted files: ${error.message}`);
      }
      throw new Error('Unknown error while getting conflicted files');
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
   * Resolve the absolute .git directory path
   */
  private async getAbsoluteGitDir(): Promise<string> {
    try {
      const gitDir = await this.git.revparse(['--git-dir']);
      // revparse --git-dir can return relative paths like ".git"
      const absolute = resolve(this.workingDir, gitDir.trim());
      return absolute;
    } catch (error) {
      throw new Error(`Failed to resolve git directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get merge conflict info (branches involved)
   * Attempts to read MERGE_HEAD and MERGE_MSG for better context
   */
  async getMergeInfo(): Promise<{ current: string; merging?: string; mergeMessage?: string }> {
    try {
      const current = await this.getCurrentBranch();
      let merging: string | undefined;
      let mergeMessage: string | undefined;

      const gitDir = await this.getAbsoluteGitDir();
      const mergeState = await this.getMergeState();

      // Only read MERGE_MSG during an actual merge — during rebase/cherry-pick,
      // a stale MERGE_MSG from a prior merge would give misleading branch info
      if (mergeState === 'merge') {
        // Try to read .git/MERGE_MSG for merge context
        try {
          const mergeMsgPath = resolve(gitDir, 'MERGE_MSG');
          if (existsSync(mergeMsgPath)) {
            const msg = await readFile(mergeMsgPath, 'utf-8');
            // Extract branch name from "Merge branch 'xyz'"
            const match = msg.match(/Merge branch ['"]([^'"]+)['"]/);
            if (match && match[1]) {
              merging = match[1];
            }
            mergeMessage = msg.split('\n')[0].trim();
          }
        } catch {
          // MERGE_MSG might not exist or be readable
        }

        // Try to read .git/MERGE_HEAD for the commit being merged
        if (!merging) {
          try {
            const mergeHeadPath = resolve(gitDir, 'MERGE_HEAD');
            if (existsSync(mergeHeadPath)) {
              const sha = (await readFile(mergeHeadPath, 'utf-8')).trim();
              if (sha) {
                // Get short ref name for the SHA
                try {
                  const name = await this.git.nameRev(['--name-only', sha]);
                  const trimmedName = name.trim();
                  merging = trimmedName || sha.substring(0, 7);
                } catch {
                  merging = sha.substring(0, 7);
                }
              }
            }
          } catch {
            // ignore
          }
        }
      }

      // During rebase, check rebase-merge directory for branch info
      if (!merging && mergeState === 'rebase') {
        try {
          const headNamePath = resolve(gitDir, 'rebase-merge', 'head-name');
          if (existsSync(headNamePath)) {
            const headName = (await readFile(headNamePath, 'utf-8')).trim();
            // head-name is typically "refs/heads/branch-name"
            if (headName) {
              merging = headName.replace(/^refs\/heads\//, '');
            }
          }
        } catch {
          // ignore
        }
      }

      // During cherry-pick, try to get the picked commit's ref
      if (!merging && mergeState === 'cherry-pick') {
        try {
          const cherryHeadPath = resolve(gitDir, 'CHERRY_PICK_HEAD');
          if (existsSync(cherryHeadPath)) {
            const sha = (await readFile(cherryHeadPath, 'utf-8')).trim();
            if (sha) {
              try {
                const name = await this.git.nameRev(['--name-only', sha]);
                const trimmedName = name.trim();
                merging = trimmedName || sha.substring(0, 7);
              } catch {
                merging = sha.substring(0, 7);
              }
            }
          }
        } catch {
          // ignore
        }
      }

      return { current, merging, mergeMessage };
    } catch (error) {
      throw new Error(`Failed to get merge info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if a file is currently in conflicted state
   * Accepts both relative and absolute paths for flexibility.
   */
  async isFileConflicted(filePath: string): Promise<boolean> {
    const conflictedFiles = await this.getConflictedFiles();
    // Normalize input to relative path for comparison with git output
    const relative = this.toRelativePath(filePath);
    return conflictedFiles.includes(relative) || conflictedFiles.includes(filePath);
  }

  /**
   * Convert an absolute or relative path to a path relative to workingDir.
   * Uses path.relative() for correct path boundary handling — avoids
   * false matches like /foo/barbaz being treated as inside /foo/bar.
   */
  private toRelativePath(filePath: string): string {
    const absolute = resolve(this.workingDir, filePath);
    const rel = relative(this.workingDir, absolute);
    // If the path escapes workingDir, relative() returns something starting with ../
    // In that case, return the original filePath as-is (can't normalize it)
    if (rel.startsWith('..') || isAbsolute(filePath)) {
      return filePath;
    }
    return rel;
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
   * Abort current merge/rebase/cherry-pick
   * Detects the type of in-progress operation and calls the appropriate abort command.
   */
  async abortMerge(): Promise<void> {
    try {
      const mergeState = await this.getMergeState();

      switch (mergeState) {
        case 'rebase':
          await this.git.raw(['rebase', '--abort']);
          break;
        case 'cherry-pick':
          await this.git.raw(['cherry-pick', '--abort']);
          break;
        case 'merge':
          await this.git.merge(['--abort']);
          break;
        default:
          throw new Error('Not in a merge, rebase, or cherry-pick state');
      }
    } catch (error) {
      if (error instanceof Error) {
        // Not in a merge state - this is a normal condition
        throw new Error(
          error.message.includes('not a merge') ||
          error.message.includes('no rebase in progress') ||
          error.message.includes('no cherry-pick') ||
          error.message.includes('Not in a merge')
            ? 'Not in a merge state'
            : error.message
        );
      }
      throw error;
    }
  }

  /**
   * Stage a file (git add)
   */
  async stageFile(filePath: string): Promise<void> {
    await this.git.add(filePath);
  }

  /**
   * Check if merge or rebase is in progress
   * Checks for all unmerged status codes: UU, AA, DD, AU, UA, DU, UD
   * Also detects rebase conflicts via .git/rebase-merge directory
   */
  async isMergeInProgress(): Promise<boolean> {
    try {
      const mergeState = await this.getMergeState();
      return mergeState !== 'none' && mergeState !== 'unknown';
    } catch {
      // If we can't determine merge state, assume it's not in progress
      // to avoid false positives
      return false;
    }
  }

  /**
   * Check if we're in a merge or rebase state
   * Returns a more specific status for better error messages
   */
  async getMergeState(): Promise<'none' | 'merge' | 'rebase' | 'cherry-pick' | 'unknown'> {
    try {
      const gitDir = await this.getAbsoluteGitDir();
      // produce unmerged files. Checking unmerged files before these would
      // misclassify a rebase conflict as a merge.
      const rebaseMergeDir = resolve(gitDir, 'rebase-merge');
      if (existsSync(rebaseMergeDir)) {
        return 'rebase';
      }

      const cherryPickHead = resolve(gitDir, 'CHERRY_PICK_HEAD');
      if (existsSync(cherryPickHead)) {
        return 'cherry-pick';
      }

      // Check for MERGE_HEAD — present during any merge (even clean ones with --no-commit)
      const mergeHeadPath = resolve(gitDir, 'MERGE_HEAD');
      if (existsSync(mergeHeadPath)) {
        return 'merge';
      }

      // Check for unmerged files (conflict state without explicit merge/rebase metadata)
      const status = await this.git.status();
      const conflictCodes = new Set(['DD', 'AU', 'UD', 'UA', 'DU', 'AA', 'UU']);
      const hasUnmergedFiles = status.files.some(
        (f: StatusFile) => conflictCodes.has(`${f.index}${f.working_dir ?? ''}`)
      );

      if (hasUnmergedFiles) {
        return 'merge';
      }

      return 'none';
    } catch {
      return 'unknown';
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
    mergeState: 'none' | 'merge' | 'rebase' | 'cherry-pick' | 'unknown';
  }> {
    try {
      const files = await this.getConflictedFiles();
      const info = await this.getMergeInfo();
      const mergeState = await this.getMergeState();
      
      return {
        hasConflicts: files.length > 0,
        files,
        branch: info.current,
        merging: info.merging,
        mergeMessage: info.mergeMessage,
        mergeState,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to get conflict status: ${error.message}`);
      }
      throw new Error('Unknown error while getting conflict status');
    }
  }

  /**
   * Check if a file is staged
   */
  async isFileStaged(filePath: string): Promise<boolean> {
    try {
      if (!filePath || typeof filePath !== 'string') {
        return false;
      }
      
      const relativePath = this.toRelativePath(filePath);
      const status = await this.git.status();
      return status.files.some(file => file.path === relativePath && file.index !== ' ');
    } catch {
      return false;
    }
  }

  /**
   * Check if a file is modified
   */
  async isFileModified(filePath: string): Promise<boolean> {
    try {
      if (!filePath || typeof filePath !== 'string') {
        return false;
      }
      
      const relativePath = this.toRelativePath(filePath);
      const status = await this.git.status();
      return status.files.some(file => file.path === relativePath && file.working_dir !== ' ');
    } catch {
      return false;
    }
  }

  /**
   * Get detailed status of a conflicted file
   */
  async getFileConflictStatus(filePath: string): Promise<{
    isConflicted: boolean;
    isStaged: boolean;
    isModified: boolean;
    conflictCount: number;
  }> {
    try {
      if (!filePath || typeof filePath !== 'string') {
        return {
          isConflicted: false,
          isStaged: false,
          isModified: false,
          conflictCount: 0,
        };
      }
      
      const isConflicted = await this.isFileConflicted(filePath);
      const isStaged = await this.isFileStaged(filePath);
      const isModified = await this.isFileModified(filePath);
      
      let conflictCount = 0;
      if (isConflicted) {
        try {
          const fullPath = resolve(this.workingDir, filePath);
          const content = await readFile(fullPath, 'utf-8');
          conflictCount = this.countConflicts(content);
        } catch {
          // File might be locked or unreadable
        }
      }
      
      return {
        isConflicted,
        isStaged,
        isModified,
        conflictCount,
      };
    } catch {
      return {
        isConflicted: false,
        isStaged: false,
        isModified: false,
        conflictCount: 0,
      };
    }
  }
}
