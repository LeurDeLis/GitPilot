import { SendOutlined } from "@ant-design/icons";
import { Button, Form, Input, Space, Typography } from "antd";
import { useState } from "react";

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
          <Typography.Title level={4}>提交</Typography.Title>
          <Typography.Text type="secondary">
            已选择 {selectedCount} / {totalCount} 个文件
          </Typography.Text>
        </div>
      </div>

      <Form form={form} layout="vertical" onFinish={submit}>
        <Form.Item
          name="message"
          label="Commit message"
          rules={[
            { required: true, message: "Commit message 不能为空" },
            {
              validator: (_rule, value?: string) => {
                if (!value || value.trim().length > 0) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error("Commit message 不能为空"));
              }
            }
          ]}
        >
          <Input.TextArea
            rows={4}
            maxLength={500}
            showCount
            placeholder="输入本次提交说明"
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
            提交选中文件
          </Button>
        </Space>
      </Form>
    </section>
  );
}
