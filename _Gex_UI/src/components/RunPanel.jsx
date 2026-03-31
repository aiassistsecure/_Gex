/**
 * RunPanel (Agentic Chat UI) v2.2.0
 * Supports Unified Agentic Repo Scans.
 * Renders multiple diff cards and live tool logs in the chat history.
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
    startRun,
    completeRun,
    failRun,
    addLog,
    setLastResult,
    setResults,
    updateRunProgress,
    results: storeResults,
  } = useGexStore();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const addChat = (role, content) => {
    setChatMessages(prev => [...prev, { role, content, time: new Date() }]);
  };

  // ── File Run (synchronous) ──
  const handleRunFile = async () => {
    if (!activeFile) return;
    const instruction = focus.trim();
    if (!instruction) return;

    setIsRunning(true);
    setFocus('');
    addChat('user', instruction);
    addChat('system', `Targeting file: ${activeFile.split(/[/\\]/).pop()}`);
    startRun(null, 1);

    try {
      const result = await runFile(repo.path, activeFile, instruction);
      setLastResult(result);
      
      if (result.tool_steps) {
        result.tool_steps.forEach(step => addChat('tool', step));
      }

      if (result.status === 'patched') {
        addChat('assistant', result.llm_analysis || 'Changes generated. Review the diff below.');
      } else if (result.status === 'unchanged') {
        addChat('assistant', result.llm_analysis || 'No changes needed — code looks correct.');
      } else {
        addChat('assistant', `Error: ${result.error || 'Analysis failed.'}`);
      }
      completeRun();
    } catch (err) {
      addChat('assistant', `Error: ${err.message}`);
      failRun(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  // ── Repo Run (Agentic Single Session) ──
  const handleRunRepo = async () => {
    if (!repo) return;
    const instruction = focus.trim();
    if (!instruction) return;

    setIsRunning(true);
    setFocus('');
    addChat('user', instruction);
    addChat('system', `Starting agentic repo scan: ${repo.name}`);
    startRun(null, 0);

    try {
      const { run_id } = await runRepo(repo.path, instruction);
      addChat('system', `Agent is exploring the codebase...`);

      let attempts = 0;
      let lastToolIdx = 0;

      while (attempts < 150) {
        await new Promise(r => setTimeout(r, 2000));
        attempts++;

        const status = await getRunStatus(run_id);
        
        // Show tool steps as they appear in 'current_file' (which we use as a log stream)
        if (status.current_file && status.current_file.startsWith('[TOOL]')) {
           // We'll avoid duplicates by checking the last message
           setChatMessages(prev => {
             if (prev[prev.length-1]?.content !== status.current_file) {
               return [...prev, { role: 'tool', content: status.current_file, time: new Date() }];
             }
             return prev;
           });
        }

        if (status.state === 'completed' || status.state === 'failed') {
          if (status.state === 'failed') {
            addChat('assistant', `Scan failed: ${status.error}`);
            failRun(status.error);
            break;
          }

          const results = status.results || [];
          setResults(results);
          
          const patched = results.filter(r => r.status === 'patched');
          const errors = results.filter(r => r.status === 'error');
          
          if (patched.length > 0) {
            addChat('assistant', `Agent concluded thinking. Found ${patched.length} file(s) to modify.\n\n${patched[0].llm_analysis || ''}`);
          } else if (errors.length > 0) {
            const firstErr = errors[0].error || 'Analysis failed.';
            addChat('assistant', `Agent encountered errors in ${errors.length} file(s). First error: ${firstErr}`);
          } else {
            addChat('assistant', `Agent explored the repo and concluded that no changes are required.`);
          }

          completeRun();
          break;
        }
      }
    } catch (err) {
      addChat('assistant', `Error: ${err.message}`);
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
          <span className="panel-label">Agentic IDE (v2.2)</span>
          <span className={`run-indicator ${runState}`}>
            {runState === 'idle' && 'IDLE'}
            {runState === 'running' && 'THINKING'}
            {runState === 'completed' && 'DONE'}
            {runState === 'failed' && 'FAILED'}
          </span>
        </div>

        {runState === 'running' && (
          <div className="progress-track" style={{ marginTop: '4px' }}>
            <div className="progress-fill indeterminate" style={{ width: '100%' }} />
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', background: 'var(--surface-0)' }}>
        <div style={{ padding: '12px', flex: 1 }}>

          {chatMessages.length === 0 && (
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
                             msg.role === 'tool' ? 'rgba(167,139,250,0.15)' : 'var(--surface-2)'
              }}>
                {msg.role === 'user' && <Send size={11} color="var(--accent-cyan)" />}
                {msg.role === 'assistant' && <Bot size={12} color="var(--accent-orange)" />}
                {msg.role === 'tool' && <Microscope size={11} color="var(--accent-purple)" />}
                {msg.role === 'system' && <Loader size={11} color="var(--text-dim)" />}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginBottom: '2px', textTransform: 'uppercase' }}>
                  {msg.role === 'user' ? 'YOU' : msg.role === 'assistant' ? 'GEX AGENT' : msg.role === 'tool' ? 'TOOL' : 'SYSTEM'}
                </div>
                <div style={{
                  fontSize: 'var(--font-size-sm)',
                  color: msg.role === 'tool' ? 'var(--accent-purple)' : msg.role === 'system' ? 'var(--text-muted)' : 'var(--text-primary)',
                  padding: msg.role === 'assistant' ? '10px' : msg.role === 'tool' ? '4px 8px' : '0',
                  background: msg.role === 'assistant' ? 'var(--surface-1)' : msg.role === 'tool' ? 'rgba(167,139,250,0.05)' : 'transparent',
                  border: msg.role === 'assistant' ? '1px solid var(--border-subtle)' : 'none',
                  borderRadius: 'var(--radius-sm)',
                  whiteSpace: 'pre-wrap',
                  fontFamily: msg.role === 'tool' ? 'var(--font-mono)' : 'inherit',
                }}>
                  {msg.content}
                </div>
              </div>
            </div>
          ))}

          {/* Render Multi-Diffs */}
          {runState === 'completed' && storeResults?.filter(r => r.status === 'patched').map((res, i) => (
            <div key={i} style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '4px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,230,138,0.15)' }}>
                <Bot size={12} color="var(--accent-green)" />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '9px', color: 'var(--text-dim)', marginBottom: '4px', textTransform: 'uppercase' }}>
                   PATCH — {res.file}
                </div>
                <div style={{ background: 'var(--surface-1)', borderRadius: 'var(--radius-sm)', padding: '8px', border: '1px solid var(--border-subtle)' }}>
                   <CircuitDiffViewer result={res} />
                </div>
              </div>
            </div>
          ))}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Area */}
      <div style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--surface-0)', padding: '12px' }}>
        <textarea
          className="input"
          disabled={isRunning}
          placeholder="e.g. 'Add a Shop navigation item to the UI'"
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (activeFile ? handleRunFile() : handleRunRepo())}
          style={{ minHeight: '80px', resize: 'none', background: 'var(--surface-1)', marginBottom: '8px' }}
        />

        <div style={{ display: 'flex', gap: '6px' }}>
          <button className="btn btn-primary" onClick={handleRunFile} disabled={isRunning || !activeFile || !focus.trim()} style={{ flex: 1 }}>
            <Send size={13} style={{ marginRight: '4px' }} /> File
          </button>
          <button className="btn btn-cyan" onClick={handleRunRepo} disabled={isRunning || !repo || !focus.trim()} style={{ flex: 1 }}>
            <Microscope size={13} style={{ marginRight: '4px' }} /> Repo
          </button>
        </div>
      </div>
    </div>
  );
}
