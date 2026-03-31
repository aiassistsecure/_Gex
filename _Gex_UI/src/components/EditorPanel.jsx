/**
 * EditorPanel v1.0.0 -- Monaco editor with tab bar + diff mode
 * Bloomberg chipset theme, auto-save, mode switching
 */
import { useRef, useCallback } from 'react';
import { FileCode } from 'lucide-react';
import Editor, { DiffEditor, loader } from '@monaco-editor/react';
import useGexStore from '../store/useGexStore';
import { saveFile } from '../services/api';

// Gex-Gel Theme — motherboard chipset palette
const GEX_THEME = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'D6E8FF' },
    { token: 'comment', foreground: '5B6EA6', fontStyle: 'italic' },
    { token: 'keyword', foreground: '7FB6FF', fontStyle: 'bold' },
    { token: 'number', foreground: '67FFD7' },
    { token: 'string', foreground: '8BF4FF' },
    { token: 'string.escape', foreground: 'D4A574' },
    { token: 'type.identifier', foreground: '9AB1FF' },
    { token: 'delimiter', foreground: '6F9CFF' },
    { token: 'operator', foreground: '5EE6FF' },
    { token: 'identifier', foreground: 'E4EEFF' },
    { token: 'function', foreground: 'E8C878' },
    { token: 'variable', foreground: 'D6E8FF' },
    { token: 'constant', foreground: 'D4A574' },
    { token: 'tag', foreground: '7FB6FF' },
    { token: 'attribute.name', foreground: 'D4A574' },
    { token: 'attribute.value', foreground: '8BF4FF' },
  ],
  colors: {
    'editor.background': '#08090d',
    'editor.foreground': '#D6E8FF',
    'editorLineNumber.foreground': '#3a4876',
    'editorLineNumber.activeForeground': '#ff8c42',
    'editorCursor.foreground': '#ff8c42',
    'editor.selectionBackground': '#2B4E8A55',
    'editor.lineHighlightBackground': '#0d1a3044',
    'editor.lineHighlightBorder': '#0000',
    'editorIndentGuide.background1': '#1a2d5530',
    'editorBracketMatch.background': '#ff8c4220',
    'editorBracketMatch.border': '#ff8c4250',
    'editorOverviewRuler.border': '#0000',
    'scrollbar.shadow': '#0000',
    'editorWidget.background': '#0c0e14',
    'editorWidget.border': '#232a3d',
    'editorGutter.background': '#08090d',
    'diffEditor.insertedTextBackground': '#00e68a25',
    'diffEditor.removedTextBackground': '#ff4c6a20',
    'diffEditor.insertedLineBackground': '#0d3a2860',
    'diffEditor.removedLineBackground': '#3a0d1a60',
  },
};

let themeRegistered = false;
loader.init().then((monaco) => {
  if (!themeRegistered) {
    monaco.editor.defineTheme('gex-gel', GEX_THEME);
    themeRegistered = true;
  }
});

function detectLanguage(fp) {
  if (!fp) return 'plaintext';
  const ext = fp.split('.').pop()?.toLowerCase();
  return {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', rs: 'rust', go: 'go', java: 'java',
    css: 'css', html: 'html', json: 'json', md: 'markdown',
    yml: 'yaml', yaml: 'yaml', sh: 'shell', sql: 'sql', toml: 'toml',
  }[ext] || 'plaintext';
}

export default function EditorPanel() {
  const { activeFile, activeFileContent, editorMode, setEditorMode, lastResult, setActiveFile } = useGexStore();
  const saveTimeoutRef = useRef(null);

  const ensureTheme = useCallback((monaco) => {
    monaco.editor.defineTheme('gex-gel', GEX_THEME);
  }, []);

  const language = detectLanguage(activeFile);
  const hasDiff = lastResult && lastResult.status === 'patched' && lastResult.before !== undefined;

  const handleChange = useCallback((value) => {
    if (value === undefined || value === activeFileContent) return;
    setActiveFile(activeFile, value);

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveFile(activeFile, value).catch(() => {});
    }, 1000);
  }, [activeFile, activeFileContent, setActiveFile]);

  const fileName = activeFile ? activeFile.split(/[\\/]/).pop() : null;

  return (
    <>
      {/* Tab Bar */}
      <div className="tab-bar">
        {activeFile && (
          <div className={`tab active`}>
            <FileCode size={13} style={{ opacity: 0.5 }} />
            <span>{fileName}</span>
          </div>
        )}

        {/* Mode toggle */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '2px', padding: '0 8px' }}>
          <button
            className={`btn btn-sm ${editorMode === 'edit' ? 'btn-primary' : ''}`}
            onClick={() => setEditorMode('edit')}
            style={{ borderRadius: '3px 0 0 3px' }}
          >
            EDIT
          </button>
          <button
            className={`btn btn-sm ${editorMode === 'diff' ? 'btn-cyan' : ''}`}
            onClick={() => setEditorMode('diff')}
            disabled={!hasDiff}
            style={{ borderRadius: '0 3px 3px 0' }}
          >
            DIFF
          </button>
        </div>
      </div>

      {/* Editor Area */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {!activeFile ? (
          <div className="empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            <h3>Select a File</h3>
            <p>Choose a file from the explorer to view and edit source code</p>
          </div>
        ) : editorMode === 'diff' && hasDiff ? (
          <DiffEditor
            height="100%"
            language={language}
            original={lastResult.before}
            modified={lastResult.after}
            theme="gex-gel"
            beforeMount={ensureTheme}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              fontLigatures: true,
              smoothScrolling: true,
              renderSideBySide: true,
              originalEditable: false,
              readOnly: true,
              scrollBeyondLastLine: false,
              renderOverviewRuler: false,
            }}
          />
        ) : (
          <Editor
            height="100%"
            language={language}
            value={activeFileContent}
            theme="gex-gel"
            beforeMount={ensureTheme}
            onChange={handleChange}
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              fontLigatures: true,
              cursorSmoothCaretAnimation: 'on',
              smoothScrolling: true,
              scrollBeyondLastLine: false,
              renderOverviewRuler: false,
              padding: { top: 12 },
            }}
          />
        )}
      </div>
    </>
  );
}
