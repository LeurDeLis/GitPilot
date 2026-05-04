import { Form, Input, Modal } from "antd";
import { useEffect } from "react";
import type { RemoteInfo } from "../../types/git";

type RemoteDialogProps = {
  open: boolean;
  mode: "add" | "edit";
  remote?: RemoteInfo;
  busy?: boolean;
  onCancel(): void;
  onSubmit(name: string, url: string): Promise<void>;
};

export function RemoteDialog({
  open,
  mode,
  remote,
  busy,
  onCancel,
  onSubmit
}: RemoteDialogProps) {
  const [form] = Form.useForm<{ name: string; url: string }>();

  useEffect(() => {
    if (open) {
      form.setFieldsValue({
        name: remote?.name ?? "",
        url: remote?.url ?? ""
      });
    } else {
      form.resetFields();
    }
  }, [form, open, remote]);

  const submit = async () => {
    const values = await form.validateFields();
    await onSubmit(values.name.trim(), values.url.trim());
  };

  return (
    <Modal
      title={mode === "add" ? "新增 remote" : "修改 remote URL"}
      open={open}
      onCancel={onCancel}
      onOk={submit}
      confirmLoading={busy}
      okText={mode === "add" ? "新增" : "保存"}
      cancelText="取消"
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label="Remote 名称"
          rules={[
            { required: true, message: "Remote 名称不能为空" },
            { pattern: /^[A-Za-z0-9._-]+$/, message: "Remote 名称只能包含字母、数字、点、下划线或短横线" }
          ]}
        >
          <Input disabled={mode === "edit"} placeholder="origin" />
        </Form.Item>
        <Form.Item
          name="url"
          label="Remote URL"
          rules={[
            { required: true, message: "Remote URL 不能为空" },
            { whitespace: true, message: "Remote URL 不能为空" }
          ]}
        >
          <Input placeholder="https://github.com/user/repo.git" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
