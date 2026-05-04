# GitPilot

一个使用 Electron + React + TypeScript 开发的桌面端 Git 可视化管理工具。应用通过 Electron 主进程封装 Git 命令，前端只通过安全 IPC 调用，不在浏览器环境直接执行 shell。

## 设计说明

### 架构分层

- `electron/main.ts`：Electron 主进程，负责窗口创建、IPC 注册、最近仓库持久化和操作日志管理。
- `electron/preload.ts`：通过 `contextBridge` 暴露安全的 `window.gitClient` API。
- `electron/gitService.ts`：Git 命令 service 层，统一使用 `execFile("git", args)` 调用 Git，避免 shell 拼接执行。
- `src/api/gitApi.ts`：渲染进程 API 适配层。
- `src/store/repoStore.ts`：Zustand 状态仓库，保存当前仓库、状态、分支、提交历史、remote、日志等数据。
- `src/components`：React UI 组件，包括顶部工具栏、侧边栏、变更列表、提交面板、分支面板、提交历史、日志面板和弹窗。
- `src/types/git.ts`：共享 TypeScript 类型定义。

### 安全策略

- Git 命令只在 Electron 主进程执行。
- Git 调用使用 `execFile` 参数数组，不使用 shell 字符串拼接。
- 分支名、remote 名称、commit message、路径、hash 等输入做基础校验。
- 所有 IPC handler 捕获异常并返回可读错误。
- 不在源码中保存 token、密码或其他凭据。

### 核心功能

- 打开本地 Git 仓库。
- 从远程 URL clone 仓库。
- 显示当前仓库路径、仓库名称、当前分支、领先/落后远程状态。
- 展示新增、修改、删除、重命名、未跟踪、冲突文件。
- 支持选择全部或部分文件提交。
- 支持 pull、push，并展示 loading、成功或失败信息。
- push 前检测 upstream，缺失时提示用户设置。
- 展示本地/远程分支，支持创建、切换、删除本地分支。
- 切换分支前检测未提交修改并提醒。
- 支持选择分支合并到当前分支，冲突时展示冲突文件列表。
- 展示最近 50 条提交历史，支持查看提交详情和变更文件。
- 展示、添加、修改、删除 remote。
- 记录最近打开仓库和最近 300 条 Git 操作日志。

## 目录结构

```text
gitpilot/
├── package.json
├── tsconfig.json
├── tsconfig.electron.json
├── vite.config.ts
├── index.html
├── electron/
│   ├── main.ts
│   ├── preload.ts
│   └── gitService.ts
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── types/
│   │   ├── git.ts
│   │   └── global.d.ts
│   ├── api/
│   │   └── gitApi.ts
│   ├── components/
│   │   ├── TopBar.tsx
│   │   ├── Sidebar.tsx
│   │   ├── ChangedFiles.tsx
│   │   ├── CommitPanel.tsx
│   │   ├── BranchPanel.tsx
│   │   ├── CommitHistory.tsx
│   │   ├── OperationLog.tsx
│   │   └── dialogs/
│   │       ├── CloneDialog.tsx
│   │       ├── CreateBranchDialog.tsx
│   │       ├── MergeDialog.tsx
│   │       └── RemoteDialog.tsx
│   ├── store/
│   │   └── repoStore.ts
│   ├── utils/
│   │   └── format.ts
│   └── styles/
│       └── global.css
└── README.md
```

## 安装

需要本机已安装：

- Node.js 18+
- Git

安装依赖：

```bash
npm install
```

## 开发运行

```bash
npm run dev
```

该命令会同时启动：

- Vite React dev server：`http://127.0.0.1:5173`
- Electron 主进程 TypeScript watch 编译
- Electron 桌面应用

## 构建

```bash
npm run build
```

生成安装包：

```bash
npm run dist
```

## 可维护扩展点

- 可在 `GitService` 中增加 `stash`、`rebase`、`tag`、`cherry-pick` 等方法。
- 可在 `preload.ts` 和 `gitApi.ts` 中补充对应 IPC API。
- 可在 `repoStore.ts` 里增加更细粒度 loading 状态。
- 后续可加入凭据管理，但不应把 token 或密码写入源码。
