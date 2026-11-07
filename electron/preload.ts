import { contextBridge, ipcRenderer } from "electron";
import type {
  CommitDetail,
  GitBridge,
  GitResult,
  OperationLogItem,
  RemoteInfo,
  RepoInfo
} from "../src/types/git";

const gitClient: GitBridge = {
  getRepositoryFiles: (repoPath) => ipcRenderer.invoke("files:list", repoPath),
  readRepositoryFile: (repoPath, filePath) => ipcRenderer.invoke("files:read", repoPath, filePath),
  writeRepositoryFile: (repoPath, filePath, content, revision) => ipcRenderer.invoke("files:write", repoPath, filePath, content, revision),
  detectEditors: () => ipcRenderer.invoke("editors:detect"),
  selectEditor: () => ipcRenderer.invoke("editors:select"),
  openInEditor: (repoPath, editorId, filePath) => ipcRenderer.invoke("editors:open", repoPath, editorId, filePath),

  createAndPublishBranch: (repoPath: string, branchName: string, remoteName: string) => ipcRenderer.invoke('git:branch:create-publish', repoPath, branchName, remoteName),
  deleteRemoteBranch: (repoPath: string, branchName: string) => ipcRenderer.invoke('git:branch:delete-remote', repoPath, branchName),
  getMarkdownFiles: (repoPath: string) => ipcRenderer.invoke('git:markdown:list', repoPath),
  readMarkdownFile: (repoPath: string, filePath: string) => ipcRenderer.invoke('git:markdown:read', repoPath, filePath),
  writeMarkdownFile: (repoPath: string, filePath: string, content: string) => ipcRenderer.invoke('git:markdown:write', repoPath, filePath, content),
  selectDirectory: () => ipcRenderer.invoke("dialog:select-directory"),
  openRepo: (repoPath: string) => ipcRenderer.invoke("repo:open", repoPath),
  cloneRepo: (repoUrl: string, targetDir: string) => ipcRenderer.invoke("repo:clone", repoUrl, targetDir),
  getRecentRepos: () => ipcRenderer.invoke("repo:recent"),
  removeRecentRepo: (repoPath: string) => ipcRenderer.invoke("repo:recent:remove", repoPath),
  getStatus: (repoPath: string) => ipcRenderer.invoke("git:status", repoPath),
  getBranches: (repoPath: string) => ipcRenderer.invoke("git:branches", repoPath),
  createBranch: (repoPath: string, branchName: string) => ipcRenderer.invoke("git:branch:create", repoPath, branchName),
  checkoutBranch: (repoPath: string, branchName: string) => ipcRenderer.invoke("git:branch:checkout", repoPath, branchName),
  checkoutRemoteBranch: (repoPath: string, branchName: string) => ipcRenderer.invoke("git:branch:checkout-remote", repoPath, branchName),
  deleteBranch: (repoPath: string, branchName: string) => ipcRenderer.invoke("git:branch:delete", repoPath, branchName),
  pull: (repoPath: string) => ipcRenderer.invoke("git:pull", repoPath),
  push: (repoPath: string) => ipcRenderer.invoke("git:push", repoPath),
  commit: (repoPath: string, files: string[], message: string) => ipcRenderer.invoke("git:commit", repoPath, files, message),
  merge: (repoPath: string, branchName: string) => ipcRenderer.invoke("git:merge", repoPath, branchName),
  getCommitHistory: (repoPath: string) => ipcRenderer.invoke("git:history", repoPath),
  getCommitDetail: (repoPath: string, hash: string): Promise<CommitDetail> => ipcRenderer.invoke("git:history:detail", repoPath, hash),
  getRemotes: (repoPath: string): Promise<RemoteInfo[]> => ipcRenderer.invoke("git:remotes", repoPath),
  addRemote: (repoPath: string, name: string, url: string): Promise<GitResult> => ipcRenderer.invoke("git:remote:add", repoPath, name, url),
  setRemoteUrl: (repoPath: string, name: string, url: string): Promise<GitResult> => ipcRenderer.invoke("git:remote:set-url", repoPath, name, url),
  removeRemote: (repoPath: string, name: string): Promise<GitResult> => ipcRenderer.invoke("git:remote:remove", repoPath, name),
  stageFiles: (repoPath: string, files: string[]): Promise<GitResult> => ipcRenderer.invoke("git:stage", repoPath, files),
  unstageFiles: (repoPath: string, files: string[]): Promise<GitResult> => ipcRenderer.invoke("git:unstage", repoPath, files),
  discardFiles: (repoPath: string, files: string[]): Promise<GitResult> => ipcRenderer.invoke("git:discard", repoPath, files),
  getLogs: (): Promise<OperationLogItem[]> => ipcRenderer.invoke("logs:get"),
  clearLogs: () => ipcRenderer.invoke("logs:clear")
};

contextBridge.exposeInMainWorld("gitClient", gitClient);

declare global {
  interface Window {
    gitClient: GitBridge;
  }
}
