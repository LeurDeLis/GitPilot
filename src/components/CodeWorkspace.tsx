import { FileAddOutlined, ReloadOutlined, SaveOutlined, SearchOutlined } from "@ant-design/icons";
import { Alert, Button, Empty, Input, Modal, Segmented, Space, Spin, Tag, Tree, Typography } from "antd";
import type { DataNode } from "antd/es/tree";
import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import { gitApi } from "../api/gitApi";
import { useI18n } from "../i18n";
import type { RepositoryFile } from "../types/git";
import { CodeEditor, codeLanguage } from "./CodeEditor";
import { ExternalEditorButton } from "./ExternalEditorButton";
import { useNotification } from "./NotificationCenter";

function fileTree(paths: string[]): DataNode[] {
  const root: DataNode[] = [];
  const directories = new Map<string, DataNode>();
  for (const file of paths) {
    const parts = file.split("/");
    let children = root;
    for (let index = 0; index < parts.length; index++) {
      const key = parts.slice(0, index + 1).join("/");
      const isLeaf = index === parts.length - 1;
      let node = directories.get(key);
      if (!node || isLeaf) {
        node = { key, title: parts[index], isLeaf, ...(isLeaf ? {} : { children: [] }) };
        children.push(node);
        if (!isLeaf) directories.set(key, node);
      }
      children = node.children || [];
    }
  }
  const sort = (nodes: DataNode[]) => {
    nodes.sort((a, b) => Number(Boolean(a.isLeaf)) - Number(Boolean(b.isLeaf)) || String(a.title).localeCompare(String(b.title)));
    nodes.forEach((node) => { if (node.children) sort(node.children); });
  };
  sort(root);
  return root;
}

