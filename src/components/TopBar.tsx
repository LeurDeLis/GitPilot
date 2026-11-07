import {
  BranchesOutlined,
  EditOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
  DownOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  GithubOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  MoonOutlined,
  ReloadOutlined,
  SunOutlined
} from "@ant-design/icons";
import { Alert, Button, Dropdown, Modal, Progress, Space, Tag, Tooltip, Typography } from "antd";
import { useEffect, useState } from "react";
import { gitApi } from "../api/gitApi";
import type { MenuProps } from "antd";
import type { Language } from "../i18n";
import { useI18n } from "../i18n";
import type { ThemeMode } from "../theme";
import type { AppUpdateState, RepoInfo } from "../types/git";
import { ExternalEditorButton } from "./ExternalEditorButton";
import appIcon from "../icon/app_icon.png";
import { useNotification } from "./NotificationCenter";

type TopBarProps = {
  repoInfo?: RepoInfo;
  busy: boolean;
  language: Language;
  theme: ThemeMode;
  onLanguageChange(language: Language): void;
  onThemeChange(theme: ThemeMode): void;
  onOpenRepo(): void;
  onCloneRepo(): void;
  onEditCode(): void;
  onPull(): void;
  onPush(): void;
  onRefresh(): void;
};

export function TopBar({
  repoInfo,
  busy,
  language,
  theme,
  onLanguageChange,
  onThemeChange,
  onOpenRepo,
  onCloneRepo,
  onEditCode,
  onPull,
  onPush,
  onRefresh
}: TopBarProps) {
  const { t } = useI18n();
  const notify = useNotification();
  const [aboutOpen, setAboutOpen] = useState(false);
  const [appVersion, setAppVersion] = useState("");
  const [updateState, setUpdateState] = useState<AppUpdateState>({ status: "idle" });
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  useEffect(() => gitApi.onUpdateState((next) => {
    setUpdateState(next);
    if (next.status === "downloaded") {
      notify.success(t("updateReadyNotification", { version: next.version || "" }), t("updateReadyTitle"));
    }
  }), [notify, t]);

  useEffect(() => {
    if (!aboutOpen) return;
    let active = true;
    void (async () => {
      try {
        const [version, state] = await Promise.all([gitApi.getAppVersion(), gitApi.getUpdateState()]);
        if (active) { setAppVersion(version); setUpdateState(state); }
      } catch (error) {
        if (active) setUpdateState({ status: "error", message: error instanceof Error ? error.message : String(error) });
      }
    })();
    return () => { active = false; };
  }, [aboutOpen]);

  const checkUpdates = async () => {
    setCheckingUpdate(true);
    try { await gitApi.checkForUpdates(); }
    catch (error) { setUpdateState({ status: "error", message: error instanceof Error ? error.message : String(error) }); }
    finally { setCheckingUpdate(false); }
  };

  const openProject = async () => {
    try { await gitApi.openProjectPage(); }
    catch (error) { notify.error(error instanceof Error ? error.message : String(error), t("externalLinkFailed")); }
  };

  const openReleases = async () => {
    try { await gitApi.openReleasesPage(); }
    catch (error) { notify.error(error instanceof Error ? error.message : String(error), t("externalLinkFailed")); }
  };

  const installDownloadedUpdate = async () => {
    try { await gitApi.installUpdate(); }
    catch (error) { notify.error(error instanceof Error ? error.message : String(error), t("updateInstallFailed")); }
  };

  const updateMessage = (() => {
    switch (updateState.status) {
      case "checking": return t("updateChecking");
      case "available": return t("updateAvailable", { version: updateState.version || "" });
      case "not-available": return t("updateNotAvailable");
      case "downloading": return t("updateDownloading", { percent: updateState.percent || 0 });
      case "downloaded": return t("updateDownloaded", { version: updateState.version || "" });
      case "error": return updateState.message === "missing-update-metadata"
        ? t("updateMetadataMissing")
        : t("updateCheckFailed");
      case "unsupported": return t("updateUnsupported");
      default: return t("updateIdle");
    }
  })();
  const updateAlertType = updateState.status === "error" ? "error"
    : updateState.status === "unsupported" ? "warning"
      : updateState.status === "downloaded" || updateState.status === "not-available" ? "success" : "info";
  const updateBusy = checkingUpdate || updateState.status === "checking" || updateState.status === "available" || updateState.status === "downloading";

  const menuItems: MenuProps["items"] = [
    {
      key: "menu-open",
      icon: <FolderOpenOutlined />,
      label: t("openRepository")
    },
    {
      key: "menu-clone",
      icon: <CloudDownloadOutlined />,
      label: t("cloneRepository")
    },
    { type: "divider" },
    {
      key: "menu-theme",
      icon: theme === "dark" ? <MoonOutlined /> : <SunOutlined />,
      label: t("theme"),
      children: [
        { key: "theme-light", icon: <SunOutlined />, label: t("lightTheme") },
        { key: "theme-dark", icon: <MoonOutlined />, label: t("darkTheme") }
      ]
    },
    {
      key: "menu-language",
      icon: <GlobalOutlined />,
      label: t("language"),
      children: [
        { key: "language-zh-CN", label: t("languageChinese") },
        { key: "language-en-US", label: "EN" }
      ]
    },
    { type: "divider" },
    {
      key: "menu-about",
      icon: <InfoCircleOutlined />,
      label: t("about")
    },
    { type: "divider" },
    {
      key: "menu-refresh",
      icon: <ReloadOutlined />,
      label: t("refresh"),
      disabled: !repoInfo || busy
    }
  ];

  const handleMenuClick: MenuProps["onClick"] = ({ key }) => {
    switch (key) {
      case "menu-open":
        onOpenRepo();
        break;
      case "menu-clone":
        onCloneRepo();
        break;
      case "theme-light":
        onThemeChange("light");
        break;
      case "theme-dark":
        onThemeChange("dark");
        break;
      case "language-zh-CN":
        onLanguageChange("zh-CN");
        break;
      case "language-en-US":
        onLanguageChange("en-US");
        break;
      case "menu-refresh":
        onRefresh();
        break;
      case "menu-about":
        setAboutOpen(true);
        break;
      default:
        break;
    }
  };

  return (
    <>
    <div className="topbar">
      <Dropdown
        trigger={["click"]}
        placement="bottomLeft"
        menu={{
          items: menuItems,
          onClick: handleMenuClick,
          selectedKeys: [
            theme === "dark" ? "theme-dark" : "theme-light",
            language === "en-US" ? "language-en-US" : "language-zh-CN"
          ]
        }}
      >
        <Button type="text" className="app-brand-menu" aria-label={t("appMenu")} title={t("appMenu")}>
          <span className="app-brand-mark" aria-hidden="true">
            <img src={appIcon} alt="" />
          </span>
          <span className="app-brand-copy">
            <span className="app-brand-name">GitPilot</span>
            <span className="app-brand-caption">{t("appMenu")}</span>
          </span>
          <DownOutlined className="app-brand-chevron" />
        </Button>
      </Dropdown>

      <Space size={8} className="topbar-repository-actions">
        <Tooltip title={t("openLocalRepository")}>
          <Button icon={<FolderOpenOutlined />} onClick={onOpenRepo}>
            {t("openRepository")}
          </Button>
        </Tooltip>
        <Tooltip title={t("cloneRemoteRepository")}>
          <Button icon={<CloudDownloadOutlined />} onClick={onCloneRepo}>
            {t("clone")}
          </Button>
        </Tooltip>
      </Space>

      <div className="topbar-repo">
        {repoInfo ? (
          <>
            <Typography.Text strong className="repo-name">
              {repoInfo.name}
            </Typography.Text>
            <Typography.Text type="secondary" ellipsis className="repo-path">
              {repoInfo.path}
            </Typography.Text>
            <Tag icon={<BranchesOutlined />} color="blue">
              {repoInfo.currentBranch}
            </Tag>
            {repoInfo.ahead > 0 && <Tag color="green">{t("branchAhead", { count: repoInfo.ahead })}</Tag>}
            {repoInfo.behind > 0 && <Tag color="orange">{t("branchBehind", { count: repoInfo.behind })}</Tag>}
          </>
        ) : (
          <Typography.Text type="secondary">{t("noRepository")}</Typography.Text>
        )}
      </div>

      <Space size={8} className="topbar-editor-actions">
        <Button icon={<EditOutlined />} aria-label={t("codeEditor")} disabled={!repoInfo || busy} onClick={onEditCode}>{t("codeEditor")}</Button>
        <ExternalEditorButton repoPath={repoInfo?.path} disabled={busy} />
      </Space>

      <Space size={8} className="topbar-actions">
        <Tooltip title="git pull">
          <Button
            icon={<DownloadOutlined />}
            disabled={!repoInfo}
            loading={busy}
            onClick={onPull}
          >
            {t("pull")}
          </Button>
        </Tooltip>
        <Tooltip title="git push">
          <Button
            icon={<CloudUploadOutlined />}
            disabled={!repoInfo}
            loading={busy}
            onClick={onPush}
          >
            {t("push")}
          </Button>
        </Tooltip>
        <Tooltip title={t("refreshStatus")}>
          <Button
            icon={<ReloadOutlined />}
            disabled={!repoInfo}
            loading={busy}
            onClick={onRefresh}
          >
            {t("refresh")}
          </Button>
        </Tooltip>
      </Space>
    </div>
    <Modal open={aboutOpen} title={t("about")} footer={null} width={480} onCancel={() => setAboutOpen(false)}>
      <div className="about-modal-content">
        <div className="about-heading">
          <img src={appIcon} alt="" />
          <div>
            <Typography.Title level={4}>GitPilot</Typography.Title>
            <Typography.Text type="secondary">{t("appVersion")}: {appVersion ? `v${appVersion}` : "..."}</Typography.Text>
          </div>
        </div>
        <Button type="link" icon={<GithubOutlined />} className="about-project-link" onClick={() => void openProject()}>
          {t("projectSource")}
        </Button>
        <div className="about-update-section">
          <Typography.Text strong>{t("updates")}</Typography.Text>
          <Alert showIcon type={updateAlertType} message={updateMessage} />
          {updateState.status === "downloading" && <Progress percent={updateState.percent || 0} size="small" status="active" />}
          <div className="about-update-actions">
            {updateState.status !== "unsupported" && <Button icon={<ReloadOutlined />} loading={updateBusy} disabled={updateBusy || updateState.status === "downloaded"} onClick={() => void checkUpdates()}>
              {t("checkForUpdates")}
            </Button>}
            <Button icon={<DownloadOutlined />} onClick={() => void openReleases()}>{t("downloadManually")}</Button>
            {updateState.status === "downloaded" && <Button type="primary" icon={<ReloadOutlined />} onClick={() => void installDownloadedUpdate()}>
              {t("installUpdateNow")}
            </Button>}
          </div>
        </div>
      </div>
    </Modal>
    </>
  );
}
