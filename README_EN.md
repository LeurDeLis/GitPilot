<p align="center">
  <img src="build/icon.ico" width="80" />
</p>

<h1 align="center">GitPilot</h1>

<p align="center">
  A clean and efficient desktop Git GUI client
</p>

<p align="center">
  English | <a href="./README.md">中文</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-29-47848f?logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/React-18-61dafb?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Ant%20Design-5-0170fe?logo=antdesign" alt="Ant Design" />
  <img src="https://img.shields.io/badge/License-GPL--3.0-blue" alt="License" />
</p>

---

## ✨ Introduction

**GitPilot** is a desktop Git GUI client built with Electron + React + TypeScript. All Git commands are encapsulated in the Electron main process and bridged to the frontend through secure IPC communication — no shell commands are ever executed in the browser context, balancing usability and security.

## 🎯 Features

### 📁 Repository Management
- **Open Local Repository** — Select a local Git repository via the native file dialog
- **Clone Remote Repository** — Enter a remote URL and target path to clone with one click
- **Recent Repositories** — Automatically records the last 12 opened repositories for quick switching and supports removing individual entries
- **Missing Repository Handling** — When a repository directory is missing or moved, its entry can be cleared from a centered confirmation dialog; this never deletes the folder on disk, and removing the active repository returns to the start page
- **Repository Overview** — Real-time display of repository name, current branch, remote URL, and ahead/behind commit counts

### 📝 File Changes & Commits
- **Changed Files List** — Clearly displays added, modified, deleted, renamed, untracked, and conflicted files with color-coded status tags
- **Stage / Unstage** — Stage or unstage files individually or in batch
- **Discard Changes** — Revert selected files to the last committed state with one click, supporting both tracked and untracked files
- **Flexible Commits** — Freely select all or specific files and write a commit message to commit
- **Auto Refresh** — Polls repository status every 1.5 seconds to reflect workspace changes in real time

### 🔀 Branch Operations
- **Branch Panel** — Displays local and remote branches in separate groups, with the current branch highlighted
- **Create Branch** — Create a new local branch from the current HEAD
- **Switch Branch** — Automatically detects uncommitted changes before switching and prompts for confirmation
- **Switch Remote Branch** — Click a remote branch to run the equivalent of `git checkout <branch>`; if no same-named local branch exists, it is created and tracked automatically
- **Delete Branch** — Safe deletion via `git branch -d`; unmerged branches are automatically rejected by Git
- **Merge Branch** — Merge any local or remote branch into the current branch; conflicts are displayed in a conflict file list

### 🔄 Sync Operations
- **Pull** — Pull remote updates with one click; conflicts trigger a popup showing the conflicted files
- **Push** — Pushes according to the current local branch's upstream; when upstream is missing, it automatically matches a same-named remote branch

### 📜 Commit History
- **History List** — Displays the most recent 50 commits with message, author, and timestamp
- **Commit Details** — Click any commit to view full details including changed files (with status, path, and rename info)

### 🌐 Remote Management
- **Remote Panel** — Displays all remote configurations with copyable URLs
- **Full CRUD** — Add new remotes, edit existing remote URLs, or remove unused remotes

### 📋 Operation Log
- **Real-time Logging** — Records the last 300 Git operations, including commands, results, and error messages
- **Clear Logs** — One-click log clearing

