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
  theme as antdTheme,
  message
} from "antd";
import enUS from "antd/locale/en_US";
import zhCN from "antd/locale/zh_CN";
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
import type { Language } from "./i18n";
import { useI18n } from "./i18n";
import { useRepoStore } from "./store/repoStore";
import { useTheme } from "./theme";
import type { CommitDetail, CommitFile, CommitItem, GitResult, RemoteInfo } from "./types/git";
import { formatDate, statusColor, statusText } from "./utils/format";

const { Header, Content, Sider } = Layout;

type RemoteDialogState = {
  open: boolean;
  mode: "add" | "edit";
  remote?: RemoteInfo;
};

function createCommitFileColumns(language: Language, translateText: (key: string, params?: Record<string, string | number>) => string): ColumnsType<CommitFile> {
  return [
    {
      title: translateText("status"),
      dataIndex: "status",
      width: 100,
      render: (status: CommitFile["status"]) => <Tag color={statusColor(status)}>{statusText(status, language)}</Tag>
    },
    {
      title: translateText("changedFiles"),
      dataIndex: "path",
      render: (_value, record) => (
        <Space direction="vertical" size={0}>
          <Typography.Text>{record.path}</Typography.Text>
          {record.originalPath && (
            <Typography.Text type="secondary">
              {translateText("originalPath", { path: record.originalPath })}
            </Typography.Text>
          )}
        </Space>
      )
    }
  ];
}

