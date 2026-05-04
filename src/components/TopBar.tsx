import {
  BranchesOutlined,
  CloudDownloadOutlined,
  CloudUploadOutlined,
  DownloadOutlined,
  FolderOpenOutlined,
  ReloadOutlined
} from "@ant-design/icons";
import { Button, Space, Tag, Tooltip, Typography } from "antd";
import type { RepoInfo } from "../types/git";

type TopBarProps = {
  repoInfo?: RepoInfo;
  busy: boolean;
  onOpenRepo(): void;
  onCloneRepo(): void;
  onPull(): void;
  onPush(): void;
  onRefresh(): void;
};

export function TopBar({
  repoInfo,
  busy,
  onOpenRepo,
  onCloneRepo,
  onPull,
  onPush,
  onRefresh
}: TopBarProps) {
  return (
    <div className="topbar">
      <Space size={8}>
        <Tooltip title="打开本地 Git 仓库">
          <Button icon={<FolderOpenOutlined />} onClick={onOpenRepo}>
            打开仓库
          </Button>
        </Tooltip>
        <Tooltip title="从远程地址克隆仓库">
          <Button icon={<CloudDownloadOutlined />} onClick={onCloneRepo}>
            克隆
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
            {repoInfo.ahead > 0 && <Tag color="green">领先 {repoInfo.ahead}</Tag>}
            {repoInfo.behind > 0 && <Tag color="orange">落后 {repoInfo.behind}</Tag>}
          </>
        ) : (
          <Typography.Text type="secondary">尚未打开仓库</Typography.Text>
        )}
      </div>

      <Space size={8}>
        <Tooltip title="git pull">
          <Button
            icon={<DownloadOutlined />}
            disabled={!repoInfo}
            loading={busy}
            onClick={onPull}
          >
            Pull
          </Button>
        </Tooltip>
        <Tooltip title="git push">
          <Button
            icon={<CloudUploadOutlined />}
            disabled={!repoInfo}
            loading={busy}
            onClick={onPush}
          >
            Push
          </Button>
        </Tooltip>
        <Tooltip title="刷新仓库状态">
          <Button
            icon={<ReloadOutlined />}
            disabled={!repoInfo}
            loading={busy}
            onClick={onRefresh}
          >
            Refresh
          </Button>
        </Tooltip>
      </Space>
    </div>
  );
}
