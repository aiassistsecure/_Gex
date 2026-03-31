/**
 * RunPanel v1.0.0 -- Bloomberg Terminal-style run engine (no emojis)
 */
import { useState } from 'react';
import useGexStore from '../store/useGexStore';
import { runFile, runRepo, API_BASE } from '../services/api';
import CircuitDiffViewer from './CircuitDiffViewer';
import { Zap, Microscope, Download, X } from 'lucide-react';

export default function RunPanel() {
  const {
    repo, activeFile, runState, progress, processedFiles, totalFiles,
    lastResult, logs,
    addLog, setLastResult, setRunState, startRun, completeRun, failRun,
  } = useGexStore();

  const [focus, setFocus] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const handleRunFile = async () => {
    if (!repo || !activeFile) return addLog('Select a repo and file first', 'error');

    setIsRunning(true);
    setRunState('running');
    const name = activeFile.split(/[\\/]/).pop();
    addLog(`[scan] ${name}`, 'info');

    try {
      const result = await runFile(repo.path, activeFile, focus || null);
      setLastResult(result);
      setRunState('completed');

      if (result.status === 'patched') {
        addLog(`[ok] ${result.blocks_applied} patch(es) ready for review`, 'success');
      } else if (result.status === 'unchanged') {
        addLog('[--] No changes needed', 'dim');
      } else if (result.status === 'error') {
        addLog(`[err] ${result.error}`, 'error');
      }
    } catch (err) {
      addLog(`[err] ${err.message}`, 'error');
      setRunState('failed');
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunRepo = async () => {
    if (!repo) return addLog('Load a repo first', 'error');

    setIsRunning(true);
    addLog(`[scan] Full scan: ${repo.name}`, 'info');
    startRun(null, 0);

    try {
      const result = await runRepo(repo.path, focus || null);
      addLog(`[ok] Run started: ${result.run_id}`, 'info');
      completeRun();
    } catch (err) {
      addLog(`[err] ${err.message}`, 'error');
      failRun(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="right-panel">
      {/* Header */}
      <div className="panel-section">
        <div className="panel-section-header">
          <span className="panel-label">Run Engine</span>
          <span className={`run-indicator ${runState}`}>
            {runState === 'idle' && 'IDLE'}
            {runState === 'running' && 'RUNNING'}
            {runState === 'completed' && 'DONE'}
            {runState === 'failed' && 'FAILED'}
          </span>
        </div>

        <input
          className="input input-sm"
          placeholder="Focus: 'fix auth bug', 'optimize queries'..."
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          style={{ marginBottom: '6px' }}
        />

        <div style={{ display: 'flex', gap: '4px' }}>
          <button className="btn btn-primary" onClick={handleRunFile}
                  disabled={isRunning || !activeFile} style={{ flex: 1 }}>
            <Zap size={13} /> SCAN FILE
          </button>
          <button className="btn btn-cyan" onClick={handleRunRepo}
                  disabled={isRunning || !repo} style={{ flex: 1 }}>
            <Microscope size={13} /> SCAN REPO
          </button>
        </div>

        {runState === 'running' && (
          <div style={{ marginTop: '6px' }}>
            <div className="progress-track">
              <div className={`progress-fill ${totalFiles === 0 ? 'indeterminate' : ''}`}
                   style={{ width: `${Math.max(progress * 100, 2)}%` }} />
            </div>
            {totalFiles > 0 && (
              <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)', marginTop: '2px' }}>
                {processedFiles}/{totalFiles} files
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bloomberg Data Grid */}
      {lastResult && (
        <div className="panel-section">
          <span className="panel-label" style={{ marginBottom: '6px', display: 'block' }}>Last Run</span>
          <div className="data-grid">
            <div className="data-cell">
              <div className="data-cell-label">Status</div>
              <div className={`data-cell-value ${
                lastResult.status === 'patched' ? 'positive' :
                lastResult.status === 'error' ? 'negative' : ''
              }`}>
                {lastResult.status?.toUpperCase()}
              </div>
            </div>
            <div className="data-cell">
              <div className="data-cell-label">Patches</div>
              <div className="data-cell-value highlight">{lastResult.blocks_applied || 0}</div>
            </div>
            <div className="data-cell">
              <div className="data-cell-label">File</div>
              <div className="data-cell-value truncate" title={lastResult.file}>
                {lastResult.file?.split(/[\\/]/).pop()}
              </div>
            </div>
            <div className="data-cell">
              <div className="data-cell-label">Additions</div>
              <div className="data-cell-value positive">
                +{lastResult.diff?.total_additions || 0}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Download */}
      {repo && (
        <div className="panel-section" style={{ padding: '6px 12px' }}>
          <button
            className="btn btn-green btn-sm"
            onClick={() => window.open(`${API_BASE}/repo/download?path=${encodeURIComponent(repo.path)}`)}
            style={{ width: '100%' }}
          >
            <Download size={13} /> DOWNLOAD PATCHED ZIP
          </button>
        </div>
      )}

      {/* Diff Hunks */}
      <div className="panel-section" style={{ flex: 1, overflow: 'auto', borderBottom: 'none' }}>
        <CircuitDiffViewer />

        {lastResult?.llm_analysis && (
          <details style={{ marginTop: '8px' }}>
            <summary style={{
              fontSize: 'var(--font-size-xs)', color: 'var(--text-dim)',
              cursor: 'pointer', fontWeight: 600, textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              LLM Analysis
            </summary>
            <div style={{
              fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)',
              padding: '8px', background: 'var(--void)', borderRadius: 'var(--radius-xs)',
              marginTop: '4px', whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto',
            }}>
              {lastResult.llm_analysis}
            </div>
          </details>
        )}
      </div>

      {/* Logs */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '6px 12px 0' }}>
        <div className="flex items-center justify-between" style={{ marginBottom: '4px' }}>
          <span className="panel-label" style={{ fontSize: 'var(--font-size-xs)' }}>Terminal</span>
          <button className="btn btn-sm" onClick={() => useGexStore.getState().clearLogs()}>Clear</button>
        </div>
      </div>
      <div className="log-output" style={{ margin: '0 12px 8px', maxHeight: '150px', minHeight: '80px' }}>
        {logs.length === 0 ? (
          <span style={{ color: 'var(--text-dim)' }}>Waiting for operations...</span>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={`log-line ${log.level}`}>
              <span className="log-time">
                {new Date(log.time).toLocaleTimeString('en-US', { hour12: false })}
              </span>
              <span className="log-msg">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
