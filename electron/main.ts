import { app, BrowserWindow, dialog, ipcMain, Menu, Notification, shell } from "electron";
import { autoUpdater } from "electron-updater";
import fs from "node:fs/promises";
import path from "node:path";
import { GitService } from "./gitService";
import { readRepositoryFile, writeRepositoryFile } from "./fileService";
import { EditorService } from "./editorService";
import type { AppUpdateState, ExternalEditor, OperationLogItem, RepoInfo } from "../src/types/git";

type Settings = {
  recentRepos: RepoInfo[];
  customEditors?: ExternalEditor[];
};

const MAX_RECENT_REPOS = 12;
const APP_NAME = "GitPilot";
const PROJECT_URL = "https://github.com/LeurDeLis/GitPilot";
const RELEASES_URL = `${PROJECT_URL}/releases/latest`;
const APP_ICON = path.join(__dirname, "../../build/icon.ico");
const DEV_RENDERER_PORT = Number(process.env.GITPILOT_RENDERER_PORT) || 5173;
const UPDATE_CHECK_INTERVAL = 12 * 60 * 60 * 1000;
const operationLogs: OperationLogItem[] = [];

let mainWindow: BrowserWindow | null = null;
let gitService: GitService;
const editorService = new EditorService();
let updateState: AppUpdateState = { status: "idle" };
let updateCheckInFlight = false;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1100,
    minHeight: 720,
    title: APP_NAME,
    icon: APP_ICON,
    backgroundColor: "#f2f5f4",
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
    mainWindow.loadURL(`http://127.0.0.1:${DEV_RENDERER_PORT}`);
    if (process.env.GITPILOT_OPEN_DEVTOOLS === "1") {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  }

  mainWindow.webContents.on("will-prevent-unload", (event) => {
    if (!mainWindow) return;
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: "question", title: "GitPilot", message: "文件有未保存的修改 / Unsaved file changes",
      detail: "关闭后将放弃修改 / Closing will discard these changes.",
      buttons: ["继续编辑 / Keep editing", "放弃并关闭 / Discard and close"], defaultId: 0, cancelId: 0
    });
    if (choice === 1) event.preventDefault();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.setName(APP_NAME);
app.setAppUserModelId("com.gitpilot.app");

