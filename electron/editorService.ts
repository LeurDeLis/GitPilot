import { execFile, spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { ExternalEditor } from "../src/types/git";
import { resolveRepositoryPath } from "./fileService";

const execFileAsync = promisify(execFile);
const definitions = [
  { id: "vscode", name: "Visual Studio Code", executables: ["Code.exe", "code"], folders: ["Microsoft VS Code"], mac: "Visual Studio Code.app" },
  { id: "vscode-insiders", name: "VS Code Insiders", executables: ["Code - Insiders.exe", "code-insiders"], folders: ["Microsoft VS Code Insiders"], mac: "Visual Studio Code - Insiders.app" },
  { id: "cursor", name: "Cursor", executables: ["Cursor.exe", "cursor"], folders: ["Cursor", "cursor"], mac: "Cursor.app" },
  { id: "windsurf", name: "Windsurf", executables: ["Windsurf.exe", "windsurf"], folders: ["Windsurf"], mac: "Windsurf.app" },
  { id: "pycharm", name: "PyCharm", executables: ["pycharm64.exe", "pycharm.exe", "pycharm"], folders: ["PyCharm"], mac: "PyCharm.app" },
  { id: "idea", name: "IntelliJ IDEA", executables: ["idea64.exe", "idea"], folders: ["IntelliJ IDEA"], mac: "IntelliJ IDEA.app" },
  { id: "clion", name: "CLion", executables: ["clion64.exe", "clion"], folders: ["CLion"], mac: "CLion.app" },
  { id: "webstorm", name: "WebStorm", executables: ["webstorm64.exe", "webstorm"], folders: ["WebStorm"], mac: "WebStorm.app" },
  { id: "rider", name: "Rider", executables: ["rider64.exe", "rider"], folders: ["Rider"], mac: "Rider.app" },
  { id: "goland", name: "GoLand", executables: ["goland64.exe", "goland"], folders: ["GoLand"], mac: "GoLand.app" },
  { id: "rustrover", name: "RustRover", executables: ["rustrover64.exe", "rustrover"], folders: ["RustRover"], mac: "RustRover.app" },
  { id: "sublime", name: "Sublime Text", executables: ["sublime_text.exe", "subl"], folders: ["Sublime Text", "Sublime Text 3"], mac: "Sublime Text.app" },
  { id: "notepad-plus-plus", name: "Notepad++", executables: ["notepad++.exe"], folders: ["Notepad++"], mac: "" },
  { id: "visual-studio", name: "Visual Studio", executables: ["devenv.exe"], folders: [], mac: "" }
];

export class EditorService {
  private editors: ExternalEditor[] = [];

  async detect(customEditors: ExternalEditor[] = []): Promise<ExternalEditor[]> {
    const candidates = new Set<string>();
    const add = (directory: string, filenames: string[]) => {
      for (const filename of filenames) candidates.add(path.join(directory, filename));
    };
    const directories = (process.env.PATH || "").split(path.delimiter).filter(Boolean).map((directory) => directory.replace(/^"|"$/g, ""));
    for (const directory of directories) {
      for (const definition of definitions) {
        add(directory, definition.executables);
        if (process.platform === "win32") add(path.dirname(directory), definition.executables.filter((file) => file.endsWith(".exe")));
      }
    }
    if (process.platform === "win32") {
      const roots = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "Programs")].filter((root): root is string => Boolean(root));
      for (const root of roots) {
        for (const definition of definitions) {
          for (const folder of definition.folders) {
            add(path.join(root, folder), definition.executables);
            add(path.join(root, folder, "bin"), definition.executables);
          }
        }
        const jetbrains = path.join(root, "JetBrains");
        for (const entry of await fs.readdir(jetbrains, { withFileTypes: true }).catch(() => [])) {
          if (entry.isDirectory()) for (const definition of definitions) add(path.join(jetbrains, entry.name, "bin"), definition.executables);
        }
        const studio = path.join(root, "Microsoft Visual Studio");
        for (const year of await fs.readdir(studio).catch(() => [])) {
          for (const edition of ["Community", "Professional", "Enterprise"]) add(path.join(studio, year, edition, "Common7", "IDE"), ["devenv.exe"]);
        }
      }
      // App Paths and uninstall entries cover custom drives and per-user installs.
      const registryRoots = [
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths",
        "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths",
        "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
        "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
        "HKLM\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall"
      ];
      await Promise.all(registryRoots.map(async (key) => {
        const result = await execFileAsync("reg.exe", ["query", key, "/s"], { windowsHide: true, timeout: 8000, maxBuffer: 8 * 1024 * 1024 }).catch(() => undefined);
        for (const line of result?.stdout.split(/\r?\n/) || []) {
          const match = line.match(/^\s*(.*?)\s+REG_(?:EXPAND_)?SZ\s+(.+)$/);
          if (!match) continue;
          const value = match[2].trim().replace(/%([^%]+)%/g, (_all, name: string) => process.env[name] || "");
          if (match[1] === "InstallLocation") {
            for (const definition of definitions) { add(value.replace(/^"|"$/g, ""), definition.executables); add(path.join(value.replace(/^"|"$/g, ""), "bin"), definition.executables); }
          } else {
            const executable = value.match(/^"([^"\r\n]+\.exe)"/i)?.[1] || value.match(/^(.+?\.exe)(?:,\s*-?\d+)?$/i)?.[1];
            if (executable) candidates.add(executable);
          }
        }
      }));
      const toolbox = process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, "JetBrains", "Toolbox", "apps");
      if (toolbox) {
        const visit = async (directory: string, depth: number): Promise<void> => {
          if (depth > 4) return;
          const entries = await fs.readdir(directory, { withFileTypes: true }).catch(() => []);
          for (const entry of entries) {
            if (entry.isDirectory() && !entry.isSymbolicLink()) {
              if (entry.name === "bin") { for (const definition of definitions) add(path.join(directory, entry.name), definition.executables); }
              else await visit(path.join(directory, entry.name), depth + 1);
            }
          }
        };
        await visit(toolbox, 0);
      }
    } else {
      for (const definition of definitions) {
        if (process.platform === "darwin" && definition.mac) {
          for (const directory of ["/Applications", path.join(process.env.HOME || "", "Applications")]) candidates.add(path.join(directory, definition.mac));
        }
        for (const directory of ["/usr/bin", "/usr/local/bin", "/snap/bin"]) add(directory, definition.executables.filter((file) => !file.endsWith(".exe")));
      }
    }
    const detected: ExternalEditor[] = [];
    const paths = [...candidates];
    for (let index = 0; index < paths.length; index += 100) {
      await Promise.all(paths.slice(index, index + 100).map(async (executable) => {
        if (process.platform === "win32" && !/\.exe$/i.test(executable)) return;
        const definition = definitions.find((item) => item.executables.some((name) => path.basename(executable).toLowerCase() === name.toLowerCase()) || Boolean(item.mac && path.basename(executable) === item.mac));
        if (!definition) return;
        const stat = await fs.stat(executable).catch(() => undefined);
        if (!stat || (!stat.isFile() && !(process.platform === "darwin" && executable.endsWith(".app") && stat.isDirectory()))) return;
        detected.push({ id: definition.id, name: definition.name, executable });
      }));
    }
    const merged = [...detected, ...customEditors];
    this.editors = merged.filter((editor, index) => merged.findIndex((other) => other.id === editor.id) === index)
      .sort((a, b) => definitions.findIndex((item) => item.id === a.id) - definitions.findIndex((item) => item.id === b.id));
    return this.editors;
  }

  async add(executable: string): Promise<ExternalEditor> {
    if (!path.isAbsolute(executable) || /[\r\n\0]/.test(executable) || (process.platform === "win32" && !/\.exe$/i.test(executable))) {
      throw new Error("Select an editor executable / 请选择编辑器可执行文件");
    }
    const stat = await fs.stat(executable);
    if (!stat.isFile() && !(process.platform === "darwin" && executable.endsWith(".app") && stat.isDirectory())) throw new Error("Invalid editor / 编辑器路径无效");
    const definition = definitions.find((item) => item.executables.some((name) => path.basename(executable).toLowerCase() === name.toLowerCase()) || Boolean(item.mac && path.basename(executable) === item.mac));
    const editor = { id: `custom:${executable}`, name: definition?.name || path.basename(executable, path.extname(executable)), executable };
    this.editors = [...this.editors.filter((item) => item.id !== editor.id), editor];
    return editor;
  }

  async open(repoPath: string, editorId: string, filePath?: string): Promise<void> {
    const editor = this.editors.find((item) => item.id === editorId);
    if (!editor) throw new Error("Rescan installed editors / 请重新检测已安装的编辑器");
    const root = await resolveRepositoryPath(repoPath);
    const target = await resolveRepositoryPath(root, filePath);
    await fs.access(target);
    const args = process.platform === "darwin" && editor.executable.endsWith(".app") ? ["-a", editor.executable, target] : [target];
    const environment = { ...process.env };
    delete environment.ELECTRON_RUN_AS_NODE;
    await new Promise<void>((resolve, reject) => {
      const child = spawn(process.platform === "darwin" && editor.executable.endsWith(".app") ? "/usr/bin/open" : editor.executable, args, {
        cwd: root, detached: true, stdio: "ignore", windowsHide: true, shell: false, env: environment
      });
      child.once("error", reject);
      child.once("spawn", () => { child.unref(); resolve(); });
    });
  }
}
