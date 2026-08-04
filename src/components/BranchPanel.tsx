import {
  DeleteOutlined,
  GitlabOutlined,
  PlusOutlined,
  RetweetOutlined,
  SwapOutlined
} from "@ant-design/icons";
import { Button, Empty, List, Space, Tag, Tooltip, Typography } from "antd";
import { useI18n } from "../i18n";
import type { BranchInfo } from "../types/git";

type BranchPanelProps = {
  branches: BranchInfo;
  currentBranch?: string;
  onCreateBranch(): void;
  onCheckoutBranch(branchName: string): void;
  onDeleteBranch(branchName: string): void;
  onMerge(): void;
};

export function BranchPanel({
  branches,
  currentBranch,
  onCreateBranch,
  onCheckoutBranch,
  onDeleteBranch,
  onMerge
}: BranchPanelProps) {
  const { t } = useI18n();

  return (
    <div className="branch-panel">
      <div className="section-title-row">
        <Typography.Text strong>{t("localBranches")}</Typography.Text>
        <Space size={4}>
          <Tooltip title={t("createBranch")}>
            <Button size="small" icon={<PlusOutlined />} onClick={onCreateBranch} />
          </Tooltip>
          <Tooltip title={t("mergeBranchIntoCurrent")}>
            <Button size="small" icon={<RetweetOutlined />} onClick={onMerge} />
          </Tooltip>
        </Space>
      </div>

      {branches.local.length > 0 ? (
        <List
          className="compact-list"
          dataSource={branches.local}
          renderItem={(branch) => {
            const active = branch === currentBranch || branch === branches.current;
            return (
              <List.Item
                className={active ? "branch-item active" : "branch-item"}
                actions={[
                  <Tooltip title={t("switchBranch")} key="checkout">
                    <Button
                      size="small"
                      type="text"
                      icon={<SwapOutlined />}
                      disabled={active}
                      onClick={() => onCheckoutBranch(branch)}
                    />
                  </Tooltip>,
                  <Tooltip title={t("deleteLocalBranch")} key="delete">
                    <Button
                      size="small"
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      disabled={active}
                      onClick={() => onDeleteBranch(branch)}
                    />
                  </Tooltip>
                ]}
              >
                <Space size={6}>
                  <GitlabOutlined />
                  <Typography.Text ellipsis>{branch}</Typography.Text>
                  {active && <Tag color="processing">{t("current")}</Tag>}
                </Space>
              </List.Item>
            );
          }}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("noLocalBranches")} />
      )}

      <Typography.Text strong className="remote-branch-title">
        {t("remoteBranches")}
      </Typography.Text>
      {branches.remote.length > 0 ? (
        <List
          className="compact-list"
          dataSource={branches.remote}
          renderItem={(branch) => (
            <List.Item className="branch-item remote">
              <Space size={6}>
                <GitlabOutlined />
                <Typography.Text ellipsis>{branch}</Typography.Text>
              </Space>
            </List.Item>
          )}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("noRemoteBranches")} />
      )}
    </div>
  );
}
