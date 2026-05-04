export type ChangedFileStatus =
  | "added"
  | "modified"
  | "deleted"
  | "renamed"
  | "copied"
  | "untracked"
  | "conflicted"
  | "unknown";

export type GitResult = {
  success: boolean;
  command: string;
  output: string;
  error?: string;
  conflictFiles?: string[];
  requiresUpstream?: boolean;
};

export type RepoInfo = {
  path: string;
  name: string;
  currentBranch: string;
  remoteUrl?: string;
  ahead: number;
  behind: number;
};

export type ChangedFile = {
  path: string;
  originalPath?: string;
  status: ChangedFileStatus;
  staged: boolean;
};

export type GitStatus = {
  repoPath: string;
  currentBranch: string;
  ahead: number;
  behind: number;
  files: ChangedFile[];
  isClean: boolean;
  hasConflicts: boolean;
};

export type BranchInfo = {
  current: string;
  local: string[];
  remote: string[];
};

export type CommitItem = {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
};

export type CommitFile = {
  path: string;
  originalPath?: string;
  status: ChangedFileStatus;
  additions?: number;
  deletions?: number;
};

export type CommitDetail = CommitItem & {
  body: string;
  files: CommitFile[];
};

export type RemoteInfo = {
  name: string;
  url: string;
  type: "fetch" | "push";
};

export type OperationLogItem = {
  id: string;
  operation: string;
  command: string;
  success: boolean;
  output: string;
  error?: string;
  time: string;
  repoPath?: string;
};

export type GitBridge = {
  selectDirectory(): Promise<string | undefined>;
  openRepo(repoPath: string): Promise<RepoInfo>;
  cloneRepo(repoUrl: string, targetDir: string): Promise<GitResult>;
  getRecentRepos(): Promise<RepoInfo[]>;
  getStatus(repoPath: string): Promise<GitStatus>;
  getBranches(repoPath: string): Promise<BranchInfo>;
  createBranch(repoPath: string, branchName: string): Promise<GitResult>;
  checkoutBranch(repoPath: string, branchName: string): Promise<GitResult>;
  deleteBranch(repoPath: string, branchName: string): Promise<GitResult>;
  pull(repoPath: string): Promise<GitResult>;
  push(repoPath: string): Promise<GitResult>;
  commit(repoPath: string, files: string[], message: string): Promise<GitResult>;
  merge(repoPath: string, branchName: string): Promise<GitResult>;
  getCommitHistory(repoPath: string): Promise<CommitItem[]>;
  getCommitDetail(repoPath: string, hash: string): Promise<CommitDetail>;
  getRemotes(repoPath: string): Promise<RemoteInfo[]>;
  addRemote(repoPath: string, name: string, url: string): Promise<GitResult>;
  setRemoteUrl(repoPath: string, name: string, url: string): Promise<GitResult>;
  removeRemote(repoPath: string, name: string): Promise<GitResult>;
  stageFiles(repoPath: string, files: string[]): Promise<GitResult>;
  unstageFiles(repoPath: string, files: string[]): Promise<GitResult>;
  discardFiles(repoPath: string, files: string[]): Promise<GitResult>;
  getLogs(): Promise<OperationLogItem[]>;
  clearLogs(): Promise<OperationLogItem[]>;
};
