import type { ChangedFileStatus } from "../types/git";

export function formatDate(input: string): string {
  if (!input) {
    return "";
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function statusText(status: ChangedFileStatus): string {
  const map: Record<ChangedFileStatus, string> = {
    added: "新增",
    modified: "修改",
    deleted: "删除",
    renamed: "重命名",
    copied: "复制",
    untracked: "未跟踪",
    conflicted: "冲突",
    unknown: "未知"
  };
  return map[status];
}

export function statusColor(status: ChangedFileStatus): string {
  const map: Record<ChangedFileStatus, string> = {
    added: "green",
    modified: "blue",
    deleted: "red",
    renamed: "purple",
    copied: "cyan",
    untracked: "orange",
    conflicted: "volcano",
    unknown: "default"
  };
  return map[status];
}

export function deriveRepoName(repoUrl: string): string {
  const cleaned = repoUrl.trim().replace(/\.git$/, "");
  const parts = cleaned.split(/[/:\\]/).filter(Boolean);
  return parts[parts.length - 1] || "repository";
}
