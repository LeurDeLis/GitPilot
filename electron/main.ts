import { app, BrowserWindow, dialog, ipcMain } from "electron";
import fs from "node:fs/promises";
import path from "node:path";
import { GitService } from "./gitService";
import type { OperationLogItem, RepoInfo } from "../src/types/git";

type Settings = {
  recentRepos: RepoInfo[];
};

const MAX_RECENT_REPOS = 12;
const APP_NAME = "GitPilot";
const APP_ICON = path.join(__dirname, "../../build/icon.ico");
const operationLogs: OperationLogItem[] = [];

let mainWindow: BrowserWindow | null = null;
let gitService: GitService;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: APP_NAME,
    icon: APP_ICON,
    backgroundColor: "#f4f6f8",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (app.isPackaged) {
    mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  } else {
    mainWindow.loadURL("http://127.0.0.1:5173");
    if (process.env.GITPILOT_OPEN_DEVTOOLS === "1") {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.setName(APP_NAME);
app.setAppUserModelId("com.gitpilot.app");

app.whenReady().then(async () => {
  gitService = new GitService((item) => {
    operationLogs.unshift({
      ...item,
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      time: new Date().toISOString()
    });

    if (operationLogs.length > 300) {
      operationLogs.length = 300;
    }
  });

  registerIpcHandlers();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function registerIpcHandlers(): void {
  ipcMain.handle("dialog:select-directory", async () => {
    const options: Electron.OpenDialogOptions = {
      title: "选择目录",
      properties: ["openDirectory", "createDirectory"]
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);

    return result.canceled ? undefined : result.filePaths[0];
  });

  ipcMain.handle("repo:open", safeHandle(async (_event, repoPath: string) => {
    const repo = await gitService.openRepo(repoPath);
    await addRecentRepo(repo);
    return repo;
  }));

  ipcMain.handle("repo:clone", safeHandle(async (_event, repoUrl: string, targetDir: string) => {
    const result = await gitService.cloneRepo(repoUrl, targetDir);
    if (result.success) {
      const repo = await gitService.openRepo(targetDir);
      await addRecentRepo(repo);
    }
    return result;
  }));

  ipcMain.handle("repo:recent", safeHandle(async () => {
    const settings = await readSettings();
    return settings.recentRepos;
  }));

  ipcMain.handle("git:status", safeHandle((_event, repoPath: string) => gitService.getStatus(repoPath)));
  ipcMain.handle("git:branches", safeHandle((_event, repoPath: string) => gitService.getBranches(repoPath)));
  ipcMain.handle("git:branch:create", safeHandle((_event, repoPath: string, branchName: string) => gitService.createBranch(repoPath, branchName)));
  ipcMain.handle("git:branch:checkout", safeHandle((_event, repoPath: string, branchName: string) => gitService.checkoutBranch(repoPath, branchName)));
  ipcMain.handle("git:branch:delete", safeHandle((_event, repoPath: string, branchName: string) => gitService.deleteBranch(repoPath, branchName)));
  ipcMain.handle("git:pull", safeHandle((_event, repoPath: string) => gitService.pull(repoPath)));
  ipcMain.handle("git:push", safeHandle((_event, repoPath: string) => gitService.push(repoPath)));
  ipcMain.handle("git:commit", safeHandle((_event, repoPath: string, files: string[], message: string) => gitService.commit(repoPath, files, message)));
  ipcMain.handle("git:merge", safeHandle((_event, repoPath: string, branchName: string) => gitService.merge(repoPath, branchName)));
  ipcMain.handle("git:history", safeHandle((_event, repoPath: string) => gitService.getCommitHistory(repoPath)));
  ipcMain.handle("git:history:detail", safeHandle((_event, repoPath: string, hash: string) => gitService.getCommitDetail(repoPath, hash)));
  ipcMain.handle("git:remotes", safeHandle((_event, repoPath: string) => gitService.getRemotes(repoPath)));
  ipcMain.handle("git:remote:add", safeHandle((_event, repoPath: string, name: string, url: string) => gitService.addRemote(repoPath, name, url)));
  ipcMain.handle("git:remote:set-url", safeHandle((_event, repoPath: string, name: string, url: string) => gitService.setRemoteUrl(repoPath, name, url)));
  ipcMain.handle("git:remote:remove", safeHandle((_event, repoPath: string, name: string) => gitService.removeRemote(repoPath, name)));
  ipcMain.handle("git:stage", safeHandle((_event, repoPath: string, files: string[]) => gitService.stageFiles(repoPath, files)));
  ipcMain.handle("git:unstage", safeHandle((_event, repoPath: string, files: string[]) => gitService.unstageFiles(repoPath, files)));
  ipcMain.handle("git:discard", safeHandle((_event, repoPath: string, files: string[]) => gitService.discardFiles(repoPath, files)));

  ipcMain.handle("logs:get", () => operationLogs);
  ipcMain.handle("logs:clear", () => {
    operationLogs.length = 0;
    return [];
  });
}

function safeHandle<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => Promise<TResult> | TResult
) {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (error) {
      const message = error instanceof Error ? error.message : "未知错误";
      throw new Error(message);
    }
  };
}

async function addRecentRepo(repo: RepoInfo): Promise<void> {
  const settings = await readSettings();
  const withoutDuplicate = settings.recentRepos.filter((item) => item.path !== repo.path);
  settings.recentRepos = [repo, ...withoutDuplicate].slice(0, MAX_RECENT_REPOS);
  await writeSettings(settings);
}

async function readSettings(): Promise<Settings> {
  const file = getSettingsFile();
  const raw = await fs.readFile(file, "utf8").catch(() => "");
  if (!raw) {
    return { recentRepos: [] };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      recentRepos: Array.isArray(parsed.recentRepos) ? parsed.recentRepos : []
    };
  } catch {
    return { recentRepos: [] };
  }
}

async function writeSettings(settings: Settings): Promise<void> {
  const file = getSettingsFile();
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(settings, null, 2), "utf8");
}

function getSettingsFile(): string {
  return path.join(app.getPath("userData"), "settings.json");
}
