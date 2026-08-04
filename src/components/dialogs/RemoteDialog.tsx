import { Form, Input, Modal } from "antd";
import { useEffect } from "react";
import { useI18n } from "../../i18n";
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
  const { t } = useI18n();

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
      title={mode === "add" ? t("addRemote") : t("editRemote")}
      open={open}
      onCancel={onCancel}
      onOk={submit}
      confirmLoading={busy}
      okText={mode === "add" ? t("add") : t("save")}
      cancelText={t("cancel")}
      destroyOnClose
    >
      <Form form={form} layout="vertical">
        <Form.Item
          name="name"
          label={t("remoteName")}
          rules={[
            { required: true, message: t("remoteNameRequired") },
            { pattern: /^[A-Za-z0-9._-]+$/, message: t("remoteNameInvalid") }
          ]}
        >
          <Input disabled={mode === "edit"} placeholder="origin" />
        </Form.Item>
        <Form.Item
          name="url"
          label={t("remoteUrl")}
          rules={[
            { required: true, message: t("remoteUrlRequired") },
            { whitespace: true, message: t("remoteUrlEmpty") }
          ]}
        >
          <Input placeholder="https://github.com/user/repo.git" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
