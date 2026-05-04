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
- **Recent Repositories** — Automatically records the last 12 opened repositories for quick switching
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
- **Delete Branch** — Safe deletion via `git branch -d`; unmerged branches are automatically rejected by Git
- **Merge Branch** — Merge any local or remote branch into the current branch; conflicts are displayed in a conflict file list

### 🔄 Sync Operations
- **Pull** — Pull remote updates with one click; conflicts trigger a popup showing the conflicted files
- **Push** — Push local commits to remote; automatically detects upstream and provides guidance when missing

### 📜 Commit History
- **History List** — Displays the most recent 50 commits with message, author, and timestamp
- **Commit Details** — Click any commit to view full details including changed files (with status, path, and rename info)

### 🌐 Remote Management
- **Remote Panel** — Displays all remote configurations with copyable URLs
- **Full CRUD** — Add new remotes, edit existing remote URLs, or remove unused remotes

### 📋 Operation Log
- **Real-time Logging** — Records the last 300 Git operations, including commands, results, and error messages
- **Clear Logs** — One-click log clearing

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
├── package.json                  # Project config & dependencies
├── vite.config.ts                # Vite build configuration
├── tsconfig.json                 # Renderer TS config
├── tsconfig.electron.json        # Main process TS config
├── index.html                    # Entry HTML
├── build/
│   └── icon.ico                  # Application icon
├── electron/
│   ├── main.ts                   # Main process: window, IPC, persistence
│   ├── preload.ts                # Preload: contextBridge API
│   └── gitService.ts             # Git command service layer
└── src/
    ├── main.tsx                  # React entry point
    ├── App.tsx                   # Root component & page routing
    ├── types/
    │   ├── git.ts                # Shared type definitions
    │   └── global.d.ts           # Global type declarations
    ├── api/
    │   └── gitApi.ts             # IPC API adapter layer
    ├── store/
    │   └── repoStore.ts          # Zustand state management
    ├── utils/
    │   └── format.ts             # Formatting utilities
    ├── styles/
    │   └── global.css            # Global styles
    └── components/
        ├── TopBar.tsx            # Top toolbar
        ├── Sidebar.tsx           # Sidebar (repos + branches)
        ├── ChangedFiles.tsx      # Changed files list
        ├── CommitPanel.tsx       # Commit panel
        ├── BranchPanel.tsx       # Branch panel
        ├── CommitHistory.tsx     # Commit history
        ├── OperationLog.tsx      # Operation log panel
        └── dialogs/
            ├── CloneDialog.tsx       # Clone repository dialog
            ├── CreateBranchDialog.tsx # Create branch dialog
            ├── MergeDialog.tsx       # Merge branch dialog
            └── RemoteDialog.tsx      # Remote edit dialog
```

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+
- **Git** installed and available in system PATH

### Install Dependencies

```bash
npm install
```

### Development Mode

```bash
npm run dev
```

This command starts concurrently:
- **Vite Dev Server**: `http://127.0.0.1:5173` (React hot reload)
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

### Other Commands

| Command | Description |
| --- | --- |
| `npm run lint` | Run TypeScript type checking for both renderer and main process |
| `npm run start` | Launch the Electron app with pre-built code |

## 📄 License

This project is open-sourced under the [GPL-3.0](LICENSE) license.
