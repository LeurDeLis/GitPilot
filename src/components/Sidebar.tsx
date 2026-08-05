import { ClockCircleOutlined, DeleteOutlined, FolderOpenOutlined } from "@ant-design/icons";
import { Button, Divider, Empty, List, Space, Tooltip, Typography } from "antd";
import { useI18n } from "../i18n";
import { BranchPanel } from "./BranchPanel";
import type { BranchInfo, RepoInfo } from "../types/git";

type SidebarProps = {
  repoInfo?: RepoInfo;
  recentRepos: RepoInfo[];
  branches: BranchInfo;
  busy: boolean;
  onOpenRecent(repoPath: string): void;
  onRemoveRecent(repo: RepoInfo): void;
  onCreateBranch(): void;
  onCheckoutBranch(branchName: string): void;
  onCheckoutRemoteBranch(branchName: string): void;
  onDeleteBranch(branchName: string): void;
  onMerge(): void;
};

export function Sidebar({
  repoInfo,
  recentRepos,
  branches,
  busy,
  onOpenRecent,
  onRemoveRecent,
  onCreateBranch,
  onCheckoutBranch,
  onCheckoutRemoteBranch,
  onDeleteBranch,
  onMerge
}: SidebarProps) {
  const { t } = useI18n();

  return (
    <aside className="sidebar">
      <div className="section-title-row">
        <Space size={6}>
          <ClockCircleOutlined />
          <Typography.Text strong>{t("recentRepositories")}</Typography.Text>
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
                <div className="recent-actions">
                  <Tooltip title={t("open")}>
                    <Button
                      aria-label={t("open")}
                      disabled={busy}
                      size="small"
                      icon={<FolderOpenOutlined />}
                      type="text"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenRecent(repo.path);
                      }}
                    />
                  </Tooltip>
                  <Tooltip title={t("removeRecentRepoTooltip")}>
                    <Button
                      aria-label={t("removeRecentRepoTooltip")}
                      danger
                      disabled={busy}
                      size="small"
                      icon={<DeleteOutlined />}
                      type="text"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRemoveRecent(repo);
                      }}
                    />
                  </Tooltip>
                </div>
              </List.Item>
            );
          }}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("noRecentRepositories")} />
      )}

      <Divider />

      {repoInfo ? (
        <BranchPanel
          branches={branches}
          currentBranch={repoInfo.currentBranch}
          busy={busy}
          onCreateBranch={onCreateBranch}
          onCheckoutBranch={onCheckoutBranch}
          onCheckoutRemoteBranch={onCheckoutRemoteBranch}
          onDeleteBranch={onDeleteBranch}
          onMerge={onMerge}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("openRepositoryToSeeBranches")} />
      )}
    </aside>
  );
}
