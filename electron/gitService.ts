import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import type {
  BranchInfo,
  ChangedFile,
  CommitDetail,
  CommitFile,
  CommitItem,
  GitResult,
  GitStatus,
  OperationLogItem,
  RemoteInfo,
  RepoInfo
} from "../src/types/git";

type Logger = (item: Omit<OperationLogItem, "id" | "time">) => void;

type RawGitResult = {
  success: boolean;
  stdout: string;
  stderr: string;
  command: string;
  code?: number;
};

const GIT_TIMEOUT_MS = 120_000;
const MAX_BUFFER = 1024 * 1024 * 12;

const CONFLICT_CODES = new Set(["DD", "AU", "UD", "UA", "DU", "AA", "UU"]);

export class GitService {
  constructor(private readonly logger: Logger) {}

  async cloneRepo(repoUrl: string, targetDir: string): Promise<GitResult> {
    const cleanUrl = validateGitUrl(repoUrl);
    const destination = validateTargetDirectory(targetDir);
    const parent = path.dirname(destination);

    await assertDirectoryExists(parent);

    const result = await this.runGit(undefined, ["clone", cleanUrl, destination], "clone", destination);
    return toGitResult(result);
  }

  async openRepo(repoPath: string): Promise<RepoInfo> {
    const resolved = validateExistingPath(repoPath);
    const rootResult = await this.runGit(resolved, ["rev-parse", "--show-toplevel"], "open", resolved);

    if (!rootResult.success) {
      throw new Error(readableError(rootResult, "所选目录不是有效的 Git 仓库"));
    }

    const repoRoot = normalizePath(rootResult.stdout.trim());
    const [branch, remoteUrl, counts] = await Promise.all([
      this.getCurrentBranch(repoRoot),
      this.getOriginUrl(repoRoot),
      this.getAheadBehind(repoRoot)
    ]);

    return {
      path: repoRoot,
      name: path.basename(repoRoot),
      currentBranch: branch,
      remoteUrl,
      ahead: counts.ahead,
      behind: counts.behind
    };
  }

  async getStatus(repoPath: string): Promise<GitStatus> {
    const root = await this.resolveRepoRoot(repoPath);
    const result = await this.runGit(root, ["status", "--porcelain=v1", "-b"], "status", root);

    if (!result.success) {
      throw new Error(readableError(result, "获取仓库状态失败"));
    }

    return parseStatus(root, result.stdout);
  }

  async getBranches(repoPath: string): Promise<BranchInfo> {
    const root = await this.resolveRepoRoot(repoPath);
    const [current, localResult, remoteResult] = await Promise.all([
      this.getCurrentBranch(root),
      this.runGit(root, ["branch", "--format=%(refname:short)"], "branch:list", root),
      this.runGit(root, ["branch", "-r", "--format=%(refname:short)"], "branch:list-remote", root)
    ]);

    if (!localResult.success) {
      throw new Error(readableError(localResult, "获取本地分支失败"));
    }

    const local = splitLines(localResult.stdout);
    const remote = remoteResult.success
      ? splitLines(remoteResult.stdout).filter((item) => !item.includes("HEAD ->"))
      : [];

    return { current, local, remote };
  }

  async createBranch(repoPath: string, branchName: string): Promise<GitResult> {
    const root = await this.resolveRepoRoot(repoPath);
    const branch = validateBranchName(branchName);
    const result = await this.runGit(root, ["branch", branch], "branch:create", root);
    return toGitResult(result);
  }

  async checkoutBranch(repoPath: string, branchName: string): Promise<GitResult> {
    const root = await this.resolveRepoRoot(repoPath);
    const branch = validateBranchName(branchName, true);
    const result = await this.runGit(root, ["checkout", branch], "branch:checkout", root);
    return toGitResult(result);
  }

  async deleteBranch(repoPath: string, branchName: string): Promise<GitResult> {
    const root = await this.resolveRepoRoot(repoPath);
    const branch = validateBranchName(branchName);
    const current = await this.getCurrentBranch(root);

    if (branch === current) {
      return {
        success: false,
        command: `git branch -d ${branch}`,
        output: "",
        error: "不能删除当前正在使用的分支"
      };
    }

    const result = await this.runGit(root, ["branch", "-d", branch], "branch:delete", root);
    return toGitResult(result);
  }

