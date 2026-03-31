/**
 * RunPanel (Agentic Chat UI) v2.2.0
 * Supports Unified Agentic Repo Scans.
 * Renders multiple diff cards and live tool logs in the chat history.
 */
import { useState, useRef, useEffect } from 'react';
import { Microscope, Download, Send, Bot, Loader } from 'lucide-react';
import useGexStore from '../store/useGexStore';
import { runFile, runRepo, getRunStatus } from '../services/api';
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
    setActiveFile,
    setEditorMode,
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
        if (result.before !== undefined) {
          setActiveFile(activeFile, result.before);
        }
        setEditorMode('patches');
        addChat('assistant', result.llm_analysis || 'Changes generated — review them in the PATCHES tab.');
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
      addChat('system', 'Agent is exploring the codebase...');

      await new Promise((resolve, reject) => {
        const ws = new WebSocket(`ws://localhost:8000/api/run/ws/${run_id}/stream`);

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);

          if (msg.type === 'tool_step') {
            // Real-time tool call — stream each one as it fires
            addChat('tool', msg.message);

          } else if (msg.type === 'file_update') {
            // A file result is ready — update progress
            updateRunProgress(msg.progress ?? 0);

          } else if (msg.type === 'run_complete') {
            const state = msg.state;
            if (state === 'failed') {
              addChat('assistant', `Scan failed: ${msg.error || 'Unknown error'}`);
              failRun(msg.error);
              ws.close();
              resolve();
              return;
            }

            // Fetch the full results once complete
            getRunStatus(run_id).then(status => {
              const results = status.results || [];
              setResults(results);

              const patched = results.filter(r => r.status === 'patched');
              const errors  = results.filter(r => r.status === 'error');

              if (patched.length > 0) {
                const first = patched[0];
                const fullPath = `${repo.path}/${first.file}`.replace(/[\\/]+/g, '/');
                if (first.before !== undefined) setActiveFile(fullPath, first.before);
                setEditorMode('patches');
                addChat('assistant',
                  `Agent concluded. ${patched.length} file(s) ready for review in PATCHES tab.` +
                  (patched.length > 1 ? `\n\nFiles: ${patched.map(r => r.file).join(', ')}` : '')
                );
              } else if (errors.length > 0) {
                addChat('assistant', `Agent encountered errors in ${errors.length} file(s). First: ${errors[0].error}`);
              } else {
                addChat('assistant', 'Agent explored the repo — no changes required.');
              }

              completeRun();
              resolve();
            }).catch(reject);

            ws.close();

          } else if (msg.type === 'error') {
            addChat('assistant', `Stream error: ${msg.message}`);
            failRun(msg.message);
            ws.close();
            resolve();
          }
        };

        ws.onerror = (e) => {
          addChat('assistant', 'WebSocket error — check backend.');
          failRun('WebSocket error');
          reject(e);
        };

        ws.onclose = () => {
          // If WS closes before run_complete (e.g. server restart), resolve gracefully
          resolve();
        };
      });

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
        <div className="panel-section-header" style={{ alignItems: 'center' }}>

          {/* Jenny Avatar — cycles states */}
          <div style={{ position: 'relative', width: '34px', height: '34px', flexShrink: 0 }}>
            {/* Spinning conic ring — always visible, intensity varies by state */}
            <div style={{
              position: 'absolute', inset: '-3px', borderRadius: '50%',
              background: runState === 'completed'
                ? 'conic-gradient(from 0deg, #6fbe44, #fca311, #6fbe44)'
                : 'conic-gradient(from 0deg, #e85d04, #f48c06, #dc2f02, #e85d04)',
              opacity: runState === 'running' ? 1 : 0.45,
              animation: runState === 'running' ? 'jenny-spin 1.5s linear infinite' : 'jenny-spin 6s linear infinite',
            }} />
            <img
              src={
                runState === 'completed' ? '/jenny-done.png'
                : runState === 'running'  ? '/jenny-working.png'
                : '/jenny-idle.png'
              }
              alt="Jenny"
              style={{
                width: '34px', height: '34px', borderRadius: '50%',
                objectFit: 'cover', position: 'relative', zIndex: 1,
                border: '2px solid var(--surface-1)',
                boxShadow: runState === 'running'
                  ? '0 0 14px 4px rgba(232,93,4,0.7)'
                  : runState === 'completed'
                    ? '0 0 14px 4px rgba(111,190,68,0.6)'
                    : '0 0 8px 2px rgba(232,93,4,0.35)',
                animation: runState === 'running'
                  ? 'jenny-pulse 1.2s ease-in-out infinite'
                  : runState === 'completed'
                    ? 'jenny-bounce 0.6s ease forwards'
                    : 'jenny-idle-breathe 3s ease-in-out infinite',
                transition: 'box-shadow 0.4s ease',
              }}
            />
          </div>


          <div style={{ flex: 1, marginLeft: '8px' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '0.5px' }}>Jenny</div>
            <div style={{ fontSize: '0.6rem', color: 'var(--text-dim)', marginTop: '1px' }}>by AiAssist SECURE</div>
          </div>

          <span className={`run-indicator ${runState}`}>
            {runState === 'idle'      && 'IDLE'}
            {runState === 'running'   && 'WORKING'}
            {runState === 'completed' && 'DONE'}
            {runState === 'failed'    && 'FAILED'}
          </span>
        </div>

        {runState === 'running' && (
          <div className="progress-track" style={{ marginTop: '6px' }}>
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
