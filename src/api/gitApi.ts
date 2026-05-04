import type { GitBridge } from "../types/git";

/**
 * Returns true if the app is running inside Electron with the IPC bridge available.
 */
function isElectron(): boolean {
  return !!window.gitClient;
}

function getClient(): GitBridge {
  if (!window.gitClient) {
    throw new Error("Git IPC bridge is not available. 请确认应用运行在 Electron 环境中。");
  }
  return window.gitClient;
}

export const gitApi: GitBridge = {
  selectDirectory: () => getClient().selectDirectory(),
  openRepo: (repoPath) => getClient().openRepo(repoPath),
  cloneRepo: (repoUrl, targetDir) => getClient().cloneRepo(repoUrl, targetDir),
  getRecentRepos: () => isElectron() ? getClient().getRecentRepos() : Promise.resolve([]),
  getStatus: (repoPath) => getClient().getStatus(repoPath),
  getBranches: (repoPath) => getClient().getBranches(repoPath),
  createBranch: (repoPath, branchName) => getClient().createBranch(repoPath, branchName),
  checkoutBranch: (repoPath, branchName) => getClient().checkoutBranch(repoPath, branchName),
  deleteBranch: (repoPath, branchName) => getClient().deleteBranch(repoPath, branchName),
  pull: (repoPath) => getClient().pull(repoPath),
  push: (repoPath) => getClient().push(repoPath),
  commit: (repoPath, files, message) => getClient().commit(repoPath, files, message),
  merge: (repoPath, branchName) => getClient().merge(repoPath, branchName),
  getCommitHistory: (repoPath) => getClient().getCommitHistory(repoPath),
  getCommitDetail: (repoPath, hash) => getClient().getCommitDetail(repoPath, hash),
  getRemotes: (repoPath) => getClient().getRemotes(repoPath),
  addRemote: (repoPath, name, url) => getClient().addRemote(repoPath, name, url),
  setRemoteUrl: (repoPath, name, url) => getClient().setRemoteUrl(repoPath, name, url),
  removeRemote: (repoPath, name) => getClient().removeRemote(repoPath, name),
  stageFiles: (repoPath, files) => getClient().stageFiles(repoPath, files),
  unstageFiles: (repoPath, files) => getClient().unstageFiles(repoPath, files),
  discardFiles: (repoPath, files) => getClient().discardFiles(repoPath, files),
  getLogs: () => isElectron() ? getClient().getLogs() : Promise.resolve([]),
  clearLogs: () => isElectron() ? getClient().clearLogs() : Promise.resolve([])
};