  async pull(repoPath: string): Promise<GitResult> {
    const root = await this.resolveRepoRoot(repoPath);
    const result = await this.runGit(root, ["pull"], "pull", root);
    const conflictFiles = result.success ? [] : await this.getConflictFiles(root);
    return toGitResult(result, { conflictFiles });
  }

  async push(repoPath: string): Promise<GitResult> {
    const root = await this.resolveRepoRoot(repoPath);
    const upstream = await this.runGit(
      root,
      ["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{u}"],
      "push:check-upstream",
      root
    );

    if (!upstream.success) {
      return {
        success: false,
        command: "git push",
        output: "",
        error: "当前分支没有设置 upstream。请先在终端执行 git push -u <remote> <branch>，或在后续版本中使用图形界面设置。",
        requiresUpstream: true
      };
    }

    const result = await this.runGit(root, ["push"], "push", root);
    return toGitResult(result);
  }

  async commit(repoPath: string, files: string[], message: string): Promise<GitResult> {
    const root = await this.resolveRepoRoot(repoPath);
    const commitMessage = validateCommitMessage(message);
    const safeFiles = validateFileList(files);

    if (safeFiles.length === 0) {
      return {
        success: false,
        command: "git commit",
        output: "",
        error: "请选择至少一个要提交的文件"
      };
    }

    const addResult = await this.runGit(root, ["add", "--", ...safeFiles], "commit:add", root);
    if (!addResult.success) {
      return toGitResult(addResult);
    }

    const commitResult = await this.runGit(root, ["commit", "-m", commitMessage], "commit", root);
    return toGitResult(commitResult);
  }

  async merge(repoPath: string, branchName: string): Promise<GitResult> {
    const root = await this.resolveRepoRoot(repoPath);
    const branch = validateBranchName(branchName, true);
    const result = await this.runGit(root, ["merge", branch], "merge", root);
    const conflictFiles = result.success ? [] : await this.getConflictFiles(root);
    return toGitResult(result, { conflictFiles });
  }

  async getCommitHistory(repoPath: string): Promise<CommitItem[]> {
    const root = await this.resolveRepoRoot(repoPath);
    const result = await this.runGit(
      root,
      ["log", "-n", "50", "--pretty=format:%H%x1f%h%x1f%an%x1f%ad%x1f%s", "--date=iso-strict"],
      "history",
      root
    );

    if (!result.success) {
      return [];
    }

    return splitLines(result.stdout).map((line) => {
      const [hash, shortHash, author, date, ...messageParts] = line.split("\x1f");
      return {
        hash,
        shortHash,
        author,
        date,
        message: messageParts.join("\x1f")
      };
    });
  }

  async getCommitDetail(repoPath: string, hash: string): Promise<CommitDetail> {
    const root = await this.resolveRepoRoot(repoPath);
    const safeHash = validateHash(hash);
    const result = await this.runGit(
      root,
      [
        "show",
        "--format=%H%x1f%h%x1f%an%x1f%ad%x1f%s%x1f%b%x1e",
        "--date=iso-strict",
        "--name-status",
        "--find-renames",
        safeHash
      ],
      "history:detail",
      root
    );

    if (!result.success) {
      throw new Error(readableError(result, "获取提交详情失败"));
    }

    const [rawHeader, rawFiles = ""] = result.stdout.split("\x1e");
    const [fullHash, shortHash, author, date, subject, body = ""] = rawHeader.split("\x1f");

    return {
      hash: fullHash,
      shortHash,
      author,
      date,
      message: subject,
      body: body.trim(),
      files: parseCommitFiles(rawFiles)
    };
  }

  async getRemotes(repoPath: string): Promise<RemoteInfo[]> {
    const root = await this.resolveRepoRoot(repoPath);
    const result = await this.runGit(root, ["remote", "-v"], "remote:list", root);

    if (!result.success) {
      throw new Error(readableError(result, "获取 remote 信息失败"));
    }

    return splitLines(result.stdout).map((line) => {
      const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
      if (!match) {
        return null;
      }
      return {
        name: match[1],
        url: match[2],
        type: match[3] as "fetch" | "push"
      };
    }).filter((item): item is RemoteInfo => Boolean(item));
  }

  async addRemote(repoPath: string, name: string, url: string): Promise<GitResult> {
    const root = await this.resolveRepoRoot(repoPath);
    const remoteName = validateRemoteName(name);
    const remoteUrl = validateGitUrl(url);
    const result = await this.runGit(root, ["remote", "add", remoteName, remoteUrl], "remote:add", root);
    return toGitResult(result);
  }

