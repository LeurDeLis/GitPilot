import {
  ApiOutlined,
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  PlusOutlined
} from "@ant-design/icons";
import {
  Alert,
  Button,
  ConfigProvider,
  Empty,
  Layout,
  List,
  Modal,
  Space,
  Tabs,
  Tag,
  Table,
  Typography,
  message
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { useEffect, useMemo, useRef, useState } from "react";
import { gitApi } from "./api/gitApi";
import { ChangedFiles } from "./components/ChangedFiles";
import { CommitHistory } from "./components/CommitHistory";
import { CommitPanel } from "./components/CommitPanel";
import { OperationLog } from "./components/OperationLog";
import { Sidebar } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { CloneDialog } from "./components/dialogs/CloneDialog";
import { CreateBranchDialog } from "./components/dialogs/CreateBranchDialog";
import { MergeDialog } from "./components/dialogs/MergeDialog";
import { RemoteDialog } from "./components/dialogs/RemoteDialog";
import { useRepoStore } from "./store/repoStore";
import type { CommitDetail, CommitFile, CommitItem, GitResult, RemoteInfo } from "./types/git";
import { formatDate, statusColor, statusText } from "./utils/format";

const { Header, Content, Sider } = Layout;

type RemoteDialogState = {
  open: boolean;
  mode: "add" | "edit";
  remote?: RemoteInfo;
};

const commitFileColumns: ColumnsType<CommitFile> = [
  {
    title: "状态",
    dataIndex: "status",
    width: 100,
    render: (status: CommitFile["status"]) => <Tag color={statusColor(status)}>{statusText(status)}</Tag>
  },
  {
    title: "文件",
    dataIndex: "path",
    render: (_value, record) => (
      <Space direction="vertical" size={0}>
        <Typography.Text>{record.path}</Typography.Text>
        {record.originalPath && (
          <Typography.Text type="secondary">原路径：{record.originalPath}</Typography.Text>
        )}
      </Space>
    )
  }
];

function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const [modal, modalContextHolder] = Modal.useModal();
  const [cloneOpen, setCloneOpen] = useState(false);
  const [createBranchOpen, setCreateBranchOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [remoteDialog, setRemoteDialog] = useState<RemoteDialogState>({ open: false, mode: "add" });
  const [commitDetail, setCommitDetail] = useState<CommitDetail | undefined>();
  const [commitDetailOpen, setCommitDetailOpen] = useState(false);
  const statusRefreshInFlight = useRef(false);

  const {
    repoInfo,
    status,
    branches,
    commits,
    remotes,
    logs,
    recentRepos,
    selectedFiles,
    busy,
    setRepoInfo,
    setStatus,
    setBranches,
    setCommits,
    setRemotes,
    setLogs,
    setRecentRepos,
    setSelectedFiles,
    setBusy
  } = useRepoStore();

  const mergeBranches = useMemo(() => {
    const all = [...branches.local, ...branches.remote];
    return Array.from(new Set(all));
  }, [branches.local, branches.remote]);

  useEffect(() => {
    void loadStartupData();
    const timer = window.setInterval(() => {
      void refreshLogs();
    }, 2500);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const repoPath = repoInfo?.path;
    if (!repoPath) {
      return;
    }

    const timer = window.setInterval(() => {
      const state = useRepoStore.getState();
      if (state.busy || state.repoInfo?.path !== repoPath) {
        return;
      }

      void refreshRepositoryStatus(repoPath);
    }, 1500);

    return () => window.clearInterval(timer);
  }, [repoInfo?.path]);

  const loadStartupData = async () => {
    try {
      const [recent, nextLogs] = await Promise.all([
        gitApi.getRecentRepos(),
        gitApi.getLogs()
      ]);
      setRecentRepos(recent);
      setLogs(nextLogs);
    } catch (error) {
      showError(error, "加载应用数据失败");
    }
  };

  const refreshLogs = async () => {
    try {
      setLogs(await gitApi.getLogs());
    } catch {
      // Logs are diagnostic only; keep the UI stable if the panel cannot refresh.
    }
  };

  const refreshRepositoryStatus = async (repoPath: string) => {
    if (statusRefreshInFlight.current) {
      return;
    }

    statusRefreshInFlight.current = true;
    try {
      const nextStatus = await gitApi.getStatus(repoPath);
      const currentRepoPath = useRepoStore.getState().repoInfo?.path;
      if (currentRepoPath === repoPath) {
        setStatus(nextStatus, { preserveSelection: true });
      }
    } catch {
      // Background status checks should not interrupt normal use.
    } finally {
      statusRefreshInFlight.current = false;
    }
  };

  const refreshRepository = async (repoPath = repoInfo?.path) => {
    if (!repoPath) {
      return;
    }

    setBusy(true);
    try {
      const [repo, nextStatus, nextBranches, nextCommits, nextRemotes, nextLogs, nextRecent] = await Promise.all([
        gitApi.openRepo(repoPath),
        gitApi.getStatus(repoPath),
        gitApi.getBranches(repoPath),
        gitApi.getCommitHistory(repoPath),
        gitApi.getRemotes(repoPath),
        gitApi.getLogs(),
        gitApi.getRecentRepos()
      ]);

      setRepoInfo(repo);
      setStatus(nextStatus);
      setBranches(nextBranches);
      setCommits(nextCommits);
      setRemotes(nextRemotes);
      setLogs(nextLogs);
      setRecentRepos(nextRecent);
    } catch (error) {
      showError(error, "刷新仓库失败");
    } finally {
      setBusy(false);
    }
  };

  const openRepoByPath = async (repoPath: string) => {
    setBusy(true);
    try {
      const repo = await gitApi.openRepo(repoPath);
      setRepoInfo(repo);
      await refreshRepository(repo.path);
      messageApi.success("仓库已打开");
    } catch (error) {
      showError(error, "打开仓库失败");
    } finally {
      setBusy(false);
    }
  };

  const handleOpenDirectory = async () => {
    try {
      const directory = await gitApi.selectDirectory();
      if (directory) {
        await openRepoByPath(directory);
      }
    } catch (error) {
      showError(error, "选择目录失败");
    }
  };

  const handleClone = async (repoUrl: string, targetDir: string) => {
    setBusy(true);
    try {
      const result = await gitApi.cloneRepo(repoUrl, targetDir);
      await refreshLogs();
      if (!result.success) {
        showGitResultError(result, "克隆失败");
        return;
      }
      setCloneOpen(false);
      await openRepoByPath(targetDir);
      messageApi.success("克隆完成");
    } catch (error) {
      showError(error, "克隆失败");
    } finally {
      setBusy(false);
    }
  };

  const runGitAction = async (
    label: string,
    action: () => Promise<GitResult>,
    successMessage: string
  ) => {
    if (!repoInfo) {
      return;
    }

    setBusy(true);
    try {
      const result = await action();
      await refreshLogs();

      if (!result.success) {
        if (result.conflictFiles?.length) {
          showConflictModal(result.conflictFiles);
        } else if (result.requiresUpstream) {
          modal.warning({
            title: "需要设置 upstream",
            content: result.error
          });
        } else {
          showGitResultError(result, `${label}失败`);
        }
        return;
      }

      messageApi.success(successMessage);
      await refreshRepository(repoInfo.path);
    } catch (error) {
      showError(error, `${label}失败`);
    } finally {
      setBusy(false);
    }
  };

  const handleCommit = async (commitMessage: string): Promise<boolean> => {
    if (!repoInfo) {
      return false;
    }

    setBusy(true);
    try {
      const result = await gitApi.commit(repoInfo.path, selectedFiles, commitMessage);
      await refreshLogs();
      if (!result.success) {
        showGitResultError(result, "提交失败");
        return false;
      }
      messageApi.success("提交成功");
      await refreshRepository(repoInfo.path);
      return true;
    } catch (error) {
      showError(error, "提交失败");
      return false;
    } finally {
      setBusy(false);
    }
  };

  const handleCreateBranch = async (branchName: string) => {
    if (!repoInfo) {
      return;
    }

    setBusy(true);
    try {
      const result = await gitApi.createBranch(repoInfo.path, branchName);
      await refreshLogs();
      if (!result.success) {
        showGitResultError(result, "创建分支失败");
        return;
      }
      setCreateBranchOpen(false);
      messageApi.success("分支已创建");
      await refreshRepository(repoInfo.path);
    } catch (error) {
      showError(error, "创建分支失败");
    } finally {
      setBusy(false);
    }
  };

  const handleCheckoutBranch = async (branchName: string) => {
    if (!repoInfo) {
      return;
    }

    if (status && !status.isClean) {
      const confirmed = await confirm({
        title: "当前有未提交修改",
        content: "切换分支可能失败或影响工作区，请确认已了解当前变更状态。",
        okText: "继续切换"
      });
      if (!confirmed) {
        return;
      }
    }

    await runGitAction(
      "切换分支",
      () => gitApi.checkoutBranch(repoInfo.path, branchName),
      "分支已切换"
    );
  };

  const handleDeleteBranch = async (branchName: string) => {
    if (!repoInfo) {
      return;
    }

    const confirmed = await confirm({
      title: `删除本地分支 ${branchName}`,
      content: "该操作会执行 git branch -d。未合并分支会被 Git 拒绝删除。",
      okText: "删除",
      danger: true
    });

    if (!confirmed) {
      return;
    }

    await runGitAction(
      "删除分支",
      () => gitApi.deleteBranch(repoInfo.path, branchName),
      "分支已删除"
    );
  };

  const handleMerge = async (branchName: string) => {
    if (!repoInfo) {
      return;
    }
    await runGitAction(
      "合并分支",
      () => gitApi.merge(repoInfo.path, branchName),
      "合并成功"
    );
    setMergeOpen(false);
  };

  const handleSelectCommit = async (commit: CommitItem) => {
    if (!repoInfo) {
      return;
    }
    try {
      const detail = await gitApi.getCommitDetail(repoInfo.path, commit.hash);
      setCommitDetail(detail);
      setCommitDetailOpen(true);
      await refreshLogs();
    } catch (error) {
      showError(error, "获取提交详情失败");
    }
  };

  const handleSaveRemote = async (name: string, url: string) => {
    if (!repoInfo) {
      return;
    }

    setBusy(true);
    try {
      const result = remoteDialog.mode === "add"
        ? await gitApi.addRemote(repoInfo.path, name, url)
        : await gitApi.setRemoteUrl(repoInfo.path, name, url);

      await refreshLogs();
      if (!result.success) {
        showGitResultError(result, remoteDialog.mode === "add" ? "新增 remote 失败" : "修改 remote 失败");
        return;
      }

      setRemoteDialog({ open: false, mode: "add" });
      messageApi.success(remoteDialog.mode === "add" ? "Remote 已新增" : "Remote 已更新");
      await refreshRepository(repoInfo.path);
    } catch (error) {
      showError(error, "保存 remote 失败");
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveRemote = async (remote: RemoteInfo) => {
    if (!repoInfo) {
      return;
    }

    const confirmed = await confirm({
      title: `删除 remote ${remote.name}`,
      content: "该操作会执行 git remote remove。",
      okText: "删除",
      danger: true
    });
    if (!confirmed) {
      return;
    }

    await runGitAction(
      "删除 remote",
      () => gitApi.removeRemote(repoInfo.path, remote.name),
      "Remote 已删除"
    );
  };

  const handleStageFiles = async (files: string[]) => {
    if (!repoInfo || files.length === 0) return;
    setBusy(true);
    try {
      const result = await gitApi.stageFiles(repoInfo.path, files);
      if (!result.success) {
        showGitResultError(result, "暂存失败");
        return;
      }
      messageApi.success(`已暂存 ${files.length} 个文件`);
      await refreshRepository(repoInfo.path);
    } catch (error) {
      showError(error, "暂存失败");
    } finally {
      setBusy(false);
    }
  };

  const handleUnstageFiles = async (files: string[]) => {
    if (!repoInfo || files.length === 0) return;
    setBusy(true);
    try {
      const result = await gitApi.unstageFiles(repoInfo.path, files);
      if (!result.success) {
        showGitResultError(result, "取消暂存失败");
        return;
      }
      messageApi.success(`已取消暂存 ${files.length} 个文件`);
      await refreshRepository(repoInfo.path);
    } catch (error) {
      showError(error, "取消暂存失败");
    } finally {
      setBusy(false);
    }
  };

  const handleDiscardFiles = async (files: string[]) => {
    if (!repoInfo || files.length === 0) return;

    const confirmed = await confirm({
      title: `回滚 ${files.length} 个文件变更`,
      content: "此操作会丢弃所选文件的未提交修改，并删除所选未跟踪文件。该操作无法从应用内撤销。",
      okText: "确认回滚",
      danger: true
    });
    if (!confirmed) {
      return;
    }

    setBusy(true);
    try {
      const result = await gitApi.discardFiles(repoInfo.path, files);
      await refreshLogs();
      if (!result.success) {
        showGitResultError(result, "回滚失败");
        return;
      }
      messageApi.success(`已回滚 ${files.length} 个文件变更`);
      await refreshRepository(repoInfo.path);
    } catch (error) {
      showError(error, "回滚失败");
    } finally {
      setBusy(false);
    }
  };

  const clearLogs = async () => {
    setLogs(await gitApi.clearLogs());
  };

  const showError = (error: unknown, title: string) => {
    const content = error instanceof Error ? error.message : String(error);
    messageApi.error(`${title}: ${content}`);
  };

  const showGitResultError = (result: GitResult, title: string) => {
    modal.error({
      title,
      content: (
        <Space direction="vertical" className="modal-error-content">
          <Typography.Text code>{result.command}</Typography.Text>
          <Typography.Text type="danger">{result.error || "Git 命令执行失败"}</Typography.Text>
          {result.output && <pre>{result.output}</pre>}
        </Space>
      )
    });
  };

  const showConflictModal = (conflictFiles: string[]) => {
    modal.warning({
      title: "合并发生冲突",
      width: 620,
      content: (
        <Space direction="vertical" className="modal-error-content">
          <Typography.Text>以下文件存在冲突，请手动解决后重新提交：</Typography.Text>
          <ul className="conflict-list">
            {conflictFiles.map((file) => (
              <li key={file}>{file}</li>
            ))}
          </ul>
          <Typography.Text type="secondary">
            解决冲突后执行提交即可完成合并。
          </Typography.Text>
        </Space>
      )
    });
  };

  const confirm = (options: {
    title: string;
    content: string;
    okText: string;
    danger?: boolean;
  }) => new Promise<boolean>((resolve) => {
    modal.confirm({
      title: options.title,
      content: options.content,
      okText: options.okText,
      cancelText: "取消",
      okButtonProps: { danger: options.danger },
      onOk: () => resolve(true),
      onCancel: () => resolve(false)
    });
  });

  const renderWelcome = () => (
    <div className="welcome">
      <div className="welcome-content">
        <Typography.Title level={2}>GitPilot</Typography.Title>
        <Typography.Paragraph type="secondary">
          打开本地 Git 仓库，或从远程地址克隆一个新仓库开始管理。
        </Typography.Paragraph>
        <Space size={12}>
          <Button type="primary" size="large" icon={<FolderOpenOutlined />} onClick={handleOpenDirectory}>
            打开本地仓库
          </Button>
          <Button size="large" icon={<ApiOutlined />} onClick={() => setCloneOpen(true)}>
            克隆远程仓库
          </Button>
        </Space>
      </div>
    </div>
  );

  const renderRemotePanel = () => {
    const fetchRemotes = remotes.filter((remote) => remote.type === "fetch");
    return (
      <div className="remote-panel">
        <div className="tab-toolbar">
          <Typography.Text type="secondary">
            {fetchRemotes.length} 个 remote
          </Typography.Text>
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setRemoteDialog({ open: true, mode: "add" })}
          >
            新增
          </Button>
        </div>
        {fetchRemotes.length > 0 ? (
          <List
            dataSource={fetchRemotes}
            renderItem={(remote) => (
              <List.Item
                actions={[
                  <Button
                    key="edit"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={() => setRemoteDialog({ open: true, mode: "edit", remote })}
                  />,
                  <Button
                    key="delete"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleRemoveRemote(remote)}
                  />
                ]}
              >
                <List.Item.Meta
                  title={<Typography.Text strong>{remote.name}</Typography.Text>}
                  description={<Typography.Text copyable ellipsis>{remote.url}</Typography.Text>}
                />
              </List.Item>
            )}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无 remote" />
        )}
      </div>
    );
  };

  const renderWorkspace = () => (
    <div className="workspace">
      <div className="main-column">
        {status?.hasConflicts && (
          <Alert
            type="error"
            showIcon
            message="仓库存在冲突文件"
            description="请手动解决冲突后重新提交。冲突文件会在变更列表中标记为“冲突”。"
          />
        )}
        <ChangedFiles
          status={status}
          selectedFiles={selectedFiles}
          busy={busy}
          onSelectionChange={setSelectedFiles}
          onRefresh={() => refreshRepository()}
          onStage={handleStageFiles}
          onUnstage={handleUnstageFiles}
          onDiscard={handleDiscardFiles}
        />
        <CommitPanel
          selectedCount={selectedFiles.length}
          totalCount={status?.files.length ?? 0}
          disabled={!repoInfo || busy}
          onCommit={handleCommit}
        />
      </div>
      <div className="right-column">
        <Tabs
          defaultActiveKey="history"
          items={[
            {
              key: "history",
              label: "提交历史",
              children: <CommitHistory commits={commits} onSelectCommit={handleSelectCommit} />
            },
            {
              key: "remotes",
              label: "Remote",
              children: renderRemotePanel()
            },
            {
              key: "logs",
              label: "操作日志",
              children: <OperationLog logs={logs} onClear={clearLogs} />
            }
          ]}
        />
      </div>
    </div>
  );

  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: "#2563eb",
          borderRadius: 8,
          fontFamily: "Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
        }
      }}
    >
      {contextHolder}
      {modalContextHolder}
      <Layout className="app-shell">
        <Header className="app-header">
          <TopBar
            repoInfo={repoInfo}
            busy={busy}
            onOpenRepo={handleOpenDirectory}
            onCloneRepo={() => setCloneOpen(true)}
            onPull={() => runGitAction("Pull", () => gitApi.pull(repoInfo!.path), "Pull 完成")}
            onPush={() => runGitAction("Push", () => gitApi.push(repoInfo!.path), "Push 完成")}
            onRefresh={() => refreshRepository()}
          />
        </Header>

        <Layout className="app-body">
          <Sider width={292} className="app-sider">
            <Sidebar
              repoInfo={repoInfo}
              recentRepos={recentRepos}
              branches={branches}
              onOpenRecent={openRepoByPath}
              onCreateBranch={() => setCreateBranchOpen(true)}
              onCheckoutBranch={handleCheckoutBranch}
              onDeleteBranch={handleDeleteBranch}
              onMerge={() => setMergeOpen(true)}
            />
          </Sider>
          <Content className="app-content">
            {repoInfo ? renderWorkspace() : renderWelcome()}
          </Content>
        </Layout>
      </Layout>

      <CloneDialog
        open={cloneOpen}
        busy={busy}
        onCancel={() => setCloneOpen(false)}
        onSelectDirectory={gitApi.selectDirectory}
        onSubmit={handleClone}
      />
      <CreateBranchDialog
        open={createBranchOpen}
        busy={busy}
        onCancel={() => setCreateBranchOpen(false)}
        onSubmit={handleCreateBranch}
      />
      <MergeDialog
        open={mergeOpen}
        currentBranch={repoInfo?.currentBranch}
        branches={mergeBranches}
        busy={busy}
        onCancel={() => setMergeOpen(false)}
        onSubmit={handleMerge}
      />
      <RemoteDialog
        open={remoteDialog.open}
        mode={remoteDialog.mode}
        remote={remoteDialog.remote}
        busy={busy}
        onCancel={() => setRemoteDialog({ open: false, mode: "add" })}
        onSubmit={handleSaveRemote}
      />
      <Modal
        title="提交详情"
        open={commitDetailOpen}
        onCancel={() => setCommitDetailOpen(false)}
        footer={null}
        width={760}
      >
        {commitDetail ? (
          <Space direction="vertical" className="commit-detail" size={12}>
            <Space wrap>
              <Typography.Text code>{commitDetail.shortHash}</Typography.Text>
              <Typography.Text>{commitDetail.author}</Typography.Text>
              <Typography.Text type="secondary">{formatDate(commitDetail.date)}</Typography.Text>
            </Space>
            <Typography.Title level={5}>{commitDetail.message}</Typography.Title>
            {commitDetail.body && <Typography.Paragraph>{commitDetail.body}</Typography.Paragraph>}
            <Table<CommitFile>
              rowKey={(record) => `${record.status}:${record.path}`}
              size="small"
              columns={commitFileColumns}
              dataSource={commitDetail.files}
              pagination={false}
            />
          </Space>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无详情" />
        )}
      </Modal>
    </ConfigProvider>
  );
}

export default App;
