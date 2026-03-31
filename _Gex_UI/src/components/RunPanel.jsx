/**
 * RunPanel (Agentic Chat UI) v2.1.0
 * Properly wires run results into Zustand store for display.
 * File runs: synchronous → store result immediately.
 * Repo runs: polls /run/{id}/status until complete, then grabs all results.
 */
import { useState, useRef, useEffect } from 'react';
import { Microscope, Download, Send, Bot, Loader } from 'lucide-react';
import useGexStore from '../store/useGexStore';
import { runFile, runRepo, getRunStatus } from '../services/api';
import CircuitDiffViewer from './CircuitDiffViewer';
import { API_BASE } from '../services/api';

export default function RunPanel() {
  const [focus, setFocus] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const chatEndRef = useRef(null);

  const {
    repo,
    activeFile,
    runState,
    progress,
    totalFiles,
    processedFiles,
    startRun,
    completeRun,
    failRun,
    addLog,
    setLastResult,
    updateRunProgress,
  } = useGexStore();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const addChat = (role, content) => {
    setChatMessages(prev => [...prev, { role, content, time: new Date() }]);
  };

  // ── File Run (synchronous — result comes back in one request) ──
  const handleRunFile = async () => {
    if (!activeFile) return;

    const instruction = focus.trim();
    if (!instruction) return;

    setIsRunning(true);
    addChat('user', instruction);
    addChat('system', `Targeting file: ${activeFile.split(/[/\\]/).pop()}`);
    addLog(`[scan] Targeting: ${activeFile}`, 'info');
    startRun(null, 1);

    try {
      const result = await runFile(repo.path, activeFile, instruction);
      addLog(`[ok] Run completed`, 'success');

      // THIS is the critical missing piece — store the result so diffs render
      setLastResult(result);
      completeRun();

      if (result.status === 'patched') {
        addChat('assistant', result.llm_analysis || 'Changes generated. Review the diff below.');
      } else if (result.status === 'unchanged') {
        addChat('assistant', result.llm_analysis || 'No changes needed — code looks correct.');
      } else if (result.status === 'error') {
        addChat('assistant', `Error: ${result.error || 'Unknown error during analysis.'}`);
      }
    } catch (err) {
      addLog(`[err] ${err.message}`, 'error');
      addChat('assistant', `Error: ${err.message}`);
      failRun(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  // ── Repo Run (async background — we poll for results) ──
  const handleRunRepo = async () => {
    if (!repo) return;

    const instruction = focus.trim();
    if (!instruction) return;

    setIsRunning(true);
    addChat('user', instruction);
    addChat('system', `Full repo scan: ${repo.name}`);
    addLog(`[scan] Full scan: ${repo.name}`, 'info');
    startRun(null, 0);

    try {
      const { run_id } = await runRepo(repo.path, instruction);
      addLog(`[ok] Run started: ${run_id}`, 'info');
      addChat('system', `Run ${run_id} started. Polling for results...`);

      // Poll until the backend finishes processing
      let attempts = 0;
      const maxAttempts = 120; // 4 minutes max (120 × 2s)

      while (attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 2000));
        attempts++;

        try {
          const status = await getRunStatus(run_id);

          // Update progress bar
          if (status.total_files > 0) {
            updateRunProgress(status.current_file, status.processed, status.total_files);
          }

          if (status.state === 'completed' || status.state === 'failed') {
            if (status.state === 'failed') {
              addChat('assistant', `Run failed: ${status.error || 'Unknown error'}`);
              failRun(status.error);
              break;
            }

            // Grab the results
            const results = status.results || [];
            addLog(`[ok] Run complete: ${results.length} files processed`, 'success');

            if (results.length > 0) {
              // Find the first file that actually changed
              const patchedResult = results.find(r => r.status === 'patched') || results[0];
              setLastResult(patchedResult);

              const patchedCount = results.filter(r => r.status === 'patched').length;
              const unchangedCount = results.filter(r => r.status === 'unchanged').length;

              addChat('assistant',
                `Scan complete. ${patchedCount} file(s) patched, ${unchangedCount} unchanged.\n\n` +
                (patchedResult.llm_analysis || 'Review the diff below.')
              );
            } else {
              addChat('assistant', 'Run completed but no files were processed.');
            }

            completeRun();
            break;
          }

          // Still running — update the chat with current file
          if (status.current_file && attempts % 3 === 0) {
            const fname = status.current_file.split(/[/\\]/).pop();
            addChat('system', `Processing: ${fname} (${status.processed}/${status.total_files})`);
          }

        } catch (pollErr) {
          // Polling error — keep trying
          if (attempts > 5) {
            addLog(`[warn] Poll error: ${pollErr.message}`, 'error');
          }
        }
      }

      if (attempts >= maxAttempts) {
        addChat('assistant', 'Run timed out after 4 minutes. Check the terminal for details.');
        failRun('Polling timeout');
      }

    } catch (err) {
      addLog(`[err] ${err.message}`, 'error');
      addChat('assistant', `Error: ${err.message}`);
      failRun(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  // Get the current lastResult from the store for rendering
  const lastResult = useGexStore(s => s.lastResult);

  return (
    <div className="right-panel" style={{ width: '100%', minWidth: '100%' }}>
      {/* Header */}
      <div className="panel-section">
        <div className="panel-section-header">
          <span className="panel-label">Agentic IDE</span>
          <span className={`run-indicator ${runState}`}>
            {runState === 'idle' && 'READY'}
            {runState === 'running' && 'THINKING'}
            {runState === 'completed' && 'DONE'}
            {runState === 'failed' && 'FAILED'}
          </span>
        </div>

        {runState === 'running' && (
          <div style={{ marginTop: '0px' }}>
            <div className="progress-track" style={{ marginBottom: '4px' }}>
              <div className={`progress-fill ${totalFiles === 0 ? 'indeterminate' : ''}`}
                   style={{ width: `${Math.max(progress * 100, 2)}%` }} />
            </div>
            {totalFiles > 0 && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)', marginTop: '2px', textAlign: 'right' }}>
                {processedFiles}/{totalFiles} files
              </div>
            )}
          </div>
        )}
      </div>

      {/* Chat Messages + Diffs Area */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--surface-0)' }}>
        <div style={{ padding: '12px', flex: 1 }}>

          {chatMessages.length === 0 && !lastResult && (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 'var(--font-size-sm)', textAlign: 'center', padding: '20px' }}>
              How can I help you improve<br/>this codebase today?
            </div>
          )}

          {chatMessages.map((msg, i) => (
            <div key={i} style={{ marginBottom: '10px', display: 'flex', gap: '8px' }}>
              <div style={{
                width: '22px', height: '22px', borderRadius: '4px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: msg.role === 'user' ? 'rgba(0,212,255,0.15)' :
                             msg.role === 'assistant' ? 'rgba(255,140,66,0.15)' :
                             'var(--surface-2)'
              }}>
                {msg.role === 'user' && <Send size={11} color="var(--accent-cyan)" />}
                {msg.role === 'assistant' && <Bot size={12} color="var(--accent-orange)" />}
                {msg.role === 'system' && <Loader size={11} color="var(--text-dim)" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: '9px', color: 'var(--text-dim)', marginBottom: '2px',
                  textTransform: 'uppercase', letterSpacing: '0.5px'
                }}>
                  {msg.role === 'user' ? 'YOU' : msg.role === 'assistant' ? 'GEX AGENT' : 'SYSTEM'}
                  <span style={{ marginLeft: '8px', opacity: 0.5 }}>
                    {msg.time.toLocaleTimeString('en-US', { hour12: false, hour:'2-digit', minute:'2-digit', second:'2-digit' })}
                  </span>
                </div>
                <div style={{
                  fontSize: 'var(--font-size-sm)',
                  color: msg.role === 'system' ? 'var(--text-muted)' : 'var(--text-primary)',
                  padding: msg.role === 'assistant' ? '8px' : '4px 0',
                  background: msg.role === 'assistant' ? 'var(--surface-1)' : 'transparent',
                  border: msg.role === 'assistant' ? '1px solid var(--border-subtle)' : 'none',
                  borderRadius: 'var(--radius-sm)',
                  whiteSpace: 'pre-wrap',
                  fontStyle: msg.role === 'system' ? 'italic' : 'normal',
                  lineHeight: '1.5'
                }}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {/* Render Diff Viewer when we have results */}
          {lastResult && lastResult.diff && lastResult.diff.hunks && lastResult.diff.hunks.length > 0 && (
            <div style={{ marginTop: '12px' }}>
              <div style={{ marginBottom: '8px', display: 'flex', gap: '8px' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '4px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,230,138,0.15)' }}>
                  <Bot size={12} color="var(--accent-green)" />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    DIFF — {lastResult.file?.split(/[/\\]/).pop() || 'result'}
                  </div>
                  <div style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-sm)', padding: '8px', border: '1px solid var(--border-subtle)' }}>
                    <CircuitDiffViewer />
                  </div>
                </div>
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input / Control Area (Bottom) */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-0)', padding: '12px' }}>
        <div style={{ position: 'relative', marginBottom: '8px' }}>
          <textarea
            className="input"
            disabled={isRunning}
            placeholder={isRunning ? 'Agent is thinking...' : "What should we build or fix? (e.g. 'add a SHOP nav item')"}
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (activeFile) handleRunFile();
                else if (repo) handleRunRepo();
              }
            }}
            style={{
              minHeight: '80px',
              paddingRight: '36px',
              resize: 'none',
              background: 'var(--surface-1)'
            }}
          />
          {isRunning && (
            <div style={{ position: 'absolute', right: '10px', top: '10px' }}>
              <Loader size={16} color="var(--accent-cyan)" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className="btn btn-primary"
            onClick={handleRunFile}
            disabled={isRunning || !activeFile || !focus.trim()}
            style={{ flex: 1 }}
            title={!activeFile ? "Select a file from the Explorer first" : "Send instruction targeted at active file"}
          >
            <Send size={13} style={{ marginRight: '4px' }} /> File
          </button>
          <button
            className="btn btn-cyan"
            onClick={handleRunRepo}
            disabled={isRunning || !repo || !focus.trim()}
            style={{ flex: 1 }}
            title={!repo ? "Wait for workspace to load" : "Send instruction to search entire repository"}
          >
            <Microscope size={13} style={{ marginRight: '4px' }} /> Repo
          </button>
        </div>

        {!activeFile && repo && (
          <div style={{ fontSize: '10px', color: 'var(--accent-orange)', marginTop: '8px', textAlign: 'center' }}>
            Click a file in the File Tree to target it, or use Repo mode.
          </div>
        )}

        {/* Download */}
        {repo && lastResult && lastResult.status === 'patched' && (
          <div style={{ marginTop: '12px' }}>
            <button
              className="btn btn-green btn-sm"
              onClick={() => window.open(`${API_BASE}/repo/download?path=${encodeURIComponent(repo.path)}`)}
              style={{ width: '100%' }}
            >
              <Download size={13} /> DOWNLOAD PATCHED ZIP
            </button>
          </div>
        )}
      </div>

    </div>
  );
}
