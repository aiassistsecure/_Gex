/**
 * RunPanel (Agentic Chat UI) v2.0.0
 * Converts the old targeting engine into a conversational IDE interface
 */
import { useState } from 'react';
import { Zap, Microscope, Download, Send, Bot, User } from 'lucide-react';
import useGexStore from '../store/useGexStore';
import { runFile, runRepo } from '../services/api';
import CircuitDiffViewer from './CircuitDiffViewer';
import { API_BASE } from '../services/api';

export default function RunPanel() {
  const [focus, setFocus] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const {
    repo,
    activeFile,
    runState,
    progress,
    totalFiles,
    processedFiles,
    lastResult,
    startRun,
    completeRun,
    failRun,
    addLog,
  } = useGexStore();

  const handleRunFile = async () => {
    if (!activeFile) return;

    setIsRunning(true);
    addLog(`[scan] Targeting: ${activeFile}`, 'info');
    startRun(null, 1);

    try {
      const result = await runFile(repo.path, activeFile, focus || null);
      addLog(`[ok] Run completed: ${result.run_id}`, 'info');
      completeRun();
    } catch (err) {
      addLog(`[err] ${err.message}`, 'error');
      failRun(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRunRepo = async () => {
    if (!repo) return;

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

      {/* Chat / Diffs Area */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--surface-0)' }}>
        <div style={{ padding: '12px', flex: 1 }}>
          {/* We will eventually render real Chat messages here. For now, we render the agent's last result output to fulfill the structure. */}
          {lastResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ width: '24px', height: '24px', borderRadius: '4px', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Bot size={14} color="var(--accent-orange)" />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '10px', color: 'var(--text-dim)', marginBottom: '4px' }}>GEX AGENT</div>
                  
                  {lastResult.llm_analysis && (
                    <div style={{
                      fontSize: 'var(--font-size-sm)', color: 'var(--text-primary)',
                      padding: '10px', background: 'var(--surface-1)', borderRadius: 'var(--radius-sm)',
                      marginBottom: '8px', whiteSpace: 'pre-wrap', border: '1px solid var(--border-subtle)'
                    }}>
                      {lastResult.llm_analysis}
                    </div>
                  )}

                  <div style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-sm)', padding: '8px', border: '1px solid var(--border-subtle)' }}>
                     <CircuitDiffViewer />
                  </div>
                </div>
              </div>

            </div>
          )}

          {!lastResult && (
            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-dim)', fontSize: 'var(--font-size-sm)', textAlign: 'center', padding: '20px' }}>
              How can I help you improve<br/>this codebase today?
            </div>
          )}
        </div>
      </div>

      {/* Input / Control Area (Moved to bottom) */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-0)', padding: '12px' }}>
        
        <div style={{ position: 'relative', marginBottom: '8px' }}>
          <textarea
            className="input"
            disabled={isRunning}
            placeholder="What should we build or fix? (e.g. 'Fix the auth bug in app.py')"
            value={focus}
            onChange={(e) => setFocus(e.target.value)}
            style={{ 
              minHeight: '80px', 
              paddingRight: '36px', 
              resize: 'none',
              background: 'var(--surface-1)'
            }}
          />
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

        {/* Global Action / Fallback */}
        {repo && lastResult && (
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
