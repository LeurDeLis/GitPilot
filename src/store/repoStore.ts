import { create } from "zustand";
import type {
  BranchInfo,
  CommitItem,
  GitStatus,
  OperationLogItem,
  RemoteInfo,
  RepoInfo
} from "../types/git";

type RepoStore = {
  repoInfo?: RepoInfo;
  status?: GitStatus;
  branches: BranchInfo;
  commits: CommitItem[];
  remotes: RemoteInfo[];
  logs: OperationLogItem[];
  recentRepos: RepoInfo[];
  selectedFiles: string[];
  busy: boolean;
  setRepoInfo(repoInfo?: RepoInfo): void;
  setStatus(status?: GitStatus, options?: { preserveSelection?: boolean }): void;
  setBranches(branches: BranchInfo): void;
  setCommits(commits: CommitItem[]): void;
  setRemotes(remotes: RemoteInfo[]): void;
  setLogs(logs: OperationLogItem[]): void;
  setRecentRepos(recentRepos: RepoInfo[]): void;
  setSelectedFiles(selectedFiles: string[]): void;
  setBusy(busy: boolean): void;
  resetRepoData(): void;
};

const emptyBranches: BranchInfo = {
  current: "",
  local: [],
  remote: []
};

export const useRepoStore = create<RepoStore>((set) => ({
  repoInfo: undefined,
  status: undefined,
  branches: emptyBranches,
  commits: [],
  remotes: [],
  logs: [],
  recentRepos: [],
  selectedFiles: [],
  busy: false,
  setRepoInfo: (repoInfo) => set({ repoInfo }),
  setStatus: (status, options) => set((state) => {
    const nextFiles = status?.files.map((file) => file.path) ?? [];
    const selectedFiles = options?.preserveSelection
      ? state.selectedFiles.filter((file) => nextFiles.includes(file))
      : nextFiles;

    return { status, selectedFiles };
  }),
  setBranches: (branches) => set({ branches }),
  setCommits: (commits) => set({ commits }),
  setRemotes: (remotes) => set({ remotes }),
  setLogs: (logs) => set({ logs }),
  setRecentRepos: (recentRepos) => set({ recentRepos }),
  setSelectedFiles: (selectedFiles) => set({ selectedFiles }),
  setBusy: (busy) => set({ busy }),
  resetRepoData: () => set({
    repoInfo: undefined,
    status: undefined,
    branches: emptyBranches,
    commits: [],
    remotes: [],
    selectedFiles: []
  })
}));
