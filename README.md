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
- **最近仓库** — 自动记录最近打开的 12 个仓库，支持快速切换和单独移除列表条目
- **失效记录处理** — 仓库目录不存在或已被移动时，可在居中确认弹窗中清理记录；此操作不会删除磁盘文件夹，移除当前仓库后会返回启动主页
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
- **切换远程分支** — 点击远程分支即可按 `git checkout <分支名>` 切换；不存在同名本地分支时自动创建并绑定 upstream
- **删除分支** — 安全删除（`git branch -d`），未合并分支会被 Git 自动拒绝
- **合并分支** — 选择任意本地或远程分支合并到当前分支，冲突时展示冲突文件列表

### 🔄 同步操作
- **Pull** — 一键拉取远程更新，冲突时弹窗展示冲突文件清单
- **Push** — 根据当前本地分支的 upstream 推送到对应远程分支；缺少 upstream 时自动匹配同名远程分支

### 📜 提交历史
- **历史列表** — 展示最近 50 条提交记录，含提交信息、作者和时间
- **提交详情** — 点击任意提交可查看完整信息及变更文件列表（含状态、路径和重命名信息）

### 🌐 Remote 管理
- **Remote 面板** — 展示所有远程仓库配置，支持 URL 复制
- **增删改查** — 添加新 Remote、修改已有 Remote URL、删除不再使用的 Remote

### 📋 操作日志
- **实时日志** — 记录最近 300 条 Git 操作，含命令、执行结果和错误信息
- **日志清空** — 支持一键清空日志

### 🎨 界面与偏好
- **中英文切换** — 支持中文和 English 两种界面语言，选择会保存在本地
- **双主题** — 默认使用浅色主题，也可切换到深色主题，选择会保存在本地
- **自定义菜单** — 左上角 GitPilot 菜单提供打开、克隆、主题、语言和刷新入口，替代 Electron 默认菜单
- **日志布局** — 操作日志使用固定列宽，过长的 Git 命令以省略号显示，避免窄面板自动换行
- **确认弹窗** — 项目移除、目录失效和其他确认类弹窗统一显示在应用界面中央

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
├── build/                 # 应用图标与 Windows 安装器资源
├── electron/              # Electron 主进程、预加载桥接和 Git 服务
├── scripts/               # 开发启动、生产启动与 Windows 打包脚本
├── src/                   # React 渲染进程源码
│   ├── api/               # 渲染进程与 Electron IPC 的 API 适配层
│   ├── components/        # 界面组件与业务弹窗
│   │   └── dialogs/       # 克隆、分支、合并和 Remote 等对话框
│   ├── constants/         # 前后端共享常量
│   ├── icon/              # 渲染界面使用的应用图标资源
│   ├── store/             # Zustand 全局状态管理
│   ├── styles/            # 全局样式与主题外观
│   ├── types/             # Git、IPC 和全局 TypeScript 类型
│   └── utils/             # 格式化等通用工具
├── dist/                  # Vite 渲染进程构建产物
├── dist-electron/         # Electron 主进程构建产物
└── release/               # 安装版与绿色便携版输出目录
```

`dist/`、`dist-electron/` 和 `release/` 会在构建或打包后生成；依赖、版本控制、IDE 配置和缓存目录未在上方列出。

## 🚀 快速开始

### 环境要求

- **Node.js** 18+
- **Git** 已安装并添加到系统 PATH
- **Python** 3（仅使用 `app.py` 启动时需要）

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

也可以运行 `python app.py`，它会调用同一套 `npm run dev` 开发流程；如果 5173 端口已被占用，会自动选择下一个可用端口并同步给 Vite 和 Electron。

该命令会并行启动：
- **Vite Dev Server**：`http://127.0.0.1:5173`（默认端口；占用时自动使用下一个可用端口，支持 React 热更新）
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

### Release 下载

最新稳定版本：[GitPilot v1.1.0](https://github.com/LeurDeLis/GitPilot/releases/latest)

| 文件 | 类型 | 说明 |
| --- | --- | --- |
| `GitPilot Setup 1.1.0.exe` | Windows 安装版 | 支持自定义安装路径，并可选择是否创建桌面快捷方式 |
| `GitPilot 1.1.0.exe` | Windows 绿色便携版 | 无需安装，下载后可直接运行 |


### Windows 安装包与绿色版

```bash
# Windows 安装包（NSIS）
npm run dist:installer

# Windows 绿色便携版
npm run dist:portable

# 一次生成安装包和绿色版
npm run dist:win
```

以上命令都会使用 `src/icon/app_icon.png` 对应的应用图标，安装包和便携版输出到 `release/`。Windows 安装器支持自定义安装目录，并在安装过程中由用户选择是否创建桌面快捷方式；开始菜单快捷方式默认创建。

### 其他命令

| 命令 | 说明 |
| --- | --- |
| `npm run lint` | 对渲染进程和主进程执行 TypeScript 类型检查 |
| `npm run start` | 以已构建的代码启动 Electron 应用 |

## 📄 许可证

本项目基于 [GPL-3.0](LICENSE) 许可证开源。
