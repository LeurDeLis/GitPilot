<p align="center">
  <img src="build/icon.ico" width="80" />
</p>

<h1 align="center">GitPilot</h1>

<p align="center">
  一个简洁高效的桌面端 Git 可视化管理工具
</p>

<p align="center">
  <a href="./README_EN.md">English</a> | 中文
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Electron-29-47848f?logo=electron" alt="Electron" />
  <img src="https://img.shields.io/badge/React-18-61dafb?logo=react" alt="React" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Ant%20Design-5-0170fe?logo=antdesign" alt="Ant Design" />
  <img src="https://img.shields.io/badge/License-GPL--3.0-blue" alt="License" />
</p>

---

## ✨ 简介

**GitPilot** 是基于 Electron + React + TypeScript 构建的桌面端 Git 图形化客户端。它将所有 Git 命令封装在 Electron 主进程中，通过安全的 IPC 通信桥接前端，不在浏览器环境中执行任何 Shell 命令，兼顾易用性与安全性。

## 🎯 功能特性

### 📁 仓库管理
- **打开本地仓库** — 通过系统文件对话框选择本地 Git 仓库
- **克隆远程仓库** — 输入远程 URL 和目标路径，一键克隆
- **最近仓库** — 自动记录最近打开的 12 个仓库，支持快速切换
- **仓库状态总览** — 实时展示仓库名称、当前分支、远程地址、领先/落后提交数

### 📝 文件变更与提交
- **变更文件列表** — 清晰展示新增、修改、删除、重命名、未跟踪和冲突文件，带状态标签着色
- **暂存 / 取消暂存** — 支持单个或批量暂存（Stage）与取消暂存（Unstage）文件
- **回滚变更** — 选中文件一键回滚到最近一次提交状态，支持已跟踪和未跟踪文件
- **灵活提交** — 自由选择全部或部分文件编写 Commit Message 提交
- **自动刷新** — 每 1.5 秒自动轮询仓库状态，实时反映工作区变化

### 🔀 分支操作
- **分支面板** — 分组展示本地分支和远程分支，当前分支高亮标识
- **创建分支** — 基于当前 HEAD 创建新的本地分支
- **切换分支** — 切换前自动检测未提交修改并弹窗提醒
- **删除分支** — 安全删除（`git branch -d`），未合并分支会被 Git 自动拒绝
- **合并分支** — 选择任意本地或远程分支合并到当前分支，冲突时展示冲突文件列表

### 🔄 同步操作
- **Pull** — 一键拉取远程更新，冲突时弹窗展示冲突文件清单
- **Push** — 推送本地提交到远程，自动检测 upstream 并在缺失时给出引导提示

### 📜 提交历史
- **历史列表** — 展示最近 50 条提交记录，含提交信息、作者和时间
- **提交详情** — 点击任意提交可查看完整信息及变更文件列表（含状态、路径和重命名信息）

### 🌐 Remote 管理
- **Remote 面板** — 展示所有远程仓库配置，支持 URL 复制
- **增删改查** — 添加新 Remote、修改已有 Remote URL、删除不再使用的 Remote

### 📋 操作日志
- **实时日志** — 记录最近 300 条 Git 操作，含命令、执行结果和错误信息
- **日志清空** — 支持一键清空日志

## 🏗️ 技术架构

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

- **渲染进程**：React 18 + Ant Design 5 构建 UI，Zustand 管理全局状态，通过 `gitApi.ts` 调用 IPC
- **主进程**：`gitService.ts` 统一使用 `execFile("git", args)` 执行命令，参数化调用避免注入风险
- **预加载脚本**：`preload.ts` 通过 `contextBridge` 暴露安全 API (`window.gitClient`)
- **持久化**：最近仓库列表序列化到 `userData/settings.json`

## 🔒 安全策略

- 所有 Git 命令仅在 Electron 主进程执行
- 使用 `execFile` 参数数组传参，禁止 shell 字符串拼接
- 分支名、Remote 名、Commit Message、文件路径、Hash 等输入均做合法性校验
- 所有 IPC handler 统一捕获异常并返回可读错误信息
- 不在源码中保存任何 Token、密码或凭据
- 启用 `contextIsolation`，禁用 `nodeIntegration`

## 📂 项目结构

```text
GitPilot/
├── package.json                  # 项目配置及依赖
├── vite.config.ts                # Vite 构建配置
├── tsconfig.json                 # 渲染进程 TS 配置
├── tsconfig.electron.json        # 主进程 TS 配置
├── index.html                    # 入口 HTML
├── build/
│   └── icon.ico                  # 应用图标
├── electron/
│   ├── main.ts                   # 主进程：窗口、IPC、持久化
│   ├── preload.ts                # 预加载：contextBridge API
│   └── gitService.ts             # Git 命令服务层
└── src/
    ├── main.tsx                  # React 入口
    ├── App.tsx                   # 根组件及页面路由
    ├── types/
    │   ├── git.ts                # 共享类型定义
    │   └── global.d.ts           # 全局类型声明
    ├── api/
    │   └── gitApi.ts             # IPC API 适配层
    ├── store/
    │   └── repoStore.ts          # Zustand 状态管理
    ├── utils/
    │   └── format.ts             # 格式化工具函数
    ├── styles/
    │   └── global.css            # 全局样式
    └── components/
        ├── TopBar.tsx            # 顶部工具栏
        ├── Sidebar.tsx           # 侧边栏（仓库 + 分支）
        ├── ChangedFiles.tsx      # 变更文件列表
        ├── CommitPanel.tsx       # 提交面板
        ├── BranchPanel.tsx       # 分支面板
        ├── CommitHistory.tsx     # 提交历史
        ├── OperationLog.tsx      # 操作日志面板
        └── dialogs/
            ├── CloneDialog.tsx       # 克隆仓库弹窗
            ├── CreateBranchDialog.tsx # 创建分支弹窗
            ├── MergeDialog.tsx       # 合并分支弹窗
            └── RemoteDialog.tsx      # Remote 编辑弹窗
```

## 🚀 快速开始

### 环境要求

- **Node.js** 18+
- **Git** 已安装并添加到系统 PATH

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

该命令会并行启动：
- **Vite Dev Server**：`http://127.0.0.1:5173`（React 热更新）
- **TypeScript Watch**：主进程代码实时编译
- **Electron 应用窗口**

> 设置环境变量 `GITPILOT_OPEN_DEVTOOLS=1` 可在开发模式自动打开 DevTools。

### 生产构建

```bash
# 构建前端和主进程
npm run build

# 打包安装程序（Windows NSIS / macOS DMG / Linux AppImage）
npm run dist
```

构建产物输出到 `release/` 目录。

### 其他命令

| 命令 | 说明 |
| --- | --- |
| `npm run lint` | 对渲染进程和主进程执行 TypeScript 类型检查 |
| `npm run start` | 以已构建的代码启动 Electron 应用 |

## 📄 许可证

本项目基于 [GPL-3.0](LICENSE) 许可证开源。
