import { CodeOutlined, DownOutlined, PlusOutlined, ReloadOutlined } from "@ant-design/icons";
import { Button, Dropdown, Space, Tag, Tooltip } from "antd";
import type { MenuProps } from "antd";
import { useEffect, useState } from "react";
import { create } from "zustand";
import { gitApi } from "../api/gitApi";
import { useI18n } from "../i18n";
import type { ExternalEditor } from "../types/git";
import { useNotification } from "./NotificationCenter";

type EditorState = { editors: ExternalEditor[]; loading: boolean; initialized: boolean; preferred?: string };
const useEditors = create<EditorState>(() => ({ editors: [], loading: false, initialized: false, preferred: window.localStorage.getItem("gitpilot-editor") || undefined }));
let detection: Promise<void> | undefined;
function detect(): Promise<void> {
  if (detection) return detection;
  useEditors.setState({ loading: true });
  detection = Promise.resolve().then(() => gitApi.detectEditors()).then((editors) => useEditors.setState({ editors, initialized: true })).finally(() => {
    useEditors.setState({ loading: false });
    detection = undefined;
  });
  return detection;
}

export function ExternalEditorButton({ repoPath, filePath, disabled, compact = false, beforeOpen }: {
  repoPath?: string;
  filePath?: string;
  disabled?: boolean;
  compact?: boolean;
  beforeOpen?: () => Promise<boolean>;
}) {
  const { t } = useI18n();
  const notify = useNotification();
  const { editors, loading, initialized, preferred } = useEditors();
  const [opening, setOpening] = useState(false);
  const scan = () => detect().catch((error) => { notify.error(String(error), t("editorDetectionFailed")); });
  useEffect(() => { if (!useEditors.getState().initialized) void scan(); }, []);

  const open = async (editor: ExternalEditor, targetFile?: string) => {
    if (!repoPath) return;
    setOpening(true);
    try {
      if (beforeOpen && !(await beforeOpen())) return;
      await gitApi.openInEditor(repoPath, editor.id, targetFile);
      window.localStorage.setItem("gitpilot-editor", editor.id);
      useEditors.setState({ preferred: editor.id });
      notify.success(t("externalEditorOpened", { editor: editor.name }));
    } catch (error) { notify.error(String(error), t("externalEditorFailed")); }
    finally { setOpening(false); }
  };

  const editorItems = (targetFile?: string): MenuProps["items"] => editors.map((editor) => ({
    key: `${targetFile ? "file" : "project"}:${editor.id}`,
    label: <Tooltip title={editor.executable} placement="left"><Space>{editor.name}{editor.id === preferred && <Tag>{t("preferredEditor")}</Tag>}</Space></Tooltip>,
    onClick: () => void open(editor, targetFile)
  }));
  const items: MenuProps["items"] = [
    ...(filePath && editors.length ? [{ key: "file-group", type: "group" as const, label: t("openFileWith"), children: editorItems(filePath) }] : []),
    ...(editors.length ? [{ key: "project-group", type: "group" as const, label: t("openProjectWith"), children: editorItems() }] : [{ key: "empty", label: t(loading ? "detectingEditors" : "noEditorsFound"), disabled: true }]),
    { type: "divider" },
    { key: "scan", label: t("detectEditors"), icon: <ReloadOutlined spin={loading} />, disabled: loading, onClick: () => void scan() },
    { key: "custom", disabled: loading, label: t("chooseEditor"), icon: <PlusOutlined />, onClick: () => {
      void gitApi.selectEditor().then((editor) => {
        if (editor) useEditors.setState((state) => ({ editors: [...state.editors.filter((item) => item.id !== editor.id), editor], initialized: true }));
      }).catch((error) => notify.error(String(error), t("editorDetectionFailed")));
    } }
  ];

  return <Dropdown menu={{ items }} trigger={["click"]} onOpenChange={(visible) => { if (visible && !initialized && !loading) void scan(); }}>
    <Button size={compact ? "small" : "middle"} icon={<CodeOutlined />} disabled={!repoPath || disabled} loading={opening}>
      {t(filePath ? "openFileExternally" : "externalEditor")} <DownOutlined />
    </Button>
  </Dropdown>;
}
