import { Form, Input, Modal } from "antd";
import { useEffect } from "react";

type CreateBranchDialogProps = {
  open: boolean;
  busy?: boolean;
  onCancel(): void;
  onSubmit(branchName: string): Promise<void>;
};

export function CreateBranchDialog({
  open,
  busy,
  onCancel,
  onSubmit
}: CreateBranchDialogProps) {
  const [form] = Form.useForm<{ branchName: string }>();

  useEffect(() => {
    if (!open) {
      form.resetFields();
    }
  }, [form, open]);

  const submit = async () => {
    const values = await form.validateFields();
    await onSubmit(values.branchName.trim());
  };

  return (
    <Modal
      title="创建分支"
      open={open}
      onCancel={onCancel}
      onOk={submit}
      confirmLoading={busy}
      okText="创建"
      cancelText="取消"
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="branchName"
          label="分支名"
          rules={[
            { required: true, message: "分支名不能为空" },
            { whitespace: true, message: "分支名不能为空" },
            {
              pattern: /^[^\s~^:?*[\\]+$/,
              message: "分支名包含非法字符"
            }
          ]}
        >
          <Input placeholder="feature/new-panel" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
