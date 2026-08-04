import { ClearOutlined } from "@ant-design/icons";
import { Button, Space, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useI18n } from "../i18n";
import type { OperationLogItem } from "../types/git";
import { formatDate, operationText } from "../utils/format";

type OperationLogProps = {
  logs: OperationLogItem[];
  onClear(): void;
};

export function OperationLog({ logs, onClear }: OperationLogProps) {
  const { language, t } = useI18n();

  const columns: ColumnsType<OperationLogItem> = [
    {
      title: t("time"),
      dataIndex: "time",
      width: 154,
      render: (value: string) => formatDate(value, language)
    },
    {
      title: t("operation"),
      dataIndex: "operation",
      width: 132,
      render: (value: string) => <Tag>{operationText(value, language)}</Tag>
    },
    {
      title: t("status"),
      dataIndex: "success",
      width: 80,
      render: (success: boolean) => success ? <Tag color="green">{t("success")}</Tag> : <Tag color="red">{t("failed")}</Tag>
    },
    {
      title: t("command"),
      dataIndex: "command",
      ellipsis: true,
      render: (value: string) => (
        <Typography.Text className="log-command" code copyable ellipsis>
          {value}
        </Typography.Text>
      )
    }
  ];

  return (
    <div className="log-panel">
      <div className="tab-toolbar">
        <Typography.Text type="secondary">{t("keepRecentLogs")}</Typography.Text>
        <Tooltip title={t("clearLog")}>
          <Button size="small" icon={<ClearOutlined />} onClick={onClear} />
        </Tooltip>
      </div>
      <Table<OperationLogItem>
        className="operation-log-table"
        rowKey="id"
        size="small"
        columns={columns}
        dataSource={logs}
        pagination={false}
        tableLayout="fixed"
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
