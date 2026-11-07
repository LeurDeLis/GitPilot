import { basicSetup } from "codemirror";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { openSearchPanel } from "@codemirror/search";
import { indentWithTab } from "@codemirror/commands";
import { LanguageDescription, indentUnit } from "@codemirror/language";
import { languages } from "@codemirror/language-data";
import { oneDark } from "@codemirror/theme-one-dark";
import { useEffect, useRef } from "react";
import { useI18n } from "../i18n";
import { useTheme } from "../theme";

export function codeLanguage(filename: string): LanguageDescription | undefined {
  const matched = LanguageDescription.matchFilename(languages, filename);
  if (matched) return matched;
  if (/\.(?:ps1|psm1|psd1)$/i.test(filename)) return LanguageDescription.matchLanguageName(languages, "PowerShell") || undefined;
  if (/\.(?:bash|zsh|ksh)$/i.test(filename) || /(?:^|\/)(?:\.(?:bashrc|zshrc|profile)|bashrc)$/i.test(filename)) return LanguageDescription.matchLanguageName(languages, "Shell") || undefined;
  return undefined;
}

export function CodeEditor({ filePath, content, readOnly, onChange, onSave, onPositionChange }: {
  filePath: string;
  content: string;
  readOnly: boolean;
  onChange(content: string): void;
  onSave(): void;
  onPositionChange(line: number, column: number): void;
}) {
  const { theme } = useTheme();
  const { language } = useI18n();
  const phrases: Record<string, string> = language === "zh-CN" ? {
    "Find": "查找", "Replace": "替换", "next": "下一个", "previous": "上一个", "all": "全选",
    "match case": "区分大小写", "regexp": "正则表达式", "by word": "整词匹配", "replace": "替换", "replace all": "全部替换", "close": "关闭",
    "Go to line": "跳转到行", "go": "跳转", "current line": "当前行"
  } : {};
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView>();
  const callbacks = useRef({ onChange, onSave, onPositionChange });
  callbacks.current = { onChange, onSave, onPositionChange };
  const configuration = useRef({ language: new Compartment(), locale: new Compartment(), theme: new Compartment(), readOnly: new Compartment() });

  useEffect(() => {
    if (!host.current) return;
    const compartments = configuration.current;
    const editor = new EditorView({
      parent: host.current,
      state: EditorState.create({ doc: content, extensions: [
        keymap.of([
          { key: "Mod-s", run: () => { callbacks.current.onSave(); return true; } },
          { key: "Mod-h", run: (editor) => { openSearchPanel(editor); editor.dom.querySelector<HTMLInputElement>('[name="replace"]')?.focus(); return true; }, preventDefault: true },
          indentWithTab
        ]),
        basicSetup,
        indentUnit.of(/\.py$/i.test(filePath) ? "    " : "  "),
        compartments.language.of([]),
        compartments.locale.of(EditorState.phrases.of(phrases)),
        compartments.theme.of(theme === "dark" ? oneDark : []),
        compartments.readOnly.of([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]),
        EditorView.contentAttributes.of({ "aria-label": filePath, spellcheck: "false" }),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) callbacks.current.onChange(update.state.doc.toString());
          if (update.selectionSet || update.docChanged) {
            const head = update.state.selection.main.head;
            const line = update.state.doc.lineAt(head);
            callbacks.current.onPositionChange(line.number, head - line.from + 1);
          }
        }),
        EditorView.theme({ "&": { height: "100%" }, ".cm-scroller": { overflow: "auto", fontFamily: "Consolas, 'Cascadia Code', monospace", fontSize: "13px" } })
      ] })
    });
    view.current = editor;
    let disposed = false;
    const language = codeLanguage(filePath);
    if (language) void language.load().then((support) => { if (!disposed) editor.dispatch({ effects: compartments.language.reconfigure(support) }); }).catch(() => {});
    editor.focus();
    callbacks.current.onPositionChange(1, 1);
    return () => { disposed = true; view.current = undefined; editor.destroy(); };
  }, [filePath]);

  useEffect(() => {
    const editor = view.current;
    if (editor && editor.state.doc.toString() !== content) editor.dispatch({ changes: { from: 0, to: editor.state.doc.length, insert: content } });
  }, [content]);
  useEffect(() => { view.current?.dispatch({ effects: configuration.current.locale.reconfigure(EditorState.phrases.of(phrases)) }); }, [language]);
  useEffect(() => { view.current?.dispatch({ effects: configuration.current.theme.reconfigure(theme === "dark" ? oneDark : []) }); }, [theme]);
  useEffect(() => { view.current?.dispatch({ effects: configuration.current.readOnly.reconfigure([EditorState.readOnly.of(readOnly), EditorView.editable.of(!readOnly)]) }); }, [readOnly]);

  return <div ref={host} className="code-editor-host" onKeyDown={(event) => { if (event.key === "Escape") event.stopPropagation(); }} />;
}