  async setRemoteUrl(repoPath: string, name: string, url: string): Promise<GitResult> {
    const root = await this.resolveRepoRoot(repoPath);
    const remoteName = validateRemoteName(name);
    const remoteUrl = validateGitUrl(url);
    const result = await this.runGit(root, ["remote", "set-url", remoteName, remoteUrl], "remote:set-url", root);
    return toGitResult(result);
  }

  async removeRemote(repoPath: string, name: string): Promise<GitResult> {
    const root = await this.resolveRepoRoot(repoPath);
    const remoteName = validateRemoteName(name);
    const result = await this.runGit(root, ["remote", "remove", remoteName], "remote:remove", root);
    return toGitResult(result);
  }

  async stageFiles(repoPath: string, files: string[]): Promise<GitResult> {
    const root = await this.resolveRepoRoot(repoPath);
    const safeFiles = validateFileList(files);
    if (safeFiles.length === 0) {
      return { success: false, command: "git add", output: "", error: "请选择至少一个文件" };
    }
    const result = await this.runGit(root, ["add", "--", ...safeFiles], "stage", root);
    return toGitResult(result);
  }

  async unstageFiles(repoPath: string, files: string[]): Promise<GitResult> {
    const root = await this.resolveRepoRoot(repoPath);
    const safeFiles = validateFileList(files);
    if (safeFiles.length === 0) {
      return { success: false, command: "git reset", output: "", error: "请选择至少一个文件" };
    }
    const result = await this.runGit(root, ["reset", "HEAD", "--", ...safeFiles], "unstage", root);
    return toGitResult(result);
  }

  async discardFiles(repoPath: string, files: string[]): Promise<GitResult> {
    const root = await this.resolveRepoRoot(repoPath);
    const safeFiles = validateFileList(files);
    if (safeFiles.length === 0) {
      return { success: false, command: "git restore", output: "", error: "请选择至少一个文件" };
    }

    const status = await this.getStatus(root);
    const fileByPath = new Map(status.files.map((file) => [file.path, file]));
    const trackedTargets = new Set<string>();
    const untrackedTargets = new Set<string>();

    for (const file of safeFiles) {
      const changedFile = fileByPath.get(file);
      if (!changedFile) {
        continue;
      }

      if (changedFile.status === "untracked") {
        untrackedTargets.add(changedFile.path);
        continue;
      }

      trackedTargets.add(changedFile.path);
      if (changedFile.originalPath) {
        trackedTargets.add(changedFile.originalPath);
      }
    }

    if (trackedTargets.size === 0 && untrackedTargets.size === 0) {
      return { success: false, command: "git restore", output: "", error: "所选文件没有可回滚的变更" };
    }

    const results: RawGitResult[] = [];
    if (trackedTargets.size > 0) {
      const restoreResult = await this.runGit(
        root,
        ["restore", "--staged", "--worktree", "--", ...trackedTargets],
        "discard:tracked",
        root
      );
      results.push(restoreResult);
      if (!restoreResult.success) {
        return combineGitResults(results);
      }
    }

    if (untrackedTargets.size > 0) {
      const cleanResult = await this.runGit(
        root,
        ["clean", "-fd", "--", ...untrackedTargets],
        "discard:untracked",
        root
      );
      results.push(cleanResult);
    }

    return combineGitResults(results);
  }

  private async resolveRepoRoot(repoPath: string): Promise<string> {
    const resolved = validateExistingPath(repoPath);
    const result = await this.runGit(resolved, ["rev-parse", "--show-toplevel"], "repo:resolve", resolved);

    if (!result.success) {
      throw new Error(readableError(result, "目录不是有效的 Git 仓库"));
    }

    return normalizePath(result.stdout.trim());
  }

  private async getCurrentBranch(repoPath: string): Promise<string> {
    const branchResult = await this.runGit(repoPath, ["branch", "--show-current"], "branch:current", repoPath);
    const branch = branchResult.stdout.trim();

    if (branchResult.success && branch) {
      return branch;
    }

    const detachedResult = await this.runGit(repoPath, ["rev-parse", "--short", "HEAD"], "branch:detached", repoPath);
    return detachedResult.success ? `detached@${detachedResult.stdout.trim()}` : "unknown";
  }

  private async getOriginUrl(repoPath: string): Promise<string | undefined> {
    const result = await this.runGit(repoPath, ["remote", "get-url", "origin"], "remote:origin", repoPath);
    return result.success ? result.stdout.trim() : undefined;
  }

