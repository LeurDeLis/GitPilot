import { ClearOutlined } from "@ant-design/icons";
import { Button, Space, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { OperationLogItem } from "../types/git";
import { formatDate } from "../utils/format";

type OperationLogProps = {
  logs: OperationLogItem[];
  onClear(): void;
};

const columns: ColumnsType<OperationLogItem> = [
  {
    title: "时间",
    dataIndex: "time",
    width: 150,
    render: (value: string) => formatDate(value)
  },
  {
    title: "操作",
    dataIndex: "operation",
    width: 128,
    render: (value: string) => <Tag>{value}</Tag>
  },
  {
    title: "状态",
    dataIndex: "success",
    width: 72,
    render: (success: boolean) => success ? <Tag color="green">成功</Tag> : <Tag color="red">失败</Tag>
  },
  {
    title: "命令",
    dataIndex: "command",
    render: (value: string) => (
      <Typography.Text code copyable ellipsis>
        {value}
      </Typography.Text>
    )
  }
];

export function OperationLog({ logs, onClear }: OperationLogProps) {
  return (
    <div className="log-panel">
      <div className="tab-toolbar">
        <Typography.Text type="secondary">保留最近 300 条 Git 命令记录</Typography.Text>
        <Tooltip title="清空日志">
          <Button size="small" icon={<ClearOutlined />} onClick={onClear} />
        </Tooltip>
      </div>
      <Table<OperationLogItem>
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={logs}
        pagination={false}
        scroll={{ y: 500 }}
        expandable={{
          expandedRowRender: (record) => (
            <Space direction="vertical" size={4} className="log-detail">
              {record.repoPath && <Typography.Text type="secondary">{record.repoPath}</Typography.Text>}
              {record.error && <Typography.Text type="danger">{record.error}</Typography.Text>}
              {record.output && <pre>{record.output}</pre>}
            </Space>
          ),
          rowExpandable: (record) => Boolean(record.output || record.error || record.repoPath)
        }}
      />
    </div>
  );
}
