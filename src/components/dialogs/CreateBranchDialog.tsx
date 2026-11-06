import { Form, Input, Modal } from "antd";
import { Radio, Select, Space } from 'antd';
import { useEffect, useMemo } from "react";
import { useI18n } from "../../i18n";
import type { RemoteInfo } from '../../types/git';

type CreateBranchDialogProps = {
  open: boolean;
  busy?: boolean;
  remotes: RemoteInfo[];
  onCancel(): void;
  onSubmit(branchName: string, remoteName?: string): Promise<void>;
};

export function CreateBranchDialog({
  open,
  busy,
  remotes,
  onCancel,
  onSubmit
}: CreateBranchDialogProps) {
  const [form] = Form.useForm<{ branchName: string; destination: 'local' | 'publish'; remoteName?: string }>();
  const { t } = useI18n();
  const fetchRemotes = useMemo(() => remotes.filter((remote) => remote.type === 'fetch'), [remotes]);

  useEffect(() => {
    if (open) {
      form.setFieldsValue({ destination: fetchRemotes.length ? 'publish' : 'local', remoteName: fetchRemotes[0]?.name });
    } else {
      form.resetFields();
    }
  }, [form, open, fetchRemotes]);

  const submit = async () => {
    const values = await form.validateFields();
    await onSubmit(values.branchName.trim(), values.destination === 'publish' ? values.remoteName : undefined);
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
        <Form.Item name="destination" label={t('branchDestination')}>
          <Radio.Group>
            <Space direction="vertical">
              <Radio value="local">{t('createLocalOnly')}</Radio>
              <Radio value="publish" disabled={fetchRemotes.length === 0}>{t('createAndPublish')}</Radio>
            </Space>
          </Radio.Group>
        </Form.Item>
        <Form.Item noStyle shouldUpdate={(previous, current) => previous.destination !== current.destination}>
          {({ getFieldValue }) => getFieldValue('destination') === 'publish' ? (
            <Form.Item name="remoteName" label={t('remoteName')} rules={[{ required: true, message: t('remoteNameRequired') }]}>
              <Select options={fetchRemotes.map((remote) => ({ label: remote.name, value: remote.name }))} />
            </Form.Item>
          ) : null}
        </Form.Item>
      </Form>
    </Modal>
  );
}