  private async getAheadBehind(repoPath: string): Promise<{ ahead: number; behind: number }> {
    const result = await this.runGit(repoPath, ["rev-list", "--left-right", "--count", "@{u}...HEAD"], "status:ahead-behind", repoPath);

    if (!result.success) {
      return { ahead: 0, behind: 0 };
    }

    const [behindRaw, aheadRaw] = result.stdout.trim().split(/\s+/);
    return {
      ahead: Number(aheadRaw || 0),
      behind: Number(behindRaw || 0)
    };
  }

  private async getConflictFiles(repoPath: string): Promise<string[]> {
    const result = await this.runGit(repoPath, ["diff", "--name-only", "--diff-filter=U"], "conflict:list", repoPath);
    return result.success ? splitLines(result.stdout) : [];
  }

  private runGit(cwd: string | undefined, args: string[], operation: string, repoPath?: string): Promise<RawGitResult> {
    const command = `git ${args.map(formatArgForLog).join(" ")}`;

    return new Promise((resolve) => {
      execFile(
        "git",
        args,
        {
          cwd,
          timeout: GIT_TIMEOUT_MS,
          maxBuffer: MAX_BUFFER,
          windowsHide: true,
          shell: false
        },
        (error, stdout, stderr) => {
          const rawCode = (error as NodeJS.ErrnoException | null)?.code;
          const code = typeof rawCode === "number" ? rawCode : undefined;

          const raw: RawGitResult = {
            success: !error,
            stdout: String(stdout || ""),
            stderr: String(stderr || ""),
            command,
            code
          };

          this.logger({
            operation,
            command,
            success: raw.success,
            output: [raw.stdout, raw.stderr].filter(Boolean).join("\n").trim(),
            error: error ? readableError(raw) : undefined,
            repoPath
          });

          resolve(raw);
        }
      );
    });
  }
}

function toGitResult(raw: RawGitResult, extra?: Partial<GitResult>): GitResult {
  return {
    success: raw.success,
    command: raw.command,
    output: [raw.stdout, raw.stderr].filter(Boolean).join("\n").trim(),
    error: raw.success ? undefined : readableError(raw),
    ...extra
  };
}

function combineGitResults(results: RawGitResult[]): GitResult {
  const failed = results.find((result) => !result.success);
  return {
    success: !failed,
    command: results.map((result) => result.command).join(" && "),
    output: results.map((result) => [result.stdout, result.stderr].filter(Boolean).join("\n").trim()).filter(Boolean).join("\n"),
    error: failed ? readableError(failed) : undefined
  };
}

function parseStatus(repoPath: string, output: string): GitStatus {
  const lines = splitStatusLines(output);
  const branchLine = lines.find((line) => line.startsWith("##"));
  const files = lines.filter((line) => !line.startsWith("##")).map(parseStatusLine);
  const currentBranch = parseBranchName(branchLine);
  const { ahead, behind } = parseAheadBehind(branchLine);

  return {
    repoPath,
    currentBranch,
    ahead,
    behind,
    files,
    isClean: files.length === 0,
    hasConflicts: files.some((file) => file.status === "conflicted")
  };
}

function splitStatusLines(value: string): string[] {
  return value.split(/\r?\n/).filter((line) => line.length > 0);
}

function parseStatusLine(line: string): ChangedFile {
  const code = line.slice(0, 2);
  const rawPath = line.slice(3);
  const stagedCode = code[0];
  const worktreeCode = code[1];

  if (code === "??") {
    return {
      path: rawPath,
      status: "untracked",
      staged: false
    };
  }

  if (CONFLICT_CODES.has(code)) {
    return {
      path: parseRenamedPath(rawPath).path,
      originalPath: parseRenamedPath(rawPath).originalPath,
      status: "conflicted",
      staged: false
    };
  }

  const renamed = parseRenamedPath(rawPath);
  const statusCode = stagedCode !== " " ? stagedCode : worktreeCode;

  return {
    ...renamed,
    status: mapStatus(statusCode),
    staged: stagedCode !== " " && stagedCode !== "?"
  };
}

function parseRenamedPath(rawPath: string): { path: string; originalPath?: string } {
  const separator = " -> ";
  if (rawPath.includes(separator)) {
    const [originalPath, nextPath] = rawPath.split(separator);
    return { path: nextPath, originalPath };
  }
  return { path: rawPath };
}

