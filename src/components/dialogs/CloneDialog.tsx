import { FolderOpenOutlined } from "@ant-design/icons";
import { Button, Form, Input, Modal, Space } from "antd";
import { useEffect } from "react";
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
      title="克隆远程仓库"
      open={open}
      onCancel={onCancel}
      onOk={submit}
      confirmLoading={busy}
      okText="开始克隆"
      cancelText="取消"
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="repoUrl"
          label="Git 仓库地址"
          rules={[
            { required: true, message: "请输入 Git 仓库地址" },
            { whitespace: true, message: "Git 仓库地址不能为空" }
          ]}
        >
          <Input placeholder="https://github.com/user/repo.git 或 git@github.com:user/repo.git" />
        </Form.Item>
        <Form.Item
          name="targetDir"
          label="目标目录"
          rules={[
            { required: true, message: "请选择或输入目标目录" },
            { whitespace: true, message: "目标目录不能为空" }
          ]}
        >
          <Space.Compact className="full-width">
            <Input placeholder="例如 D:\\Projects\\repo" />
            <Button icon={<FolderOpenOutlined />} onClick={chooseTarget}>
              选择父目录
            </Button>
          </Space.Compact>
        </Form.Item>
      </Form>
    </Modal>
  );
}