### 🎨 Interface & Preferences
- **Chinese / English UI** — Switch between Chinese and English; the selection is stored locally
- **Two Themes** — Light is the default theme, with an optional dark theme; the selection is stored locally
- **Custom Menu** — The GitPilot menu in the top-left provides open, clone, theme, language, and refresh actions instead of Electron's default menu
- **Log Layout** — The operation log uses fixed columns, and long Git commands are truncated with an ellipsis instead of wrapping in a narrow panel
- **Confirmation Dialogs** — Repository removal, missing-directory prompts, and other confirmation dialogs are centered in the application window

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Renderer Process                  │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ React UI │──│ Zustand  │──│ gitApi.ts (IPC)   │  │
│  │ (Ant Design)│  │  Store   │  │                   │  │
│  └──────────┘  └──────────┘  └─────────┬─────────┘  │
│                                        │ IPC        │
├────────────────────────────────────────┼────────────┤
│                                        │            │
│                   Main Process         │            │
│  ┌─────────────┐  ┌───────────────────▼──────────┐  │
│  │  main.ts    │──│  gitService.ts               │  │
│  │  (Window,   │  │  execFile("git", args)       │  │
│  │   IPC,      │  │  (no shell, parameterized)   │  │
│  │   Settings) │  └──────────────────────────────┘  │
│  └─────────────┘                                    │
└─────────────────────────────────────────────────────┘
```

- **Renderer Process**: React 18 + Ant Design 5 for UI, Zustand for global state management, IPC calls via `gitApi.ts`
- **Main Process**: `gitService.ts` uses `execFile("git", args)` exclusively — parameterized calls prevent injection risks
- **Preload Script**: `preload.ts` exposes a secure API (`window.gitClient`) via `contextBridge`
- **Persistence**: Recent repositories are serialized to `userData/settings.json`

## 🔒 Security

- All Git commands execute exclusively in the Electron main process
- Uses `execFile` with argument arrays — shell string concatenation is forbidden
- Branch names, remote names, commit messages, file paths, and hashes are validated before use
- All IPC handlers catch exceptions uniformly and return human-readable error messages
- No tokens, passwords, or credentials are stored in source code
- `contextIsolation` is enabled; `nodeIntegration` is disabled

## 📂 Project Structure

```text
GitPilot/
├── build/                 # Application icons and Windows installer resources
├── electron/              # Electron main process, preload bridge, and Git services
├── scripts/               # Development startup, production startup, and Windows packaging scripts
├── src/                   # React renderer source code
│   ├── api/               # API adapter between the renderer and Electron IPC
│   ├── components/        # Interface components and workflow dialogs
│   │   └── dialogs/       # Clone, branch, merge, and remote dialogs
│   ├── constants/         # Constants shared between processes
│   ├── icon/              # Application icons used by the renderer
│   ├── store/             # Zustand global state management
│   ├── styles/            # Global styles and theme appearance
│   ├── types/             # Git, IPC, and global TypeScript types
│   └── utils/             # Shared utilities such as formatting helpers
├── dist/                  # Vite renderer build output
├── dist-electron/         # Electron main-process build output
└── release/               # Installer and portable release artifacts
```

`dist/`, `dist-electron/`, and `release/` are generated during builds or packaging. Dependency, version-control, IDE configuration, and cache directories are omitted above.

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **Git** installed and available in system PATH
- **Python** 3 (only required when using `app.py`)

### Install Dependencies

```bash
npm install
```

### Development Mode

```bash
npm run dev
```

You can also run `python app.py`; it delegates to the same `npm run dev` workflow. If port 5173 is already in use, it automatically selects the next available port and passes it to Vite and Electron.

This command starts concurrently:
- **Vite Dev Server**: `http://127.0.0.1:5173` (default; selects the next available port when occupied, with React hot reload)
- **TypeScript Watch**: Main process code recompiles on change
- **Electron Application Window**

> Set the environment variable `GITPILOT_OPEN_DEVTOOLS=1` to automatically open DevTools in development mode.

### Production Build

```bash
# Build frontend and main process
npm run build

# Package installer (Windows NSIS / macOS DMG / Linux AppImage)
npm run dist
```

Build artifacts are output to the `release/` directory.

### Release Downloads

Latest stable release: [GitPilot v1.1.0](https://github.com/LeurDeLis/GitPilot/releases/latest)

| File | Type | Description |
| --- | --- | --- |
| `GitPilot Setup 1.1.0.exe` | Windows installer | Supports a custom installation directory and optional desktop shortcut |
| `GitPilot 1.1.0.exe` | Windows portable build | No installation required; download and run directly |


### Windows Installer and Portable Build

```bash
# Windows installer (NSIS)
npm run dist:installer

# Windows portable build
npm run dist:portable

# Generate both packages in one command
npm run dist:win
```

All of these commands use the application icon from `src/icon/app_icon.png`; installer and portable artifacts are written to `release/`. The Windows installer lets users choose a custom installation directory and whether to create a desktop shortcut; the Start Menu shortcut is created by default.

### Other Commands

| Command | Description |
| --- | --- |
| `npm run lint` | Run TypeScript type checking for both renderer and main process |
| `npm run start` | Launch the Electron app with pre-built code |

## 📄 License

This project is open-sourced under the [GPL-3.0](LICENSE) license.
