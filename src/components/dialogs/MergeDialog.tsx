import { Form, Modal, Select } from "antd";
import { useEffect } from "react";
import { useI18n } from "../../i18n";

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
  const { t } = useI18n();
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
      title={t("mergeBranch")}
      open={open}
      onCancel={onCancel}
      onOk={submit}
      confirmLoading={busy}
      okText={t("mergeBranch")}
      cancelText={t("cancel")}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="branchName"
          label={t("mergeTargetLabel")}
          rules={[{ required: true, message: t("selectBranchRequired") }]}
        >
          <Select showSearch options={options} placeholder={t("selectBranch")} />
        </Form.Item>
      </Form>
    </Modal>
  );
}
