import { useState, useCallback, useEffect } from 'react';
import './index.css';
import useGexStore from './store/useGexStore';
import { loadRepo, getWorkspace, geneCLI, getSettings } from './services/api';
import { Play, Package, Info } from 'lucide-react';
import ActivityBar from './components/ActivityBar';
import FileTree from './components/FileTree';
import EditorPanel from './components/EditorPanel';
import RunPanel from './components/RunPanel';
import StatusBar from './components/StatusBar';
import CommandPalette from './components/CommandPalette';
import SettingsPanel from './components/SettingsPanel';
import TerminalPanel from './components/TerminalPanel';
import JennyOnboarding from './components/JennyOnboarding';

export default function App() {
  const { repo, setRepo, addLog, showSettings } = useGexStore();
  const [repoPath, setRepoPath]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [activeView, setActiveView] = useState('explorer');
  const [showCommand, setShowCommand] = useState(false);
  const [cliRunning, setCliRunning] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Resizable layout state
  const [sidebarWidth, setSidebarWidth] = useState(240);
  const [rightPanelWidth, setRightPanelWidth] = useState(360);
  const [terminalHeight, setTerminalHeight] = useState(220);

  // Resize Handlers
  const startResizing = useCallback((type) => (e) => {
    e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;

    const startSidebar = sidebarWidth;
    const startRight = rightPanelWidth;
    const startTerm = terminalHeight;

    const onMouseMove = (moveEvent) => {
      if (type === 'sidebar') {
        setSidebarWidth(Math.max(160, Math.min(600, startSidebar + (moveEvent.clientX - startX))));
      } else if (type === 'rightPanel') {
        setRightPanelWidth(Math.max(280, Math.min(900, startRight - (moveEvent.clientX - startX))));
      } else if (type === 'terminal') {
        setTerminalHeight(Math.max(100, Math.min(800, startTerm - (moveEvent.clientY - startY))));
      }
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = 'default';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);

    if (type === 'terminal') document.body.style.cursor = 'row-resize';
    else document.body.style.cursor = 'col-resize';
  }, [sidebarWidth, rightPanelWidth, terminalHeight]);


  // Auto-load workspace from jenny dev + check BYOK
  useEffect(() => {
    (async () => {
      // localStorage is the reliable signal — backend can restart cold
      const onboarded = localStorage.getItem('jenny_onboarded');
      if (!onboarded) {
        try {
          const settings = await getSettings();
          if (!settings?.api_key_set) {
            setShowOnboarding(true);
          } else {
            localStorage.setItem('jenny_onboarded', '1');
          }
        } catch { setShowOnboarding(true); }
      }

      try {
        const ws = await getWorkspace();
        if (ws.workspace && ws.exists) {
          addLog(`Jenny workspace detected: ${ws.workspace}`, 'info');
          setRepoPath(ws.workspace);
          handleLoadRepo(ws.workspace);
        }
      } catch { /* not launched via jenny dev */ }
    })();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommand(v => !v);
      }
      if (e.key === 'Escape') setShowCommand(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleLoadRepo = useCallback(async (path) => {
    const target = path || repoPath;
    if (!target.trim()) return;

    setLoading(true);
    addLog(`Loading: ${target}`, 'info');

    try {
      const result = await loadRepo(target.trim());
      setRepo(result);
      addLog(`Loaded ${result.name} -- ${result.file_count} files (${result.source})`, 'success');
    } catch (err) {
      addLog(`Failed: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [repoPath, addLog, setRepo]);

  const handleCLI = useCallback(async (action) => {
    setCliRunning(action);
    addLog(`[jenny ${action}] Starting...`, 'info');
    try {
      const result = await geneCLI(action);
      if (result.exit_code === 0) {
        addLog(`[jenny ${action}] Complete`, 'success');
        // Show only the last meaningful line of stdout (skip PyInstaller noise)
        if (result.stdout) {
          const lines = result.stdout.trim().split('\n').filter(l => l.trim() && !l.includes('pip install') && !l.includes('Try running') && !l.includes('Make sure'));
          if (lines.length) addLog(lines[lines.length - 1].trim(), 'dim');
        }
      } else {
        addLog(`[jenny ${action}] Failed (exit ${result.exit_code})`, 'error');
        if (result.stderr) addLog(result.stderr.split('\n').filter(l => l.trim()).slice(-3).join(' | '), 'error');
      }
    } catch (err) {
      addLog(`[jenny ${action}] Error: ${err.message}`, 'error');
    } finally {
      setCliRunning(null);
    }
  }, [addLog]);

  return (
    <div className="app-shell">
      {/* Jenny BYOK Onboarding — first launch only */}
      {showOnboarding && (
        <JennyOnboarding onComplete={() => setShowOnboarding(false)} />
      )}
      {/* Title Bar */}
      <header className="titlebar">
        <div className="titlebar-brand">
          <img src="/jenny-logo.png" alt="AiAssist" style={{ width: '20px', height: '20px', borderRadius: '4px', marginRight: '8px' }} onError={e => e.target.style.display='none'} />
          <h1>_Gex &amp; Jenny</h1>
          <span className="version">by AiAssist SECURE</span>
          {repo && (
            <span style={{
              fontSize: 'var(--font-size-xs)', color: 'var(--accent-orange)',
              padding: '1px 8px', background: 'rgba(255,140,66,0.1)',
              border: '1px solid rgba(255,140,66,0.2)', borderRadius: '3px',
              marginLeft: '8px',
            }}>
              {(repo.name || '')}
            </span>
          )}
        </div>

        <div className="titlebar-center">
          <button className="command-trigger" onClick={() => setShowCommand(true)}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <span>Search or run a command...</span>
            <kbd>Ctrl+K</kbd>
          </button>
        </div>

        <div className="titlebar-actions">
          <input
            className="input input-sm"
            placeholder="repo path or GitHub URL"
            value={repoPath}
            onChange={(e) => setRepoPath(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleLoadRepo()}
            style={{ width: '240px' }}
          />
          <button className="btn btn-primary btn-sm" onClick={() => handleLoadRepo()}
                  disabled={loading || !repoPath.trim()}>
            {loading ? 'LOADING...' : 'LOAD'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="main-layout">
        <ActivityBar active={activeView} onSelect={setActiveView} />

        <div className="sidebar" style={{ width: sidebarWidth, minWidth: sidebarWidth }}>
          <div className="sidebar-header">
            <span className="sidebar-title">
              {activeView === 'explorer' && 'Explorer'}
              {activeView === 'search' && 'Search'}
              {activeView === 'jenny' && 'Jenny CLI'}
            </span>
          </div>
          <div className="sidebar-content">
            {activeView === 'explorer' && <FileTree />}
            {activeView === 'search' && (
              <div style={{ padding: '12px' }}>
                <input className="input input-sm" placeholder="Search in files..." />
              </div>
            )}
            {activeView === 'jenny' && (
              <div style={{ padding: '12px' }}>
                <div style={{ marginBottom: '14px' }}>
                  <span className="panel-label">Project Actions</span>
                </div>

                <button className="btn btn-primary" style={{ width: '100%', marginBottom: '6px' }}
                  onClick={() => handleCLI('build')} disabled={!!cliRunning}>
                  <Play size={13} /> {cliRunning === 'build' ? 'Building...' : 'jenny build'}
                </button>

                <button className="btn btn-cyan" style={{ width: '100%', marginBottom: '6px' }}
                  onClick={() => handleCLI('package')} disabled={!!cliRunning}>
                  <Package size={13} /> {cliRunning === 'package' ? 'Packaging...' : 'jenny package'}
                </button>

                <button className="btn" style={{ width: '100%', marginBottom: '16px' }}
                  onClick={() => handleCLI('info')} disabled={!!cliRunning}>
                  <Info size={13} /> jenny info
                </button>

                <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px' }}>
                  <span className="panel-label">Workspace</span>
                  <div style={{
                    fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)',
                    marginTop: '6px', wordBreak: 'break-all',
                  }}>
                    {repo ? repo.path : 'No project loaded'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        <div className="resize-handle" onMouseDown={startResizing('sidebar')} />

        <div className="center-area">
          <div className="editor-split">
            <div className="editor-pane">
              <EditorPanel />
            </div>
          </div>
          <TerminalPanel height={terminalHeight} onResizeStart={startResizing('terminal')} />
        </div>

        <div className="resize-handle" onMouseDown={startResizing('rightPanel')} />

        <div className="right-panel-wrapper" style={{ width: rightPanelWidth, minWidth: rightPanelWidth, display: 'flex', flexDirection: 'column' }}>
           <RunPanel />
        </div>
      </div>

      <StatusBar />

      {showCommand && <CommandPalette onClose={() => setShowCommand(false)} onLoadRepo={handleLoadRepo} onCLI={handleCLI} />}
      {showSettings && <SettingsPanel />}
    </div>
  );
}
