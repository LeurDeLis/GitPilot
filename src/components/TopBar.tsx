import {
  BranchesOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
  DownOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  GlobalOutlined,
  MoonOutlined,
  ReloadOutlined,
  SunOutlined
} from "@ant-design/icons";
import { Button, Dropdown, Space, Tag, Tooltip, Typography } from "antd";
import type { MenuProps } from "antd";
import type { Language } from "../i18n";
import { useI18n } from "../i18n";
import type { ThemeMode } from "../theme";
import type { RepoInfo } from "../types/git";
import appIcon from "../icon/app_icon.png";

type TopBarProps = {
  repoInfo?: RepoInfo;
  busy: boolean;
  language: Language;
  theme: ThemeMode;
  onLanguageChange(language: Language): void;
  onThemeChange(theme: ThemeMode): void;
  onOpenRepo(): void;
  onCloneRepo(): void;
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
  onPull,
  onPush,
  onRefresh
}: TopBarProps) {
  const { t } = useI18n();

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
      default:
        break;
    }
  };

  return (
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
  );
}
