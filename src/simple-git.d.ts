declare module 'simple-git' {
  interface SimpleGit {
    status(): Promise<StatusResult>;
    diff(args: string[]): Promise<string>;
    merge(args: string[]): Promise<MergeResult>;
    add(files: string | string[]): Promise<string>;
    raw(args: string[]): Promise<string>;
    revparse(args: string[]): Promise<string>;
    nameRev(args: string[]): Promise<string>;
    log(options?: Record<string, unknown>): Promise<unknown>;
    stash(options?: Record<string, unknown>): Promise<string>;
    checkout(branch: string): Promise<string>;
    checkoutFiles(files: string[]): Promise<string>;
    reset(options?: Record<string, unknown>): Promise<string>;
    clean(options?: Record<string, unknown>): Promise<string>;
    fetch(options?: Record<string, unknown>): Promise<string>;
    pull(options?: Record<string, unknown>): Promise<string>;
    push(options?: Record<string, unknown>): Promise<string>;
    tag(options?: Record<string, unknown>): Promise<string>;
    clone(url: string, path: string): Promise<string>;
    init(): Promise<string>;
    remote(options?: Record<string, unknown>): Promise<string>;
    branch(options?: Record<string, unknown>): Promise<string>;
    describe(options?: Record<string, unknown>): Promise<string>;
    blame(options?: Record<string, unknown>): Promise<string>;
    show(options?: Record<string, unknown>): Promise<string>;
    grep(options?: Record<string, unknown>): Promise<string>;
    mv(from: string, to: string): Promise<string>;
    rm(files: string[]): Promise<string>;
    commit(message: string, options?: Record<string, unknown>): Promise<string>;
  }

  interface StatusResult {
    current: string;
    tracking: string;
    ahead: number;
    behind: number;
    files: StatusFile[];
    staged: StatusFile[];
    modified: StatusFile[];
    deleted: StatusFile[];
    conflicts: StatusFile[];
  }

  interface StatusFile {
    path: string;
    index: string;
    working_dir: string;
    from?: string;
    to?: string;
    original?: string;
    type?: 'M' | 'A' | 'D' | 'R' | 'C' | 'U';
  }

  interface MergeResult {
    alreadyUpToDate: boolean;
    wasAlreadyMerged: boolean;
    failed: boolean;
    conflicts: string[];
    merges: string[];
    deletions: string[];
    insertions: string[];
  }

  export interface SimpleGitOptions {
    baseDir?: string;
    binary?: string;
    maxConcurrentProcesses?: number;
    config?: string[];
    trimmed?: boolean;
    timeout?: number;
    'bare'?: boolean;
  }

  export default function simpleGit(baseDir?: string | SimpleGitOptions): SimpleGit;
}
