import type { Language } from "../i18n";
import type { ChangedFileStatus } from "../types/git";
import { translate } from "../i18n";

export function formatDate(input: string, language: Language = "zh-CN"): string {
  if (!input) {
    return "";
  }
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }
  return new Intl.DateTimeFormat(language, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

const statusKeyMap: Record<ChangedFileStatus, string> = {
  added: "statusAdded",
  modified: "statusModified",
  deleted: "statusDeleted",
  renamed: "statusRenamed",
  copied: "statusCopied",
  untracked: "statusUntracked",
  conflicted: "statusConflicted",
  unknown: "statusUnknown"
};

export function statusText(status: ChangedFileStatus, language: Language = "zh-CN"): string {
  return translate(language, statusKeyMap[status]);
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

const operationKeyMap: Record<string, string> = {
  clone: "operationClone",
  open: "operationOpen",
  status: "operationStatus",
  "branch:current": "operationBranchCurrent",
  "remote:origin": "operationRemoteOrigin",
  "status:ahead-behind": "operationAheadBehind",
  "branch:list": "operationBranchList",
  "branch:list-remote": "operationBranchListRemote",
  "branch:create": "operationBranchCreate",
  "branch:checkout": "operationBranchCheckout",
  "branch:delete": "operationBranchDelete",
  pull: "operationPull",
  "push:check-upstream": "operationPushCheck",
  push: "operationPush",
  "commit:add": "operationCommitAdd",
  commit: "operationCommit",
  merge: "operationMerge",
  history: "operationHistory",
  "history:detail": "operationHistoryDetail",
  "remote:list": "operationRemoteList",
  "remote:add": "operationRemoteAdd",
  "remote:set-url": "operationRemoteSetUrl",
  "remote:remove": "operationRemoteRemove",
  stage: "operationStage",
  unstage: "operationUnstage",
  "discard:tracked": "operationDiscardTracked",
  "discard:untracked": "operationDiscardUntracked",
  "repo:resolve": "operationRepoResolve",
  "branch:detached": "operationBranchDetached",
  "conflict:list": "operationConflictList"
};

export function operationText(operation: string, language: Language = "zh-CN"): string {
  return translate(language, operationKeyMap[operation] ?? operation);
}

export function deriveRepoName(repoUrl: string): string {
  const cleaned = repoUrl.trim().replace(/\.git$/, "");
  const parts = cleaned.split(/[/:\\]/).filter(Boolean);
  return parts[parts.length - 1] || "repository";
}
