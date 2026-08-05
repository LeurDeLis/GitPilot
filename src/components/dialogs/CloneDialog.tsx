import { FolderOpenOutlined } from "@ant-design/icons";
import { Button, Form, Input, Modal, Space } from "antd";
import { useEffect } from "react";
import { useI18n } from "../../i18n";
import { deriveRepoName } from "../../utils/format";

type CloneDialogProps = {
  open: boolean;
  busy?: boolean;
  onCancel(): void;
  onSelectDirectory(): Promise<string | undefined>;
  onSubmit(repoUrl: string, targetDir: string): Promise<void>;
};

export function CloneDialog({
  open,
  busy,
  onCancel,
  onSelectDirectory,
  onSubmit
}: CloneDialogProps) {
  const [form] = Form.useForm<{ repoUrl: string; targetDir: string }>();
  const repoUrl = Form.useWatch("repoUrl", form);
  const { t } = useI18n();

  useEffect(() => {
    if (!open) {
      form.resetFields();
    }
  }, [form, open]);

  const chooseTarget = async () => {
    const directory = await onSelectDirectory();
    if (!directory) {
      return;
    }
    const separator = directory.includes("\\") ? "\\" : "/";
    const repoName = deriveRepoName(repoUrl || "");
    form.setFieldValue("targetDir", `${directory}${separator}${repoName}`);
  };

  const submit = async () => {
    const values = await form.validateFields();
    await onSubmit(values.repoUrl.trim(), values.targetDir.trim());
  };

  return (
    <Modal
      title={t("cloneRepository")}
      open={open}
      onCancel={onCancel}
      onOk={submit}
      confirmLoading={busy}
      okText={t("startClone")}
      cancelText={t("cancel")}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="repoUrl"
          label={t("cloneUrl")}
          rules={[
            { required: true, message: t("repoUrlRequired") },
            { whitespace: true, message: t("repoUrlEmpty") }
          ]}
        >
          <Input placeholder="https://github.com/user/repo.git or git@github.com:user/repo.git" />
        </Form.Item>
        <Form.Item
          label={t("targetDirectory")}
        >
          <Space.Compact className="full-width">
            <Form.Item
              name="targetDir"
              noStyle
              rules={[
                { required: true, message: t("targetDirectoryRequired") },
                { whitespace: true, message: t("targetDirectoryEmpty") }
              ]}
            >
              <Input placeholder="D:\\Projects\\repo" />
            </Form.Item>
            <Button icon={<FolderOpenOutlined />} onClick={chooseTarget}>
              {t("chooseParentDirectory")}
            </Button>
          </Space.Compact>
        </Form.Item>
      </Form>
    </Modal>
  );
}
