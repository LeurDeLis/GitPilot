import { FileMarkdownOutlined, ReloadOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Empty, Input, List, Modal, Segmented, Space, Spin, Typography } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { gitApi } from '../api/gitApi';
import { useI18n } from '../i18n';
import { useNotification } from './NotificationCenter';

type MarkdownWorkspaceProps = {
  repoPath: string;
  busy: boolean;
  onSave(filePath: string, content: string): Promise<void>;
};

export function MarkdownWorkspace({ repoPath, busy, onSave }: MarkdownWorkspaceProps) {
  const { t } = useI18n();
  const notify = useNotification();
  const [modal, modalContextHolder] = Modal.useModal();
  const [files, setFiles] = useState<string[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>();
  const [content, setContent] = useState('');
  const [savedContent, setSavedContent] = useState('');
  const [mode, setMode] = useState<'preview' | 'edit'>('preview');
  const [search, setSearch] = useState('');
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [loadingFile, setLoadingFile] = useState(false);
  const [saving, setSaving] = useState(false);
  const dirty = content !== savedContent;

  const visibleFiles = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    return query ? files.filter((file) => file.toLocaleLowerCase().includes(query)) : files;
  }, [files, search]);

  const loadFiles = async (preferredFile?: string) => {
    setLoadingFiles(true);
    try {
      const nextFiles = await gitApi.getMarkdownFiles(repoPath);
      setFiles(nextFiles);
      const nextSelected = preferredFile && nextFiles.includes(preferredFile)
        ? preferredFile
        : selectedFile && nextFiles.includes(selectedFile) ? selectedFile : nextFiles[0];
      if (nextSelected !== selectedFile) await openFile(nextSelected);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : String(error), t('markdownLoadFailed'));
    } finally {
      setLoadingFiles(false);
    }
  };

  const openFile = async (filePath?: string) => {
    if (!filePath) {
      setSelectedFile(undefined);
      setContent('');
      setSavedContent('');
      return;
    }
    setLoadingFile(true);
    try {
      const nextContent = await gitApi.readMarkdownFile(repoPath, filePath);
      setSelectedFile(filePath);
      setContent(nextContent);
      setSavedContent(nextContent);
      setMode('preview');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : String(error), t('markdownLoadFailed'));
    } finally {
      setLoadingFile(false);
    }
  };

  useEffect(() => {
    setFiles([]);
    setSelectedFile(undefined);
    setContent('');
    setSavedContent('');
    void loadFiles();
  }, [repoPath]);

  const selectFile = async (filePath: string) => {
    if (filePath === selectedFile) return;
    if (dirty) {
      const confirmed = await new Promise<boolean>((resolve) => {
        modal.confirm({
          title: t('markdownUnsavedTitle'),
          content: t('markdownUnsavedDescription'),
          okText: t('discard'),
          cancelText: t('cancel'),
          okButtonProps: { danger: true },
          onOk: () => resolve(true),
          onCancel: () => resolve(false)
        });
      });
      if (!confirmed) return;
    }
    await openFile(filePath);
  };

  const save = async () => {
    if (!selectedFile || !dirty) return;
    setSaving(true);
    try {
      await onSave(selectedFile, content);
      setSavedContent(content);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : String(error), t('markdownSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="markdown-workspace">
      {modalContextHolder}
      <aside className="markdown-file-pane">
        <div className="markdown-file-toolbar">
          <Typography.Text strong>{t('markdownFiles')}</Typography.Text>
          <Button size="small" type="text" icon={<ReloadOutlined />} disabled={loadingFiles || busy} onClick={() => void loadFiles()} aria-label={t('refreshMarkdownFiles')} />
        </div>
        <Input size="small" value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t('searchMarkdownFiles')} allowClear />
        <Spin spinning={loadingFiles}>
          {visibleFiles.length ? (
            <List
              className="markdown-file-list"
              dataSource={visibleFiles}
              renderItem={(file) => (
                <List.Item className={file === selectedFile ? 'markdown-file active' : 'markdown-file'} onClick={() => void selectFile(file)}>
                  <FileMarkdownOutlined />
                  <Typography.Text ellipsis title={file}>{file}</Typography.Text>
                  {file === selectedFile && dirty && <span className="markdown-dirty-indicator" />}
                </List.Item>
              )}
            />
          ) : !loadingFiles ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('noMarkdownFiles')} /> : null}
        </Spin>
      </aside>

      <section className="markdown-document">
        {selectedFile ? (
          <>
            <div className="markdown-document-toolbar">
              <Typography.Text className="markdown-document-path" ellipsis title={selectedFile}>{selectedFile}{dirty ? ' *' : ''}</Typography.Text>
              <Space size={8}>
                <Segmented
                  size="small"
                  value={mode}
                  onChange={(value) => setMode(value as 'preview' | 'edit')}
                  options={[
                    { label: t('markdownPreview'), value: 'preview' },
                    { label: t('markdownEdit'), value: 'edit' }
                  ]}
                />
                <Button size="small" type="primary" icon={<SaveOutlined />} disabled={!dirty || busy} loading={saving} onClick={() => void save()}>{t('save')}</Button>
              </Space>
            </div>
            <Spin spinning={loadingFile}>
              {mode === 'edit' ? (
                <Input.TextArea className="markdown-editor" value={content} onChange={(event) => setContent(event.target.value)} spellCheck={false} />
              ) : (
                <div className="markdown-preview"><ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown></div>
              )}
            </Spin>
          </>
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('selectMarkdownFile')} />
        )}
      </section>
    </div>
  );
}
