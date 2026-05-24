declare module 'simple-git' {
  interface SimpleGit {
    status(): Promise<StatusResult>;
    diff(args: string[]): Promise<string>;
    merge(args: string[]): Promise<MergeResult>;
  }

  interface StatusResult {
    current: string;
    files: StatusFile[];
  }

  interface StatusFile {
    index: string;
    path: string;
  }

  interface MergeResult {
    files: string[];
  }

  export interface SimpleGitOptions {
    baseDir?: string;
    binary?: string;
    maxConcurrentProcesses?: number;
    config?: string[];
  }

  export default function simpleGit(baseDir?: string | SimpleGitOptions): SimpleGit;
}