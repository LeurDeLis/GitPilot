import { HistoryOutlined } from "@ant-design/icons";
import { Empty, List, Space, Typography } from "antd";
import type { CommitItem } from "../types/git";
import { formatDate } from "../utils/format";

type CommitHistoryProps = {
  commits: CommitItem[];
  onSelectCommit(commit: CommitItem): void;
};

export function CommitHistory({ commits, onSelectCommit }: CommitHistoryProps) {
  return (
    <div className="history-panel">
      {commits.length > 0 ? (
        <List
          className="history-list"
          dataSource={commits}
          renderItem={(commit) => (
            <List.Item className="history-item" onClick={() => onSelectCommit(commit)}>
              <div className="history-line">
                <Space size={6}>
                  <HistoryOutlined />
                  <Typography.Text code>{commit.shortHash}</Typography.Text>
                </Space>
                <Typography.Text className="history-message" ellipsis>
                  {commit.message}
                </Typography.Text>
                <Typography.Text type="secondary" className="history-meta">
                  {commit.author} · {formatDate(commit.date)}
                </Typography.Text>
              </div>
            </List.Item>
          )}
        />
      ) : (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无提交历史" />
      )}
    </div>
  );
}
