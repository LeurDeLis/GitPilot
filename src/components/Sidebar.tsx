import { ClockCircleOutlined, FolderOpenOutlined } from "@ant-design/icons";
import { Button, Divider, Empty, List, Space, Tooltip, Typography } from "antd";
import { BranchPanel } from "./BranchPanel";
import type { BranchInfo, RepoInfo } from "../types/git";

type SidebarProps = {
  repoInfo?: RepoInfo;
  recentRepos: RepoInfo[];
  branches: BranchInfo;
  onOpenRecent(repoPath: string): void;
  onCreateBranch(): void;
  onCheckoutBranch(branchName: string): void;
  onDeleteBranch(branchName: string): void;
  onMerge(): void;
};

export function Sidebar({
  repoInfo,
  recentRepos,
  branches,
  onOpenRecent,
  onCreateBranch,
  onCheckoutBranch,
  onDeleteBranch,
  onMerge
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="section-title-row">
        <Space size={6}>
          <ClockCircleOutlined />
          <Typography.Text strong>最近仓库</Typography.Text>
        </Space>
      </div>
      {recentRepos.length > 0 ? (
        <List
          className="recent-list"
          dataSource={recentRepos}
          renderItem={(repo) => {
            const active = repo.path === repoInfo?.path;
            return (
              <List.Item className={active ? "recent-item active" : "recent-item"}>
                <button className="recent-button" onClick={() => onOpenRecent(repo.path)}>
                  <span className="recent-name">{repo.name}</span>
                  <span className="recent-path">{repo.path}</span>
                </button>
                <Tooltip title="打开">
                  <Button
                    size="small"
                    icon={<FolderOpenOutlined />}
                    type="text"
                    onClick={() => onOpenRecent(repo.path)}
                  />
                </Tooltip>
              </List.Item>
            );
          }}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无最近仓库" />
      )}

      <Divider />

      {repoInfo ? (
        <BranchPanel
          branches={branches}
          currentBranch={repoInfo.currentBranch}
          onCreateBranch={onCreateBranch}
          onCheckoutBranch={onCheckoutBranch}
          onDeleteBranch={onDeleteBranch}
          onMerge={onMerge}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="打开仓库后显示分支" />
      )}
    </aside>
  );
}
