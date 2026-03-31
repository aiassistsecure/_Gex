/**
 * RunPanel — Run controls, progress, logs, and diff summary
 */
import { useState } from 'react';
import useGexStore from '../store/useGexStore';
import { runFile, runRepo } from '../services/api';
import CircuitDiffViewer from './CircuitDiffViewer';
import './CircuitDiffViewer.css';

export default function RunPanel() {
  const {
    repo, activeFile, runState, progress, processedFiles, totalFiles,
    currentRunFile, lastResult, logs,
    addLog, setLastResult, setRunState, startRun, completeRun, failRun, resetRun,
  } = useGexStore();
  const [focus, setFocus] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const handleRunFile = async () => {
    if (!repo || !activeFile) {
      addLog('Select a repo and file first', 'error');
      return;
    }

    setIsRunning(true);
    setRunState('running');
    addLog(`[⚡] Running Gex on: ${activeFile.split(/[\\/]/).pop()}`, 'info');

    try {
      const result = await runFile(repo.path, activeFile, focus || null);
      setLastResult(result);
      setRunState('completed');

      if (result.status === 'patched') {
        addLog(`[+] ${result.blocks_applied} patch(es) generated (ready for review)`, 'success');
      } else if (result.status === 'unchanged') {
        addLog('[-] No changes needed — code looks good', 'dim');
      } else if (result.status === 'error') {
        addLog(`[x] Error: ${result.error}`, 'error');
      }
    } catch (err) {
      addLog(`[x] Failed: ${err.message}`, 'error');
      setRunState('failed');
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunRepo = async () => {
    if (!repo) {
      addLog('Load a repo first', 'error');
      return;
    }

    setIsRunning(true);
    addLog(`[🔬] Starting full repo scan: ${repo.name}`, 'info');
    startRun(null, 0);

    try {
      const result = await runRepo(repo.path, focus || null);
      addLog(`[📡] Repo run started: ${result.run_id}`, 'info');
      // In production this would connect via WebSocket for real-time updates
      completeRun();
    } catch (err) {
      addLog(`[x] Repo run failed: ${err.message}`, 'error');
      failRun(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="right-panel">
      {/* Run State */}
      <div className="panel-header" style={{ marginBottom: '0', paddingBottom: '0', borderBottom: 'none' }}>
        <span className="panel-title">Run Engine</span>
        <span className={`run-state ${runState}`}>
          {runState === 'idle' && '◌ IDLE'}
          {runState === 'running' && '◉ RUNNING'}
          {runState === 'completed' && '✓ DONE'}
          {runState === 'failed' && '✕ FAILED'}
        </span>
      </div>

      {/* Focus input */}
      <input
        className="form-input"
        placeholder="Focus area (e.g. 'fix auth bug', 'optimize queries')"
        value={focus}
        onChange={(e) => setFocus(e.target.value)}
        style={{ fontSize: '0.75rem', marginBottom: '4px' }}
      />

      {/* Run controls */}
      <div className="run-controls">
        <button
          className="btn btn-primary"
          onClick={handleRunFile}
          disabled={isRunning || !activeFile}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg> SCAN FILE
        </button>
        <button
          className="btn btn-copper"
          onClick={handleRunRepo}
          disabled={isRunning || !repo}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg> SCAN REPO
        </button>
      </div>

      {/* Progress bar */}
      {runState === 'running' && (
        <div className="progress-container fade-in">
          <div className="progress-label">
            <span>{currentRunFile || 'Initializing...'}</span>
            <span>{Math.round(progress * 100)}%</span>
          </div>
          <div className="progress-bar-track">
            <div className="progress-bar-fill" style={{ width: `${Math.max(progress * 100, 2)}%` }} />
          </div>
          {totalFiles > 0 && (
            <div className="progress-label" style={{ marginTop: '4px' }}>
              <span>{processedFiles}/{totalFiles} files</span>
            </div>
          )}
        </div>
      )}

      <div className="trace-divider" />

      {/* Circuit Diff Viewer (motherboard chipset hunks) */}
      <CircuitDiffViewer />

      {/* LLM Analysis */}
      {lastResult?.llm_analysis && (
        <details style={{ marginTop: '6px' }}>
          <summary style={{
            fontSize: '0.7rem',
            color: 'var(--text-muted)',
            cursor: 'pointer',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            marginBottom: '6px',
          }}>
            LLM Analysis
          </summary>
          <div className="llm-analysis">
            {lastResult.llm_analysis}
          </div>
        </details>
      )}

      <div className="trace-divider" />

      {/* Logs */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
        <span className="panel-title" style={{ fontSize: '0.65rem' }}>LOGS</span>
        <button className="btn btn-sm" onClick={() => useGexStore.getState().clearLogs()}>Clear</button>
      </div>
      <div className="log-output">
        {logs.length === 0 ? (
          <span style={{ color: 'var(--text-muted)' }}>Waiting for operations...</span>
        ) : (
          logs.map((log, i) => (
            <div key={i} className={`log-line ${log.level}`}>
              <span style={{ opacity: 0.4, marginRight: '6px' }}>
                {new Date(log.time).toLocaleTimeString()}
              </span>
              {log.message}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
