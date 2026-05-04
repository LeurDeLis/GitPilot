import { Form, Modal, Select } from "antd";
import { useEffect } from "react";

type MergeDialogProps = {
  open: boolean;
  currentBranch?: string;
  branches: string[];
  busy?: boolean;
  onCancel(): void;
  onSubmit(branchName: string): Promise<void>;
};

export function MergeDialog({
  open,
  currentBranch,
  branches,
  busy,
  onCancel,
  onSubmit
}: MergeDialogProps) {
  const [form] = Form.useForm<{ branchName: string }>();
  const options = branches
    .filter((branch) => branch && branch !== currentBranch)
    .map((branch) => ({ label: branch, value: branch }));

  useEffect(() => {
    if (!open) {
      form.resetFields();
    }
  }, [form, open]);

  const submit = async () => {
    const values = await form.validateFields();
    await onSubmit(values.branchName);
  };

  return (
    <Modal
      title="合并分支"
      open={open}
      onCancel={onCancel}
      onOk={submit}
      confirmLoading={busy}
      okText="执行合并"
      cancelText="取消"
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="branchName"
          label="选择要合并到当前分支的目标分支"
          rules={[{ required: true, message: "请选择分支" }]}
        >
          <Select showSearch options={options} placeholder="选择分支" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
