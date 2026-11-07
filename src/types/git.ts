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
  upstream?: string;
};

export type CommitItem = {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
  parents: string[];
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

export type RepositoryFile = {
  path: string;
  content: string;
  revision: string;
  encoding: "UTF-8" | "UTF-16 LE" | "UTF-16 BE" | "GB18030";
  lineEnding: "LF" | "CRLF";
  readOnly: boolean;
};

export type ExternalEditor = {
  id: string;
  name: string;
  executable: string;
};

export type GitBridge = {
  getRepositoryFiles(repoPath: string): Promise<string[]>;
  readRepositoryFile(repoPath: string, filePath: string): Promise<RepositoryFile>;
  writeRepositoryFile(repoPath: string, filePath: string, content: string, revision?: string): Promise<RepositoryFile>;
  detectEditors(): Promise<ExternalEditor[]>;
  selectEditor(): Promise<ExternalEditor | undefined>;
  openInEditor(repoPath: string, editorId: string, filePath?: string): Promise<void>;
  selectDirectory(): Promise<string | undefined>;
  openRepo(repoPath: string): Promise<RepoInfo>;
  cloneRepo(repoUrl: string, targetDir: string): Promise<GitResult>;
  getRecentRepos(): Promise<RepoInfo[]>;
  removeRecentRepo(repoPath: string): Promise<RepoInfo[]>;
  getStatus(repoPath: string): Promise<GitStatus>;
  getBranches(repoPath: string): Promise<BranchInfo>;
  createBranch(repoPath: string, branchName: string): Promise<GitResult>;
  createAndPublishBranch(repoPath: string, branchName: string, remoteName: string): Promise<GitResult>;
  deleteRemoteBranch(repoPath: string, remoteBranchName: string): Promise<GitResult>;
  checkoutBranch(repoPath: string, branchName: string): Promise<GitResult>;
  checkoutRemoteBranch(repoPath: string, branchName: string): Promise<GitResult>;
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
  getMarkdownFiles(repoPath: string): Promise<string[]>;
  readMarkdownFile(repoPath: string, filePath: string): Promise<string>;
  writeMarkdownFile(repoPath: string, filePath: string, content: string): Promise<void>;
  getLogs(): Promise<OperationLogItem[]>;
  clearLogs(): Promise<OperationLogItem[]>;
};
