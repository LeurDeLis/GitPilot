import { SendOutlined } from "@ant-design/icons";
import { Button, Form, Input, Space, Typography } from "antd";
import { useState } from "react";
import { useI18n } from "../i18n";

type CommitPanelProps = {
  selectedCount: number;
  totalCount: number;
  disabled?: boolean;
  onCommit(message: string): Promise<boolean>;
};

export function CommitPanel({
  selectedCount,
  totalCount,
  disabled,
  onCommit
}: CommitPanelProps) {
  const [form] = Form.useForm<{ message: string }>();
  const [submitting, setSubmitting] = useState(false);
  const { t } = useI18n();

  const submit = async () => {
    const values = await form.validateFields();
    setSubmitting(true);
    try {
      const ok = await onCommit(values.message);
      if (ok) {
        form.resetFields();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="panel commit-panel">
      <div className="panel-header compact">
        <div>
          <Typography.Title level={4}>{t("commit")}</Typography.Title>
          <Typography.Text type="secondary">
            {t("selectedFiles", { selected: selectedCount, total: totalCount })}
          </Typography.Text>
        </div>
      </div>

      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item
          name="message"
          label={t("commitMessage")}
          rules={[
            { required: true, message: t("commitMessageRequired") },
            {
              validator: (_rule, value?: string) => {
                if (!value || value.trim().length > 0) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error(t("commitMessageRequired")));
              }
            }
          ]}
        >
          <Input.TextArea
            rows={4}
            maxLength={500}
            showCount
            placeholder={t("commitMessagePlaceholder")}
            disabled={disabled || submitting}
          />
        </Form.Item>
        <Space className="commit-actions">
          <Button
            type="primary"
            icon={<SendOutlined />}
            htmlType="submit"
            loading={submitting}
            disabled={disabled || selectedCount === 0}
          >
            {t("commitSelectedFiles")}
          </Button>
        </Space>
      </Form>
    </section>
  );
}
