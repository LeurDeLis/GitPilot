import {
  DeleteOutlined,
  GitlabOutlined,
  PlusOutlined,
  RetweetOutlined,
  SwapOutlined
} from "@ant-design/icons";
import { Button, Empty, List, Space, Tag, Tooltip, Typography } from "antd";
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
  return (
    <div className="branch-panel">
      <div className="section-title-row">
        <Typography.Text strong>本地分支</Typography.Text>
        <Space size={4}>
          <Tooltip title="创建分支">
            <Button size="small" icon={<PlusOutlined />} onClick={onCreateBranch} />
          </Tooltip>
          <Tooltip title="合并分支到当前分支">
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
                  <Tooltip title="切换分支" key="checkout">
                    <Button
                      size="small"
                      type="text"
                      icon={<SwapOutlined />}
                      disabled={active}
                      onClick={() => onCheckoutBranch(branch)}
                    />
                  </Tooltip>,
                  <Tooltip title="删除本地分支" key="delete">
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
                  {active && <Tag color="processing">当前</Tag>}
                </Space>
              </List.Item>
            );
          }}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无本地分支" />
      )}

      <Typography.Text strong className="remote-branch-title">
        远程分支
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
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无远程分支" />
      )}
    </div>
  );
}