function App() {
  const [messageApi, contextHolder] = message.useMessage();
  const [modal, modalContextHolder] = Modal.useModal();
  const { language, setLanguage, t } = useI18n();
  const { theme, setTheme } = useTheme();
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
      showError(error, t("loadAppDataFailed"));
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
      showError(error, t("refreshRepositoryFailed"));
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
      messageApi.success(t("repositoryOpened"));
    } catch (error) {
      showError(error, t("openRepositoryFailed"));
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
      showError(error, t("selectDirectory"));
    }
  };

  const handleClone = async (repoUrl: string, targetDir: string) => {
    setBusy(true);
    try {
      const result = await gitApi.cloneRepo(repoUrl, targetDir);
      await refreshLogs();
      if (!result.success) {
        showGitResultError(result, t("cloneFailed"));
        return;
      }
      setCloneOpen(false);
      await openRepoByPath(targetDir);
      messageApi.success(t("cloneCompleted"));
    } catch (error) {
      showError(error, t("cloneFailed"));
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
            title: t("upstreamRequired"),
            content: result.error
          });
        } else {
          showGitResultError(result, t("actionFailed", { label }));
        }
        return;
      }

      messageApi.success(successMessage);
      await refreshRepository(repoInfo.path);
    } catch (error) {
      showError(error, t("actionFailed", { label }));
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
        showGitResultError(result, t("commitFailed"));
        return false;
      }
      messageApi.success(t("commitCompleted"));
      await refreshRepository(repoInfo.path);
      return true;
    } catch (error) {
      showError(error, t("commitFailed"));
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
        showGitResultError(result, t("branchCreateFailed"));
        return;
      }
      setCreateBranchOpen(false);
      messageApi.success(t("branchCreated"));
      await refreshRepository(repoInfo.path);
    } catch (error) {
      showError(error, t("branchCreateFailed"));
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
        title: t("uncommittedChangesTitle"),
        content: t("uncommittedChangesDescription"),
        okText: t("continueSwitch")
      });
      if (!confirmed) {
        return;
      }
    }

    await runGitAction(
      t("switchBranch"),
      () => gitApi.checkoutBranch(repoInfo.path, branchName),
      t("branchSwitched")
    );
  };

  const handleCheckoutRemoteBranch = async (branchName: string) => {
    if (!repoInfo) {
      return;
    }

    if (status && !status.isClean) {
      const confirmed = await confirm({
        title: t("uncommittedChangesTitle"),
        content: t("uncommittedChangesDescription"),
        okText: t("continueSwitch")
      });
      if (!confirmed) {
        return;
      }
    }

    await runGitAction(
      t("switchRemoteBranch"),
      () => gitApi.checkoutRemoteBranch(repoInfo.path, branchName),
      t("branchSwitched")
    );
  };

  const handleDeleteBranch = async (branchName: string) => {
    if (!repoInfo) {
      return;
    }

    const confirmed = await confirm({
      title: t("deleteBranchTitle", { branch: branchName }),
      content: t("deleteBranchDescription"),
      okText: t("delete"),
      danger: true
    });

    if (!confirmed) {
      return;
    }

    await runGitAction(
      t("deleteLocalBranch"),
      () => gitApi.deleteBranch(repoInfo.path, branchName),
      t("branchDeleted")
    );
  };

  const handleMerge = async (branchName: string) => {
    if (!repoInfo) {
      return;
    }
    await runGitAction(
      t("mergeBranch"),
      () => gitApi.merge(repoInfo.path, branchName),
      t("mergeCompleted")
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
      showError(error, t("errorLoadCommitDetail"));
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
        showGitResultError(result, remoteDialog.mode === "add" ? t("addRemoteFailed") : t("editRemoteFailed"));
        return;
      }

      setRemoteDialog({ open: false, mode: "add" });
      messageApi.success(remoteDialog.mode === "add" ? t("remoteAdded") : t("remoteUpdated"));
      await refreshRepository(repoInfo.path);
    } catch (error) {
      showError(error, t("errorSaveRemote"));
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveRemote = async (remote: RemoteInfo) => {
    if (!repoInfo) {
      return;
    }

    const confirmed = await confirm({
      title: t("deleteRemoteTitle", { remote: remote.name }),
      content: t("deleteRemoteDescription"),
      okText: t("delete"),
      danger: true
    });
    if (!confirmed) {
      return;
    }

    await runGitAction(
      t("delete"),
      () => gitApi.removeRemote(repoInfo.path, remote.name),
      t("remoteRemoved")
    );
  };

  const handleStageFiles = async (files: string[]) => {
    if (!repoInfo || files.length === 0) return;
    setBusy(true);
    try {
      const result = await gitApi.stageFiles(repoInfo.path, files);
      if (!result.success) {
        showGitResultError(result, t("stageFailed"));
        return;
      }
      messageApi.success(t("stageCompleted", { count: files.length }));
      await refreshRepository(repoInfo.path);
    } catch (error) {
      showError(error, t("stageFailed"));
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
        showGitResultError(result, t("unstageFailed"));
        return;
      }
      messageApi.success(t("unstageCompleted", { count: files.length }));
      await refreshRepository(repoInfo.path);
    } catch (error) {
      showError(error, t("unstageFailed"));
    } finally {
      setBusy(false);
    }
  };

  const handleDiscardFiles = async (files: string[]) => {
    if (!repoInfo || files.length === 0) return;

    const confirmed = await confirm({
      title: t("discardFilesTitle", { count: files.length }),
      content: t("discardFilesDescription"),
      okText: t("confirmDiscard"),
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
        showGitResultError(result, t("discardFailed"));
        return;
      }
      messageApi.success(t("discardCompleted", { count: files.length }));
      await refreshRepository(repoInfo.path);
    } catch (error) {
      showError(error, t("discardFailed"));
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
          <Typography.Text type="danger">{result.error || t("errorGitCommand")}</Typography.Text>
          {result.output && <pre>{result.output}</pre>}
        </Space>
      )
    });
  };

  const showConflictModal = (conflictFiles: string[]) => {
    modal.warning({
      title: t("conflictTitle"),
      width: 620,
      content: (
        <Space direction="vertical" className="modal-error-content">
          <Typography.Text>{t("conflictDescription")}</Typography.Text>
          <ul className="conflict-list">
            {conflictFiles.map((file) => (
              <li key={file}>{file}</li>
            ))}
          </ul>
          <Typography.Text type="secondary">
            {t("conflictResolvedHint")}
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
      cancelText: t("cancel"),
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
          {t("welcomeDescription")}
        </Typography.Paragraph>
        <Space size={12}>
          <Button type="primary" size="large" icon={<FolderOpenOutlined />} onClick={handleOpenDirectory}>
            {t("openRepository")}
          </Button>
          <Button size="large" icon={<ApiOutlined />} onClick={() => setCloneOpen(true)}>
            {t("cloneRepository")}
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
            {t("remoteCount", { count: fetchRemotes.length })}
          </Typography.Text>
          <Button
            size="small"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setRemoteDialog({ open: true, mode: "add" })}
          >
            {t("add")}
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
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("noRemote")} />
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
            message={t("conflictFilesTitle")}
            description={t("conflictFilesDescription")}
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
              label: t("commitHistory"),
              children: <CommitHistory commits={commits} onSelectCommit={handleSelectCommit} />
            },
            {
              key: "remotes",
              label: t("remote"),
              children: renderRemotePanel()
            },
            {
              key: "logs",
              label: t("operationLog"),
              children: <OperationLog logs={logs} onClear={clearLogs} />
            }
          ]}
        />
      </div>
    </div>
  );

  return (
    <ConfigProvider
      locale={language === "zh-CN" ? zhCN : enUS}
      theme={{
        algorithm: theme === "dark" ? antdTheme.darkAlgorithm : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: theme === "dark" ? "#56c5b5" : "#0f766e",
          colorInfo: theme === "dark" ? "#56c5b5" : "#0f766e",
          colorLink: theme === "dark" ? "#7ad7c9" : "#0f766e",
          colorText: theme === "dark" ? "#e7f0ee" : "#1f2b2b",
          colorTextSecondary: theme === "dark" ? "#9eb1ac" : "#6b7a78",
          colorBorder: theme === "dark" ? "#334641" : "#d9e4e1",
          colorBgLayout: theme === "dark" ? "#121817" : "#f2f5f4",
          colorBgContainer: theme === "dark" ? "#19211f" : "#ffffff",
          colorBgElevated: theme === "dark" ? "#202b28" : "#ffffff",
          borderRadius: 7,
          fontFamily: '"Avenir Next", "Segoe UI Variable", "Segoe UI", -apple-system, BlinkMacSystemFont, sans-serif'
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
            language={language}
            theme={theme}
            onLanguageChange={setLanguage}
            onThemeChange={setTheme}
            onOpenRepo={handleOpenDirectory}
            onCloneRepo={() => setCloneOpen(true)}
            onPull={() => runGitAction(t("pull"), () => gitApi.pull(repoInfo!.path), t("actionCompleted", { label: t("pull") }))}
            onPush={() => runGitAction(t("push"), () => gitApi.push(repoInfo!.path), t("actionCompleted", { label: t("push") }))}
            onRefresh={() => refreshRepository()}
          />
        </Header>

        <Layout className="app-body">
          <Sider width={292} className="app-sider">
            <Sidebar
              repoInfo={repoInfo}
              recentRepos={recentRepos}
              branches={branches}
              busy={busy}
              onOpenRecent={openRepoByPath}
              onCreateBranch={() => setCreateBranchOpen(true)}
              onCheckoutBranch={handleCheckoutBranch}
              onCheckoutRemoteBranch={handleCheckoutRemoteBranch}
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
        title={t("commitDetail")}
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
              <Typography.Text type="secondary">{formatDate(commitDetail.date, language)}</Typography.Text>
            </Space>
            <Typography.Title level={5}>{commitDetail.message}</Typography.Title>
            {commitDetail.body && <Typography.Paragraph>{commitDetail.body}</Typography.Paragraph>}
            <Table<CommitFile>
              rowKey={(record) => `${record.status}:${record.path}`}
              size="small"
              columns={createCommitFileColumns(language, t)}
              dataSource={commitDetail.files}
              pagination={false}
            />
          </Space>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("noCommitDetail")} />
        )}
      </Modal>
    </ConfigProvider>
  );
}

export default App;