export function CodeWorkspace({ repoPath, initialFile, busy, onClose, onSaved }: {
  repoPath: string;
  initialFile?: string;
  busy: boolean;
  onClose(): void;
  onSaved(): void;
}) {
  const { t } = useI18n();
  const notify = useNotification();
  const [modal, contextHolder] = Modal.useModal();
  const [files, setFiles] = useState<string[]>([]);
  const [document, setDocument] = useState<RepositoryFile>();
  const [content, setContent] = useState("");
  const [search, setSearch] = useState("");
  const [loadingFiles, setLoadingFiles] = useState(true);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPath, setNewPath] = useState("");
  const [newFileOpen, setNewFileOpen] = useState(false);
  const [markdownMode, setMarkdownMode] = useState<"preview" | "edit">("edit");
  const [expanded, setExpanded] = useState<string[]>([]);
  const [position, setPosition] = useState({ line: 1, column: 1 });
  const mounted = useRef(true);
  const pending = useRef(false);
  const requestId = useRef(0);
  const saveInFlight = useRef(false);
  const dirty = Boolean(document && content !== document.content);
  const disabled = loading || saving || creating || busy;
  const visibleFiles = useMemo(() => files.filter((file) => file.toLowerCase().includes(search.toLowerCase())), [files, search]);
  const tree = useMemo(() => fileTree(visibleFiles), [visibleFiles]);
  const expandedKeys = search ? Array.from(new Set(visibleFiles.flatMap((file) => file.split("/").slice(0, -1).map((_part, index, parts) => parts.slice(0, index + 1).join("/"))))) : expanded;
  const isMarkdown = Boolean(document && /\.(?:md|markdown)$/i.test(document.path));

  const loadFiles = async () => {
    setLoadingFiles(true);
    try { const next = await gitApi.getRepositoryFiles(repoPath); if (mounted.current) setFiles(next); }
    catch (error) { if (mounted.current) notify.error(String(error), t("codeLoadFailed")); }
    finally { if (mounted.current) setLoadingFiles(false); }
  };
  const loadFile = async (filePath: string) => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const next = await gitApi.readRepositoryFile(repoPath, filePath);
      if (!mounted.current || id !== requestId.current) return;
      setDocument(next);
      setContent(next.content);
      setMarkdownMode(/\.(?:md|markdown)$/i.test(filePath) ? "preview" : "edit");
      const parents = filePath.split("/").slice(0, -1);
      setExpanded((current) => [...new Set([...current, ...parents.map((_part, index) => parents.slice(0, index + 1).join("/"))])]);
    } catch (error) { if (mounted.current && id === requestId.current) notify.error(String(error), t("codeLoadFailed")); }
    finally { if (mounted.current && id === requestId.current) setLoading(false); }
  };
  useEffect(() => {
    mounted.current = true;
    void loadFiles();
    if (initialFile) void loadFile(initialFile);
    return () => { mounted.current = false; requestId.current++; };
  }, [repoPath]);
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = "unsaved"; };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty]);

  const save = async (): Promise<boolean> => {
    if (!document || !dirty) return true;
    if (document.readOnly || saveInFlight.current || loading || busy) return false;
    saveInFlight.current = true;
    setSaving(true);
    try {
      const next = await gitApi.writeRepositoryFile(repoPath, document.path, content, document.revision);
      if (mounted.current) { setDocument(next); notify.success(t("codeSaved")); onSaved(); }
      return true;
    } catch (error) { notify.error(String(error), t("codeSaveFailed")); return false; }
    finally { saveInFlight.current = false; if (mounted.current) setSaving(false); }
  };
  const confirmChanges = (): Promise<boolean> => {
    if (!dirty) return Promise.resolve(true);
    return new Promise((resolve) => {
      const dialog = modal.confirm({
        title: t("codeUnsavedTitle"), content: t("codeUnsavedDescription"),
        okText: t("saveAndContinue"), cancelText: t("cancel"),
        onCancel: () => resolve(false),
        onOk: async () => { if (await save()) resolve(true); else throw new Error("Save failed"); },
        footer: (_node, { OkBtn, CancelBtn }) => <Space>
          <Button danger onClick={() => { setContent(document?.content || ""); dialog.destroy(); resolve(true); }}>{t("discardAndContinue")}</Button><CancelBtn /><OkBtn />
        </Space>
      });
    });
  };
  const afterConfirmation = async (action: () => void | Promise<void>) => {
    if (pending.current || disabled) return;
    pending.current = true;
    try { if (await confirmChanges()) await action(); }
    finally { pending.current = false; }
  };
  const createFile = async () => {
    if (!newPath.trim() || creating) return;
    setCreating(true);
    try {
      const next = await gitApi.writeRepositoryFile(repoPath, newPath.trim().replace(/\\/g, "/"), "");
      if (!mounted.current) return;
      setDocument(next); setContent(next.content); setNewFileOpen(false); setNewPath("");
      notify.success(t("codeCreated")); onSaved(); await loadFiles();
    } catch (error) { notify.error(String(error), t("codeSaveFailed")); }
    finally { if (mounted.current) setCreating(false); }
  };

  return <>
    {contextHolder}
    <Modal open title={t("codeEditor")} className="code-workspace-modal" width="94vw" style={{ top: 28 }} footer={null}
      maskClosable={false} closable={!disabled} keyboard={!disabled} onCancel={() => void afterConfirmation(onClose)}>
      <div className="code-workspace">
        <aside className="code-file-pane">
          <div className="code-file-toolbar">
            <Typography.Text strong>{t("repositoryFiles")}</Typography.Text>
            <Space size={2}>
              <Button type="text" size="small" icon={<FileAddOutlined />} title={t("newCodeFile")} aria-label={t("newCodeFile")} disabled={disabled} onClick={() => void afterConfirmation(() => setNewFileOpen(true))} />
              <Button type="text" size="small" icon={<ReloadOutlined />} title={t("refresh")} aria-label={t("refresh")} disabled={loadingFiles || disabled} onClick={() => void loadFiles()} />
            </Space>
          </div>
          <Input prefix={<SearchOutlined />} placeholder={t("searchRepositoryFiles")} aria-label={t("searchRepositoryFiles")} allowClear value={search} onChange={(event) => setSearch(event.target.value)} />
          <div className="code-file-tree"><Spin spinning={loadingFiles}>
            {visibleFiles.length ? <Tree.DirectoryTree blockNode treeData={tree} selectedKeys={document ? [document.path] : []} expandedKeys={expandedKeys}
              onExpand={(keys) => setExpanded(keys.map(String))} expandAction="click"
              onSelect={(_keys, info) => { if (info.node.isLeaf && info.node.key !== document?.path) void afterConfirmation(() => loadFile(String(info.node.key))); }}
              titleRender={(node) => <span title={String(node.key)}>{String(node.title)}</span>} />
              : !loadingFiles && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("noRepositoryFiles")} />}
          </Spin></div>
          <Typography.Text type="secondary" className="code-file-count">{t("codeFileCount", { count: files.length })}</Typography.Text>
        </aside>
        <section className="code-document">
          <div className="code-document-toolbar">
            <Typography.Text className="code-document-path" ellipsis title={document?.path || repoPath}>{document?.path || repoPath}</Typography.Text>
            {dirty && <Tag color="gold">{t("unsavedChanges")}</Tag>}
            <Space size={6}>
              {isMarkdown && <Segmented size="small" value={markdownMode} onChange={(value) => setMarkdownMode(value as "preview" | "edit")}
                options={[{ label: t("markdownPreview"), value: "preview" }, { label: t("markdownEdit"), value: "edit" }]} />}
              <ExternalEditorButton repoPath={repoPath} filePath={document?.path} compact disabled={disabled} beforeOpen={confirmChanges} />
              <Button size="small" icon={<ReloadOutlined />} aria-label={t("reloadCodeFile")} title={t("reloadCodeFile")} disabled={!document || disabled}
                onClick={() => document && void afterConfirmation(() => loadFile(document.path))} />
              <Button size="small" type="primary" icon={<SaveOutlined />} disabled={!dirty || disabled || document?.readOnly} loading={saving} onClick={() => void save()}>{t("save")}</Button>
            </Space>
          </div>
          {document?.readOnly && <Alert showIcon type="info" message={t("readOnlyEncoding")} />}
          <div className="code-document-body"><Spin spinning={loading}>
            {document && isMarkdown && markdownMode === "preview" ? <div className="markdown-preview code-markdown-preview"><ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize]}>{content}</ReactMarkdown></div>
              : document ? <CodeEditor filePath={document.path} content={content} readOnly={document.readOnly || loading || busy} onChange={setContent} onSave={() => void save()}
              onPositionChange={(line, column) => setPosition({ line, column })} />
              : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("selectCodeFile")} />}
          </Spin></div>
          <div className="code-statusbar">
            <span>{t("codeEditorHint")}</span>
            {document && <Space size={14}><span>{codeLanguage(document.path)?.name || t("plainText")}</span><span>{document.encoding}</span><span>{document.lineEnding}</span><span>{t("codePosition", position)}</span></Space>}
          </div>
        </section>
      </div>
    </Modal>
    <Modal open={newFileOpen} title={t("newCodeFile")} okText={t("create")} cancelText={t("cancel")} confirmLoading={creating} okButtonProps={{ disabled: !newPath.trim() }}
      onCancel={() => { if (!creating) setNewFileOpen(false); }} onOk={() => void createFile()}>
      <Input autoFocus value={newPath} aria-label={t("newCodeFilePath")} placeholder={t("newCodeFilePath")} onChange={(event) => setNewPath(event.target.value)} onPressEnter={() => void createFile()} />
    </Modal>
  </>;
}
