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
import { useI18n } from "../i18n";
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
  const { language, t } = useI18n();
  const files = status?.files ?? [];
  const hasConflicts = Boolean(status?.hasConflicts);

  const stagedFiles = files.filter((f) => f.staged);
  const unstagedFiles = files.filter((f) => !f.staged);

  const selectedStagedFiles = selectedFiles.filter((p) => stagedFiles.some((f) => f.path === p));
  const selectedUnstagedFiles = selectedFiles.filter((p) => unstagedFiles.some((f) => f.path === p));

  const columns: ColumnsType<ChangedFile> = [
    {
      title: t("status"),
      dataIndex: "status",
      width: 92,
      render: (s: ChangedFile["status"]) => (
        <Tag color={statusColor(s)}>{statusText(s, language)}</Tag>
      )
    },
    {
      title: t("changedFiles"),
      dataIndex: "path",
      render: (_value, record) => (
        <div className="file-cell">
          <span className="file-name" title={record.path}>{record.path}</span>
          {record.originalPath && (
            <span className="file-original" title={record.originalPath}>
              {t("originalPath", { path: record.originalPath })}
            </span>
          )}
        </div>
      )
    },
    {
      title: t("staged"),
      dataIndex: "staged",
      width: 80,
      align: "center",
      render: (staged: boolean) => staged ? <Tag color="green">{t("yes")}</Tag> : <Tag>{t("no")}</Tag>
    },
    {
      title: t("actions"),
      width: 104,
      align: "center",
      render: (_value, record) => (
        <Space size={2}>
          {record.staged ? (
            <Tooltip title={t("unstageFile")}>
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
            <Tooltip title={t("stageFile")}>
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
          <Tooltip title={t("discardFile")}>
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
          <Typography.Title level={4}>{t("changedFiles")}</Typography.Title>
          <Typography.Text type="secondary">
            {status ? t("changedFilesCount", { count: files.length }) : t("waitingForRepositoryStatus")}
          </Typography.Text>
        </div>
        <Space size={8}>
          <Tooltip title={t("stageSelectedFiles")}>
            <Button
              className="changed-files-action-button"
              icon={<UploadOutlined />}
              disabled={selectedUnstagedFiles.length === 0 || busy}
              onClick={() => onStage(selectedUnstagedFiles)}
            >
              {t("stageSelectedAction")}
            </Button>
          </Tooltip>
          <Tooltip title={t("unstageSelectedFiles")}>
            <Button
              className="changed-files-action-button"
              icon={<DownloadOutlined />}
              disabled={selectedStagedFiles.length === 0 || busy}
              onClick={() => onUnstage(selectedStagedFiles)}
            >
              {t("unstageSelectedAction")}
            </Button>
          </Tooltip>
          <Tooltip title={t("discardSelectedFiles")}>
            <Button
              className="changed-files-action-button"
              danger
              icon={<RollbackOutlined />}
              disabled={selectedFiles.length === 0 || busy}
              onClick={() => onDiscard(selectedFiles)}
            >
              {t("discardSelectedAction")}
            </Button>
          </Tooltip>
          <Tooltip title={t("selectAllFiles")}>
            <Button
              icon={<CheckSquareOutlined />}
              disabled={files.length === 0}
              onClick={() => onSelectionChange(files.map((file) => file.path))}
            />
          </Tooltip>
          <Tooltip title={t("clearSelection")}>
            <Button
              icon={<ClearOutlined />}
              disabled={selectedFiles.length === 0}
              onClick={() => onSelectionChange([])}
            />
          </Tooltip>
          <Tooltip title={t("refreshStatus")}>
            <Button icon={<ReloadOutlined />} onClick={onRefresh} />
          </Tooltip>
        </Space>
      </div>

      {hasConflicts && (
        <Alert
          type="error"
          showIcon
          className="conflict-alert"
          message={t("conflictAlert")}
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
          description={status?.isClean ? t("cleanWorkingTree") : t("noChanges")}
        />
      )}
    </section>
  );
}