function mapStatus(code: string): ChangedFile["status"] {
  switch (code) {
    case "A":
      return "added";
    case "M":
      return "modified";
    case "D":
      return "deleted";
    case "R":
      return "renamed";
    case "C":
      return "copied";
    default:
      return "unknown";
  }
}

function parseBranchName(branchLine?: string): string {
  if (!branchLine) {
    return "unknown";
  }
  const branch = branchLine.replace(/^##\s+/, "").split("...")[0].trim();
  return branch || "unknown";
}

function parseAheadBehind(branchLine?: string): { ahead: number; behind: number } {
  const aheadMatch = branchLine?.match(/ahead\s+(\d+)/);
  const behindMatch = branchLine?.match(/behind\s+(\d+)/);
  return {
    ahead: aheadMatch ? Number(aheadMatch[1]) : 0,
    behind: behindMatch ? Number(behindMatch[1]) : 0
  };
}

function parseCommitFiles(rawFiles: string): CommitFile[] {
  return splitLines(rawFiles).map((line) => {
    const parts = line.split("\t");
    const statusCode = parts[0] || "";

    if (statusCode.startsWith("R")) {
      return {
        status: "renamed" as const,
        path: parts[2] || parts[1] || "",
        originalPath: parts[1]
      };
    }

    return {
      status: mapStatus(statusCode[0]),
      path: parts[1] || parts[0] || ""
    };
  }).filter((file) => Boolean(file.path));
}

function splitLines(value: string): string[] {
  return value.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
}

function readableError(raw: RawGitResult, fallback = "Git 命令执行失败"): string {
  return raw.stderr.trim() || raw.stdout.trim() || fallback;
}

function validateExistingPath(input: string): string {
  const resolved = normalizePath(input);
  if (!resolved) {
    throw new Error("路径不能为空");
  }
  return resolved;
}

function validateTargetDirectory(input: string): string {
  const resolved = normalizePath(input);
  if (!resolved) {
    throw new Error("目标目录不能为空");
  }
  return resolved;
}

async function assertDirectoryExists(directory: string): Promise<void> {
  const stat = await fs.stat(directory).catch(() => null);
  if (!stat?.isDirectory()) {
    throw new Error(`目标父目录不存在：${directory}`);
  }
}

function normalizePath(input: string): string {
  if (typeof input !== "string" || !input.trim()) {
    return "";
  }
  return path.resolve(input.trim());
}

function validateGitUrl(input: string): string {
  const value = input.trim();
  if (!value) {
    throw new Error("Git 仓库地址不能为空");
  }
  if (/[\u0000-\u001f]/.test(value)) {
    throw new Error("Git 仓库地址包含非法控制字符");
  }
  return value;
}

function validateBranchName(input: string, allowRemote = false): string {
  const value = input.trim();
  if (!value) {
    throw new Error("分支名不能为空");
  }
  if (value.length > 200 || /[\u0000-\u001f\s~^:?*[\\]/.test(value)) {
    throw new Error("分支名包含非法字符");
  }
  if (value.startsWith("-") || value.startsWith(".") || value.endsWith("/") || value.endsWith(".") || value.includes("..") || value.includes("//")) {
    throw new Error("分支名格式不合法");
  }
  if (!allowRemote && value.includes("..")) {
    throw new Error("分支名格式不合法");
  }
  return value;
}

function validateCommitMessage(input: string): string {
  const value = input.trim();
  if (!value) {
    throw new Error("Commit message 不能为空");
  }
  if (/[\u0000]/.test(value)) {
    throw new Error("Commit message 包含非法字符");
  }
  return value;
}

function validateFileList(files: string[]): string[] {
  if (!Array.isArray(files)) {
    throw new Error("文件列表不合法");
  }

  return files.map((file) => {
    const value = String(file).trim();
    if (!value || value.includes("\u0000")) {
      throw new Error("文件路径不合法");
    }
    return value;
  });
}

function validateHash(input: string): string {
  const value = input.trim();
  if (!/^[a-fA-F0-9]{4,64}$/.test(value)) {
    throw new Error("Commit hash 不合法");
  }
  return value;
}

function validateRemoteName(input: string): string {
  const value = input.trim();
  if (!/^[A-Za-z0-9._-]+$/.test(value) || value.startsWith("-")) {
    throw new Error("Remote 名称不合法");
  }
  return value;
}

function formatArgForLog(arg: string): string {
  return /^[A-Za-z0-9_./:@+=,-]+$/.test(arg) ? arg : JSON.stringify(arg);
}
