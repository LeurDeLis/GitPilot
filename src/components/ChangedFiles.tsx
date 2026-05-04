import {
  CheckSquareOutlined,
  ClearOutlined,
  DownloadOutlined,
  ReloadOutlined,
  RollbackOutlined,
  UploadOutlined,
  VerticalAlignBottomOutlined,
  VerticalAlignTopOutlined
} from "@ant-design/icons";
import { Alert, Button, Empty, Space, Table, Tag, Tooltip, Typography } from "antd";
import type { ColumnsType } from "antd/es/table";
import type { ChangedFile, GitStatus } from "../types/git";
import { statusColor, statusText } from "../utils/format";

type ChangedFilesProps = {
  status?: GitStatus;
  selectedFiles: string[];
  busy?: boolean;
  onSelectionChange(files: string[]): void;
  onRefresh(): void;
  onStage(files: string[]): void;
  onUnstage(files: string[]): void;
  onDiscard(files: string[]): void;
};

export function ChangedFiles({
  status,
  selectedFiles,
  busy,
  onSelectionChange,
  onRefresh,
  onStage,
  onUnstage,
  onDiscard
}: ChangedFilesProps) {
  const files = status?.files ?? [];
  const hasConflicts = Boolean(status?.hasConflicts);

  const stagedFiles = files.filter((f) => f.staged);
  const unstagedFiles = files.filter((f) => !f.staged);

  const selectedStagedFiles = selectedFiles.filter((p) => stagedFiles.some((f) => f.path === p));
  const selectedUnstagedFiles = selectedFiles.filter((p) => unstagedFiles.some((f) => f.path === p));

  const columns: ColumnsType<ChangedFile> = [
    {
      title: "状态",
      dataIndex: "status",
      width: 92,
      render: (s: ChangedFile["status"]) => (
        <Tag color={statusColor(s)}>{statusText(s)}</Tag>
      )
    },
    {
      title: "文件",
      dataIndex: "path",
      render: (_value, record) => (
        <div className="file-cell">
          <span className="file-name" title={record.path}>{record.path}</span>
          {record.originalPath && (
            <span className="file-original" title={record.originalPath}>
              原路径：{record.originalPath}
            </span>
          )}
        </div>
      )
    },
    {
      title: "暂存",
      dataIndex: "staged",
      width: 80,
      align: "center",
      render: (staged: boolean) => staged ? <Tag color="green">是</Tag> : <Tag>否</Tag>
    },
    {
      title: "操作",
      width: 104,
      align: "center",
      render: (_value, record) => (
        <Space size={2}>
          {record.staged ? (
          <Tooltip title="取消暂存">
            <Button
              type="text"
              size="small"
              icon={<VerticalAlignBottomOutlined />}
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onUnstage([record.path]);
              }}
            />
          </Tooltip>
        ) : (
          <Tooltip title="暂存文件">
            <Button
              type="text"
              size="small"
              icon={<VerticalAlignTopOutlined />}
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onStage([record.path]);
              }}
            />
          </Tooltip>
        )}
          <Tooltip title="回滚文件变更">
            <Button
              type="text"
              size="small"
              danger
              icon={<RollbackOutlined />}
              disabled={busy}
              onClick={(e) => {
                e.stopPropagation();
                onDiscard([record.path]);
              }}
            />
          </Tooltip>
        </Space>
      )
    }
  ];

  return (
    <section className="panel changed-files">
      <div className="panel-header">
        <div>
          <Typography.Title level={4}>文件变更</Typography.Title>
          <Typography.Text type="secondary">
            {status ? `${files.length} 个变更文件` : "等待加载仓库状态"}
          </Typography.Text>
        </div>
        <Space size={8}>
          <Tooltip title="暂存选中文件">
            <Button
              icon={<UploadOutlined />}
              disabled={selectedUnstagedFiles.length === 0 || busy}
              onClick={() => onStage(selectedUnstagedFiles)}
            />
          </Tooltip>
          <Tooltip title="取消暂存选中文件">
            <Button
              icon={<DownloadOutlined />}
              disabled={selectedStagedFiles.length === 0 || busy}
              onClick={() => onUnstage(selectedStagedFiles)}
            />
          </Tooltip>
          <Tooltip title="回滚选中文件变更">
            <Button
              danger
              icon={<RollbackOutlined />}
              disabled={selectedFiles.length === 0 || busy}
              onClick={() => onDiscard(selectedFiles)}
            />
          </Tooltip>
          <Tooltip title="选择全部文件">
            <Button
              icon={<CheckSquareOutlined />}
              disabled={files.length === 0}
              onClick={() => onSelectionChange(files.map((file) => file.path))}
            />
          </Tooltip>
          <Tooltip title="清空选择">
            <Button
              icon={<ClearOutlined />}
              disabled={selectedFiles.length === 0}
              onClick={() => onSelectionChange([])}
            />
          </Tooltip>
          <Tooltip title="刷新状态">
            <Button icon={<ReloadOutlined />} onClick={onRefresh} />
          </Tooltip>
        </Space>
      </div>

      {hasConflicts && (
        <Alert
          type="error"
          showIcon
          className="conflict-alert"
          message="当前仓库存在合并冲突，请手动解决冲突文件后再提交。"
        />
      )}

      {files.length > 0 ? (
        <div className="changed-files-table-wrapper">
          <Table<ChangedFile>
            rowKey="path"
            size="middle"
            columns={columns}
            dataSource={files}
            pagination={false}
            tableLayout="auto"
            rowSelection={{
              selectedRowKeys: selectedFiles,
              onChange: (keys) => onSelectionChange(keys.map(String))
            }}
          />
        </div>
      ) : (
        <Empty
          className="empty-state"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={status?.isClean ? "工作区干净" : "暂无变更"}
        />
      )}
    </section>
  );
}
