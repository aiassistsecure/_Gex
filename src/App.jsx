/**
 * _Gex — Root Application
 * AI-native code surgery environment
 */
import { useState } from 'react';
import './index.css';
import useGexStore from './store/useGexStore';
import { loadRepo, API_BASE } from './services/api';
import FileTree from './components/FileTree';
import EditorPanel from './components/EditorPanel';
import RunPanel from './components/RunPanel';
import SettingsPanel from './components/SettingsPanel';
import TosModal from './components/TosModal';

export default function App() {
  const { repo, setRepo, setShowSettings, addLog } = useGexStore();
  const [repoPath, setRepoPath] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLoadRepo = async () => {
    if (!repoPath.trim()) return;

    setLoading(true);
    addLog(`📂 Loading repo: ${repoPath}`, 'info');

    try {
      const result = await loadRepo(repoPath.trim());
      setRepo(result);
      addLog(`✅ Loaded ${result.name} — ${result.file_count} source files`, 'success');
    } catch (err) {
      addLog(`❌ Failed to load repo: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') handleLoadRepo();
  };

  return (
    <>
      {/* Background layers */}
      <div className="bg-aurora" />
      <div className="bg-pcb-grid" />

      {/* ── Cyber-Gecko Loading Overlay ── */}
      {loading && (
        <div className="gecko-loading-overlay">
          <div className="gecko-logo-container">
            <img src="/gex-gecko.png" alt="Scanning..." className="gecko-logo-image" />
          </div>
          <div className="gecko-loading-text">Cloning Repository...</div>
        </div>
      )}

      <div className="app-root">
        {/* ── Top Bar ── */}
        <header className="topbar glass">
          <div className="topbar-brand">
            <div className="chip-icon">
              <img src="/gex-gecko.png" alt="_Gex" style={{ width: '22px', height: '22px', borderRadius: '4px', border: '1px solid var(--signal-cyan)' }} />
            </div>
            <div>
              <h1>_Gex</h1>
            </div>
            <span className="version">v0.1.0</span>
          </div>

          <div className="topbar-actions">
            <input
              className="form-input"
              placeholder="Enter GitHub URL (e.g. https://github.com/...)"
              value={repoPath}
              onChange={(e) => setRepoPath(e.target.value)}
              onKeyDown={handleKeyPress}
              style={{ width: '320px', fontSize: '0.78rem' }}
            />
            <button
              className="btn btn-primary"
              onClick={handleLoadRepo}
              disabled={loading || !repoPath.trim()}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentcolor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: '6px' }}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
              {loading ? '[ CLONING ]' : '[ LOAD REPO ]'}
            </button>
            <button className="btn btn-icon" onClick={() => setShowSettings(true)} title="Settings" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            </button>
          </div>
        </header>

        {/* ── Main 3-Panel Layout ── */}
        <main className="main-layout">
          {/* Left: File Explorer */}
          <aside className="panel glass">
            <div className="panel-header" style={{ display: 'flex', flexWrap: 'nowrap', gap: '8px', overflow: 'hidden' }}>
              <span className="panel-title" style={{ flexShrink: 0 }}>Explorer</span>
              {repo && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', minWidth: 0 }}>
                  <span className="panel-subtitle" title={repo.path} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, display: 'block' }}>
                    {repo.name.substring(0, repo.name.lastIndexOf('_')) || repo.name}
                  </span>
                  <button
                    className="btn"
                    title="Download Patched ZIP"
                    onClick={() => window.open(`${API_BASE}/repo/download?path=${encodeURIComponent(repo.path)}`)}
                    style={{ fontSize: '0.7rem', padding: '2px 6px', height: '22px', minHeight: 'unset', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg> ZIP
                  </button>
                </div>
              )}
            </div>
            <FileTree />
          </aside>

          {/* Center: Editor / Diff */}
          <section style={{ display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
            <EditorPanel />
          </section>

          {/* Right: Run Panel */}
          <aside className="panel glass" style={{ overflow: 'auto' }}>
            <RunPanel />
          </aside>
        </main>

        {/* ── Footer ── */}
        <footer style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '8px 24px',
          fontSize: '0.75rem',
          color: 'var(--text-muted)',
          background: 'rgba(4, 8, 16, 0.4)',
          borderTop: '1px solid var(--panel-border)',
          fontFamily: "'JetBrains Mono', monospace"
        }}>
          <div>
            _Gex is open-source software. <a href="https://github.com/aiassistsecure/_Gex" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--signal-cyan)', textDecoration: 'none' }}>View source on GitHub</a>.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', opacity: 0.8 }}>
            Powered by
            <a href="https://aiassistsecure.com/" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--signal-cyan)', textDecoration: 'none' }}>
              <img src="https://aiassist.net/favicon.png" alt="AiAssist" style={{ width: '14px', height: '14px', borderRadius: '2px' }} />
              <span style={{ fontWeight: '700', color: '#fff', letterSpacing: '0.5px' }}>
                AiAssist <span style={{ color: 'var(--copper)' }}>SECURE</span>
              </span>
            </a>
          </div>
        </footer>
      </div>

      {/* Settings modal */}
      <SettingsPanel />

      {/* TOS modal */}
      <TosModal />
    </>
  );
}