app.whenReady().then(async () => {
  // The renderer owns the localized, theme-aware application menu.
  Menu.setApplicationMenu(null);
  if (!supportsAutoUpdate()) {
    updateState = { status: "unsupported" };
  }

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
  configureAutoUpdater();
  createWindow();
  if (supportsAutoUpdate()) {
    setTimeout(() => void checkForUpdates(), 4000);
    const interval = setInterval(() => void checkForUpdates(), UPDATE_CHECK_INTERVAL);
    interval.unref();
  }

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
  ipcMain.handle("app:version", () => app.getVersion());
  ipcMain.handle("app:update:state", () => updateState);
  ipcMain.handle("app:update:check", safeHandle(() => checkForUpdates()));
  ipcMain.handle("app:update:install", safeHandle(() => installUpdate()));
  ipcMain.handle("app:open-project", safeHandle(() => shell.openExternal(PROJECT_URL)));
  ipcMain.handle("app:open-releases", safeHandle(() => shell.openExternal(RELEASES_URL)));
  ipcMain.handle("files:list", safeHandle((_event, repoPath: string) => gitService.getRepositoryFiles(repoPath)));
  ipcMain.handle("files:read", safeHandle((_event, repoPath: string, filePath: string) => readRepositoryFile(repoPath, filePath)));
  ipcMain.handle("files:write", safeHandle((_event, repoPath: string, filePath: string, content: string, revision?: string) => writeRepositoryFile(repoPath, filePath, content, revision)));
  ipcMain.handle("editors:detect", safeHandle(async () => editorService.detect((await readSettings()).customEditors)));
  ipcMain.handle("editors:open", safeHandle((_event, repoPath: string, editorId: string, filePath?: string) => editorService.open(repoPath, editorId, filePath)));
  ipcMain.handle("editors:select", safeHandle(async () => {
    const options: Electron.OpenDialogOptions = {
      title: "选择编辑器 / Select editor",
      properties: ["openFile"],
      ...(process.platform === "win32" ? { filters: [{ name: "Editor executable", extensions: ["exe"] }] } : {})
    };
    const selection = mainWindow ? await dialog.showOpenDialog(mainWindow, options) : await dialog.showOpenDialog(options);
    if (selection.canceled || !selection.filePaths[0]) return undefined;
    const editor = await editorService.add(selection.filePaths[0]);
    const settings = await readSettings();
    settings.customEditors = [...(settings.customEditors || []).filter((item) => item.id !== editor.id), editor];
    await writeSettings(settings);
    return editor;
  }));
  ipcMain.handle('git:branch:create-publish', safeHandle((_event, repoPath: string, branchName: string, remoteName: string) => gitService.createAndPublishBranch(repoPath, branchName, remoteName)));
  ipcMain.handle('git:branch:delete-remote', safeHandle((_event, repoPath: string, branchName: string) => gitService.deleteRemoteBranch(repoPath, branchName)));
  ipcMain.handle('git:markdown:list', safeHandle((_event, repoPath: string) => gitService.getMarkdownFiles(repoPath)));
  ipcMain.handle('git:markdown:read', safeHandle((_event, repoPath: string, filePath: string) => gitService.readMarkdownFile(repoPath, filePath)));
  ipcMain.handle('git:markdown:write', safeHandle((_event, repoPath: string, filePath: string, content: string) => gitService.writeMarkdownFile(repoPath, filePath, content)));
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

  ipcMain.handle("repo:recent:remove", safeHandle(async (_event, repoPath: string) => {
    const settings = await readSettings();
    settings.recentRepos = settings.recentRepos.filter((item) => item.path !== repoPath);
    await writeSettings(settings);
    return settings.recentRepos;
  }));

  ipcMain.handle("git:status", safeHandle((_event, repoPath: string) => gitService.getStatus(repoPath)));
  ipcMain.handle("git:branches", safeHandle((_event, repoPath: string) => gitService.getBranches(repoPath)));
  ipcMain.handle("git:branch:create", safeHandle((_event, repoPath: string, branchName: string) => gitService.createBranch(repoPath, branchName)));
  ipcMain.handle("git:branch:checkout", safeHandle((_event, repoPath: string, branchName: string) => gitService.checkoutBranch(repoPath, branchName)));
  ipcMain.handle("git:branch:checkout-remote", safeHandle((_event, repoPath: string, branchName: string) => gitService.checkoutRemoteBranch(repoPath, branchName)));
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

function supportsAutoUpdate(): boolean {
  return app.isPackaged && process.platform === "win32" && !process.env.PORTABLE_EXECUTABLE_DIR;
}

function configureAutoUpdater(): void {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on("checking-for-update", () => setUpdateState({ status: "checking" }));
  autoUpdater.on("update-available", (info) => setUpdateState({ status: "available", version: info.version }));
  autoUpdater.on("update-not-available", (info) => setUpdateState({ status: "not-available", version: info.version }));
  autoUpdater.on("download-progress", (progress) => setUpdateState({
    status: "downloading",
    version: updateState.version,
    percent: Math.round(progress.percent)
  }));
  autoUpdater.on("update-downloaded", (info) => {
    setUpdateState({ status: "downloaded", version: info.version, percent: 100 });
    if (Notification.isSupported()) {
      const notification = new Notification({
        title: APP_NAME,
        body: `Version ${info.version} is ready. Close GitPilot to install it.`
      });
      notification.on("click", () => autoUpdater.quitAndInstall(false, true));
      notification.show();
    }
  });
  autoUpdater.on("error", (error) => setUpdateState({ status: "error", message: getUpdateErrorCode(error) }));
}

function getUpdateErrorCode(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/Cannot find latest\.yml|latest\.yml.*\b404\b|\b404\b.*latest\.yml/i.test(message)) {
    return "missing-update-metadata";
  }
  return "update-check-failed";
}

async function checkForUpdates(): Promise<void> {
  if (!supportsAutoUpdate()) {
    setUpdateState({ status: "unsupported" });
    return;
  }
  if (updateCheckInFlight || ["available", "downloading", "downloaded"].includes(updateState.status)) return;

  updateCheckInFlight = true;
  setUpdateState({ status: "checking" });
  try {
    await autoUpdater.checkForUpdates();
  } catch (error) {
    setUpdateState({ status: "error", message: getUpdateErrorCode(error) });
  } finally {
    updateCheckInFlight = false;
  }
}

function installUpdate(): void {
  if (updateState.status !== "downloaded" || !supportsAutoUpdate()) {
    throw new Error("No downloaded update is ready to install");
  }
  autoUpdater.quitAndInstall(false, true);
}

function setUpdateState(next: AppUpdateState): void {
  updateState = next;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("app:update:state-changed", updateState);
  }
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
      recentRepos: Array.isArray(parsed.recentRepos) ? parsed.recentRepos : [],
      customEditors: Array.isArray(parsed.customEditors) ? parsed.customEditors : []
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
