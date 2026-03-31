/**
 * EditorPanel v1.0.0 -- Monaco editor with tab bar + diff mode
 * Bloomberg chipset theme, auto-save, mode switching
 */
import { useRef, useCallback, useState, useEffect } from 'react';
import { FileCode } from 'lucide-react';
import Editor, { DiffEditor, loader } from '@monaco-editor/react';
import useGexStore from '../store/useGexStore';
import { saveFile, freezeCheckpoint, listCheckpoints, restoreCheckpoint, deleteCheckpoint } from '../services/api';
import PreviewPanel from './PreviewPanel';
import CircuitDiffViewer from './CircuitDiffViewer';

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
  const {
    activeFile, activeFileContent, editorMode, setEditorMode,
    lastResult, setActiveFile, results: storeResults, repo, addLog,
  } = useGexStore();
  const saveTimeoutRef = useRef(null);

  const pendingPatches = (storeResults || []).filter(r => r.status === 'patched' && r.diff?.hunks?.length);
  const patchCount = pendingPatches.length;

  // ── Checkpoint state ──
  const [checkpoints, setCheckpoints]   = useState([]);
  const [cpLoading, setCpLoading]       = useState(false);
  const [cpFreezing, setCpFreezing]     = useState(false);
  const [cpLabel, setCpLabel]           = useState('');
  const [restoring, setRestoring]       = useState(null);

  const loadCheckpoints = useCallback(async () => {
    if (!repo?.path) return;
    setCpLoading(true);
    try {
      const data = await listCheckpoints(repo.path);
      setCheckpoints(data.checkpoints || []);
    } catch { /* non-fatal */ }
    finally { setCpLoading(false); }
  }, [repo?.path]);

  useEffect(() => {
    if (editorMode === 'checkpoints') loadCheckpoints();
  }, [editorMode, loadCheckpoints]);

  const handleFreeze = async () => {
    if (!repo?.path) return;
    setCpFreezing(true);
    try {
      const result = await freezeCheckpoint(repo.path, cpLabel || null);
      addLog(`Frozen: ${result.label} (${result.file_count} files)`, 'success');
      setCpLabel('');
      await loadCheckpoints();
    } catch (e) {
      addLog(`Freeze failed: ${e.message}`, 'error');
    } finally { setCpFreezing(false); }
  };

  const handleRestore = async (cp) => {
    if (!repo?.path) return;
    setRestoring(cp.id);
    try {
      const result = await restoreCheckpoint(repo.path, cp.id);
      addLog(`Restored ${result.restored} files from "${cp.label}"`, 'success');
      // Reload active file if it was restored
      if (activeFile) {
        const { readFile } = await import('../services/api');
        const data = await readFile(activeFile);
        if (data?.content !== undefined) setActiveFile(activeFile, data.content);
      }
    } catch (e) {
      addLog(`Restore failed: ${e.message}`, 'error');
    } finally { setRestoring(null); }
  };

  const handleDeleteCp = async (cp) => {
    if (!repo?.path) return;
    try {
      await deleteCheckpoint(repo.path, cp.id);
      await loadCheckpoints();
    } catch (e) {
      addLog(`Delete failed: ${e.message}`, 'error');
    }
  };

  const ensureTheme = useCallback((monaco) => {
    monaco.editor.defineTheme('gex-gel', GEX_THEME);
  }, []);

  const editorRef = useRef(null);

  const saveNow = useCallback((content) => {
    const val = content ?? activeFileContent;
    if (!activeFile || !val) return;
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveFile(activeFile, val).catch(() => {});
  }, [activeFile, activeFileContent]);

  const handleEditorMount = useCallback((editor, monaco) => {
    editorRef.current = editor;
    // Register inside Monaco too (shows in command palette)
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
      () => saveNow(editor.getValue()),
    );
  }, [saveNow]);

  // Global Ctrl+S — must preventDefault here or the browser save dialog fires
  useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        e.stopPropagation();
        // Get latest value from Monaco ref if available, else fall back to store
        const val = editorRef.current ? editorRef.current.getValue() : activeFileContent;
        saveNow(val);
      }
    };
    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [saveNow, activeFileContent]);

  const language = detectLanguage(activeFile);
  const hasDiff = lastResult && lastResult.status === 'patched' && lastResult.before !== undefined;

  const handleChange = useCallback((value) => {
    if (value === undefined || value === activeFileContent) return;
    setActiveFile(activeFile, value);
    // Debounce auto-save — Ctrl+S will flush this immediately
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => saveNow(value), 1500);
  }, [activeFile, activeFileContent, setActiveFile, saveNow]);

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

        {/* Mode toggle — EDIT / DIFF / PATCHES / PREVIEW */}
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
            style={{ borderRadius: '0' }}
          >
            DIFF
          </button>
          <button
            className={`btn btn-sm ${editorMode === 'patches' ? 'btn-primary' : ''}`}
            onClick={() => setEditorMode('patches')}
            style={{
              borderRadius: '0',
              ...(editorMode !== 'patches' && patchCount > 0 ? {
                color: 'var(--accent-orange)',
                borderColor: 'rgba(255,140,66,0.4)',
              } : {}),
              position: 'relative',
            }}
          >
            PATCHES
            {patchCount > 0 && (
              <span style={{
                marginLeft: '5px',
                background: 'var(--accent-orange)',
                color: '#000',
                borderRadius: '8px',
                fontSize: '9px',
                fontWeight: 700,
                padding: '0 5px',
                lineHeight: '14px',
                display: 'inline-block',
              }}>
                {patchCount}
              </span>
            )}
          </button>
          <button
            className={`btn btn-sm ${editorMode === 'checkpoints' ? 'btn-cyan' : ''}`}
            onClick={() => setEditorMode('checkpoints')}
            style={{ borderRadius: '0' }}
          >
            CHECKPOINTS
          </button>
          <button
            className={`btn btn-sm ${editorMode === 'preview' ? 'btn-green' : ''}`}
            onClick={() => setEditorMode('preview')}
            style={{ borderRadius: '0 3px 3px 0' }}
          >
            PREVIEW
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {editorMode === 'checkpoints' ? (
          <div style={{ flex: 1, overflow: 'auto', padding: '16px', background: 'var(--surface-0)' }}>
            {/* FREEZE row */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', alignItems: 'center' }}>
              <input
                className="input input-sm"
                placeholder="Label (optional) — e.g. 'pre-nav-refactor'"
                value={cpLabel}
                onChange={e => setCpLabel(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleFreeze()}
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-primary"
                onClick={handleFreeze}
                disabled={cpFreezing || !repo?.path}
                style={{ whiteSpace: 'nowrap', minWidth: '90px' }}
              >
                {cpFreezing ? 'FREEZING...' : '❄ FREEZE'}
              </button>
            </div>

            {/* Checkpoint list */}
            {cpLoading ? (
              <div style={{ color: 'var(--text-muted)', fontSize: 'var(--font-size-xs)', textAlign: 'center', padding: '20px' }}>Loading...</div>
            ) : checkpoints.length === 0 ? (
              <div className="empty-state">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
                </svg>
                <h3>No Checkpoints Yet</h3>
                <p>Hit FREEZE to snapshot the workspace state before a risky patch.</p>
              </div>
            ) : (
              checkpoints.map((cp) => {
                const ts = new Date(cp.timestamp);
                const timeStr = ts.toLocaleString(undefined, {
                  month: 'short', day: 'numeric',
                  hour: '2-digit', minute: '2-digit', second: '2-digit'
                });
                return (
                  <div key={cp.id} style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '10px 12px',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}>
                    {/* Timeline dot */}
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: 'var(--accent-cyan)', flexShrink: 0,
                      boxShadow: '0 0 6px var(--accent-cyan)',
                    }} />
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {cp.label}
                      </div>
                      <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)', marginTop: '2px' }}>
                        {timeStr} &nbsp;·&nbsp; {cp.file_count} files
                      </div>
                    </div>
                    {/* Actions */}
                    <button
                      className="btn btn-sm btn-cyan"
                      onClick={() => handleRestore(cp)}
                      disabled={restoring === cp.id}
                      style={{ padding: '2px 10px', fontSize: 'var(--font-size-xs)' }}
                    >
                      {restoring === cp.id ? '...' : 'RESTORE'}
                    </button>
                    <button
                      className="btn btn-sm"
                      onClick={() => handleDeleteCp(cp)}
                      style={{ padding: '2px 8px', fontSize: 'var(--font-size-xs)', color: 'var(--accent-red)' }}
                      title="Delete checkpoint"
                    >
                      ✕
                    </button>
                  </div>
                );
              })
            )}
          </div>

        ) : editorMode === 'preview' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <PreviewPanel />
          </div>

        ) : editorMode === 'patches' ? (
          <div style={{ flex: 1, overflow: 'auto', padding: '16px', background: 'var(--surface-0)' }}>
            {pendingPatches.length === 0 ? (
              <div className="empty-state">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                <h3>No Pending Patches</h3>
                <p>Run Gex on a file or repo — proposed changes will appear here for review.</p>
              </div>
            ) : (
              pendingPatches.map((res, i) => (
                <div key={i} style={{ marginBottom: '24px' }}>
                  <div style={{
                    fontSize: 'var(--font-size-xs)', fontWeight: 600,
                    color: 'var(--text-muted)', textTransform: 'uppercase',
                    letterSpacing: '1px', marginBottom: '8px',
                    display: 'flex', alignItems: 'center', gap: '8px',
                  }}>
                    <span style={{ color: 'var(--accent-orange)' }}>◈</span>
                    {res.file}
                  </div>
                  <div style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px',
                  }}>
                    <CircuitDiffViewer result={res} />
                  </div>
                </div>
              ))
            )}
          </div>

        ) : !activeFile ? (
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
            onMount={handleEditorMount}
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
