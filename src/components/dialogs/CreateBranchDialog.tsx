import { Form, Input, Modal } from "antd";
import { useEffect } from "react";
import { useI18n } from "../../i18n";

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
  const { t } = useI18n();

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
      title={t("createBranch")}
      open={open}
      onCancel={onCancel}
      onOk={submit}
      confirmLoading={busy}
      okText={t("createBranch")}
      cancelText={t("cancel")}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="branchName"
          label={t("branchName")}
          rules={[
            { required: true, message: t("branchNameRequired") },
            { whitespace: true, message: t("branchNameRequired") },
            {
              pattern: /^[^\s~^:?*[\\]+$/,
              message: t("branchNameInvalid")
            }
          ]}
        >
          <Input placeholder="feature/new-panel" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
