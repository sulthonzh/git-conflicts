declare module 'simple-git' {
  interface SimpleGit {
    status(): Promise<StatusResult>;
    diff(args: string[]): Promise<string>;
    merge(args: string[]): Promise<MergeResult>;
    add(files: string | string[]): Promise<string>;
    raw(args: string[]): Promise<string>;
    revparse(args: string[]): Promise<string>;
    log(options?: any): Promise<any>;
    stash(options?: any): Promise<string>;
    checkout(branch: string): Promise<string>;
    checkoutFiles(files: string[]): Promise<string>;
    reset(options?: any): Promise<string>;
    clean(options?: any): Promise<string>;
    fetch(options?: any): Promise<string>;
    pull(options?: any): Promise<string>;
    push(options?: any): Promise<string>;
    tag(options?: any): Promise<string>;
    clone(url: string, path: string): Promise<string>;
    init(): Promise<string>;
    remote(options?: any): Promise<string>;
    branch(options?: any): Promise<string>;
    describe(options?: any): Promise<string>;
    blame(options?: any): Promise<string>;
    show(options?: any): Promise<string>;
    grep(options?: any): Promise<string>;
    mv(from: string, to: string): Promise<string>;
    rm(files: string[]): Promise<string>;
    commit(message: string, options?: any): Promise<string>;
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
