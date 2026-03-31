/**
 * EditorPanel — Monaco editor + diff viewer with mode switching
 * 
 * Theme is registered globally via loader.init() so it persists
 * across Editor ↔ DiffEditor transitions.
 */
import { useRef, useEffect, useCallback, useState } from 'react';
import Editor, { DiffEditor, loader } from '@monaco-editor/react';
import useGexStore from '../store/useGexStore';
import { saveFile } from '../services/api';

// Custom gex-gel theme — motherboard chipset palette
const GEX_THEME = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'D6E8FF' },
    { token: 'comment', foreground: '5B6EA6', fontStyle: 'italic' },
    { token: 'keyword', foreground: '7FB6FF', fontStyle: 'bold' },
    { token: 'keyword.control', foreground: '7FB6FF', fontStyle: 'bold' },
    { token: 'number', foreground: '67FFD7' },
    { token: 'string', foreground: '8BF4FF' },
    { token: 'string.escape', foreground: 'D4A574' },
    { token: 'type.identifier', foreground: '9AB1FF' },
    { token: 'delimiter', foreground: '6F9CFF' },
    { token: 'delimiter.bracket', foreground: '6F9CFF' },
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
    'editor.background': '#060c18',
    'editor.foreground': '#D6E8FF',
    'editorLineNumber.foreground': '#3a4876',
    'editorLineNumber.activeForeground': '#D4A574',
    'editorCursor.foreground': '#D4A574',
    'editor.selectionBackground': '#2B4E8A55',
    'editor.inactiveSelectionBackground': '#1E345844',
    'editor.lineHighlightBackground': '#0d1a3066',
    'editor.lineHighlightBorder': '#1a2d5500',
    'editorIndentGuide.background1': '#1a2d5530',
    'editorIndentGuide.activeBackground1': '#D4A57440',
    'editorBracketMatch.background': '#D4A57420',
    'editorBracketMatch.border': '#D4A57450',
    'editorOverviewRuler.border': '#0000',
    'scrollbar.shadow': '#0000',
    'editorWidget.background': '#0a1424',
    'editorWidget.border': '#1a2d55',
    'editorSuggestWidget.background': '#0a1424',
    'editorSuggestWidget.border': '#1a2d55',
    'editorSuggestWidget.selectedBackground': '#1a2d55',
    'editorGutter.background': '#060c18',
    // Diff editor — bold red/green chipset highlights
    'diffEditor.insertedTextBackground': '#67FFD730',
    'diffEditor.removedTextBackground': '#FF6F9F30',
    'diffEditor.insertedLineBackground': '#0d3a2880',
    'diffEditor.removedLineBackground': '#3a0d1a80',
    'diffEditorGutter.insertedLineBackground': '#0d3a28AA',
    'diffEditorGutter.removedLineBackground': '#3a0d1aAA',
    'diffEditor.diagonalFill': '#1a2d5520',
    'diffEditorOverview.insertedForeground': '#67FFD7',
    'diffEditorOverview.removedForeground': '#FF6F9F',
  },
};

// Register theme globally ONCE via loader — persists across all editor instances
let themeRegistered = false;
loader.init().then((monaco) => {
  if (!themeRegistered) {
    monaco.editor.defineTheme('gex-gel', GEX_THEME);
    themeRegistered = true;
  }
});

function detectLanguage(filePath) {
  if (!filePath) return 'plaintext';
  const ext = filePath.split('.').pop()?.toLowerCase();
  const map = {
    js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
    py: 'python', rs: 'rust', go: 'go', java: 'java',
    css: 'css', html: 'html', json: 'json', md: 'markdown',
    yml: 'yaml', yaml: 'yaml', sh: 'shell', sql: 'sql',
    toml: 'toml', cpp: 'cpp', c: 'c', h: 'cpp',
  };
  return map[ext] || 'plaintext';
}

export default function EditorPanel() {
  const { activeFile, activeFileContent, editorMode, setEditorMode, lastResult, setActiveFile } = useGexStore();

  // Fallback: define theme right before each editor mounts (in case loader.init hasn't resolved yet)
  const ensureTheme = useCallback((monaco) => {
    monaco.editor.defineTheme('gex-gel', GEX_THEME);
  }, []);

  const language = detectLanguage(activeFile);

  // Auto-save changes with debounce
  const saveTimeoutRef = useRef(null);
  const handleEditorChange = useCallback((value) => {
    if (value === undefined || value === activeFileContent) return;
    
    // Update local state immediately so UI feels responsive
    setActiveFile(activeFile, value);

    // Debounce backend save
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
      saveFile(activeFile, value).catch(err => {
        console.error("Failed to auto-save file:", err);
      });
    }, 1000);
  }, [activeFile, activeFileContent, setActiveFile]);

  // Determine diff content
  const hasDiff = lastResult && lastResult.status === 'patched' && lastResult.before !== undefined;

  return (
    <div className="center-stack">
      {/* Mode tabs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
        <div className="mode-tabs">
          <button
            className={`mode-tab ${editorMode === 'edit' ? 'active' : ''}`}
            onClick={() => setEditorMode('edit')}
          >
            Editor
          </button>
          <button
            className={`mode-tab ${editorMode === 'diff' ? 'active' : ''}`}
            onClick={() => setEditorMode('diff')}
            disabled={!hasDiff}
            style={!hasDiff ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
          >
            Diff View
          </button>
        </div>
        {activeFile && (
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            maxWidth: '400px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {activeFile}
          </span>
        )}
      </div>

      {/* Editor/Diff container */}
      <div className="editor-container">
          {!activeFile ? (
            <div className="empty-state" style={{ height: '100%', background: '#060c18', borderRadius: 'var(--radius-md)', border: '1px solid var(--panel-border)', opacity: 0.5 }}>
              <div style={{ marginBottom: '12px' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
              </div>
              <h3 style={{ textTransform: 'uppercase', letterSpacing: '1px', fontSize: '0.8rem' }}>Select a File</h3>
              <p style={{ fontSize: '0.7rem' }}>Choose a file from the explorer to view its source code</p>
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
              onChange={handleEditorChange}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "'JetBrains Mono', monospace",
                fontLigatures: true,
                cursorSmoothCaretAnimation: 'on',
                smoothScrolling: true,
                readOnly: false,
                scrollBeyondLastLine: false,
                renderOverviewRuler: false,
                padding: { top: 12 },
              }}
            />
          )}
      </div>
    </div>
  );
}
